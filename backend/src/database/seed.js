require('dotenv').config();
const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('Seeding database...');
    
    await client.query('BEGIN');
    
    // Create admin user
    const adminPassword = await bcrypt.hash('admin123', 10);
    await client.query(`
      INSERT INTO users (email, password_hash, name, role) 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['admin@pos.com', adminPassword, 'Admin User', 'admin']);
    
    // Create cashier user
    const cashierPassword = await bcrypt.hash('cashier123', 10);
    await client.query(`
      INSERT INTO users (email, password_hash, name, role) 
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['cashier@pos.com', cashierPassword, 'Cashier User', 'cashier']);
    
    console.log('✅ Users created');
    
    // Create categories
    const categories = [
      ['Electronics', 'Electronic devices and accessories'],
      ['Beverages', 'Drinks and beverages'],
      ['Snacks', 'Snacks and confectionery'],
      ['Groceries', 'General grocery items'],
      ['Personal Care', 'Personal care products']
    ];
    
    for (const [name, description] of categories) {
      await client.query(`
        INSERT INTO categories (name, description) 
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [name, description]);
    }
    
    console.log('✅ Categories created');
    
    // Get category IDs
    const { rows: categoryRows } = await client.query('SELECT id, name FROM categories');
    const categoryMap = {};
    categoryRows.forEach(row => {
      categoryMap[row.name] = row.id;
    });
    
    // Create products
    const products = [
      // Electronics
      ['USB-C-001', 'USB-C Cable', 'High-quality USB-C charging cable', categoryMap['Electronics'], 9.99, 5.00, 50, '123456789001'],
      ['HDPH-001', 'Wireless Headphones', 'Bluetooth wireless headphones', categoryMap['Electronics'], 49.99, 25.00, 30, '123456789002'],
      ['CHRG-001', 'Phone Charger', 'Fast charging adapter', categoryMap['Electronics'], 14.99, 7.50, 45, '123456789003'],
      
      // Beverages
      ['COLA-001', 'Cola 500ml', 'Refreshing cola drink', categoryMap['Beverages'], 1.99, 0.80, 120, '223456789001'],
      ['WATR-001', 'Bottled Water', 'Pure spring water 500ml', categoryMap['Beverages'], 0.99, 0.40, 200, '223456789002'],
      ['JUCE-001', 'Orange Juice', 'Fresh orange juice 1L', categoryMap['Beverages'], 3.99, 2.00, 60, '223456789003'],
      ['COFF-001', 'Coffee Beans', 'Premium arabica coffee 250g', categoryMap['Beverages'], 12.99, 6.50, 40, '223456789004'],
      
      // Snacks
      ['CHIP-001', 'Potato Chips', 'Classic potato chips 150g', categoryMap['Snacks'], 2.49, 1.20, 80, '323456789001'],
      ['CHOC-001', 'Chocolate Bar', 'Milk chocolate bar 100g', categoryMap['Snacks'], 1.79, 0.90, 100, '323456789002'],
      ['COOK-001', 'Cookies Pack', 'Assorted cookies 200g', categoryMap['Snacks'], 3.49, 1.75, 70, '323456789003'],
      
      // Groceries
      ['RICE-001', 'White Rice', 'Long grain white rice 1kg', categoryMap['Groceries'], 4.99, 2.50, 90, '423456789001'],
      ['PAST-001', 'Pasta', 'Spaghetti pasta 500g', categoryMap['Groceries'], 2.99, 1.50, 100, '423456789002'],
      ['OLIV-001', 'Olive Oil', 'Extra virgin olive oil 500ml', categoryMap['Groceries'], 8.99, 4.50, 50, '423456789003'],
      
      // Personal Care
      ['SOAP-001', 'Hand Soap', 'Antibacterial hand soap', categoryMap['Personal Care'], 3.99, 2.00, 60, '523456789001'],
      ['SHMP-001', 'Shampoo', 'Hair shampoo 400ml', categoryMap['Personal Care'], 6.99, 3.50, 55, '523456789002'],
      ['TPST-001', 'Toothpaste', 'Whitening toothpaste', categoryMap['Personal Care'], 4.49, 2.25, 75, '523456789003']
    ];
    
    for (const [sku, name, description, categoryId, price, cost, stock, barcode] of products) {
      await client.query(`
        INSERT INTO products (sku, name, description, category_id, price, cost, stock_quantity, low_stock_threshold, barcode) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, 10, $8)
        ON CONFLICT (sku) DO NOTHING
      `, [sku, name, description, categoryId, price, cost, stock, barcode]);
    }
    
    console.log('✅ Products created');
    
    // Create default tax rate
    await client.query(`
      INSERT INTO tax_rates (name, rate, is_active)
      VALUES ('Standard VAT', 10.00, true)
      ON CONFLICT DO NOTHING
    `);
    
    console.log('✅ Tax rates created');
    
    await client.query('COMMIT');
    console.log('✅ Database seeded successfully');
    
    console.log('\n📝 Default credentials:');
    console.log('   Admin: admin@pos.com / admin123');
    console.log('   Cashier: cashier@pos.com / cashier123');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  seedDatabase().catch(console.error);
}

module.exports = { seedDatabase };