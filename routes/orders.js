const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id,
        order_code AS code,
        order_date AS date,
        status,
        items,
        total,
        payment_method
      FROM orders
      ORDER BY id DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('GET /api/orders error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/items', async (req, res) => {
  try {
    const orderId = req.params.id;

    const [rows] = await db.query(`
      SELECT product_id, product_name, price, qty
      FROM order_items
      WHERE order_id = ?
    `, [orderId]);

    res.json(rows);
  } catch (error) {
    console.error('GET /api/orders/:id/items error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  const connection = await db.getConnection();

  try {
    console.log('POST /api/orders body:', req.body);

    const {
      order_code,
      order_date,
      status,
      items,
      total,
      payment_method,
      cartItems
    } = req.body;

    await connection.beginTransaction();

    const [orderResult] = await connection.query(
      `INSERT INTO orders (order_code, order_date, status, items, total, payment_method)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [order_code, order_date, status, items, total, payment_method]
    );

    const orderId = orderResult.insertId;
    console.log('Inserted order ID:', orderId);

    if (cartItems && cartItems.length > 0) {
      for (const item of cartItems) {
        console.log('Inserting order item:', item);

        await connection.query(
          `INSERT INTO order_items (order_id, product_id, product_name, price, qty)
           VALUES (?, ?, ?, ?, ?)`,
          [
            orderId,
            item.id,
            item.name,
            Number(item.price),
            item.qty
          ]
        );
      }
    } else {
      console.log('No cartItems received.');
    }

    await connection.commit();

    res.json({
      message: 'Order created successfully',
      orderId: orderId
    });
  } catch (error) {
    await connection.rollback();
    console.error('POST /api/orders error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;