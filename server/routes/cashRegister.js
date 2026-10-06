import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// Get current open register session for branch
router.get('/current', authenticate, (req, res) => {
  const branchId = Number(req.query.branch_id || req.user.branch_id || 1);

  const register = db.prepare(`
    SELECT cr.*, b.name as branch_name, u.name as user_name
    FROM cash_registers cr
    JOIN branches b ON cr.branch_id = b.id
    JOIN users u ON cr.user_id = u.id
    WHERE cr.branch_id = ? AND cr.status = 'open'
    ORDER BY cr.opened_at DESC LIMIT 1
  `).get(branchId);

  if (!register) {
    return res.json({ open: false, register: null });
  }

  // Calculate shift activity since opened_at
  const cashSales = db.prepare(`
    SELECT COALESCE(SUM(paid_amount - change_amount), 0) as total
    FROM sales
    WHERE branch_id = ? AND payment_method = 'cash' AND created_at >= ?
  `).get(branchId, register.opened_at).total;

  const cashUdhaarRec = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM customer_payments
    WHERE branch_id = ? AND payment_method = 'cash' AND created_at >= ?
  `).get(branchId, register.opened_at).total;

  const cashExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE branch_id = ? AND payment_method = 'cash' AND created_at >= ?
  `).get(branchId, register.opened_at).total;

  const cashRefunds = db.prepare(`
    SELECT COALESCE(SUM(refund_amount), 0) as total
    FROM sales_returns
    WHERE branch_id = ? AND refund_method = 'cash' AND created_at >= ?
  `).get(branchId, register.opened_at).total;

  const calculatedExpected = register.opening_cash + cashSales + cashUdhaarRec - cashExpenses - cashRefunds;

  res.json({
    open: true,
    register: {
      ...register,
      cash_sales: cashSales,
      cash_udhaar_received: cashUdhaarRec,
      cash_expenses: cashExpenses,
      cash_refunds: cashRefunds,
      calculated_expected_cash: calculatedExpected
    }
  });
});

// Open Register session
router.post('/open', authenticate, requirePermission('pos_access'), (req, res) => {
  const { branch_id, opening_cash = 0, notes } = req.body;
  const branchId = Number(branch_id || req.user.branch_id || 1);

  // Check if already open
  const existing = db.prepare("SELECT id FROM cash_registers WHERE branch_id = ? AND status = 'open'").get(branchId);
  if (existing) {
    return res.status(400).json({ error: 'A cash register session is already open for this branch. Please close it first.' });
  }

  const openFloat = Number(opening_cash || 0);

  const result = db.prepare(`
    INSERT INTO cash_registers (branch_id, user_id, opening_cash, expected_cash, actual_cash, difference, status, notes)
    VALUES (?, ?, ?, ?, 0, 0, 'open', ?)
  `).run(branchId, req.user.id, openFloat, openFloat, notes || 'Morning shift open');

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId,
    action: 'OPEN_REGISTER',
    entity: 'REGISTER',
    entityId: result.lastInsertRowid,
    details: `Opened cash register with float Rs. ${openFloat}`
  });

  res.status(201).json({ message: 'Cash register opened successfully', id: result.lastInsertRowid });
});

// Close Register session
router.post('/close', authenticate, requirePermission('pos_access'), (req, res) => {
  const { branch_id, actual_cash, notes } = req.body;
  const branchId = Number(branch_id || req.user.branch_id || 1);

  const register = db.prepare("SELECT * FROM cash_registers WHERE branch_id = ? AND status = 'open'").get(branchId);
  if (!register) {
    return res.status(400).json({ error: 'No open cash register session found to close.' });
  }

  const actual = Number(actual_cash || 0);

  // Re-calculate expected
  const cashSales = db.prepare(`
    SELECT COALESCE(SUM(paid_amount - change_amount), 0) as total
    FROM sales
    WHERE branch_id = ? AND payment_method = 'cash' AND created_at >= ?
  `).get(branchId, register.opened_at).total;

  const cashUdhaarRec = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM customer_payments
    WHERE branch_id = ? AND payment_method = 'cash' AND created_at >= ?
  `).get(branchId, register.opened_at).total;

  const cashExpenses = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE branch_id = ? AND payment_method = 'cash' AND created_at >= ?
  `).get(branchId, register.opened_at).total;

  const cashRefunds = db.prepare(`
    SELECT COALESCE(SUM(refund_amount), 0) as total
    FROM sales_returns
    WHERE branch_id = ? AND refund_method = 'cash' AND created_at >= ?
  `).get(branchId, register.opened_at).total;

  const expected = register.opening_cash + cashSales + cashUdhaarRec - cashExpenses - cashRefunds;
  const diff = actual - expected; // positive is surplus, negative is shortage

  db.prepare(`
    UPDATE cash_registers
    SET closed_at = CURRENT_TIMESTAMP,
        expected_cash = ?,
        actual_cash = ?,
        difference = ?,
        status = 'closed',
        notes = ?
    WHERE id = ?
  `).run(expected, actual, diff, notes || null, register.id);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId,
    action: 'CLOSE_REGISTER',
    entity: 'REGISTER',
    entityId: register.id,
    details: `Closed register: Expected Rs. ${expected}, Actual Rs. ${actual}, Difference Rs. ${diff}`
  });

  res.json({
    message: 'Register closed successfully',
    summary: {
      opening_cash: register.opening_cash,
      cash_sales: cashSales,
      expected_cash: expected,
      actual_cash: actual,
      difference: diff
    }
  });
});

// Register history
router.get('/history', authenticate, (req, res) => {
  const { branch_id } = req.query;

  let query = `
    SELECT cr.*, b.name as branch_name, u.name as user_name
    FROM cash_registers cr
    JOIN branches b ON cr.branch_id = b.id
    JOIN users u ON cr.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (branch_id && branch_id !== 'all') {
    query += ` AND cr.branch_id = ?`;
    params.push(Number(branch_id));
  }

  query += ` ORDER BY cr.opened_at DESC LIMIT 30`;

  const history = db.prepare(query).all(...params);
  res.json({ history });
});

export default router;
