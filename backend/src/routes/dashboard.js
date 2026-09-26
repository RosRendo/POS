const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { getCache, setCache } = require('../config/redis');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // Try cache first (cache for 1 minute)
    const cacheKey = `dashboard:stats:${period}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let dateFilter = "created_at >= CURRENT_DATE";
    
    switch (period) {
      case 'today':
        dateFilter = "created_at >= CURRENT_DATE";
        break;
      case 'week':
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
        break;
      case 'month':
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
        break;
      case 'year':
        dateFilter = "created_at >= CURRENT_DATE - INTERVAL '1 year'";
        break;
    }

    // Get sales statistics
    const salesStats = await query(`
      SELECT 
        COUNT(*) as total_sales,
        COALESCE(SUM(total_amount), 0) as total_revenue,
        COALESCE(AVG(total_amount), 0) as average_sale,
        COUNT(DISTINCT DATE(created_at)) as days_with_sales
      FROM sales
      WHERE ${dateFilter} AND payment_status = 'completed'
    `);

    // Get payment method breakdown
    const paymentBreakdown = await query(`
      SELECT 
        payment_method,
        COUNT(*) as count,
        SUM(total_amount) as total
      FROM sales
      WHERE ${dateFilter} AND payment_status = 'completed'
      GROUP BY payment_method
    `);

    // Get top selling products
    const topProducts = await query(`
      SELECT 
        si.product_name,
        si.product_sku,
        SUM(si.quantity) as total_quantity,
        SUM(si.total_price) as total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      WHERE s.${dateFilter} AND s.payment_status = 'completed'
      GROUP BY si.product_id, si.product_name, si.product_sku
      ORDER BY total_quantity DESC
      LIMIT 10
    `);

    // Get low stock products
    const lowStock = await query(`
      SELECT id, sku, name, stock_quantity, low_stock_threshold, image_url
      FROM products
      WHERE stock_quantity <= low_stock_threshold AND is_active = true
      ORDER BY stock_quantity ASC
      LIMIT 10
    `);

    // Get recent sales
    const recentSales = await query(`
      SELECT 
        s.id,
        s.sale_number,
        s.total_amount,
        s.payment_method,
        s.created_at,
        u.name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.${dateFilter}
      ORDER BY s.created_at DESC
      LIMIT 10
    `);

    // Sales trend (hourly for today, daily for week/month)
    let trendQuery;
    if (period === 'today') {
      trendQuery = `
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count,
          SUM(total_amount) as revenue
        FROM sales
        WHERE ${dateFilter} AND payment_status = 'completed'
        GROUP BY hour
        ORDER BY hour
      `;
    } else {
      trendQuery = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          SUM(total_amount) as revenue
        FROM sales
        WHERE ${dateFilter} AND payment_status = 'completed'
        GROUP BY date
        ORDER BY date
      `;
    }
    const salesTrend = await query(trendQuery);

    const stats = {
      overview: salesStats.rows[0],
      payment_breakdown: paymentBreakdown.rows,
      top_products: topProducts.rows,
      low_stock: lowStock.rows,
      recent_sales: recentSales.rows,
      sales_trend: salesTrend.rows,
      period
    };

    // Cache for 1 minute
    await setCache(cacheKey, stats, 60);

    res.json(stats);
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sales report
router.get('/report', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date required' });
    }

    let groupByClause;
    switch (group_by) {
      case 'hour':
        groupByClause = "DATE_TRUNC('hour', created_at)";
        break;
      case 'day':
        groupByClause = "DATE(created_at)";
        break;
      case 'week':
        groupByClause = "DATE_TRUNC('week', created_at)";
        break;
      case 'month':
        groupByClause = "DATE_TRUNC('month', created_at)";
        break;
      default:
        groupByClause = "DATE(created_at)";
    }

    const result = await query(`
      SELECT 
        ${groupByClause} as period,
        COUNT(*) as total_sales,
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as average_sale,
        SUM(subtotal) as total_subtotal,
        SUM(tax_amount) as total_tax,
        SUM(discount_amount) as total_discounts
      FROM sales
      WHERE created_at >= $1 AND created_at <= $2 AND payment_status = 'completed'
      GROUP BY period
      ORDER BY period
    `, [start_date, end_date]);

    res.json(result.rows);
  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;