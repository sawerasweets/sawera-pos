import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// List Expenses
router.get('/', authenticate, (req, res) => {
  const { branch_id, category, date_from, date_to } = req.query;

  let query = `
    SELECT e.*, b.name as branch_name, b.code as branch_code, u.name as user_name
    FROM expenses e
    JOIN branches b ON e.branch_id = b.id
    LEFT JOIN users u ON e.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (branch_id && branch_id !== 'all') {
    query += ` AND e.branch_id = ?`;
    params.push(Number(branch_id));
  }

  if (category && category !== 'all') {
    query += ` AND e.category = ?`;
    params.push(category);
  }

  if (date_from) {
    query += ` AND date(e.date) >= date(?)`;
    params.push(date_from);
  }

  if (date_to) {
    query += ` AND date(e.date) <= date(?)`;
    params.push(date_to);
  }

  query += ` ORDER BY e.date DESC, e.id DESC`;

  const expenses = db.prepare(query).all(...params);

  // Group summary by category
  const categorySummary = db.prepare(`
    SELECT category, COUNT(*) as count, SUM(amount) as total_amount
    FROM expenses
    GROUP BY category
    ORDER BY total_amount DESC
  `).all();

  res.json({ expenses, categorySummary });
});

// Add Expense
router.post('/', authenticate, requirePermission('manage_expenses'), (req, res) => {
  const { branch_id, category, title, amount, payment_method = 'cash', paid_to, notes, date } = req.body;

  if (!title || !amount || !category) {
    return res.status(400).json({ error: 'Title, category and amount are required.' });
  }

  const branchId = Number(branch_id || req.user.branch_id || 1);
  const expenseAmount = Number(amount);
  const expenseDate = date || new Date().toISOString().split('T')[0];

  const dateStr = expenseDate.replace(/-/g, '');
  const expCount = db.prepare(`SELECT COUNT(*) as count FROM expenses WHERE expense_no LIKE 'EXP-${dateStr}-%'`).get().count + 1;
  const expenseNo = `EXP-${dateStr}-${String(expCount).padStart(4, '0')}`;

  const result = db.prepare(`
    INSERT INTO expenses (expense_no, branch_id, category, title, amount, payment_method, paid_to, notes, user_id, date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(expenseNo, branchId, category, title.trim(), expenseAmount, payment_method, paid_to || null, notes || null, req.user.id, expenseDate);

  // If paid from cash drawer, deduct from expected cash of open register
  if (payment_method === 'cash') {
    db.prepare(`
      UPDATE cash_registers
      SET expected_cash = expected_cash - ?
      WHERE branch_id = ? AND status = 'open'
    `).run(expenseAmount, branchId);
  }

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId,
    action: 'CREATE_EXPENSE',
    entity: 'EXPENSES',
    entityId: result.lastInsertRowid,
    details: `Recorded expense "${title}" (${category}): Rs. ${expenseAmount}`
  });

  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: 'Expense recorded successfully', expense });
});

// Delete Expense
router.delete('/:id', authenticate, requirePermission('manage_expenses'), (req, res) => {
  const expense = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!expense) {
    return res.status(404).json({ error: 'Expense not found.' });
  }

  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: expense.branch_id,
    action: 'DELETE_EXPENSE',
    entity: 'EXPENSES',
    entityId: expense.id,
    details: `Deleted expense "${expense.title}" for Rs. ${expense.amount}`
  });

  res.json({ message: 'Expense deleted successfully' });
});

export default router;
