import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// List quotations
router.get('/', authenticate, (req, res) => {
  const { branch_id, status, limit = 50 } = req.query;

  let query = `
    SELECT q.*, b.name as branch_name, c.name as customer_name, c.phone as customer_phone,
           u.name as user_name,
           (SELECT COUNT(*) FROM quotation_items WHERE quotation_id = q.id) as items_count
    FROM quotations q
    JOIN branches b ON q.branch_id = b.id
    LEFT JOIN customers c ON q.customer_id = c.id
    JOIN users u ON q.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (branch_id && branch_id !== 'all') {
    query += ` AND q.branch_id = ?`;
    params.push(Number(branch_id));
  }

  if (status && status !== 'all') {
    query += ` AND q.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY q.created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const quotations = db.prepare(query).all(...params);
  res.json({ quotations });
});

// Single quotation detail
router.get('/:id', authenticate, (req, res) => {
  const quotation = db.prepare(`
    SELECT q.*, b.name as branch_name, c.name as customer_name, c.phone as customer_phone,
           u.name as user_name
    FROM quotations q
    JOIN branches b ON q.branch_id = b.id
    LEFT JOIN customers c ON q.customer_id = c.id
    JOIN users u ON q.user_id = u.id
    WHERE q.id = ?
  `).get(req.params.id);

  if (!quotation) {
    return res.status(404).json({ error: 'Quotation not found.' });
  }

  const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id = ?').all(quotation.id);
  res.json({ quotation: { ...quotation, items } });
});

// Create quotation
router.post('/', authenticate, requirePermission('pos_access'), (req, res) => {
  const { branch_id, customer_id, items, subtotal, discount_amount = 0, tax_amount = 0, grand_total, valid_until, notes } = req.body;
  const branchId = Number(branch_id || req.user.branch_id || 1);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Please add items to quotation.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = db.prepare(`SELECT COUNT(*) as count FROM quotations WHERE quotation_no LIKE 'QT-${dateStr}-%'`).get().count + 1;
    const quotationNo = `QT-${dateStr}-${String(count).padStart(4, '0')}`;

    const qResult = db.prepare(`
      INSERT INTO quotations (quotation_no, branch_id, customer_id, user_id, subtotal, discount_amount, tax_amount, grand_total, valid_until, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      quotationNo,
      branchId,
      customer_id ? Number(customer_id) : null,
      req.user.id,
      Number(subtotal),
      Number(discount_amount),
      Number(tax_amount),
      Number(grand_total),
      valid_until || null,
      notes || null
    );
    const quotationId = Number(qResult.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO quotation_items (quotation_id, product_id, product_name, unit, unit_price, quantity, discount_amount, line_total, weight_grams, rate_per_kg)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      insertItem.run(
        quotationId,
        Number(item.id || item.product_id),
        item.name || item.product_name,
        item.unit || 'Piece',
        Number(item.price || item.unit_price),
        Number(item.quantity),
        Number(item.discount || item.discount_amount || 0),
        Number(item.line_total),
        item.weight_grams ? Number(item.weight_grams) : null,
        item.rate_per_kg ? Number(item.rate_per_kg) : null
      );
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId,
      action: 'CREATE_QUOTATION',
      entity: 'QUOTATIONS',
      entityId: quotationId,
      details: `Created quotation #${quotationNo} for Rs. ${grand_total}`
    });

    res.status(201).json({ message: 'Quotation created successfully!', quotation_no: quotationNo, id: quotationId });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// Update quotation status
router.put('/:id/status', authenticate, requirePermission('pos_access'), (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE quotations SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Status updated' });
});

export default router;
