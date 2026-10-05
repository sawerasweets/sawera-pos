import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// List Customers with balances and filters
router.get('/', authenticate, (req, res) => {
  const { search, has_balance } = req.query;

  let query = `
    SELECT c.*,
      (SELECT COUNT(*) FROM sales WHERE customer_id = c.id) as total_invoices,
      (SELECT COALESCE(SUM(grand_total), 0) FROM sales WHERE customer_id = c.id) as total_purchased
    FROM customers c
    WHERE c.status = 'active'
  `;
  const params = [];

  if (search) {
    const s = `%${search.trim()}%`;
    query += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ?)`;
    params.push(s, s, s);
  }

  if (has_balance === 'true') {
    query += ` AND c.current_balance > 0`;
  }

  query += ` ORDER BY c.current_balance DESC, c.name ASC`;

  const customers = db.prepare(query).all(...params);
  res.json({ customers });
});

// Single Customer Profile with Complete Ledger & Sales History
router.get('/:id', authenticate, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  const sales = db.prepare(`
    SELECT s.id, s.invoice_no, s.grand_total, s.paid_amount, s.credit_amount, s.payment_method, s.created_at,
           b.name as branch_name, u.name as cashier_name
    FROM sales s
    JOIN branches b ON s.branch_id = b.id
    JOIN users u ON s.user_id = u.id
    WHERE s.customer_id = ?
    ORDER BY s.created_at DESC
  `).all(customer.id);

  const payments = db.prepare(`
    SELECT cp.*, b.name as branch_name, u.name as cashier_name
    FROM customer_payments cp
    JOIN branches b ON cp.branch_id = b.id
    JOIN users u ON cp.user_id = u.id
    WHERE cp.customer_id = ?
    ORDER BY cp.created_at DESC
  `).all(customer.id);

  res.json({ customer, sales, payments });
});

// Create Customer
router.post('/', authenticate, requirePermission('manage_customers'), (req, res) => {
  const { name, phone, email, address, opening_balance = 0, credit_limit = 50000 } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Customer name is required.' });
  }

  const openBal = Number(opening_balance || 0);

  const result = db.prepare(`
    INSERT INTO customers (name, phone, email, address, opening_balance, current_balance, credit_limit, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(name.trim(), phone || null, email || null, address || null, openBal, openBal, Number(credit_limit || 50000));

  const custId = Number(result.lastInsertRowid);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: req.user.branch_id,
    action: 'CREATE_CUSTOMER',
    entity: 'CUSTOMERS',
    entityId: custId,
    details: `Added customer ${name} (${phone || 'No phone'}) with credit limit Rs. ${credit_limit}`
  });

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(custId);
  res.status(201).json({ message: 'Customer added successfully', customer });
});

// Update Customer
router.put('/:id', authenticate, requirePermission('manage_customers'), (req, res) => {
  const { name, phone, email, address, credit_limit, status } = req.body;

  db.prepare(`
    UPDATE customers
    SET name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        email = COALESCE(?, email),
        address = COALESCE(?, address),
        credit_limit = COALESCE(?, credit_limit),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, phone, email, address, credit_limit !== undefined ? Number(credit_limit) : null, status, req.params.id);

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  res.json({ message: 'Customer updated', customer: updated });
});

// Receive Payment from Customer (Recover Udhaar)
router.post('/:id/payments', authenticate, requirePermission('pos_access'), (req, res) => {
  const { amount, payment_method = 'cash', reference_no, notes, branch_id } = req.body;
  const customerId = Number(req.params.id);
  const payAmount = Number(amount);
  const branchId = Number(branch_id || req.user.branch_id || 1);

  if (!payAmount || payAmount <= 0) {
    return res.status(400).json({ error: 'Please enter a valid payment amount.' });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const payCount = db.prepare(`SELECT COUNT(*) as count FROM customer_payments WHERE payment_no LIKE 'REC-${dateStr}-%'`).get().count + 1;
    const paymentNo = `REC-${dateStr}-${String(payCount).padStart(4, '0')}`;

    // Insert payment record
    const payResult = db.prepare(`
      INSERT INTO customer_payments (payment_no, customer_id, branch_id, amount, payment_method, reference_no, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(paymentNo, customerId, branchId, payAmount, payment_method, reference_no || null, notes || null, req.user.id);

    // Deduct from customer outstanding balance
    const previousBalance = customer.current_balance;
    const newBalance = previousBalance - payAmount;

    db.prepare(`
      UPDATE customers SET current_balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(newBalance, customerId);

    // If payment method was cash, add to active cash register
    if (payment_method === 'cash') {
      db.prepare(`
        UPDATE cash_registers
        SET expected_cash = expected_cash + ?
        WHERE branch_id = ? AND status = 'open'
      `).run(payAmount, branchId);
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId,
      action: 'RECEIVE_PAYMENT',
      entity: 'CUSTOMERS',
      entityId: customerId,
      details: `Received Rs. ${payAmount} Udhaar payment from ${customer.name} (${paymentNo}) via ${payment_method}`
    });

    res.status(201).json({
      message: 'Payment received successfully',
      payment: {
        id: payResult.lastInsertRowid,
        payment_no: paymentNo,
        customer_name: customer.name,
        amount: payAmount,
        previous_balance: previousBalance,
        new_balance: newBalance,
        payment_method,
        date: new Date().toISOString()
      }
    });

  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err.message });
  }
});

export default router;
