const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get inventory logs
router.get('/logs', authenticateToken, async (req, res) => {
  try {
    const { product_id, type, limit = 50 } = req.query;

    let queryText = `
      SELECT il.*, p.name as product_name, p.sku as product_sku, u.name as user_name
      FROM inventory_logs il
      LEFT JOIN products p ON il.product_id = p.id
      LEFT JOIN users u ON il.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (product_id) {
      queryText += ` AND il.product_id = $${paramCount}`;
      params.push(product_id);
      paramCount++;
    }

    if (type) {
      queryText += ` AND il.type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    queryText += ` ORDER BY il.created_at DESC LIMIT $${paramCount}`;
    params.push(limit);

    const result = await query(queryText, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Get inventory logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Adjust inventory (admin only)
router.post('/adjust', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { product_id, quantity_change, notes } = req.body;

    if (!product_id || !quantity_change) {
      return res.status(400).json({ error: 'Product ID and quantity change required' });
    }

    // Get current stock
    const productResult = await query(
      'SELECT stock_quantity FROM products WHERE id = $1',
      [product_id]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const currentStock = productResult.rows[0].stock_quantity;
    const newStock = currentStock + quantity_change;

    if (newStock < 0) {
      return res.status(400).json({ error: 'Insufficient stock' });
    }

    // Update stock
    await query(
      'UPDATE products SET stock_quantity = $1 WHERE id = $2',
      [newStock, product_id]
    );

    // Log the adjustment
    const logResult = await query(
      `INSERT INTO inventory_logs 
       (product_id, user_id, type, quantity_change, previous_quantity, new_quantity, notes)
       VALUES ($1, $2, 'adjustment', $3, $4, $5, $6)
       RETURNING *`,
      [product_id, req.user.id, quantity_change, currentStock, newStock, notes]
    );

    res.json(logResult.rows[0]);
  } catch (error) {
    console.error('Inventory adjustment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;