import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'sawera_pos.sqlite');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode and foreign keys
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function initDatabase() {
  db.exec(`
    -- Branches
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      name_urdu TEXT,
      address TEXT,
      phone TEXT,
      manager_name TEXT,
      opening_time TEXT DEFAULT '08:00 AM',
      closing_time TEXT DEFAULT '11:00 PM',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL, -- admin, manager, cashier
      branch_id INTEGER REFERENCES branches(id) ON DELETE SET NULL,
      phone TEXT,
      status TEXT DEFAULT 'active',
      permissions TEXT, -- JSON array of granted permission strings
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Product Categories
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_urdu TEXT,
      icon TEXT DEFAULT 'ShoppingBag',
      color TEXT DEFAULT 'amber',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      opening_balance REAL DEFAULT 0,
      current_balance REAL DEFAULT 0,
      credit_limit REAL DEFAULT 50000,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_urdu TEXT,
      code TEXT UNIQUE NOT NULL,
      sku TEXT,
      barcode TEXT UNIQUE,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      brand TEXT,
      purchase_price REAL NOT NULL DEFAULT 0,
      sale_price REAL NOT NULL DEFAULT 0,
      wholesale_price REAL DEFAULT 0,
      min_stock REAL DEFAULT 5,
      unit TEXT DEFAULT 'Piece',
      supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
      expiry_date TEXT,
      image_url TEXT,
      description TEXT,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Branch Inventory
    CREATE TABLE IF NOT EXISTS branch_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      quantity REAL NOT NULL DEFAULT 0,
      min_stock_override REAL,
      last_restocked DATETIME,
      UNIQUE(branch_id, product_id)
    );

    -- Stock Movements Ledger
    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- purchase, sale, sales_return, purchase_return, damage, manual_adjustment, transfer_in, transfer_out
      quantity REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      reference_id TEXT,
      reason TEXT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sales / Invoices
    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT UNIQUE NOT NULL,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      subtotal REAL NOT NULL,
      discount_type TEXT DEFAULT 'fixed',
      discount_value REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      tax_percentage REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      paid_amount REAL NOT NULL,
      change_amount REAL DEFAULT 0,
      credit_amount REAL DEFAULT 0,
      payment_method TEXT NOT NULL, -- cash, card, bank, easypaisa, jazzcash, split, credit
      split_details TEXT, -- JSON
      status TEXT DEFAULT 'completed', -- completed, returned, partially_returned, cancelled
      total_cost REAL DEFAULT 0,
      profit REAL DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sale Items
    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      product_code TEXT,
      unit TEXT,
      purchase_price REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL,
      quantity REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      line_total REAL NOT NULL,
      returned_quantity REAL DEFAULT 0
    );

    -- Customer Payments (Udhaar Recovery)
    CREATE TABLE IF NOT EXISTS customer_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT UNIQUE,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      reference_no TEXT,
      notes TEXT,
      user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Supplier Payments
    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_no TEXT UNIQUE,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      reference_no TEXT,
      notes TEXT,
      user_id INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Purchases
    CREATE TABLE IF NOT EXISTS purchases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_no TEXT UNIQUE NOT NULL,
      supplier_invoice_no TEXT,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      paid_amount REAL NOT NULL,
      remaining_amount REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Purchase Items
    CREATE TABLE IF NOT EXISTS purchase_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity REAL NOT NULL,
      purchase_price REAL NOT NULL,
      line_total REAL NOT NULL
    );

    -- Sales Returns
    CREATE TABLE IF NOT EXISTS sales_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT UNIQUE NOT NULL,
      sale_id INTEGER NOT NULL REFERENCES sales(id),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      refund_amount REAL NOT NULL,
      refund_method TEXT NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Sales Return Items
    CREATE TABLE IF NOT EXISTS sales_return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES sales_returns(id) ON DELETE CASCADE,
      sale_item_id INTEGER REFERENCES sale_items(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity REAL NOT NULL,
      refund_rate REAL NOT NULL,
      refund_total REAL NOT NULL
    );

    -- Purchase Returns
    CREATE TABLE IF NOT EXISTS purchase_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_no TEXT UNIQUE NOT NULL,
      purchase_id INTEGER REFERENCES purchases(id),
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      total_amount REAL NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      expense_no TEXT UNIQUE,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      paid_to TEXT,
      notes TEXT,
      user_id INTEGER REFERENCES users(id),
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Cash Registers (Shift Drawer sessions)
    CREATE TABLE IF NOT EXISTS cash_registers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      closed_at DATETIME,
      opening_cash REAL NOT NULL DEFAULT 0,
      expected_cash REAL DEFAULT 0,
      actual_cash REAL DEFAULT 0,
      difference REAL DEFAULT 0,
      status TEXT DEFAULT 'open', -- open, closed
      notes TEXT
    );

    -- Branch Transfers
    CREATE TABLE IF NOT EXISTS branch_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_no TEXT UNIQUE NOT NULL,
      from_branch_id INTEGER NOT NULL REFERENCES branches(id),
      to_branch_id INTEGER NOT NULL REFERENCES branches(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Branch Transfer Items
    CREATE TABLE IF NOT EXISTS branch_transfer_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transfer_id INTEGER NOT NULL REFERENCES branch_transfers(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity REAL NOT NULL
    );

    -- Parked Bills (Hold Bill)
    CREATE TABLE IF NOT EXISTS parked_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference TEXT NOT NULL,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      customer_id INTEGER REFERENCES customers(id),
      cart_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      username TEXT,
      branch_id INTEGER REFERENCES branches(id),
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    -- Recipes for Sweet & Bakery production
    CREATE TABLE IF NOT EXISTS recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_urdu TEXT,
      finished_product_id INTEGER NOT NULL REFERENCES products(id),
      expected_yield REAL NOT NULL DEFAULT 1,
      yield_unit TEXT DEFAULT 'Kg',
      instructions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Recipe Ingredients
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
      raw_product_id INTEGER NOT NULL REFERENCES products(id),
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'Kg'
    );

    -- Production Entries
    CREATE TABLE IF NOT EXISTS productions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      production_no TEXT UNIQUE NOT NULL,
      recipe_id INTEGER REFERENCES recipes(id),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      finished_product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_produced REAL NOT NULL,
      waste_quantity REAL DEFAULT 0,
      total_cost REAL NOT NULL DEFAULT 0,
      user_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Production Items (Raw ingredients consumed)
    CREATE TABLE IF NOT EXISTS production_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      production_id INTEGER NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
      raw_product_id INTEGER NOT NULL REFERENCES products(id),
      quantity_used REAL NOT NULL,
      unit_cost REAL DEFAULT 0,
      line_cost REAL DEFAULT 0
    );

    -- Waste Logs (Burnt, expired, damaged, unsold, production waste)
    CREATE TABLE IF NOT EXISTS waste_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      waste_no TEXT UNIQUE NOT NULL,
      product_id INTEGER NOT NULL REFERENCES products(id),
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'Kg',
      cost_price REAL DEFAULT 0,
      total_loss REAL DEFAULT 0,
      reason TEXT NOT NULL, -- burnt, expired, damaged, unsold, production_waste
      user_id INTEGER REFERENCES users(id),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Physical Stock Audits / Counts
    CREATE TABLE IF NOT EXISTS stock_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_no TEXT UNIQUE NOT NULL,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      user_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'completed',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Stock Audit Items
    CREATE TABLE IF NOT EXISTS stock_audit_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id INTEGER NOT NULL REFERENCES stock_audits(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      system_quantity REAL NOT NULL,
      physical_quantity REAL NOT NULL,
      variance REAL NOT NULL,
      reason TEXT
    );

    -- Quotations / Estimates
    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_no TEXT UNIQUE NOT NULL,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER REFERENCES users(id),
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      valid_until DATE,
      status TEXT DEFAULT 'pending', -- pending, converted, cancelled
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Quotation Items
    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit TEXT,
      unit_price REAL NOT NULL,
      quantity REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      line_total REAL NOT NULL
    );

    -- Offers & Promotions
    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT NOT NULL, -- percentage, fixed, bogo, category_discount
      value REAL DEFAULT 0,
      category_id INTEGER REFERENCES categories(id),
      product_id INTEGER REFERENCES products(id),
      min_order_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Customer Loyalty Logs
    CREATE TABLE IF NOT EXISTS loyalty_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      sale_id INTEGER REFERENCES sales(id),
      points_change REAL NOT NULL,
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Shifts
    CREATE TABLE IF NOT EXISTS shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shift_name TEXT NOT NULL,
      branch_id INTEGER NOT NULL REFERENCES branches(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      register_id INTEGER REFERENCES cash_registers(id),
      opening_cash REAL NOT NULL,
      closing_cash REAL DEFAULT 0,
      expected_cash REAL DEFAULT 0,
      difference REAL DEFAULT 0,
      status TEXT DEFAULT 'active', -- active, closed
      start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      end_time DATETIME,
      notes TEXT
    );

    -- Price Change Requests
    CREATE TABLE IF NOT EXISTS price_change_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id),
      cashier_id INTEGER REFERENCES users(id),
      approved_by INTEGER REFERENCES users(id),
      original_price REAL NOT NULL,
      requested_price REAL NOT NULL,
      reason TEXT NOT NULL,
      status TEXT DEFAULT 'approved',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Create helpful indexes
    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_branch_inventory_product ON branch_inventory(product_id);
    CREATE INDEX IF NOT EXISTS idx_sales_branch ON sales(branch_id);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_waste_branch ON waste_logs(branch_id);
    CREATE INDEX IF NOT EXISTS idx_recipes_product ON recipes(finished_product_id);
  `);

  // Safe Column Migrations
  const addCol = (tbl, col, def) => {
    try {
      const cols = db.prepare(`PRAGMA table_info(${tbl})`).all();
      if (!cols.some(c => c.name === col)) {
        db.exec(`ALTER TABLE ${tbl} ADD COLUMN ${col} ${def};`);
      }
    } catch (e) {}
  };

  addCol('products', 'product_type', "TEXT DEFAULT 'finished_good'");
  addCol('products', 'special_price', "REAL DEFAULT 0");
  addCol('products', 'batch_no', "TEXT");
  addCol('products', 'mfg_date', "TEXT");
  addCol('customers', 'loyalty_points', "REAL DEFAULT 0");
  addCol('users', 'pin_code', "TEXT DEFAULT '1234'");
  addCol('sales', 'is_exchange', "INTEGER DEFAULT 0");
  addCol('sales', 'exchange_return_id', "INTEGER");
  addCol('sales', 'exchange_credit_used', "REAL DEFAULT 0");
  addCol('sales', 'loyalty_points_earned', "REAL DEFAULT 0");
  addCol('sales', 'loyalty_points_redeemed', "REAL DEFAULT 0");
  addCol('sales', 'price_level', "TEXT DEFAULT 'retail'");
  addCol('sales', 'quotation_id', "INTEGER");
  addCol('sale_items', 'weight_grams', "REAL");
  addCol('sale_items', 'rate_per_kg', "REAL");
  addCol('quotation_items', 'weight_grams', "REAL");
  addCol('quotation_items', 'rate_per_kg', "REAL");

  // Seed default settings and records if empty
  seedInitialData();
  seedProductionAndRecipes();
}

export function logAudit({ userId, username, branchId, action, entity, entityId, details, ipAddress = '' }) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (user_id, username, branch_id, action, entity, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(userId || null, username || 'System', branchId || null, action, entity, String(entityId || ''), details || '', ipAddress);
  } catch (err) {
    console.error('Error logging audit:', err);
  }
}

export function seedInitialData(force = false) {
  const branchesCount = db.prepare('SELECT COUNT(*) as count FROM branches').get().count;
  if (branchesCount > 0 && !force) {
    return;
  }

  console.log('Seeding initial data for Sawera Sweet & Bakers...');

  // 1. Settings
  const defaultSettings = [
    { key: 'business_name', value: 'Sawera Sweet & Bakers' },
    { key: 'business_name_urdu', value: 'سویرا سویٹس اینڈ بیکرز' },
    { key: 'phone', value: '+92 300 1234567' },
    { key: 'email', value: 'info@sawerasweets.com' },
    { key: 'address', value: 'Main Saddar Bazar, Near GPO, Rawalpindi / Lahore' },
    { key: 'ntn', value: '8765432-1' },
    { key: 'strn', value: '32-77-8765-432-19' },
    { key: 'currency', value: 'Rs.' },
    { key: 'tax_rate', value: '0' }, // 0% by default, configurable
    { key: 'receipt_header', value: 'Sawera Sweet & Bakers - Quality Sweets & Fresh Bakery' },
    { key: 'receipt_header_urdu', value: 'خالص دیسی گھی کی بنی مٹھائیاں اور تازہ بیکری' },
    { key: 'receipt_footer', value: 'Thank you for shopping with us! Please come again.' },
    { key: 'receipt_footer_urdu', value: 'آپ کی تشریف آوری کا بہت شکریہ! دوبارہ تشریف لائیں۔' },
    { key: 'printer_type', value: 'thermal_80' }, // thermal_80, thermal_58, a4
    { key: 'low_stock_threshold', value: '10' },
    { key: 'auto_print_receipt', value: 'true' },
    { key: 'allow_negative_stock', value: 'true' },
    { key: 'last_backup_date', value: '' }
  ];

  const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const s of defaultSettings) {
    setSetting.run(s.key, s.value);
  }

  // 2. Initial 4 Branches
  const branches = [
    {
      code: 'BR-01',
      name: 'Main Saddar Branch',
      name_urdu: 'مین صدر برانچ',
      address: 'Shop 1-4, Saddar Commercial Area, Rawalpindi',
      phone: '051-5551234',
      manager_name: 'Muhammad Tariq',
      opening_time: '07:30 AM',
      closing_time: '11:30 PM',
      status: 'active'
    },
    {
      code: 'BR-02',
      name: 'Gulberg Branch',
      name_urdu: 'گلبرگ برانچ',
      address: 'Plot 42, Main Boulevard Gulberg, Lahore',
      phone: '042-3578910',
      manager_name: 'Usman Ghani',
      opening_time: '08:00 AM',
      closing_time: '11:00 PM',
      status: 'active'
    },
    {
      code: 'BR-03',
      name: 'DHA Phase 5 Branch',
      name_urdu: 'ڈی ایچ اے فیز 5 برانچ',
      address: 'Shop 12, Commercial Broadway, DHA Phase 5, Lahore',
      phone: '042-3718290',
      manager_name: 'Zubair Ahmed',
      opening_time: '08:00 AM',
      closing_time: '12:00 AM',
      status: 'active'
    },
    {
      code: 'BR-04',
      name: 'Township / Ferozepur Rd',
      name_urdu: 'ٹاؤن شپ فیروز پور روڈ برانچ',
      address: 'College Road, Township Chowk, Lahore',
      phone: '042-3511223',
      manager_name: 'Rashid Mahmood',
      opening_time: '07:30 AM',
      closing_time: '11:00 PM',
      status: 'active'
    }
  ];

  const insertBranch = db.prepare(`
    INSERT INTO branches (code, name, name_urdu, address, phone, manager_name, opening_time, closing_time, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const b of branches) {
    insertBranch.run(b.code, b.name, b.name_urdu, b.address, b.phone, b.manager_name, b.opening_time, b.closing_time, b.status);
  }

  // 3. User Accounts with bcrypt hashes
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync('admin123', salt);
  const managerHash = bcrypt.hashSync('manager123', salt);
  const cashierHash = bcrypt.hashSync('cashier123', salt);

  const allPermissions = JSON.stringify([
    'pos_access', 'view_dashboard', 'view_reports', 'view_profit', 'manage_products',
    'delete_products', 'manage_inventory', 'manage_purchases', 'manage_expenses',
    'manage_customers', 'manage_suppliers', 'manage_branches', 'manage_users',
    'manage_settings', 'manage_backup', 'process_returns', 'view_all_branches',
    'cash_register'
  ]);

  const managerPermissions = JSON.stringify([
    'pos_access', 'view_dashboard', 'view_reports', 'manage_products',
    'manage_inventory', 'manage_purchases', 'manage_expenses', 'manage_customers',
    'manage_suppliers', 'process_returns', 'cash_register'
  ]);

  const cashierPermissions = JSON.stringify([
    'pos_access', 'manage_customers', 'process_returns', 'cash_register'
  ]);

  const insertUser = db.prepare(`
    INSERT INTO users (username, name, email, password_hash, role, branch_id, phone, status, permissions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('admin', 'Owner / Admin (Sawera Sweets)', 'admin@sawerasweets.com', adminHash, 'admin', 1, '0300-1112233', 'active', allPermissions);
  insertUser.run('manager1', 'Muhammad Tariq (Manager)', 'tariq@sawerasweets.com', managerHash, 'manager', 1, '0301-4445566', 'active', managerPermissions);
  insertUser.run('cashier1', 'Ali Hassan (Cashier B1)', 'ali@sawerasweets.com', cashierHash, 'cashier', 1, '0321-7778899', 'active', cashierPermissions);
  insertUser.run('cashier2', 'Hamza Khan (Cashier B2)', 'hamza@sawerasweets.com', cashierHash, 'cashier', 2, '0333-8889900', 'active', cashierPermissions);

  // 4. Categories
  const categories = [
    { name: 'Sweets', name_urdu: 'روایتی مٹھائیاں', icon: 'Sparkles', color: 'amber', sort_order: 1 },
    { name: 'Bakery', name_urdu: 'بیکری اور پیٹیز', icon: 'Croissant', color: 'orange', sort_order: 2 },
    { name: 'Cakes', name_urdu: 'کیک اور پیسٹری', icon: 'Cake', color: 'rose', sort_order: 3 },
    { name: 'Biscuits', name_urdu: 'بسکٹ اور نان خطائی', icon: 'Cookie', color: 'yellow', sort_order: 4 },
    { name: 'Cold Drinks', name_urdu: 'کولڈ ڈرنکس و جوس', icon: 'Coffee', color: 'blue', sort_order: 5 },
    { name: 'Cosmetics', name_urdu: 'کاسمیٹکس و فیس کریم', icon: 'Heart', color: 'pink', sort_order: 6 },
    { name: 'Perfumes', name_urdu: 'پرفیوم اور عطریات', icon: 'Flame', color: 'purple', sort_order: 7 },
    { name: 'Shampoo', name_urdu: 'شیمپو و ہیئر کیئر', icon: 'Droplets', color: 'cyan', sort_order: 8 },
    { name: 'Face Wash & Soaps', name_urdu: 'صابن اور فیس واش', icon: 'Sparkle', color: 'teal', sort_order: 9 },
    { name: 'Grocery & Dairy', name_urdu: 'گروسری اور ڈیری', icon: 'Package', color: 'emerald', sort_order: 10 }
  ];

  const insertCategory = db.prepare(`
    INSERT INTO categories (name, name_urdu, icon, color, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const c of categories) {
    insertCategory.run(c.name, c.name_urdu, c.icon, c.color, c.sort_order);
  }

  // 5. Suppliers
  const suppliers = [
    { name: 'Al-Madina Pure Dairy Farm', company: 'Al-Madina Milk & Desi Ghee Suppliers', phone: '0300-9876541', email: 'madina.dairy@gmail.com', address: 'Sheikhupura Road, Lahore', opening_balance: 15000, current_balance: 45000 },
    { name: 'Gourmet Flour & Packaging Mills', company: 'Gourmet Packaging Industries', phone: '0321-4567890', email: 'sales@gourmetpackaging.pk', address: 'Industrial Estate, Lahore', opening_balance: 20000, current_balance: 20000 },
    { name: 'Nestle Pakistan Wholesale', company: 'Nestle Distribution Center', phone: '042-111-637-853', email: 'info@nestle.com.pk', address: 'Multan Road, Lahore', opening_balance: 0, current_balance: 18500 },
    { name: 'Unilever Pakistan Distributors', company: 'Unilever Personal Care Wholesale', phone: '0300-1122334', email: 'orders@unileverpakistan.com', address: 'Gulberg 3, Lahore', opening_balance: 10000, current_balance: 32000 },
    { name: 'National Foods & Spices Supply', company: 'National Foods Ltd', phone: '021-35077700', email: 'sales@nationalfoods.com', address: 'Korangi Industrial Area, Karachi', opening_balance: 0, current_balance: 12000 }
  ];

  const insertSupplier = db.prepare(`
    INSERT INTO suppliers (name, company, phone, email, address, opening_balance, current_balance)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of suppliers) {
    insertSupplier.run(s.name, s.company, s.phone, s.email, s.address, s.opening_balance, s.current_balance);
  }

  // 6. Customers (including realistic Udhaar balances)
  const customers = [
    { name: 'Chaudhry Akram', phone: '0300-5551122', email: 'akram@gmail.com', address: 'House 45, Street 12, Saddar', opening_balance: 5000, current_balance: 12500, credit_limit: 50000 },
    { name: 'Haji Muhammad Aslam', phone: '0321-9988776', email: 'aslam.traders@yahoo.com', address: 'Shop 8, Main Bazar', opening_balance: 0, current_balance: 8400, credit_limit: 40000 },
    { name: 'Malik Zafar Iqbal', phone: '0333-4455667', email: 'malik.zafar@gmail.com', address: 'Civil Lines, Rawalpindi', opening_balance: 3500, current_balance: 3500, credit_limit: 30000 },
    { name: 'Dr. Shahida Parveen', phone: '0302-7766554', email: 'shahida.doc@hotmail.com', address: 'DHA Phase 5, Block B', opening_balance: 0, current_balance: 0, credit_limit: 60000 },
    { name: 'Mian Shaukat Ali', phone: '0312-3344556', email: 'shaukat@aliindustries.pk', address: 'Gulberg III, Lahore', opening_balance: 10000, current_balance: 24500, credit_limit: 100000 }
  ];

  const insertCustomer = db.prepare(`
    INSERT INTO customers (name, phone, email, address, opening_balance, current_balance, credit_limit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const c of customers) {
    insertCustomer.run(c.name, c.phone, c.email, c.address, c.opening_balance, c.current_balance, c.credit_limit);
  }

  // 7. Rich Pakistani Sweets, Bakery, Cosmetics, Drinks & Grocery Products
  const products = [
    // Sweets (cat 1)
    { name: 'Special Gulab Jamun (Desi Ghee)', name_urdu: 'اسپیشل گلاب جامن (دیسی گھی)', code: 'SWT-001', sku: 'GJ-001', barcode: '896400100101', cat: 1, brand: 'Sawera Sweets', purchase: 750, sale: 1100, wholesale: 950, min_stock: 15, unit: 'Kg', supplier: 1, desc: 'Fresh hot gulab jamun prepared in pure cow desi ghee' },
    { name: 'Rasgulla (Pure Chhena)', name_urdu: 'رس گلہ (خالص چھینا)', code: 'SWT-002', sku: 'RG-002', barcode: '896400100102', cat: 1, brand: 'Sawera Sweets', purchase: 700, sale: 1000, wholesale: 900, min_stock: 10, unit: 'Kg', supplier: 1, desc: 'Soft and spongy rasgulla soaked in saffron cardamom syrup' },
    { name: 'Motichoor Ladoo', name_urdu: 'موتی چور لڈو', code: 'SWT-003', sku: 'ML-003', barcode: '896400100103', cat: 1, brand: 'Sawera Sweets', purchase: 600, sale: 950, wholesale: 850, min_stock: 20, unit: 'Kg', supplier: 1, desc: 'Traditional festive motichoor ladoo made with pure gram flour' },
    { name: 'Pista Barfi (Special Khoya)', name_urdu: 'پستہ برفی (اسپیشل کھویا)', code: 'SWT-004', sku: 'PB-004', barcode: '896400100104', cat: 1, brand: 'Sawera Sweets', purchase: 900, sale: 1400, wholesale: 1250, min_stock: 12, unit: 'Kg', supplier: 1, desc: 'Premium pistachio barfi garnished with silver leaf' },
    { name: 'Plain Khoya Barfi', name_urdu: 'سادہ کھویا برفی', code: 'SWT-005', sku: 'KB-005', barcode: '896400100105', cat: 1, brand: 'Sawera Sweets', purchase: 800, sale: 1200, wholesale: 1050, min_stock: 15, unit: 'Kg', supplier: 1, desc: 'Rich milk solids barfi with mild sweetness' },
    { name: 'Special Jalebi (Desi Ghee)', name_urdu: 'اسپیشل جلیبی (دیسی گھی)', code: 'SWT-006', sku: 'JB-006', barcode: '896400100106', cat: 1, brand: 'Sawera Sweets', purchase: 500, sale: 800, wholesale: 700, min_stock: 10, unit: 'Kg', supplier: 1, desc: 'Crispy, hot and juicy desi ghee jalebi' },
    { name: 'Multani Sohan Halwa Tin 1kg', name_urdu: 'ملتانی سوہن حلوہ ٹن 1 کلو', code: 'SWT-007', sku: 'SH-007', barcode: '896400100107', cat: 1, brand: 'Sawera Sweets', purchase: 1100, sale: 1600, wholesale: 1400, min_stock: 8, unit: 'Box', supplier: 1, desc: 'Original dry fruit rich Sohan Halwa in airtight tin box' },
    { name: 'Cham Cham Pink & White', name_urdu: 'چم چم گلابی اور سفید', code: 'SWT-008', sku: 'CC-008', barcode: '896400100108', cat: 1, brand: 'Sawera Sweets', purchase: 720, sale: 1050, wholesale: 920, min_stock: 10, unit: 'Kg', supplier: 1, desc: 'Stuffed cham cham with coconut dusting' },

    // Bakery (cat 2)
    { name: 'Fresh Milk Bread (Large)', name_urdu: 'تازہ ملک بریڈ (بڑی)', code: 'BAK-001', sku: 'BRD-001', barcode: '896400200201', cat: 2, brand: 'Sawera Bakery', purchase: 140, sale: 200, wholesale: 175, min_stock: 25, unit: 'Piece', supplier: 2, desc: 'Soft daily freshly baked milk bread' },
    { name: 'Chicken Patties (Special Puff)', name_urdu: 'چکن پیٹیز (بیکری تازہ)', code: 'BAK-002', sku: 'PAT-002', barcode: '896400200202', cat: 2, brand: 'Sawera Bakery', purchase: 65, sale: 110, wholesale: 95, min_stock: 30, unit: 'Piece', supplier: 2, desc: 'Crispy layered puff pastry filled with spiced shredded chicken' },
    { name: 'Crispy Butter Rusk 500g', name_urdu: 'مکھن رسک 500 گرام', code: 'BAK-003', sku: 'RSK-003', barcode: '896400200203', cat: 2, brand: 'Sawera Bakery', purchase: 180, sale: 280, wholesale: 240, min_stock: 20, unit: 'Pack', supplier: 2, desc: 'Tea-time crunchy double-baked butter rusks' },
    { name: 'Bakarkhani Sweet 400g', name_urdu: 'باقرخانی میٹھی 400 گرام', code: 'BAK-004', sku: 'BK-004', barcode: '896400200204', cat: 2, brand: 'Sawera Bakery', purchase: 160, sale: 250, wholesale: 220, min_stock: 15, unit: 'Pack', supplier: 2, desc: 'Layered traditional flaky bakarkhani' },

    // Cakes (cat 3)
    { name: 'Chocolate Fudge Cake 2 Lbs', name_urdu: 'چاکلیٹ فج کیک 2 پاؤنڈ', code: 'CAK-001', sku: 'CFC-001', barcode: '896400300301', cat: 3, brand: 'Sawera Bakery', purchase: 1100, sale: 1800, wholesale: 1600, min_stock: 5, unit: 'Piece', supplier: 2, desc: 'Decadent moist chocolate sponge drenched in Belgian chocolate ganache' },
    { name: 'Red Velvet Cream Cheese Cake 2 Lbs', name_urdu: 'ریڈ ویلوٹ کریم چیز کیک 2 پاؤنڈ', code: 'CAK-002', sku: 'RVC-002', barcode: '896400300302', cat: 3, brand: 'Sawera Bakery', purchase: 1300, sale: 2200, wholesale: 1900, min_stock: 4, unit: 'Piece', supplier: 2, desc: 'Classic red velvet layered with rich cream cheese frosting' },
    { name: 'Pineapple Gateau Cake 2 Lbs', name_urdu: 'پائن ایپل کیک 2 پاؤنڈ', code: 'CAK-003', sku: 'PAC-003', barcode: '896400300303', cat: 3, brand: 'Sawera Bakery', purchase: 950, sale: 1600, wholesale: 1400, min_stock: 5, unit: 'Piece', supplier: 2, desc: 'Fresh whipped cream cake topped with sweet pineapple chunks' },

    // Biscuits (cat 4)
    { name: 'Zeera Biscuits 500g', name_urdu: 'زیرہ بسکٹ 500 گرام', code: 'BIS-001', sku: 'ZB-001', barcode: '896400400401', cat: 4, brand: 'Sawera Bakery', purchase: 220, sale: 350, wholesale: 300, min_stock: 20, unit: 'Pack', supplier: 2, desc: 'Savoury cumin roasted cookies' },
    { name: 'Traditional Nan Khatai 500g', name_urdu: 'روایتی نان خطائی 500 گرام', code: 'BIS-002', sku: 'NK-002', barcode: '896400400402', cat: 4, brand: 'Sawera Bakery', purchase: 280, sale: 450, wholesale: 390, min_stock: 25, unit: 'Pack', supplier: 2, desc: 'Melt-in-mouth traditional desi cardamom nan khatai' },
    { name: 'Coconut Crunch Cookies 400g', name_urdu: 'کوکونٹ کرینچ کوکیز 400 گرام', code: 'BIS-003', sku: 'CK-003', barcode: '896400400403', cat: 4, brand: 'Sawera Bakery', purchase: 200, sale: 320, wholesale: 280, min_stock: 18, unit: 'Pack', supplier: 2, desc: 'Crispy coconut flakes baked biscuits' },

    // Cold Drinks (cat 5)
    { name: 'Gourmet Cola 1.5L Pet Bottle', name_urdu: 'گورمے کولا 1.5 لیٹر بوتل', code: 'DRK-001', sku: 'GC-15L', barcode: '896400500501', cat: 5, brand: 'Gourmet', purchase: 110, sale: 150, wholesale: 135, min_stock: 40, unit: 'Bottle', supplier: 3, desc: 'Chilled refreshing cola drink' },
    { name: 'Pakola Ice Cream Soda 500ml', name_urdu: 'پاکولا آئس کریم سوڈا 500 ملی لیٹر', code: 'DRK-002', sku: 'PAK-500', barcode: '896400500502', cat: 5, brand: 'Pakola', purchase: 65, sale: 90, wholesale: 80, min_stock: 30, unit: 'Bottle', supplier: 3, desc: 'Classic Pakistani ice cream soda flavor' },
    { name: 'Rooh Afza Syrup 800ml', name_urdu: 'روح افزا شربت 800 ملی لیٹر', code: 'DRK-003', sku: 'RA-800', barcode: '896400500503', cat: 5, brand: 'Hamdard', purchase: 360, sale: 450, wholesale: 410, min_stock: 15, unit: 'Bottle', supplier: 3, desc: 'Refreshing herbal red syrup for summer' },

    // Cosmetics (cat 6)
    { name: 'Golden Pearl Beauty Cream 28g', name_urdu: 'گولڈن پرل بیوٹی کریم 28 گرام', code: 'COS-001', sku: 'GP-001', barcode: '896400600601', cat: 6, brand: 'Golden Pearl', purchase: 260, sale: 350, wholesale: 310, min_stock: 20, unit: 'Piece', supplier: 4, desc: 'Top whitening face cream with natural minerals' },
    { name: 'Glow & Lovely Advanced Multivitamin 50g', name_urdu: 'گلو اینڈ لولی ملٹی وٹامن کریم 50 گرام', code: 'COS-002', sku: 'GL-002', barcode: '896400600602', cat: 6, brand: 'Unilever', purchase: 320, sale: 420, wholesale: 380, min_stock: 15, unit: 'Piece', supplier: 4, desc: 'Enriched fairness cream with vitamins B3, C, E' },
    { name: 'Saeed Ghani Pure Rose Water 120ml Spray', name_urdu: 'سعید غنی عرق گلاب اسپرے 120 ملی', code: 'COS-003', sku: 'SG-003', barcode: '896400600603', cat: 6, brand: 'Saeed Ghani', purchase: 150, sale: 220, wholesale: 190, min_stock: 15, unit: 'Bottle', supplier: 4, desc: 'Organic steam distilled rose water toner' },

    // Perfumes (cat 7)
    { name: 'J. Janan Pour Homme Eau De Parfum 100ml', name_urdu: 'جنید جمشید جاناں پرفیوم 100 ملی لیٹر', code: 'PRF-001', sku: 'JJ-001', barcode: '896400700701', cat: 7, brand: 'J.', purchase: 3800, sale: 5200, wholesale: 4700, min_stock: 6, unit: 'Bottle', supplier: 4, desc: 'Iconic masculine fragrance with bergamot, leather and musk' },
    { name: 'Oud Al-Layl Concentrated Attar 12ml', name_urdu: 'عود اللیل خالص عطر 12 ملی', code: 'PRF-002', sku: 'OAL-002', barcode: '896400700702', cat: 7, brand: 'Al-Haramain', purchase: 850, sale: 1350, wholesale: 1150, min_stock: 10, unit: 'Bottle', supplier: 4, desc: 'Long lasting alcohol-free Arabian woody oud perfume oil' },

    // Shampoo (cat 8)
    { name: 'Sunsilk Black Shine Shampoo 380ml', name_urdu: 'سن سلک بلیک شائن شیمپو 380 ملی', code: 'SHM-001', sku: 'SS-380', barcode: '896400800801', cat: 8, brand: 'Sunsilk', purchase: 520, sale: 680, wholesale: 610, min_stock: 15, unit: 'Bottle', supplier: 4, desc: 'Amla pearl complex for healthy black hair shine' },
    { name: 'Head & Shoulders Classic Clean 360ml', name_urdu: 'ہیڈ اینڈ شولڈرز کلاسک کلین 360 ملی', code: 'SHM-002', sku: 'HS-360', barcode: '896400800802', cat: 8, brand: 'P&G', purchase: 620, sale: 790, wholesale: 720, min_stock: 12, unit: 'Bottle', supplier: 4, desc: 'Anti-dandruff daily shampoo' },

    // Face Wash & Soaps (cat 9)
    { name: 'Dettol Original Soap 135g Pack of 3', name_urdu: 'ڈیٹول اوریجنل صابن 135 گرام 3 کا پیک', code: 'SOP-001', sku: 'DET-001', barcode: '896400900901', cat: 9, brand: 'Dettol', purchase: 390, sale: 490, wholesale: 450, min_stock: 25, unit: 'Pack', supplier: 4, desc: 'Antibacterial germ protection soap' },
    { name: 'Pond\'s Pure Bright Face Wash 100g', name_urdu: 'پونڈز پیور برائٹ فیس واش 100 گرام', code: 'SOP-002', sku: 'PND-002', barcode: '896400900902', cat: 9, brand: 'Ponds', purchase: 340, sale: 460, wholesale: 410, min_stock: 16, unit: 'Piece', supplier: 4, desc: 'Activated charcoal anti-pollution facial cleanser' },

    // Grocery & Dairy (cat 10)
    { name: 'Olper\'s Full Cream Milk 1 Liter UHT', name_urdu: 'اولپرز فل کریم دودھ 1 لیٹر', code: 'GRO-001', sku: 'OLP-001', barcode: '896401001001', cat: 10, brand: 'Engro', purchase: 275, sale: 320, wholesale: 300, min_stock: 50, unit: 'Pack', supplier: 5, desc: 'Pure homogenized UHT whole milk' },
    { name: 'Dalda Banaspati Ghee 1kg Pouch', name_urdu: 'ڈالڈا بناسپتی گھی 1 کلو پاؤچ', code: 'GRO-002', sku: 'DAL-002', barcode: '896401001002', cat: 10, brand: 'Dalda', purchase: 510, sale: 580, wholesale: 550, min_stock: 30, unit: 'Pack', supplier: 5, desc: 'Vitamin A & D enriched premium cooking ghee' },
    { name: 'Tapal Danedar Tea 430g Poly Pack', name_urdu: 'ٹاپل دانے دار چائے 430 گرام', code: 'GRO-003', sku: 'TAP-003', barcode: '896401001003', cat: 10, brand: 'Tapal', purchase: 650, sale: 780, wholesale: 730, min_stock: 20, unit: 'Pack', supplier: 5, desc: 'Strong aromatic Kenyan leaf tea' }
  ];

  const insertProduct = db.prepare(`
    INSERT INTO products (name, name_urdu, code, sku, barcode, category_id, brand, purchase_price, sale_price, wholesale_price, min_stock, unit, supplier_id, image_url, description, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  const insertInventory = db.prepare(`
    INSERT INTO branch_inventory (branch_id, product_id, quantity, last_restocked)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);

  const insertStockMovement = db.prepare(`
    INSERT INTO stock_movements (product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id)
    VALUES (?, ?, 'purchase', ?, 0, ?, 'INITIAL-OPENING', 'Initial Stock Seeding', 1)
  `);

  for (let idx = 0; idx < products.length; idx++) {
    const p = products[idx];
    const res = insertProduct.run(
      p.name,
      p.name_urdu,
      p.code,
      p.sku,
      p.barcode,
      p.cat,
      p.brand,
      p.purchase,
      p.sale,
      p.wholesale,
      p.min_stock,
      p.unit,
      p.supplier,
      `https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=200&auto=format&fit=crop&q=60`,
      p.desc
    );
    const prodId = Number(res.lastInsertRowid);

    // Seed stock for all 4 branches with realistic quantities
    // Make branch 1 well stocked, branch 2 medium, branch 3 low on a couple items (to demonstrate alerts)
    const baseStocks = [40, 25, 18, 30]; // stock for branch 1, 2, 3, 4
    for (let b = 1; b <= 4; b++) {
      let qty = baseStocks[b - 1];
      // Intentionally make item 4 and 12 low stock in branch 2/3 for testing alert banners
      if ((idx === 3 || idx === 11) && b === 2) {
        qty = 3; // trigger low stock alert
      } else if (idx === 7 && b === 3) {
        qty = 0; // trigger out of stock alert
      }
      insertInventory.run(b, prodId, qty);
      insertStockMovement.run(prodId, b, qty, qty);
    }
  }

  // 8. Seed sample expenses for branches
  const expenses = [
    { no: 'EXP-B1-001', branch: 1, cat: 'electricity', title: 'WAPDA Commercial Electricity Bill', amount: 48500, paid_to: 'LESCO / IESCO', date: new Date().toISOString().split('T')[0] },
    { no: 'EXP-B1-002', branch: 1, cat: 'salaries', title: 'Staff Monthly Advance Salaries', amount: 35000, paid_to: 'Bakery Chef & Karigar', date: new Date().toISOString().split('T')[0] },
    { no: 'EXP-B2-001', branch: 2, cat: 'rent', title: 'Gulberg Branch Shop Rent Advance', amount: 85000, paid_to: 'Plaza Owner', date: new Date().toISOString().split('T')[0] },
    { no: 'EXP-B1-003', branch: 1, cat: 'packaging', title: 'Sweet Boxes & Printed Ribbon Cartons', amount: 18000, paid_to: 'Gourmet Packaging', date: new Date().toISOString().split('T')[0] },
    { no: 'EXP-B3-001', branch: 3, cat: 'maintenance', title: 'Display Chiller Gas Refill & Servicing', amount: 7500, paid_to: 'Cool Star Technician', date: new Date().toISOString().split('T')[0] }
  ];

  const insertExpense = db.prepare(`
    INSERT INTO expenses (expense_no, branch_id, category, title, amount, payment_method, paid_to, date, user_id)
    VALUES (?, ?, ?, ?, ?, 'cash', ?, ?, 1)
  `);
  for (const e of expenses) {
    insertExpense.run(e.no, e.branch, e.cat, e.title, e.amount, e.paid_to, e.date);
  }

  // 9. Seed an active Cash Register session for Branch 1
  db.prepare(`
    INSERT INTO cash_registers (branch_id, user_id, opening_cash, expected_cash, actual_cash, difference, status, notes)
    VALUES (1, 1, 10000, 10000, 0, 0, 'open', 'Shift 1 Morning opening float Rs. 10,000')
  `).run();

  // 10. Seed a couple realistic completed sales to populate charts & stats
  const sale1 = db.prepare(`
    INSERT INTO sales (invoice_no, branch_id, customer_id, user_id, subtotal, discount_type, discount_value, discount_amount, tax_percentage, tax_amount, grand_total, paid_amount, change_amount, credit_amount, payment_method, status, total_cost, profit)
    VALUES ('SSB-B1-2026-0001', 1, 1, 1, 3300, 'fixed', 100, 100, 0, 0, 3200, 3500, 300, 0, 'cash', 'completed', 2250, 950)
  `).run();
  const sale1Id = Number(sale1.lastInsertRowid);

  db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, product_name, product_code, unit, purchase_price, unit_price, quantity, discount_amount, line_total)
    VALUES (?, 1, 'Special Gulab Jamun (Desi Ghee)', 'SWT-001', 'Kg', 750, 1100, 2, 50, 2150)
  `).run(sale1Id);

  db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, product_name, product_code, unit, purchase_price, unit_price, quantity, discount_amount, line_total)
    VALUES (?, 5, 'Plain Khoya Barfi', 'SWT-005', 'Kg', 800, 1200, 1, 50, 1150)
  `).run(sale1Id);

  const sale2 = db.prepare(`
    INSERT INTO sales (invoice_no, branch_id, customer_id, user_id, subtotal, discount_type, discount_value, discount_amount, tax_percentage, tax_amount, grand_total, paid_amount, change_amount, credit_amount, payment_method, split_details, status, total_cost, profit)
    VALUES ('SSB-B2-2026-0002', 2, 2, 2, 2750, 'fixed', 0, 0, 0, 0, 2750, 2750, 0, 0, 'split', '{"cash":1500,"easypaisa":1250}', 'completed', 1700, 1050)
  `).run();
  const sale2Id = Number(sale2.lastInsertRowid);

  db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, product_name, product_code, unit, purchase_price, unit_price, quantity, discount_amount, line_total)
    VALUES (?, 9, 'Chocolate Fudge Cake 2 Lbs', 'CAK-001', 'Piece', 1100, 1800, 1, 0, 1800)
  `).run(sale2Id);

  db.prepare(`
    INSERT INTO sale_items (sale_id, product_id, product_name, product_code, unit, purchase_price, unit_price, quantity, discount_amount, line_total)
    VALUES (?, 10, 'Special Jalebi (Desi Ghee)', 'SWT-006', 'Kg', 500, 800, 1, 0, 800)
  `).run(sale2Id);

  // Log audit
  logAudit({
    userId: 1,
    username: 'admin',
    branchId: 1,
    action: 'INITIAL_SEED',
    entity: 'SYSTEM',
    details: 'Initial system seeding with 4 branches, products, stock, and settings.'
  });

  console.log('Initial data seeded successfully!');
}

export function seedProductionAndRecipes() {
  try {
    const rawCat = db.prepare("SELECT id FROM categories WHERE name = 'Raw Materials'").get();
    let rawCatId = rawCat?.id;
    if (!rawCatId) {
      const insCat = db.prepare("INSERT INTO categories (name, name_urdu, icon, color, sort_order) VALUES ('Raw Materials', 'خام مال', 'Layers', 'emerald', 7)").run();
      rawCatId = Number(insCat.lastInsertRowid);
    }

    const rawMaterials = [
      { name: 'Khoya (Pure Mawa)', name_urdu: 'کھویا خالص', code: 'RAW-001', sku: 'KHY-001', barcode: '896499000001', purchase: 700, sale: 850, unit: 'Kg', stock: 100 },
      { name: 'Desi Ghee (Cow Pure)', name_urdu: 'خالص دیسی گھی', code: 'RAW-002', sku: 'GHE-002', barcode: '896499000002', purchase: 1800, sale: 2200, unit: 'Kg', stock: 80 },
      { name: 'Sugar (Refined White)', name_urdu: 'چینی سفید', code: 'RAW-003', sku: 'SGR-003', barcode: '896499000003', purchase: 140, sale: 160, unit: 'Kg', stock: 500 },
      { name: 'Maida (Super Fine Flour)', name_urdu: 'میدہ سپر فائن', code: 'RAW-004', sku: 'MDA-004', barcode: '896499000004', purchase: 130, sale: 150, unit: 'Kg', stock: 300 },
      { name: 'Milk Powder (Full Cream)', name_urdu: 'خشک دودھ فل کریم', code: 'RAW-005', sku: 'MLK-005', barcode: '896499000005', purchase: 850, sale: 1000, unit: 'Kg', stock: 150 },
      { name: 'Pistachio / Pista Kernel', name_urdu: 'پستہ مغز', code: 'RAW-006', sku: 'PST-006', barcode: '896499000006', purchase: 3500, sale: 4200, unit: 'Kg', stock: 25 },
      { name: 'Cardamom / Green Elaichi', name_urdu: 'سبز الائچی', code: 'RAW-007', sku: 'ELC-007', barcode: '896499000007', purchase: 4500, sale: 5500, unit: 'Kg', stock: 15 },
      { name: 'Cocoa Powder Dutch Process', name_urdu: 'کوکو پاؤڈر', code: 'RAW-008', sku: 'CCA-008', barcode: '896499000008', purchase: 1200, sale: 1500, unit: 'Kg', stock: 40 },
      { name: 'Fresh Eggs (Large)', name_urdu: 'تازہ انڈے', code: 'RAW-009', sku: 'EGG-009', barcode: '896499000009', purchase: 320, sale: 360, unit: 'Dozen', stock: 100 },
      { name: 'Cooking Oil (Canola)', name_urdu: 'کوکنگ آئل', code: 'RAW-010', sku: 'OIL-010', barcode: '896499000010', purchase: 450, sale: 500, unit: 'Liter', stock: 120 }
    ];

    const branches = db.prepare('SELECT id FROM branches').all();

    for (const rm of rawMaterials) {
      const existing = db.prepare('SELECT id FROM products WHERE code = ?').get(rm.code);
      let prodId = existing?.id;
      if (!prodId) {
        const ins = db.prepare(`
          INSERT INTO products (name, name_urdu, code, sku, barcode, category_id, brand, purchase_price, sale_price, min_stock, unit, product_type, status)
          VALUES (?, ?, ?, ?, ?, ?, 'Sawera Raw Materials', ?, ?, 10, ?, 'raw_material', 'active')
        `).run(rm.name, rm.name_urdu, rm.code, rm.sku, rm.barcode, rawCatId, rm.purchase, rm.sale, rm.unit);
        prodId = Number(ins.lastInsertRowid);

        for (const b of branches) {
          db.prepare('INSERT OR IGNORE INTO branch_inventory (branch_id, product_id, quantity) VALUES (?, ?, ?)').run(b.id, prodId, rm.stock);
        }
      }
    }

    // Seed Recipes
    const existingRecipe = db.prepare('SELECT COUNT(*) as count FROM recipes').get().count;
    if (existingRecipe === 0) {
      const getProd = (c) => db.prepare('SELECT id FROM products WHERE code = ?').get(c)?.id;

      const r1 = db.prepare(`
        INSERT INTO recipes (name, name_urdu, finished_product_id, expected_yield, yield_unit, instructions)
        VALUES ('Special Gulab Jamun (10 Kg Batch)', 'اسپیشل گلاب جامن 10 کلو ترکیب', ?, 10, 'Kg', 'Knead fresh khoya with maida and milk powder into soft dough balls. Deep fry in pure cow desi ghee over gentle flame until golden brown. Soak in hot fragrant sugar syrup flavored with green cardamom.')
      `).run(getProd('SWT-001') || 1);
      const r1Id = Number(r1.lastInsertRowid);
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r1Id, getProd('RAW-001'), 4, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r1Id, getProd('RAW-004'), 1, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r1Id, getProd('RAW-005'), 1, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r1Id, getProd('RAW-003'), 5, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r1Id, getProd('RAW-002'), 2, 'Kg');

      const r2 = db.prepare(`
        INSERT INTO recipes (name, name_urdu, finished_product_id, expected_yield, yield_unit, instructions)
        VALUES ('Plain Khoya Barfi (10 Kg Batch)', 'سادہ کھویا برفی 10 کلو ترکیب', ?, 10, 'Kg', 'Roast pure khoya over slow heat until aromatic. Gradually fold in refined sugar and cardamom powder. Spread evenly in greased trays and set before slicing.')
      `).run(getProd('SWT-005') || 5);
      const r2Id = Number(r2.lastInsertRowid);
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r2Id, getProd('RAW-001'), 8, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r2Id, getProd('RAW-003'), 3, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r2Id, getProd('RAW-007'), 0.05, 'Kg');

      const r3 = db.prepare(`
        INSERT INTO recipes (name, name_urdu, finished_product_id, expected_yield, yield_unit, instructions)
        VALUES ('Pista Barfi (Special Khoya) (10 Kg Batch)', 'پستہ برفی 10 کلو ترکیب', ?, 10, 'Kg', 'Blend pure khoya and sugar over low flame. Fold in crushed green pistachios. Garnish with edible silver leaves and slivered pistachios.')
      `).run(getProd('SWT-004') || 4);
      const r3Id = Number(r3.lastInsertRowid);
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r3Id, getProd('RAW-001'), 7.5, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r3Id, getProd('RAW-003'), 3, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r3Id, getProd('RAW-006'), 0.75, 'Kg');

      const r4 = db.prepare(`
        INSERT INTO recipes (name, name_urdu, finished_product_id, expected_yield, yield_unit, instructions)
        VALUES ('Chocolate Fudge Cake 2 Lbs (5 Cakes Batch)', 'چاکلیٹ فج کیک 5 عدد ترکیب', ?, 5, 'Piece', 'Whisk eggs with sugar and oil until fluffy. Sift maida and premium cocoa powder. Bake at 180C for 35 mins. Layer with rich chocolate fudge frosting.')
      `).run(getProd('CAK-001') || 9);
      const r4Id = Number(r4.lastInsertRowid);
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r4Id, getProd('RAW-004'), 1.5, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r4Id, getProd('RAW-003'), 1.5, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r4Id, getProd('RAW-008'), 0.5, 'Kg');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r4Id, getProd('RAW-009'), 2, 'Dozen');
      db.prepare('INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit) VALUES (?, ?, ?, ?)').run(r4Id, getProd('RAW-010'), 1, 'Liter');
    }

    // Seed a couple sample promotions
    const promoCount = db.prepare('SELECT COUNT(*) as count FROM promotions').get().count;
    if (promoCount === 0) {
      db.prepare(`
        INSERT INTO promotions (title, type, value, min_order_amount, status)
        VALUES ('10% Off Orders Above Rs. 5000', 'percentage', 10, 5000, 'active')
      `).run();
      db.prepare(`
        INSERT INTO promotions (title, type, value, min_order_amount, status)
        VALUES ('Flat Rs. 200 Off Orders Above Rs. 3000', 'fixed', 200, 3000, 'active')
      `).run();
    }
  } catch (err) {
    console.error('Error seeding production/recipes:', err);
  }
}

export default db;
