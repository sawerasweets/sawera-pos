import { Router } from 'express';
import db, { logAudit, seedInitialData } from '../db.js';
import { authenticate, requireRole, requirePermission } from '../middleware/auth.js';

const router = Router();

// Get all settings
router.get('/', authenticate, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  res.json({ settings });
});

// Update settings
router.post('/', authenticate, requirePermission('manage_settings'), (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object is required.' });
  }

  const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  for (const [key, value] of Object.entries(settings)) {
    setSetting.run(key, String(value));
  }

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: req.user.branch_id,
    action: 'UPDATE_SETTINGS',
    entity: 'SETTINGS',
    details: `Updated system settings`
  });

  res.json({ message: 'Settings saved successfully' });
});

// Purge All Demo Data while preserving Products and setting stock to 0
router.post('/clean-demo-data', authenticate, requireRole(['admin']), (req, res) => {
  try {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('UPDATE branch_inventory SET quantity = 0, last_restocked = NULL;');
    db.exec('DELETE FROM stock_movements;');
    db.exec('DELETE FROM sales_return_items;');
    db.exec('DELETE FROM sales_returns;');
    db.exec('DELETE FROM sale_items;');
    db.exec('DELETE FROM sales;');
    db.exec('DELETE FROM purchase_items;');
    db.exec('DELETE FROM purchases;');
    db.exec('DELETE FROM purchase_returns;');
    db.exec('DELETE FROM expenses;');
    db.exec('DELETE FROM cash_registers;');
    db.exec('DELETE FROM shifts;');
    db.exec('DELETE FROM waste_logs;');
    db.exec('DELETE FROM production_items;');
    db.exec('DELETE FROM productions;');
    db.exec('DELETE FROM stock_audit_items;');
    db.exec('DELETE FROM stock_audits;');
    db.exec('DELETE FROM quotation_items;');
    db.exec('DELETE FROM quotations;');
    db.exec('DELETE FROM branch_transfer_items;');
    db.exec('DELETE FROM branch_transfers;');
    db.exec('DELETE FROM parked_bills;');
    db.exec('DELETE FROM loyalty_logs;');
    db.exec('DELETE FROM price_change_requests;');
    db.exec('DELETE FROM customer_payments;');
    db.exec('DELETE FROM supplier_payments;');
    db.exec('DELETE FROM audit_logs;');
    db.exec('DELETE FROM customers;');
    db.exec(`
      INSERT INTO customers (id, name, phone, email, address, opening_balance, current_balance, credit_limit, status)
      VALUES (1, 'Walk-in Customer (عام گاہک)', '0300-0000000', '', 'Counter Sale', 0, 0, 50000, 'active');
    `);
    db.exec('UPDATE suppliers SET opening_balance = 0, current_balance = 0;');
    db.exec('PRAGMA foreign_keys = ON;');
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

    res.json({ message: 'All demo data removed successfully! Product names preserved with 0 stock.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
