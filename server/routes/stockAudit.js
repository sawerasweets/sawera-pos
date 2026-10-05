import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// Get items for physical counting in a branch
router.get('/items', authenticate, (req, res) => {
  const branchId = Number(req.query.branch_id || req.user.branch_id || 1);
  const categoryId = req.query.category_id;

  let query = `
    SELECT p.id as product_id, p.name as product_name, p.code as product_code,
           p.barcode, p.unit, p.purchase_price, p.sale_price,
           c.name as category_name,
           COALESCE(bi.quantity, 0) as system_quantity
    FROM products p
    LEFT JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = ?
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.status = 'active'
  `;
  const params = [branchId];

  if (categoryId && categoryId !== 'all') {
    query += ` AND p.category_id = ?`;
    params.push(Number(categoryId));
  }

  query += ` ORDER BY p.name ASC`;

  const items = db.prepare(query).all(...params);
  res.json({ items });
});

// Submit physical stock audit / count
router.post('/', authenticate, requirePermission('manage_inventory'), (req, res) => {
  const { branch_id, items, apply_adjustments = true, notes } = req.body;
  const branchId = Number(branch_id || req.user.branch_id || 1);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Please submit at least one counted product.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const auditCount = db.prepare(`SELECT COUNT(*) as count FROM stock_audits WHERE audit_no LIKE 'AUD-${dateStr}-%'`).get().count + 1;
    const auditNo = `AUD-${dateStr}-${String(auditCount).padStart(4, '0')}`;

    const insertAudit = db.prepare(`
      INSERT INTO stock_audits (audit_no, branch_id, user_id, status, notes)
      VALUES (?, ?, ?, 'completed', ?)
    `);
    const aResult = insertAudit.run(auditNo, branchId, req.user.id, notes || 'Physical Stock Count Reconciliation');
    const auditId = Number(aResult.lastInsertRowid);

    const insertAuditItem = db.prepare(`
      INSERT INTO stock_audit_items (audit_id, product_id, system_quantity, physical_quantity, variance, reason)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateInventory = db.prepare(`
      INSERT INTO branch_inventory (branch_id, product_id, quantity, last_restocked)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(branch_id, product_id) DO UPDATE SET quantity = ?, last_restocked = CURRENT_TIMESTAMP
    `);

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id)
      VALUES (?, ?, 'manual_adjustment', ?, ?, ?, ?, ?, ?)
    `);

    let discrepanciesCount = 0;

    for (const item of items) {
      const prodId = Number(item.product_id);
      const physicalQty = Number(item.physical_quantity);
      const systemQty = Number(item.system_quantity || 0);
      const variance = physicalQty - systemQty;

      if (variance !== 0) {
        discrepanciesCount++;
      }

      insertAuditItem.run(
        auditId,
        prodId,
        systemQty,
        physicalQty,
        variance,
        item.reason || (variance > 0 ? 'Surplus found during count' : variance < 0 ? 'Shortage during count' : 'Match')
      );

      if (apply_adjustments && variance !== 0) {
        updateInventory.run(branchId, prodId, physicalQty, physicalQty);

        insertMovement.run(
          prodId,
          branchId,
          variance,
          systemQty,
          physicalQty,
          auditNo,
          `Physical stock count reconciliation (Variance: ${variance >= 0 ? '+' : ''}${variance})`,
          req.user.id
        );
      }
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId,
      action: 'STOCK_AUDIT',
      entity: 'INVENTORY',
      entityId: auditId,
      details: `Physical stock audit #${auditNo} completed with ${discrepanciesCount} variances (Adjustments Applied: ${apply_adjustments})`
    });

    res.status(201).json({
      message: 'Physical stock count saved successfully!',
      audit_no: auditNo,
      discrepancies_count: discrepanciesCount
    });

  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// List past audits
router.get('/history', authenticate, (req, res) => {
  const { branch_id, limit = 30 } = req.query;

  let query = `
    SELECT sa.*, b.name as branch_name, u.name as user_name,
           (SELECT COUNT(*) FROM stock_audit_items WHERE audit_id = sa.id) as items_count,
           (SELECT COUNT(*) FROM stock_audit_items WHERE audit_id = sa.id AND variance != 0) as discrepancies_count
    FROM stock_audits sa
    JOIN branches b ON sa.branch_id = b.id
    JOIN users u ON sa.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (branch_id && branch_id !== 'all') {
    query += ` AND sa.branch_id = ?`;
    params.push(Number(branch_id));
  }

  query += ` ORDER BY sa.created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const audits = db.prepare(query).all(...params);
  res.json({ audits });
});

export default router;
