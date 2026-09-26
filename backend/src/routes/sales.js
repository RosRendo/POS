const express = require('express');
const { query, transaction } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { notifySaleCreated } = require('../websocket/websocketServer');

const router = express.Router();

// Generate sale number
function generateSaleNumber() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `SALE-${year}${month}${day}-${random}`;
}

// Create new sale
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      items,
      customer_name,
      customer_email,
      customer_phone,
      payment_method,
      discount_amount = 0,
      notes
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Items are required' });
    }

    if (!payment_method) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    const sale = await transaction(async (client) => {
      // Calculate totals
      let subtotal = 0;
      const saleItems = [];

      // Validate and prepare items
      for (const item of items) {
        const productResult = await client.query(
          'SELECT id, name, sku, price, stock_quantity FROM products WHERE id = $1 AND is_active = true',
          [item.product_id]
        );

        if (productResult.rows.length === 0) {
          throw new Error(`Product ${item.product_id} not found or inactive`);
        }

        const product = productResult.rows[0];

        if (product.stock_quantity < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }

        const itemDiscount = item.discount_amount || 0;
        const totalPrice = (product.price * item.quantity) - itemDiscount;
        subtotal += totalPrice;

        saleItems.push({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: item.quantity,
          unit_price: product.price,
          discount_amount: itemDiscount,
          total_price: totalPrice
        });
      }

      // Get tax rate (assuming 10% for now)
      const taxRate = 0.10;
      const tax_amount = subtotal * taxRate;
      const total_amount = subtotal + tax_amount - discount_amount;

      // Create sale record
      const saleResult = await client.query(
        `INSERT INTO sales 
         (sale_number, user_id, customer_name, customer_email, customer_phone, 
          subtotal, tax_amount, discount_amount, total_amount, payment_method, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          generateSaleNumber(),
          req.user.id,
          customer_name,
          customer_email,
          customer_phone,
          subtotal,
          tax_amount,
          discount_amount,
          total_amount,
          payment_method,
          notes
        ]
      );

      const saleId = saleResult.rows[0].id;

      // Insert sale items and update inventory
      for (const item of saleItems) {
        // Insert sale item
        await client.query(
          `INSERT INTO sale_items 
           (sale_id, product_id, product_name, product_sku, quantity, unit_price, discount_amount, total_price)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            saleId,
            item.product_id,
            item.product_name,
            item.product_sku,
            item.quantity,
            item.unit_price,
            item.discount_amount,
            item.total_price
          ]
        );

        // Get current stock
        const stockResult = await client.query(
          'SELECT stock_quantity FROM products WHERE id = $1',
          [item.product_id]
        );
        const currentStock = stockResult.rows[0].stock_quantity;
        const newStock = currentStock - item.quantity;

        // Update product stock
        await client.query(
          'UPDATE products SET stock_quantity = $1 WHERE id = $2',
          [newStock, item.product_id]
        );

        // Log inventory change
        await client.query(
          `INSERT INTO inventory_logs 
           (product_id, user_id, type, quantity_change, previous_quantity, new_quantity, reference_id)
           VALUES ($1, $2, 'sale', $3, $4, $5, $6)`,
          [item.product_id, req.user.id, -item.quantity, currentStock, newStock, saleId]
        );
      }

      return saleResult.rows[0];
    });

    // Notify via WebSocket
    notifySaleCreated(sale);

    res.status(201).json(sale);
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Get all sales (with filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, payment_method, payment_status, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT s.*, u.name as cashier_name,
             COUNT(si.id) as item_count
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (start_date) {
      queryText += ` AND s.created_at >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      queryText += ` AND s.created_at <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (payment_method) {
      queryText += ` AND s.payment_method = $${paramCount}`;
      params.push(payment_method);
      paramCount++;
    }

    if (payment_status) {
      queryText += ` AND s.payment_status = $${paramCount}`;
      params.push(payment_status);
      paramCount++;
    }

    queryText += ` GROUP BY s.id, u.name ORDER BY s.created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single sale with items
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const saleResult = await query(
      `SELECT s.*, u.name as cashier_name
       FROM sales s
       LEFT JOIN users u ON s.user_id = u.id
       WHERE s.id = $1`,
      [req.params.id]
    );

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const itemsResult = await query(
      'SELECT * FROM sale_items WHERE sale_id = $1',
      [req.params.id]
    );

    const sale = {
      ...saleResult.rows[0],
      items: itemsResult.rows
    };

    res.json(sale);
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;