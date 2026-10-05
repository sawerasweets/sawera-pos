import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// List waste logs
router.get('/', authenticate, (req, res) => {
  const { branch_id, reason, date_from, date_to, limit = 50 } = req.query;

  let query = `
    SELECT w.*, p.name as product_name, p.code as product_code, p.unit as product_unit,
           b.name as branch_name, u.name as user_name
    FROM waste_logs w
    JOIN products p ON w.product_id = p.id
    JOIN branches b ON w.branch_id = b.id
    JOIN users u ON w.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (branch_id && branch_id !== 'all') {
    query += ` AND w.branch_id = ?`;
    params.push(Number(branch_id));
  }

  if (reason && reason !== 'all') {
    query += ` AND w.reason = ?`;
    params.push(reason);
  }

  if (date_from) {
    query += ` AND date(w.created_at) >= date(?)`;
    params.push(date_from);
  }

  if (date_to) {
    query += ` AND date(w.created_at) <= date(?)`;
    params.push(date_to);
  }

  query += ` ORDER BY w.created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const waste_logs = db.prepare(query).all(...params);

  // Summary totals
  let totalLoss = 0;
  for (const wl of waste_logs) {
    totalLoss += wl.total_loss;
  }

  res.json({ waste_logs, total_loss: totalLoss });
});

// Record waste entry (burnt sweets, expired cakes, damaged packs, production waste)
router.post('/', authenticate, requirePermission('manage_inventory'), (req, res) => {
  const { product_id, branch_id, quantity, reason, notes } = req.body;

  if (!product_id || !quantity || Number(quantity) <= 0 || !reason) {
    return res.status(400).json({ error: 'Product, valid positive quantity, and waste reason are required.' });
  }

  const branchId = Number(branch_id || req.user.branch_id || 1);
  const prodId = Number(product_id);
  const qty = Number(quantity);

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const curStock = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(branchId, prodId)?.quantity || 0;
  if (curStock < qty) {
    return res.status(400).json({ error: `Cannot record waste of ${qty} ${product.unit}. Current stock is only ${curStock} ${product.unit}.` });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const wasteCount = db.prepare(`SELECT COUNT(*) as count FROM waste_logs WHERE waste_no LIKE 'WST-${dateStr}-%'`).get().count + 1;
    const wasteNo = `WST-${dateStr}-${String(wasteCount).padStart(4, '0')}`;

    const costPrice = product.purchase_price;
    const totalLoss = costPrice * qty;

    // Deduct stock
    db.prepare('UPDATE branch_inventory SET quantity = quantity - ? WHERE branch_id = ? AND product_id = ?').run(qty, branchId, prodId);

    // Movement ledger
    db.prepare(`
      INSERT INTO stock_movements (product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id)
      VALUES (?, ?, 'damage', ?, ?, ?, ?, ?, ?)
    `).run(
      prodId,
      branchId,
      -qty,
      curStock,
      curStock - qty,
      wasteNo,
      `Waste recorded: ${reason} (${notes || ''})`,
      req.user.id
    );

    // Insert waste log
    const wResult = db.prepare(`
      INSERT INTO waste_logs (waste_no, product_id, branch_id, quantity, unit, cost_price, total_loss, reason, user_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      wasteNo,
      prodId,
      branchId,
      qty,
      product.unit,
      costPrice,
      totalLoss,
      reason,
      req.user.id,
      notes || null
    );

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId,
      action: 'WASTE_LOGGED',
      entity: 'WASTE',
      entityId: wResult.lastInsertRowid,
      details: `Logged waste of ${qty} ${product.unit} for "${product.name}" (Reason: ${reason}, Loss: Rs. ${totalLoss})`
    });

    res.status(201).json({
      message: 'Waste recorded and stock decremented successfully.',
      waste_no: wasteNo,
      total_loss: totalLoss
    });

  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

export default router;
