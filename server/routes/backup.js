import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db, { logAudit } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, '..', '..', 'data', 'sawera_pos.sqlite');

const router = Router();

// Get Backup Status & Info
router.get('/info', authenticate, requireRole(['admin']), (req, res) => {
  let fileSize = 0;
  if (fs.existsSync(DB_FILE)) {
    const stats = fs.statSync(DB_FILE);
    fileSize = (stats.size / (1024 * 1024)).toFixed(2); // MB
  }

  const lastBackup = db.prepare("SELECT value FROM settings WHERE key = 'last_backup_date'").get()?.value || 'Never';

  const tables = [
    'branches', 'users', 'categories', 'products', 'branch_inventory',
    'sales', 'sale_items', 'purchases', 'purchase_items', 'suppliers',
    'customers', 'customer_payments', 'expenses', 'cash_registers', 'audit_logs'
  ];

  const counts = {};
  for (const t of tables) {
    try {
      counts[t] = db.prepare(`SELECT COUNT(*) as count FROM ${t}`).get().count;
    } catch {
      counts[t] = 0;
    }
  }

  res.json({
    db_size_mb: fileSize,
    last_backup: lastBackup,
    record_counts: counts
  });
});

// Download JSON Backup
router.get('/download', authenticate, requireRole(['admin']), (req, res) => {
  const tables = [
    'branches', 'users', 'categories', 'products', 'branch_inventory',
    'stock_movements', 'sales', 'sale_items', 'purchases', 'purchase_items',
    'suppliers', 'customers', 'customer_payments', 'supplier_payments',
    'sales_returns', 'sales_return_items', 'purchase_returns',
    'expenses', 'cash_registers', 'branch_transfers', 'branch_transfer_items',
    'settings'
  ];

  const backupData = {
    version: '1.0.0',
    business: 'Sawera Sweet & Bakers',
    exported_at: new Date().toISOString(),
    exported_by: req.user.username,
    tables: {}
  };

  for (const t of tables) {
    try {
      backupData.tables[t] = db.prepare(`SELECT * FROM ${t}`).all();
    } catch (e) {
      backupData.tables[t] = [];
    }
  }

  const nowStr = new Date().toISOString();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_backup_date', ?)").run(nowStr);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: req.user.branch_id,
    action: 'BACKUP_DOWNLOAD',
    entity: 'BACKUP',
    details: 'Downloaded full database JSON backup'
  });

  const filename = `sawera_sweets_backup_${nowStr.slice(0, 10)}.json`;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(JSON.stringify(backupData, null, 2));
});

// Restore Backup from JSON Payload
router.post('/restore', authenticate, requireRole(['admin']), (req, res) => {
  const { backupData } = req.body;
  if (!backupData || !backupData.tables) {
    return res.status(400).json({ error: 'Invalid backup structure. Missing "tables" property.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    for (const [table, rows] of Object.entries(backupData.tables)) {
      if (!Array.isArray(rows) || rows.length === 0) continue;

      // Clear existing table contents
      try {
        db.exec(`DELETE FROM ${table};`);
      } catch (e) {
        continue;
      }

      // Re-insert rows
      const columns = Object.keys(rows[0]);
      const placeholders = columns.map(() => '?').join(', ');
      const insertStmt = db.prepare(`INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);

      for (const row of rows) {
        insertStmt.run(...columns.map(col => row[col]));
      }
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: req.user.branch_id,
      action: 'BACKUP_RESTORE',
      entity: 'BACKUP',
      details: `Restored database from backup file dated ${backupData.exported_at || 'unknown'}`
    });

    res.json({ message: 'Database successfully restored from backup!' });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: `Restore failed: ${err.message}` });
  }
});

// Remove Demo Data / Start Fresh (Strictly Admin only, requires confirmation)
router.post('/clean-demo-data', authenticate, requireRole(['admin']), (req, res) => {
  const { confirmationCode } = req.body;
  if (confirmationCode !== 'START_FRESH') {
    return res.status(400).json({
      error: 'Confirmation code "START_FRESH" is required to remove demo data.'
    });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    // Remove transactional demo records
    db.exec('DELETE FROM sales_returns;');
    db.exec('DELETE FROM sales_return_items;');
    db.exec('DELETE FROM sale_items;');
    db.exec('DELETE FROM sales;');
    db.exec('DELETE FROM purchase_items;');
    db.exec('DELETE FROM purchases;');
    db.exec('DELETE FROM purchase_returns;');
    db.exec('DELETE FROM customer_payments;');
    db.exec('DELETE FROM supplier_payments;');
    db.exec('DELETE FROM expenses;');
    db.exec('DELETE FROM cash_registers;');
    db.exec('DELETE FROM stock_movements;');
    db.exec('DELETE FROM branch_transfers;');
    db.exec('DELETE FROM branch_transfer_items;');
    db.exec('DELETE FROM stock_audits;');
    db.exec('DELETE FROM stock_audit_items;');
    db.exec('DELETE FROM waste_logs;');
    db.exec('DELETE FROM production_batches;');
    db.exec('DELETE FROM quotations;');
    db.exec('DELETE FROM quotation_items;');
    db.exec('DELETE FROM parked_bills;');
    db.exec('DELETE FROM loyalty_logs;');

    // Reset customer udhaar & balances
    db.exec('UPDATE customers SET current_balance = 0, loyalty_points = 0;');

    // Reset supplier balances
    db.exec('UPDATE suppliers SET current_balance = 0;');

    // Reset inventory stock to 0
    db.exec('UPDATE branch_inventory SET quantity = 0;');

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: req.user.branch_id,
      action: 'REMOVE_DEMO_DATA',
      entity: 'SYSTEM',
      details: 'Admin executed START FRESH / Remove Demo Data. Production settings, branches, and admin accounts preserved.'
    });

    res.json({
      message: 'Demo transaction data cleared successfully! System is fresh and ready for live production use.',
      preserved: [
        'System & Business Settings',
        'Branch Configurations (4 Branches)',
        'Admin Accounts',
        'Printer & Barcode Settings',
        'Product & Category Catalog Architecture'
      ]
    });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: `Clean demo data failed: ${err.message}` });
  }
});

export default router;
