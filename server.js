const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 5055;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'grocery_newdb',
  port: 3306,
  connectTimeout: 10000
});
db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err);
    return;
  }
  console.log('Connected to grocery_newdb!');
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
  try {
    await query(
      `INSERT INTO user_notifications (userId, title, message, type, is_read)
       VALUES (?, ?, ?, ?, 0)`,
      [userId, title, message, type]
    );
  } catch (error) {
    console.error('Create notification error:', error);
  }
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const tables = await query('SHOW TABLES');
    res.json({
      success: true,
      message: 'Database connected successfully',
      tables
    });
  } catch (error) {
    console.error('Database query failed:', error);
    res.status(500).json({
      success: false,
      message: 'Database query failed',
      error: error.message
    });
  }
});

app.post('/api/register', async (req, res) => {
  try {
    const { fullname, email, phone, role, employee_id, password } = req.body;

    if (!fullname || !email || !role || !password) {
      return res.status(400).json({
        message: 'Please fill in all required fields.'
      });
    }

    let finalRole = String(role).toLowerCase();

    if (finalRole !== 'customer' && finalRole !== 'employee') {
      return res.status(400).json({
        message: 'Invalid role selected.'
      });
    }

    if (finalRole === 'employee') {
      if (!employee_id) {
        return res.status(400).json({
          message: 'Employee ID is required for employee account.'
        });
      }

      const empIdPattern = /^MCP-\d{4}-\d{2}$/;

      if (!empIdPattern.test(employee_id)) {
        return res.status(400).json({
          message: 'Employee ID must follow the format MCP-YYYY-XX.'
        });
      }

      const existingEmpId = await query(
        'SELECT * FROM user WHERE emp_id = ? LIMIT 1',
        [employee_id]
      );

      if (existingEmpId.length > 0) {
        return res.status(409).json({
          message: 'Employee ID is already registered.'
        });
      }
    }

    const existing = await query(
      'SELECT * FROM user WHERE email = ? LIMIT 1',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Email is already registered.'
      });
    }

    const result = await query(
      `INSERT INTO user (fullname, email, password, role, emp_id, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        fullname,
        email,
        password,
        finalRole,
        finalRole === 'employee' ? employee_id : null,
        'pending'
      ]
    );

    res.status(201).json({
      message: 'Account created successfully. Your account is pending verification.',
      userId: result.insertId
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      message: 'Server error during signup.',
      error: error.message
    });
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
      return res.status(401).json({
        message: 'Invalid email or password.'
      });
    }

    const user = rows[0];

    if (!user.status || user.status.toLowerCase() !== 'verified') {
      return res.status(403).json({
        message: 'Your account is not verified yet.'
      });
    }

    res.json({
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
    res.status(500).json({
      message: 'Server error during login.',
      error: error.message
    });
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
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    const u = rows[0];

    res.json({
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
    res.status(500).json({
      message: 'Failed to fetch user.',
      error: error.message
    });
  }
});

app.put('/api/user/:userId', async (req, res) => {
  try {
    const { fullname, email } = req.body;

    if (!fullname || !email) {
      return res.status(400).json({
        message: 'Full name and email are required.'
      });
    }

    const existing = await query(
      `SELECT userId FROM user WHERE email = ? AND userId != ? LIMIT 1`,
      [email, req.params.userId]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        message: 'Email already in use.'
      });
    }

    await query(
      `UPDATE user SET fullname = ?, email = ? WHERE userId = ?`,
      [fullname, email, req.params.userId]
    );

    res.json({
      message: 'Profile updated successfully.'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      message: 'Failed to update profile.',
      error: error.message
    });
  }
});

app.put('/api/user/:userId/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: 'Current password and new password are required.'
      });
    }

    const rows = await query(
      `SELECT * FROM user WHERE userId = ? AND password = ? LIMIT 1`,
      [req.params.userId, currentPassword]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        message: 'Current password is incorrect.'
      });
    }

    await query(
      `UPDATE user SET password = ? WHERE userId = ?`,
      [newPassword, req.params.userId]
    );

    res.json({
      message: 'Password updated successfully.'
    });
  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({
      message: 'Failed to update password.',
      error: error.message
    });
  }
});

app.get('/api/products', async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM products ORDER BY id DESC`);
    res.json(rows);
  } catch (error) {
    console.error('Products fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch products.',
      error: error.message
    });
  }
});

app.get('/api/products/popular', async (req, res) => {
  try {
    const rows = await query(`
      SELECT * 
      FROM products 
      WHERE stock > 0
      ORDER BY id DESC
      LIMIT 6
    `);
    res.json(rows);
  } catch (error) {
    console.error('Popular products fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch popular products.',
      error: error.message
    });
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

    res.json({
      valid: discount > 0,
      discount,
      message
    });
  } catch (error) {
    console.error('Promo validation error:', error);
    res.status(500).json({
      message: 'Failed to validate promo.',
      error: error.message
    });
  }
});

app.get('/api/orders/:userId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM orders WHERE userId = ? ORDER BY id DESC`,
      [req.params.userId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Orders fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch orders.',
      error: error.message
    });
  }
});

app.get('/api/order-items/:orderId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM order_items WHERE order_id = ?`,
      [req.params.orderId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Order items fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch order items.',
      error: error.message
    });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const {
  userId,
  order_code,
  order_date,
  status,
  payment_method,
  address,
  gcash_sender_name,
  gcash_reference,
  cartItems
} = req.body;

    if (
      !userId ||
      !order_code ||
      !order_date ||
      !status ||
      !payment_method ||
      !address ||
      !Array.isArray(cartItems) ||
      cartItems.length === 0
    ) {
      return res.status(400).json({
        error: 'Please fill in all order fields'
      });
    }

    const users = await query(
      `SELECT userId, role FROM user WHERE userId = ?`,
      [userId]
    );

    if (!users || users.length === 0) {
      return res.status(404).json({
        error: 'User not found'
      });
    }

    const user = users[0];
    const isEmployee = user.role === 'employee';

    let totalItems = 0;
    let subtotal = 0;
    const normalizedItems = [];

    for (const item of cartItems) {
      const products = await query(
  `SELECT id, name, price, stock FROM products WHERE id = ?`,
  [item.id]
);

      if (!products || products.length === 0) {
        return res.status(404).json({
          error: `Product not found: ${item.id}`
        });
      }

      const product = products[0];
      const qty = Number(item.qty);

      if (!qty || qty <= 0) {
        return res.status(400).json({
          error: `Invalid quantity for product ${item.id}`
        });
      }

      if (Number(product.stock || 0) < qty) {
  return res.status(400).json({
    error: `Insufficient stock for ${product.name}. Available: ${product.stock}, Requested: ${qty}`
  });
}

      const originalPrice = Number(product.price) || 0;
      const finalPrice = isEmployee
        ? Number((originalPrice * 0.90).toFixed(2))
        : originalPrice;

      totalItems += qty;
      subtotal += finalPrice * qty;

      normalizedItems.push({
        id: product.id,
        name: product.name,
        price: finalPrice,
        qty
      });
    }

    const vat = Number((subtotal * 0.12).toFixed(2));
    const shipping_fee = subtotal >= 300 ? 0 : 30;
    const promo_code = null;
    const promo_discount = 0;
    const total = Number((subtotal + vat + shipping_fee).toFixed(2));
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
        totalItems,
        subtotal,
        vat,
        shipping_fee,
        promo_code,
        promo_discount,
        total,
        payment_method,
        address,
        estimated_delivery
      ]
    );

    const orderId = result.insertId;

    await query(
  `INSERT INTO order_status_history (order_id, status, notes, changed_by)
   VALUES (?, ?, ?, ?)`,
  [
    orderId,
    status,
    'Order placed successfully.',
    userId
  ]
);

  for (const item of normalizedItems) {
  const stockRows = await query(
    `SELECT stock FROM products WHERE id = ? LIMIT 1`,
    [item.id]
  );

  if (!stockRows.length) {
    return res.status(404).json({
      error: `Product not found while processing stock: ${item.id}`
    });
  }

  const currentStock = Number(stockRows[0].stock || 0);

  if (currentStock < item.qty) {
    return res.status(400).json({
      error: `Insufficient stock for ${item.name}. Available: ${currentStock}, Requested: ${item.qty}`
    });
  }

  await query(
    `INSERT INTO order_items (order_id, product_id, product_name, price, qty)
     VALUES (?, ?, ?, ?, ?)`,
    [orderId, item.id, item.name, item.price, item.qty]
  );

  await query(
    `UPDATE products
     SET stock = stock - ?
     WHERE id = ?`,
    [item.qty, item.id]
  );
}

let paymentStatus = 'Pending';
let referenceNumber = null;

if (payment_method === 'GCash') {
  paymentStatus = 'Pending Verification';
  referenceNumber = gcash_reference || null;
} else if (
  payment_method === 'COD' ||
  payment_method === 'Cash on Delivery'
) {
  paymentStatus = 'Pending';
  referenceNumber = null;
}
await query(
  `INSERT INTO payments
  (order_id, user_id, payment_method, payment_status, reference_number, amount, paid_at, sender_name)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  [
    orderId,
    userId,
    payment_method,
    paymentStatus,
    referenceNumber,
    total,
    null,
    payment_method === 'GCash' ? (gcash_sender_name || null) : null
  ]
);
    try {
      await createNotification(
        userId,
        'Order Placed',
        `Your order ${order_code} is now being processed. Estimated delivery: 2-3 days.`,
        'order'
      );
    } catch (notifError) {
      console.error('Notification insert skipped:', notifError.message);
    }

    res.status(201).json({
      message: 'Order placed successfully',
      orderId,
      subtotal,
      vat,
      shipping_fee,
      total,
      isEmployeeDiscountApplied: isEmployee
    });

  } catch (error) {
    console.error('Save order error:', error);
    res.status(500).json({
      error: 'Failed to save order',
      details: error.message
    });
  }
});
app.get('/api/addresses/:userId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC`,
      [req.params.userId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Addresses fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch addresses.',
      error: error.message
    });
  }
});
app.get('/api/address/:id', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM addresses WHERE id = ? LIMIT 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Address not found.'
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Single address fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch address.',
      error: error.message
    });
  }
});
app.post('/api/addresses', async (req, res) => {
  try {
    const {
      user_id,
      full_name,
      phone,
      house_no,
      street,
      barangay,
      municipality,
      province,
      postal_code,
      landmark
    } = req.body;

    if (!user_id || !full_name || !phone || !barangay || !municipality || !province) {
      return res.status(400).json({
        message: 'Please fill in all required address fields.'
      });
    }

    const existingAddresses = await query(
      `SELECT id FROM addresses WHERE user_id = ?`,
      [user_id]
    );

    const finalIsDefault = existingAddresses.length === 0 ? 1 : 0;

    const result = await query(
      `INSERT INTO addresses
      (user_id, full_name, phone, house_no, street, barangay, municipality, province, postal_code, landmark, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user_id,
        full_name,
        phone,
        house_no || null,
        street || null,
        barangay,
        municipality,
        province,
        postal_code || null,
        landmark || null,
        finalIsDefault
      ]
    );

    res.status(201).json({
      message: 'Address added successfully.',
      addressId: result.insertId
    });
  } catch (error) {
    console.error('Add address error:', error);
    res.status(500).json({
      message: 'Failed to add address.',
      error: error.message
    });
  }
});
app.put('/api/addresses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const {
      user_id,
      full_name,
      phone,
      house_no,
      street,
      barangay,
      municipality,
      province,
      postal_code,
      landmark,
      is_default
    } = req.body;

    if (!user_id || !full_name || !phone || !barangay || !municipality || !province) {
      return res.status(400).json({
        message: 'Please fill in all required address fields.'
      });
    }

    if (is_default) {
      await query(
        `UPDATE addresses SET is_default = 0 WHERE user_id = ?`,
        [user_id]
      );
    }

    await query(
      `UPDATE addresses
       SET full_name = ?, phone = ?, house_no = ?, street = ?, barangay = ?, municipality = ?, province = ?, postal_code = ?, landmark = ?, is_default = ?
       WHERE id = ? AND user_id = ?`,
      [
        full_name,
        phone,
        house_no || null,
        street || null,
        barangay,
        municipality,
        province,
        postal_code || null,
        landmark || null,
        is_default ? 1 : 0,
        id,
        user_id
      ]
    );

    res.json({
      message: 'Address updated successfully.'
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      message: 'Failed to update address.',
      error: error.message
    });
  }
});
app.delete('/api/addresses/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await query(`DELETE FROM addresses WHERE id = ?`, [id]);

    res.json({
      message: 'Address deleted successfully.'
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      message: 'Failed to delete address.',
      error: error.message
    });
  }
});
app.put('/api/addresses/:id/default', async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({
        message: 'user_id is required.'
      });
    }

    await query(
      `UPDATE addresses SET is_default = 0 WHERE user_id = ?`,
      [user_id]
    );

    await query(
      `UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?`,
      [id, user_id]
    );

    res.json({
      message: 'Default address updated successfully.'
    });
  } catch (error) {
    console.error('Set default address error:', error);
    res.status(500).json({
      message: 'Failed to set default address.',
      error: error.message
    });
  }
});
app.get('/api/barangays', async (req, res) => {
  try {
    const rows = await query(`SELECT * FROM barangays ORDER BY id ASC`);
    res.json(rows);
  } catch (error) {
    console.error('Barangays fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch barangays.',
      error: error.message
    });
  }
});
app.get('/api/payments/:userId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM payments WHERE user_id = ? ORDER BY id DESC`,
      [req.params.userId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Payments fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch payments.',
      error: error.message
    });
  }
});

app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM user_notifications WHERE userId = ? ORDER BY id DESC`,
      [req.params.userId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Notifications fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch notifications.',
      error: error.message
    });
  }
});
app.put('/api/notifications/:userId/read-all', async (req, res) => {
  try {
    await query(
      `UPDATE user_notifications SET is_read = 1 WHERE userId = ?`,
      [req.params.userId]
    );

    res.json({
      message: 'All notifications marked as read.'
    });
  } catch (error) {
    console.error('Mark all notifications as read error:', error);
    res.status(500).json({
      message: 'Failed to mark notifications as read.',
      error: error.message
    });
  }
});

app.get('/api/order-status-history/:orderId', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC`,
      [req.params.orderId]
    );

    res.json(rows);
  } catch (error) {
    console.error('Order status history fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch order status history.',
      error: error.message
    });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, category, price, image, stock, description } = req.body;

    if (!name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({
        message: 'Name, category, price, and stock are required.'
      });
    }

    const result = await query(
      `INSERT INTO products (name, category, price, image, stock, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        name,
        category,
        Number(price),
        image || null,
        Number(stock),
        description || null
      ]
    );

    res.status(201).json({
      message: 'Product added successfully.',
      productId: result.insertId
    });
  } catch (error) {
    console.error('Add product error:', error);
    res.status(500).json({
      message: 'Failed to add product.',
      error: error.message
    });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { name, category, price, image, stock, description } = req.body;
    const { id } = req.params;

    if (!name || !category || price === undefined || stock === undefined) {
      return res.status(400).json({
        message: 'Name, category, price, and stock are required.'
      });
    }

    await query(
      `UPDATE products
       SET name = ?, category = ?, price = ?, image = ?, stock = ?, description = ?
       WHERE id = ?`,
      [
        name,
        category,
        Number(price),
        image || null,
        Number(stock),
        description || null,
        id
      ]
    );

    res.json({
      message: 'Product updated successfully.'
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      message: 'Failed to update product.',
      error: error.message
    });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;

    await query(`DELETE FROM products WHERE id = ?`, [id]);

    res.json({
      message: 'Product deleted successfully.'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      message: 'Failed to delete product.',
      error: error.message
    });
  }
});
app.get('/api/products/:id', async (req, res) => {
  try {
    const rows = await query(
      `SELECT * FROM products WHERE id = ? LIMIT 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: 'Product not found.'
      });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Single product fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch product.',
      error: error.message
    });
  }
});



app.post('/api/forgot-password/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    console.log('SEND OTP REQUEST BODY:', req.body);

    if (!email) {
      return res.status(400).json({
        message: 'Email is required.'
      });
    }

    const users = await query(
      `SELECT userId FROM user WHERE email = ? LIMIT 1`,
      [email]
    );

    console.log('MATCHED USERS:', users);

    if (users.length === 0) {
      return res.status(404).json({
        message: 'Email not found.'
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await query(`DELETE FROM password_resets WHERE email = ?`, [email]);

    await query(
      `INSERT INTO password_resets (email, otp_code, expires_at, is_verified)
       VALUES (?, ?, ?, 0)`,
      [email, otp, expiresAt]
    );

    console.log('==============================');
    console.log(`DEMO OTP for ${email}: ${otp}`);
    console.log('==============================');

    res.json({
      message: 'OTP generated successfully.'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      message: 'Failed to send OTP.',
      error: error.message
    });
  }
});

app.post('/api/forgot-password/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: 'Email and OTP are required.'
      });
    }

    const rows = await query(
      `SELECT * FROM password_resets
       WHERE email = ? AND otp_code = ?
       ORDER BY id DESC
       LIMIT 1`,
      [email, otp]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        message: 'Invalid OTP.'
      });
    }

    const reset = rows[0];
    const now = new Date();
    const expiresAt = new Date(reset.expires_at);

    if (now > expiresAt) {
      return res.status(400).json({
        message: 'OTP has expired.'
      });
    }

    await query(
      `UPDATE password_resets SET is_verified = 1 WHERE id = ?`,
      [reset.id]
    );

    res.json({
      message: 'OTP verified successfully.'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      message: 'Failed to verify OTP.',
      error: error.message
    });
  }
});

app.put('/api/forgot-password/reset', async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({
        message: 'Email and new password are required.'
      });
    }

    const rows = await query(
      `SELECT * FROM password_resets
       WHERE email = ? AND is_verified = 1
       ORDER BY id DESC
       LIMIT 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(400).json({
        message: 'OTP verification is required first.'
      });
    }

    const reset = rows[0];
    const now = new Date();
    const expiresAt = new Date(reset.expires_at);

    if (now > expiresAt) {
      return res.status(400).json({
        message: 'OTP verification has expired.'
      });
    }

    await query(
      `UPDATE user SET password = ? WHERE email = ?`,
      [newPassword, email]
    );

    await query(`DELETE FROM password_resets WHERE email = ?`, [email]);

    res.json({
      message: 'Password reset successfully.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      message: 'Failed to reset password.',
      error: error.message
    });
  }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const { adminId } = req.query;

    if (!adminId) {
      return res.status(400).json({
        message: 'adminId is required.'
      });
    }

    const users = await query(
      `SELECT userId, role, status FROM user WHERE userId = ? LIMIT 1`,
      [adminId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: 'Admin user not found.'
      });
    }

    const admin = users[0];

    if (admin.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied. Admin only.'
      });
    }

    if (!admin.status || admin.status.toLowerCase() !== 'verified') {
      return res.status(403).json({
        message: 'Admin account is not verified.'
      });
    }

    const rows = await query(`
      SELECT 
        o.*,
        u.fullname,
        u.email,
        p.payment_method,
        p.payment_status,
        p.reference_number,
        p.sender_name
      FROM orders o
      LEFT JOIN user u ON o.userId = u.userId
      LEFT JOIN payments p ON p.order_id = o.id
      ORDER BY o.id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Admin orders fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch all orders.',
      error: error.message
    });
  }
});

app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, changed_by } = req.body;

    if (!changed_by) {
      return res.status(400).json({
        message: 'changed_by is required.'
      });
    }

    const users = await query(
      `SELECT userId, role, status FROM user WHERE userId = ? LIMIT 1`,
      [changed_by]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: 'Updater account not found.'
      });
    }

    const actor = users[0];

    if (actor.role !== 'admin') {
      return res.status(403).json({
        message: 'Only admin can update order status.'
      });
    }

    if (!actor.status || actor.status.toLowerCase() !== 'verified') {
      return res.status(403).json({
        message: 'Admin account is not verified.'
      });
    }

    const allowedStatuses = [
      'Processing',
      'Packed',
      'Out for Delivery',
      'Delivered',
      'Cancelled'
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: 'Invalid order status.'
      });
    }

    const orders = await query(
      `SELECT * FROM orders WHERE id = ? LIMIT 1`,
      [id]
    );

    if (orders.length === 0) {
      return res.status(404).json({
        message: 'Order not found.'
      });
    }

    const order = orders[0];

    if (order.status === status) {
      return res.status(400).json({
        message: `Order is already marked as ${status}.`
      });
    }

    await query(
      `UPDATE orders SET status = ? WHERE id = ?`,
      [status, id]
    );

    await query(
      `INSERT INTO order_status_history (order_id, status, notes, changed_by)
       VALUES (?, ?, ?, ?)`,
      [
        id,
        status,
        notes || `Order status updated to ${status}.`,
        changed_by
      ]
    );

    let notifMessage = `Your order ${order.order_code} is now ${status}.`;

    if (status === 'Packed') {
      notifMessage = `Your order ${order.order_code} has been packed and is being prepared for delivery.`;
    } else if (status === 'Out for Delivery') {
      notifMessage = `Your order ${order.order_code} is now out for delivery.`;
    } else if (status === 'Delivered') {
      notifMessage = `Your order ${order.order_code} has been delivered successfully.`;
    } else if (status === 'Cancelled') {
      notifMessage = `Your order ${order.order_code} has been cancelled.`;
    }

    await createNotification(
      order.userId,
      'Order Status Updated',
      notifMessage,
      'order'
    );

    if (status === 'Delivered') {
  const payments = await query(
    `SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
    [id]
  );

  if (payments.length > 0) {
    const payment = payments[0];

    if (
      payment.payment_method === 'COD' ||
      payment.payment_method === 'Cash on Delivery'
    ) {
      await query(
        `UPDATE payments
         SET payment_status = 'Paid', paid_at = NOW()
         WHERE id = ?`,
        [payment.id]
      );
    }
  }
}

    res.json({
      message: 'Order status updated successfully.'
    });
  } catch (error) {
    console.error('Order status update error:', error);
    res.status(500).json({
      message: 'Failed to update order status.',
      error: error.message
    });
  }
});

app.put('/api/payments/:orderId/verify-gcash', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        message: 'adminId is required.'
      });
    }

    const users = await query(
      `SELECT userId, role, status FROM user WHERE userId = ? LIMIT 1`,
      [adminId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: 'Admin user not found.'
      });
    }

    const admin = users[0];

    if (admin.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied. Admin only.'
      });
    }

    if (!admin.status || admin.status.toLowerCase() !== 'verified') {
      return res.status(403).json({
        message: 'Admin account is not verified.'
      });
    }

    const payments = await query(
      `SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC LIMIT 1`,
      [orderId]
    );

    if (payments.length === 0) {
      return res.status(404).json({
        message: 'Payment record not found.'
      });
    }

    const payment = payments[0];

    if (payment.payment_method !== 'GCash') {
  return res.status(400).json({
    message: 'Only GCash payments can be verified here.'
  });
}

if (payment.payment_status === 'Verified') {
  return res.status(400).json({
    message: 'GCash payment is already verified.'
  });
}

    await query(
      `UPDATE payments
       SET payment_status = 'Verified', paid_at = NOW()
       WHERE id = ?`,
      [payment.id]
    );

    const orders = await query(
      `SELECT * FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    );

    if (orders.length > 0) {
      const order = orders[0];

      await createNotification(
        order.userId,
        'Payment Verified',
        `Your GCash payment for order ${order.order_code} has been verified.`,
        'payment'
      );
    }

    res.json({
      message: 'GCash payment verified successfully.'
    });
  } catch (error) {
    console.error('GCash verification error:', error);
    res.status(500).json({
      message: 'Failed to verify GCash payment.',
      error: error.message
    });
  }
});

app.put('/api/admin/users/:userId/verify', async (req, res) => {
  try {
    const { userId } = req.params;
    const { adminId } = req.body;

    if (!adminId) {
      return res.status(400).json({
        message: 'adminId is required.'
      });
    }

    const admins = await query(
      `SELECT userId, role, status FROM user WHERE userId = ? LIMIT 1`,
      [adminId]
    );

    if (admins.length === 0) {
      return res.status(404).json({
        message: 'Admin user not found.'
      });
    }

    const admin = admins[0];

    if (admin.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied. Admin only.'
      });
    }

    if (!admin.status || admin.status.toLowerCase() !== 'verified') {
      return res.status(403).json({
        message: 'Admin account is not verified.'
      });
    }

    const users = await query(
      `SELECT * FROM user WHERE userId = ? LIMIT 1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        message: 'User not found.'
      });
    }

    const targetUser = users[0];

    if (targetUser.status && targetUser.status.toLowerCase() === 'verified') {
      return res.status(400).json({
        message: 'User is already verified.'
      });
    }

    await query(
      `UPDATE user SET status = 'verified' WHERE userId = ?`,
      [userId]
    );

    await createNotification(
      userId,
      'Account Verified',
      'Your account has been verified by admin. You may now access your account.',
      'account'
    );

    res.json({
      message: 'User verified successfully.'
    });
  } catch (error) {
    console.error('User verification error:', error);
    res.status(500).json({
      message: 'Failed to verify user.',
      error: error.message
    });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const { adminId } = req.query;

    if (!adminId) {
      return res.status(400).json({
        message: 'adminId is required.'
      });
    }

    const admins = await query(
      `SELECT userId, role, status FROM user WHERE userId = ? LIMIT 1`,
      [adminId]
    );

    if (admins.length === 0) {
      return res.status(404).json({
        message: 'Admin user not found.'
      });
    }

    const admin = admins[0];

    if (admin.role !== 'admin') {
      return res.status(403).json({
        message: 'Access denied. Admin only.'
      });
    }

    if (!admin.status || admin.status.toLowerCase() !== 'verified') {
      return res.status(403).json({
        message: 'Admin account is not verified.'
      });
    }

    const rows = await query(`
      SELECT userId, fullname, email, role, emp_id, status, created_at
      FROM user
      ORDER BY userId DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('Admin users fetch error:', error);
    res.status(500).json({
      message: 'Failed to fetch users.',
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});