const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'grocery_db',
  port: 3307
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to grocery_db!');
});

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

async function createNotification(userId, title, message, type = 'info') {
  await query(
    `INSERT INTO notifications (userId, title, message, type, is_read)
     VALUES (?, ?, ?, ?, 0)`,
    [userId, title, message, type]
  );
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

app.post('/api/register', async (req, res) => {
  try {
    const { fullname, email, role, employee_id, password } = req.body;

    if (!fullname || !email || !role || !password) {
      return res.status(400).json({ message: 'Please fill in all required fields.' });
    }

    if (role === 'employee' && !employee_id) {
      return res.status(400).json({ message: 'Employee ID is required for employee account.' });
    }

    const existing = await query('SELECT * FROM user WHERE email = ? LIMIT 1', [email]);

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email is already registered.' });
    }

    const result = await query(
      `INSERT INTO user (fullname, email, password, role, emp_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fullname, email, password, role, role === 'employee' ? employee_id : null, 'pending']
    );

    const newUserId = result.insertId;

    setTimeout(async () => {
      try {
        await query(`UPDATE user SET status = 'verified' WHERE userId = ?`, [newUserId]);
      } catch (error) {
        console.error('Auto verify error:', error);
      }
    }, 60000);

    return res.status(201).json({
      message: 'Account created successfully. Auto verification will happen in 60 seconds.',
      userId: newUserId
    });

  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ message: 'Registration failed.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const rows = await query(
      `SELECT * FROM user WHERE email = ? AND password = ? LIMIT 1`,
      [email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];

    if (!user.status || user.status.toLowerCase() !== 'verified') {
      return res.status(403).json({ message: 'Your account is not verified yet.' });
    }

    return res.json({
      message: 'Login successful.',
      user: {
        id: user.userId,
        fullname: user.fullname,
        email: user.email,
        role: user.role,
        employee_id: user.emp_id,
        status: user.status
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});

app.get('/api/user/:userId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT userId, fullname, email, role, emp_id, status, created_at
       FROM user WHERE userId = ? LIMIT 1`,
      [req.params.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const u = rows[0];

    return res.json({
      id: u.userId,
      fullname: u.fullname,
      email: u.email,
      role: u.role,
      employee_id: u.emp_id,
      status: u.status,
      created_at: u.created_at
    });

  } catch (error) {
    console.error('User fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch user.' });
  }
});

app.put('/api/user/:userId', async (req, res) => {
  try {
    const { fullname, email } = req.body;

    if (!fullname || !email) {
      return res.status(400).json({ message: 'Full name and email are required.' });
    }

    const existing = await query(
      `SELECT userId FROM user WHERE email = ? AND userId != ? LIMIT 1`,
      [email, req.params.userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({ message: 'Email already in use.' });
    }

    await query(
      `UPDATE user SET fullname = ?, email = ? WHERE userId = ?`,
      [fullname, email, req.params.userId]
    );

    await createNotification(
      req.params.userId,
      'Profile Updated',
      'Your profile details were updated successfully.',
      'profile'
    );

    return res.json({ message: 'Profile updated successfully.' });

  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ message: 'Failed to update profile.' });
  }
});

app.put('/api/user/:userId/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    const rows = await query(
      `SELECT * FROM user WHERE userId = ? AND password = ? LIMIT 1`,
      [req.params.userId, currentPassword]
    );

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    await query(
      `UPDATE user SET password = ? WHERE userId = ?`,
      [newPassword, req.params.userId]
    );

    await createNotification(
      req.params.userId,
      'Password Updated',
      'Your password was changed successfully.',
      'security'
    );

    return res.json({ message: 'Password updated successfully.' });

  } catch (error) {
    console.error('Password update error:', error);
    return res.status(500).json({ message: 'Failed to update password.' });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM products ORDER BY id DESC`);
    return res.json(rows);
  } catch (error) {
    console.error('Products fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch products.' });
  }
});

app.get('/api/products/popular', async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM products ORDER BY id DESC LIMIT 12`);
    return res.json(rows);
  } catch (error) {
    console.error('Popular products fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch popular products.' });
  }
});

app.post('/api/promos/validate', async (req, res) => {
  try {
    const { code, subtotal } = req.body;

    const cleanCode = String(code || '').trim().toUpperCase();
    const amount = Number(subtotal || 0);

    let discount = 0;
    let message = 'Invalid promo code.';

    if (cleanCode === 'MCP10') {
      discount = amount * 0.10;
      message = 'Promo applied: 10% off';
    } else if (cleanCode === 'SAVE50' && amount >= 500) {
      discount = 50;
      message = 'Promo applied: ₱50 off';
    }

    return res.json({
      valid: discount > 0,
      discount,
      message
    });
  } catch (error) {
    console.error('Promo validation error:', error);
    return res.status(500).json({ message: 'Failed to validate promo.' });
  }
});

app.get('/api/orders/:userId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM orders WHERE userId = ? ORDER BY id DESC`,
      [req.params.userId]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Orders fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch orders.' });
  }
});

app.get('/api/order-items/:orderId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [req.params.orderId]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Order items fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch order items.' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const {
      userId,
      order_code,
      order_date,
      status,
      items,
      subtotal,
      vat,
      shipping_fee,
      promo_code,
      promo_discount,
      total,
      payment_method,
      address,
      cartItems
    } = req.body;

    if (
      !userId ||
      !order_code ||
      !order_date ||
      !status ||
      !items ||
      !payment_method ||
      !address ||
      !Array.isArray(cartItems) ||
      cartItems.length === 0
    ) {
      return res.status(400).json({
        error: 'Please fill in all order fields'
      });
    }

    const estimated_delivery = '2-3 days';

    const result = await query(
      `INSERT INTO orders
      (userId, order_code, order_date, status, items, subtotal, vat, shipping_fee, promo_code, promo_discount, total, payment_method, address, estimated_delivery)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        order_code,
        order_date,
        status,
        items,
        Number(subtotal || 0),
        Number(vat || 0),
        Number(shipping_fee || 0),
        promo_code || null,
        Number(promo_discount || 0),
        Number(total || 0),
        payment_method,
        address,
        estimated_delivery
      ]
    );

    const orderId = result.insertId;

    for (const item of cartItems) {
      await query(
        `INSERT INTO order_items (order_id, product_id, product_name, price, qty)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.id, item.name, Number(item.price), Number(item.qty)]
      );
    }

    await createNotification(
      userId,
      'Order Placed',
      `Your order ${order_code} is now being processed. Estimated delivery: 2-3 days.`,
      'order'
    );

    return res.status(201).json({
      message: 'Order placed successfully',
      orderId
    });

  } catch (error) {
    console.error('Save order error:', error);
    return res.status(500).json({
      error: 'Failed to save order'
    });
  }
});

app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM notifications WHERE userId = ? ORDER BY id DESC`,
      [req.params.userId]
    );

    return res.json(rows);
  } catch (error) {
    console.error('Notifications fetch error:', error);
    return res.status(500).json({ message: 'Failed to fetch notifications.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});