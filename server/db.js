import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'sawera_pos.sqlite');
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
    { key: 'business_name', value: 'Sawera Sweets & Bakers' },
    { key: 'business_name_urdu', value: 'سویرا سویٹس اینڈ بیکرز' },
    { key: 'phone', value: '0322-7434080' },
    { key: 'email', value: 'info@sawerasweets.com' },
    { key: 'address', value: 'Gojra Road opp DHQ Hospital' },
    { key: 'ntn', value: '' },
    { key: 'strn', value: '' },
    { key: 'currency', value: 'Rs.' },
    { key: 'tax_rate', value: '0' }, // 0% by default, configurable
    { key: 'receipt_header', value: 'Sawera Sweets & Bakers - Quality Sweets & Fresh Bakery' },
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
      name: 'Main Branch',
      name_urdu: 'مین برانچ',
      address: 'Gojra Road opp DHQ Hospital',
      phone: '0322-7434080',
      manager_name: 'Store Manager',
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

  // Log audit
  logAudit({
    userId: 1,
    username: 'admin',
    branchId: 1,
    action: 'INITIAL_SEED',
    entity: 'SYSTEM',
    details: 'Initial system seeding with settings, branches, users, and categories.'
  });

  console.log('Initial system configurations seeded successfully (0 demo products)!');
}

export function seedProductionAndRecipes() {
  try {
    const rawCat = db.prepare("SELECT id FROM categories WHERE name = 'Raw Materials'").get();
    if (!rawCat) {
      db.prepare("INSERT INTO categories (name, name_urdu, icon, color, sort_order) VALUES ('Raw Materials', 'خام مال', 'Layers', 'emerald', 7)").run();
    }
  } catch (err) {
    console.error('Error ensuring raw materials category:', err);
  }
}

export default db;
