import { openDB, IDBPDatabase } from 'idb';
import type { Product, Category, Sale, HeldOrder } from '@/types';

const DB_NAME = 'pos-offline';
const DB_VERSION = 1;

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 1, name: 'Electronics', description: 'Electronic devices and accessories', is_active: true, created_at: new Date().toISOString() },
  { id: 2, name: 'Beverages', description: 'Drinks and beverages', is_active: true, created_at: new Date().toISOString() },
  { id: 3, name: 'Snacks', description: 'Snacks and confectionery', is_active: true, created_at: new Date().toISOString() },
  { id: 4, name: 'Groceries', description: 'General grocery items', is_active: true, created_at: new Date().toISOString() },
  { id: 5, name: 'Personal Care', description: 'Personal care products', is_active: true, created_at: new Date().toISOString() },
];

export const DEFAULT_PRODUCTS: Product[] = [
  // Electronics
  { id: 1, sku: 'USB-C-001', name: 'USB-C Cable Pro', category_id: 1, category_name: 'Electronics', price: 9.99, cost: 5.0, stock_quantity: 50, low_stock_threshold: 10, barcode: '123456789001', image_url: '/products/usb-c-cable.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 2, sku: 'HDPH-001', name: 'Wireless Headphones ANC', category_id: 1, category_name: 'Electronics', price: 49.99, cost: 25.0, stock_quantity: 30, low_stock_threshold: 10, barcode: '123456789002', image_url: '/products/headphones.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 3, sku: 'CHRG-001', name: 'Fast Phone Charger 30W', category_id: 1, category_name: 'Electronics', price: 14.99, cost: 7.5, stock_quantity: 45, low_stock_threshold: 10, barcode: '123456789003', image_url: '/products/charger.jpg', is_active: true, created_at: new Date().toISOString() },
  // Beverages
  { id: 4, sku: 'COLA-001', name: 'Classic Cola 500ml', category_id: 2, category_name: 'Beverages', price: 1.99, cost: 0.8, stock_quantity: 120, low_stock_threshold: 20, barcode: '223456789001', image_url: '/products/cola.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 5, sku: 'WATR-001', name: 'Mineral Spring Water', category_id: 2, category_name: 'Beverages', price: 0.99, cost: 0.4, stock_quantity: 200, low_stock_threshold: 30, barcode: '223456789002', image_url: '/products/water.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 6, sku: 'JUCE-001', name: 'Cold Pressed Orange Juice 1L', category_id: 2, category_name: 'Beverages', price: 3.99, cost: 2.0, stock_quantity: 60, low_stock_threshold: 15, barcode: '223456789003', image_url: '/products/orange-juice.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 7, sku: 'COFF-001', name: 'Arabica Coffee Beans 250g', category_id: 2, category_name: 'Beverages', price: 12.99, cost: 6.5, stock_quantity: 8, low_stock_threshold: 10, barcode: '223456789004', image_url: '/products/coffee-beans.jpg', is_active: true, created_at: new Date().toISOString() },
  // Snacks
  { id: 8, sku: 'CHIP-001', name: 'Sea Salt Potato Chips 150g', category_id: 3, category_name: 'Snacks', price: 2.49, cost: 1.2, stock_quantity: 80, low_stock_threshold: 15, barcode: '323456789001', image_url: '/products/potato-chips.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 9, sku: 'CHOC-001', name: 'Dark Chocolate Bar 70%', category_id: 3, category_name: 'Snacks', price: 1.79, cost: 0.9, stock_quantity: 100, low_stock_threshold: 20, barcode: '323456789002', image_url: '/products/chocolate.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 10, sku: 'COOK-001', name: 'Artisan Cookies Pack 200g', category_id: 3, category_name: 'Snacks', price: 3.49, cost: 1.75, stock_quantity: 70, low_stock_threshold: 15, barcode: '323456789003', image_url: '/products/cookies.jpg', is_active: true, created_at: new Date().toISOString() },
  // Groceries
  { id: 11, sku: 'RICE-001', name: 'Premium Jasmine Rice 1kg', category_id: 4, category_name: 'Groceries', price: 4.99, cost: 2.5, stock_quantity: 90, low_stock_threshold: 15, barcode: '423456789001', image_url: '/products/rice.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 12, sku: 'PAST-001', name: 'Italian Spaghetti 500g', category_id: 4, category_name: 'Groceries', price: 2.99, cost: 1.5, stock_quantity: 100, low_stock_threshold: 20, barcode: '423456789002', image_url: '/products/pasta.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 13, sku: 'OLIV-001', name: 'Extra Virgin Olive Oil 500ml', category_id: 4, category_name: 'Groceries', price: 8.99, cost: 4.5, stock_quantity: 4, low_stock_threshold: 10, barcode: '423456789003', image_url: '/products/olive-oil.jpg', is_active: true, created_at: new Date().toISOString() },
  // Personal Care
  { id: 14, sku: 'SOAP-001', name: 'Gentle Hand Soap 250ml', category_id: 5, category_name: 'Personal Care', price: 3.99, cost: 2.0, stock_quantity: 60, low_stock_threshold: 10, barcode: '523456789001', image_url: '/products/hand-soap.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 15, sku: 'SHMP-001', name: 'Revitalizing Shampoo 400ml', category_id: 5, category_name: 'Personal Care', price: 6.99, cost: 3.5, stock_quantity: 55, low_stock_threshold: 10, barcode: '523456789002', image_url: '/products/shampoo.jpg', is_active: true, created_at: new Date().toISOString() },
  { id: 16, sku: 'TPST-001', name: 'Whitening Toothpaste 100g', category_id: 5, category_name: 'Personal Care', price: 4.49, cost: 2.25, stock_quantity: 75, low_stock_threshold: 12, barcode: '523456789003', image_url: '/products/toothpaste.jpg', is_active: true, created_at: new Date().toISOString() },
];

type POSDatabase = {
  products: {
    key: number;
    value: Product;
    indexes: { sku: string; category_id: number };
  };
  pending_sales: {
    key: number;
    value: Sale & { synced: boolean };
    indexes: { created_at: string };
  };
  session: {
    key: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    value: any;
  };
  categories: {
    key: number;
    value: Category;
  };
};

let dbInstance: IDBPDatabase<POSDatabase> | null = null;

// Initialize IndexedDB
export async function initDB(): Promise<IDBPDatabase<POSDatabase>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<POSDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('sku', 'sku');
        productStore.createIndex('category_id', 'category_id');
      }

      if (!db.objectStoreNames.contains('pending_sales')) {
        const salesStore = db.createObjectStore('pending_sales', {
          keyPath: 'id',
          autoIncrement: true,
        });
        salesStore.createIndex('created_at', 'created_at');
      }

      if (!db.objectStoreNames.contains('session')) {
        db.createObjectStore('session', { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains('categories')) {
        db.createObjectStore('categories', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

// Products operations
export async function saveProducts(products: Product[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('products', 'readwrite');

  await Promise.all([
    ...products.map((product) => tx.store.put(product)),
    tx.done,
  ]);
}

export async function getProducts(): Promise<Product[]> {
  const db = await initDB();
  const items = await db.getAll('products');
  if (!items || items.length === 0) {
    // Seed default products
    await saveProducts(DEFAULT_PRODUCTS);
    return DEFAULT_PRODUCTS;
  }
  // Ensure image_url is populated for all items
  const enriched = items.map((item) => {
    if (!item.image_url) {
      const match = DEFAULT_PRODUCTS.find((d) => d.sku === item.sku);
      if (match?.image_url) {
        item.image_url = match.image_url;
      }
    }
    return item;
  });
  return enriched;
}

export async function getProduct(id: number): Promise<Product | undefined> {
  const db = await initDB();
  return db.get('products', id);
}

export async function searchProducts(query: string): Promise<Product[]> {
  const products = await getProducts();

  if (!query) return products;

  const lowerQuery = query.toLowerCase();
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.sku.toLowerCase().includes(lowerQuery) ||
      (p.barcode && p.barcode.includes(lowerQuery))
  );
}

// Pending sales operations (for offline mode)
export async function savePendingSale(sale: Partial<Sale>): Promise<number> {
  const db = await initDB();
  const saleWithTimestamp = {
    ...sale,
    id: Date.now(),
    created_at: new Date().toISOString(),
    synced: false,
  } as Sale & { synced: boolean };
  
  return db.add('pending_sales', saleWithTimestamp);
}

export async function getPendingSales(): Promise<(Sale & { synced: boolean })[]> {
  const db = await initDB();
  return db.getAll('pending_sales');
}

export async function deletePendingSale(id: number): Promise<void> {
  const db = await initDB();
  return db.delete('pending_sales', id);
}

export async function markSaleSynced(id: number): Promise<void> {
  const db = await initDB();
  const sale = await db.get('pending_sales', id);
  if (sale) {
    sale.synced = true;
    await db.put('pending_sales', sale);
  }
}

// Categories operations
export async function saveCategories(categories: Category[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('categories', 'readwrite');

  await Promise.all([
    ...categories.map((category) => tx.store.put(category)),
    tx.done,
  ]);
}

export async function getCategories(): Promise<Category[]> {
  const db = await initDB();
  const cats = await db.getAll('categories');
  if (!cats || cats.length === 0) {
    await saveCategories(DEFAULT_CATEGORIES);
    return DEFAULT_CATEGORIES;
  }
  return cats;
}

// Held / Parked Orders (stored in localStorage for fast immediate recall)
const HELD_ORDERS_KEY = 'pos_held_orders';

export function getHeldOrders(): HeldOrder[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HELD_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHeldOrder(order: HeldOrder): void {
  if (typeof window === 'undefined') return;
  const current = getHeldOrders();
  const updated = [order, ...current];
  localStorage.setItem(HELD_ORDERS_KEY, JSON.stringify(updated));
}

export function removeHeldOrder(id: string): void {
  if (typeof window === 'undefined') return;
  const current = getHeldOrders();
  const updated = current.filter((o) => o.id !== id);
  localStorage.setItem(HELD_ORDERS_KEY, JSON.stringify(updated));
}

// Clear all data (logout)
export async function clearAllData(): Promise<void> {
  const db = await initDB();
  await Promise.all([
    db.clear('products'),
    db.clear('pending_sales'),
    db.clear('session'),
    db.clear('categories'),
  ]);
}