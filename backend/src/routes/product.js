const express = require('express');
const { query } = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { getCache, setCache, deleteCachePattern } = require('../config/redis');

const router = express.Router();

// Get all products (with optional filters)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category_id, search, is_active } = req.query;
    
    // Try cache first
    const cacheKey = `products:${JSON.stringify(req.query)}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let queryText = `
      SELECT p.*, c.name as category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (category_id) {
      queryText += ` AND p.category_id = $${paramCount}`;
      params.push(category_id);
      paramCount++;
    }

    if (search) {
      queryText += ` AND (p.name ILIKE $${paramCount} OR p.sku ILIKE $${paramCount} OR p.barcode ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    if (is_active !== undefined) {
      queryText += ` AND p.is_active = $${paramCount}`;
      params.push(is_active === 'true');
      paramCount++;
    }

    queryText += ' ORDER BY p.name';

    const result = await query(queryText, params);
    
    // Cache for 5 minutes
    await setCache(cacheKey, result.rows, 300);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single product
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, c.name as category_name 
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create product (admin only)
router.post('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      sku,
      name,
      description,
      category_id,
      price,
      cost,
      stock_quantity,
      low_stock_threshold,
      barcode,
      image_url
    } = req.body;

    if (!sku || !name || !price) {
      return res.status(400).json({ error: 'SKU, name, and price are required' });
    }

    const result = await query(
      `INSERT INTO products 
       (sku, name, description, category_id, price, cost, stock_quantity, low_stock_threshold, barcode, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [sku, name, description, category_id, price, cost || 0, stock_quantity || 0, low_stock_threshold || 10, barcode, image_url]
    );

    // Clear products cache
    await deleteCachePattern('products:*');

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'SKU already exists' });
    }
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product (admin only)
router.put('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const {
      sku,
      name,
      description,
      category_id,
      price,
      cost,
      stock_quantity,
      low_stock_threshold,
      barcode,
      image_url,
      is_active
    } = req.body;

    const result = await query(
      `UPDATE products 
       SET sku = COALESCE($1, sku),
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           category_id = COALESCE($4, category_id),
           price = COALESCE($5, price),
           cost = COALESCE($6, cost),
           stock_quantity = COALESCE($7, stock_quantity),
           low_stock_threshold = COALESCE($8, low_stock_threshold),
           barcode = COALESCE($9, barcode),
           image_url = COALESCE($10, image_url),
           is_active = COALESCE($11, is_active)
       WHERE id = $12
       RETURNING *`,
      [sku, name, description, category_id, price, cost, stock_quantity, low_stock_threshold, barcode, image_url, is_active, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Clear products cache
    await deleteCachePattern('products:*');

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete product (admin only)
router.delete('/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await query(
      'UPDATE products SET is_active = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Clear products cache
    await deleteCachePattern('products:*');

    res.json({ message: 'Product deactivated successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;