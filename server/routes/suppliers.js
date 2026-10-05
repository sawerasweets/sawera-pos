import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// List Suppliers
router.get('/', authenticate, (req, res) => {
  const { search } = req.query;

  let query = `
    SELECT s.*,
      (SELECT COUNT(*) FROM purchases WHERE supplier_id = s.id) as total_purchases_count,
      (SELECT COALESCE(SUM(grand_total), 0) FROM purchases WHERE supplier_id = s.id) as total_purchased_amount
    FROM suppliers s
    WHERE s.status = 'active'
  `;
  const params = [];

  if (search) {
    const s = `%${search.trim()}%`;
    query += ` AND (s.name LIKE ? OR s.company LIKE ? OR s.phone LIKE ?)`;
    params.push(s, s, s);
  }

  query += ` ORDER BY s.current_balance DESC, s.name ASC`;

  const suppliers = db.prepare(query).all(...params);
  res.json({ suppliers });
});

// Single Supplier Profile & Ledger
router.get('/:id', authenticate, (req, res) => {
  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  const purchases = db.prepare(`
    SELECT p.*, b.name as branch_name, u.name as user_name
    FROM purchases p
    JOIN branches b ON p.branch_id = b.id
    JOIN users u ON p.user_id = u.id
    WHERE p.supplier_id = ?
    ORDER BY p.created_at DESC
  `).all(supplier.id);

  const payments = db.prepare(`
    SELECT sp.*, b.name as branch_name, u.name as user_name
    FROM supplier_payments sp
    JOIN branches b ON sp.branch_id = b.id
    JOIN users u ON sp.user_id = u.id
    WHERE sp.supplier_id = ?
    ORDER BY sp.created_at DESC
  `).all(supplier.id);

  res.json({ supplier, purchases, payments });
});

// Create Supplier
router.post('/', authenticate, requirePermission('manage_suppliers'), (req, res) => {
  const { name, company, phone, email, address, opening_balance = 0 } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Supplier name is required.' });
  }

  const openBal = Number(opening_balance || 0);

  const result = db.prepare(`
    INSERT INTO suppliers (name, company, phone, email, address, opening_balance, current_balance, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(name.trim(), company || null, phone || null, email || null, address || null, openBal, openBal);

  const supId = Number(result.lastInsertRowid);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: req.user.branch_id,
    action: 'CREATE_SUPPLIER',
    entity: 'SUPPLIERS',
    entityId: supId,
    details: `Added supplier ${name} (${company || 'Individual'})`
  });

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supId);
  res.status(201).json({ message: 'Supplier added successfully', supplier });
});

// Update Supplier
router.put('/:id', authenticate, requirePermission('manage_suppliers'), (req, res) => {
  const { name, company, phone, email, address, status } = req.body;

  db.prepare(`
    UPDATE suppliers
    SET name = COALESCE(?, name),
        company = COALESCE(?, company),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, company, phone, email, address, status, req.params.id);

  const updated = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  res.json({ message: 'Supplier updated', supplier: updated });
});

// Record Payment to Supplier
router.post('/:id/payments', authenticate, requirePermission('manage_suppliers'), (req, res) => {
  const { amount, payment_method = 'cash', reference_no, notes, branch_id } = req.body;
  const supplierId = Number(req.params.id);
  const payAmount = Number(amount);
  const branchId = Number(branch_id || req.user.branch_id || 1);

  if (!payAmount || payAmount <= 0) {
    return res.status(400).json({ error: 'Please enter a valid payment amount.' });
  }

  const supplier = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(supplierId);
  if (!supplier) {
    return res.status(404).json({ error: 'Supplier not found.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const payCount = db.prepare(`SELECT COUNT(*) as count FROM supplier_payments WHERE payment_no LIKE 'PAY-SUP-${dateStr}-%'`).get().count + 1;
    const paymentNo = `PAY-SUP-${dateStr}-${String(payCount).padStart(4, '0')}`;

    db.prepare(`
      INSERT INTO supplier_payments (payment_no, supplier_id, branch_id, amount, payment_method, reference_no, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(paymentNo, supplierId, branchId, payAmount, payment_method, reference_no || null, notes || null, req.user.id);

    // Deduct from supplier balance
    const previousBalance = supplier.current_balance;
    const newBalance = previousBalance - payAmount;

    db.prepare(`
      UPDATE suppliers SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newBalance, supplierId);

    // If paid from cash drawer
    if (payment_method === 'cash') {
      db.prepare(`
        UPDATE cash_registers
        SET expected_cash = expected_cash - ?
        WHERE branch_id = ? AND status = 'open'
      `).run(payAmount, branchId);
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId,
      action: 'PAY_SUPPLIER',
      entity: 'SUPPLIERS',
      entityId: supplierId,
      details: `Paid Rs. ${payAmount} to ${supplier.name} (${paymentNo}) via ${payment_method}`
    });

    res.status(201).json({
      message: 'Payment recorded successfully',
      payment: {
        payment_no: paymentNo,
        supplier_name: supplier.name,
        amount: payAmount,
        previous_balance: previousBalance,
        new_balance: newBalance,
        payment_method
      }
    });

  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err.message });
  }
});

export default router;
