import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// List sales
router.get('/', authenticate, (req, res) => {
  const { branch_id, customer_id, date_from, date_to, payment_method, status, search, limit = 50, offset = 0 } = req.query;

  let query = `
    SELECT s.*, b.name as branch_name, b.code as branch_code,
           c.name as customer_name, c.phone as customer_phone,
           u.name as cashier_name
    FROM sales s
    JOIN branches b ON s.branch_id = b.id
    LEFT JOIN customers c ON s.customer_id = c.id
    JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (branch_id && branch_id !== 'all') {
    query += ` AND s.branch_id = ?`;
    params.push(Number(branch_id));
  } else if (req.user.role === 'cashier') {
    query += ` AND s.branch_id = ?`;
    params.push(req.user.branch_id);
  }

  if (customer_id) {
    query += ` AND s.customer_id = ?`;
    params.push(Number(customer_id));
  }

  if (payment_method && payment_method !== 'all') {
    query += ` AND s.payment_method = ?`;
    params.push(payment_method);
  }

  if (status && status !== 'all') {
    query += ` AND s.status = ?`;
    params.push(status);
  }

  if (date_from) {
    query += ` AND date(s.created_at) >= date(?)`;
    params.push(date_from);
  }

  if (date_to) {
    query += ` AND date(s.created_at) <= date(?)`;
    params.push(date_to);
  }

  if (search) {
    const s = `%${search.trim()}%`;
    query += ` AND (s.invoice_no LIKE ? OR c.name LIKE ? OR c.phone LIKE ?)`;
    params.push(s, s, s);
  }

  query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const sales = db.prepare(query).all(...params);
  res.json({ sales });
});

// Single sale details with items and return history
router.get('/:id', authenticate, (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, b.name as branch_name, b.name_urdu as branch_name_urdu, b.address as branch_address, b.phone as branch_phone,
           c.name as customer_name, c.phone as customer_phone, c.current_balance as customer_balance,
           u.name as cashier_name
    FROM sales s
    JOIN branches b ON s.branch_id = b.id
    LEFT JOIN customers c ON s.customer_id = c.id
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? OR s.invoice_no = ?
  `).get(req.params.id, req.params.id);

  if (!sale) {
    return res.status(404).json({ error: 'Invoice not found.' });
  }

  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
  const returns = db.prepare(`
    SELECT sr.*, u.name as user_name
    FROM sales_returns sr
    JOIN users u ON sr.user_id = u.id
    WHERE sr.sale_id = ?
    ORDER BY sr.created_at DESC
  `).all(sale.id);

  res.json({ sale: { ...sale, items, returns } });
});

// Process Sales Return
router.post('/:id/return', authenticate, requirePermission('process_returns'), (req, res) => {
  const { return_items, reason, refund_method = 'cash' } = req.body;
  const saleId = Number(req.params.id);

  if (!return_items || !Array.isArray(return_items) || return_items.length === 0) {
    return res.status(400).json({ error: 'Please select items and quantities to return.' });
  }

  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  if (!sale) {
    return res.status(404).json({ error: 'Sale not found.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    let totalRefund = 0;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const returnCount = db.prepare(`SELECT COUNT(*) as count FROM sales_returns WHERE return_no LIKE 'RET-${dateStr}-%'`).get().count + 1;
    const returnNo = `RET-${dateStr}-${String(returnCount).padStart(4, '0')}`;

    const insertReturn = db.prepare(`
      INSERT INTO sales_returns (return_no, sale_id, branch_id, customer_id, user_id, refund_amount, refund_method, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Prepare items and calculate refund
    const preparedItems = [];
    for (const rItem of return_items) {
      const saleItem = db.prepare('SELECT * FROM sale_items WHERE id = ? AND sale_id = ?').get(rItem.sale_item_id, saleId);
      if (!saleItem) {
        throw new Error('Item not found on this sale.');
      }

      const returnQty = Number(rItem.quantity);
      const remainingQty = saleItem.quantity - saleItem.returned_quantity;
      if (returnQty <= 0 || returnQty > remainingQty) {
        throw new Error(`Invalid return quantity for ${saleItem.product_name}. Available to return: ${remainingQty}`);
      }

      const effectiveRate = saleItem.line_total / saleItem.quantity;
      const refundTotal = effectiveRate * returnQty;
      totalRefund += refundTotal;

      preparedItems.push({
        sale_item_id: saleItem.id,
        product_id: saleItem.product_id,
        product_name: saleItem.product_name,
        quantity: returnQty,
        refund_rate: effectiveRate,
        refund_total: refundTotal
      });
    }

    const returnResult = insertReturn.run(
      returnNo,
      saleId,
      sale.branch_id,
      sale.customer_id,
      req.user.id,
      totalRefund,
      refund_method,
      reason || 'Customer Return'
    );
    const returnId = Number(returnResult.lastInsertRowid);

    const insertReturnItem = db.prepare(`
      INSERT INTO sales_return_items (return_id, sale_item_id, product_id, quantity, refund_rate, refund_total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const updateSaleItemReturned = db.prepare(`
      UPDATE sale_items
      SET returned_quantity = returned_quantity + ?
      WHERE id = ?
    `);

    const restockBranch = db.prepare(`
      UPDATE branch_inventory
      SET quantity = quantity + ?
      WHERE branch_id = ? AND product_id = ?
    `);

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id)
      VALUES (?, ?, 'sales_return', ?, ?, ?, ?, ?, ?)
    `);

    for (const item of preparedItems) {
      insertReturnItem.run(
        returnId,
        item.sale_item_id,
        item.product_id,
        item.quantity,
        item.refund_rate,
        item.refund_total
      );

      updateSaleItemReturned.run(item.quantity, item.sale_item_id);

      // Get current stock
      const curStock = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(sale.branch_id, item.product_id)?.quantity || 0;
      restockBranch.run(item.quantity, sale.branch_id, item.product_id);
      insertMovement.run(
        item.product_id,
        sale.branch_id,
        item.quantity,
        curStock,
        curStock + item.quantity,
        returnNo,
        `Sales Return on ${sale.invoice_no}`,
        req.user.id
      );
    }

    // Check if fully returned or partially returned
    const unreturnedItemsCount = db.prepare(`
      SELECT COUNT(*) as count FROM sale_items
      WHERE sale_id = ? AND returned_quantity < quantity
    `).get(saleId).count;

    const newStatus = unreturnedItemsCount === 0 ? 'returned' : 'partially_returned';
    db.prepare('UPDATE sales SET status = ? WHERE id = ?').run(newStatus, saleId);

    // If refund was credit deduction and customer exists
    if (refund_method === 'credit_deduction' && sale.customer_id) {
      db.prepare('UPDATE customers SET current_balance = current_balance - ? WHERE id = ?').run(totalRefund, sale.customer_id);
    }

    // If cash refund and register open
    if (refund_method === 'cash') {
      db.prepare(`
        UPDATE cash_registers
        SET expected_cash = expected_cash - ?
        WHERE branch_id = ? AND status = 'open'
      `).run(totalRefund, sale.branch_id);
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: sale.branch_id,
      action: 'SALES_RETURN',
      entity: 'RETURNS',
      entityId: returnId,
      details: `Processed return ${returnNo} on invoice ${sale.invoice_no} for Rs. ${totalRefund}`
    });

    res.json({
      message: 'Sales return processed successfully',
      return_no: returnNo,
      refund_amount: totalRefund
    });

  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err.message });
  }
});

export default router;
