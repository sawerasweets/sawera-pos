import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// List Purchases
router.get('/', authenticate, (req, res) => {
  const { branch_id, supplier_id, date_from, date_to } = req.query;

  let query = `
    SELECT p.*, s.name as supplier_name, s.company as supplier_company,
           b.name as branch_name, b.code as branch_code,
           u.name as user_name
    FROM purchases p
    JOIN suppliers s ON p.supplier_id = s.id
    JOIN branches b ON p.branch_id = b.id
    JOIN users u ON p.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (branch_id && branch_id !== 'all') {
    query += ` AND p.branch_id = ?`;
    params.push(Number(branch_id));
  }

  if (supplier_id) {
    query += ` AND p.supplier_id = ?`;
    params.push(Number(supplier_id));
  }

  if (date_from) {
    query += ` AND date(p.created_at) >= date(?)`;
    params.push(date_from);
  }

  if (date_to) {
    query += ` AND date(p.created_at) <= date(?)`;
    params.push(date_to);
  }

  query += ` ORDER BY p.created_at DESC LIMIT 100`;

  const purchases = db.prepare(query).all(...params);
  res.json({ purchases });
});

// Single Purchase Detail
router.get('/:id', authenticate, (req, res) => {
  const purchase = db.prepare(`
    SELECT p.*, s.name as supplier_name, s.company as supplier_company, s.phone as supplier_phone,
           b.name as branch_name, b.code as branch_code,
           u.name as user_name
    FROM purchases p
    JOIN suppliers s ON p.supplier_id = s.id
    JOIN branches b ON p.branch_id = b.id
    JOIN users u ON p.user_id = u.id
    WHERE p.id = ? OR p.purchase_no = ?
  `).get(req.params.id, req.params.id);

  if (!purchase) {
    return res.status(404).json({ error: 'Purchase record not found.' });
  }

  const items = db.prepare(`
    SELECT pi.*, pr.name as product_name, pr.code as product_code, pr.unit
    FROM purchase_items pi
    JOIN products pr ON pi.product_id = pr.id
    WHERE pi.purchase_id = ?
  `).all(purchase.id);

  res.json({ purchase: { ...purchase, items } });
});

// Create Purchase (Atomic Stock Increment + Supplier Ledger Update)
router.post('/', authenticate, requirePermission('manage_purchases'), (req, res) => {
  const {
    supplier_id,
    branch_id,
    supplier_invoice_no,
    items,
    subtotal,
    discount_amount = 0,
    grand_total,
    paid_amount = 0,
    payment_method = 'cash',
    notes
  } = req.body;

  if (!supplier_id || !branch_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Supplier, branch and products are required.' });
  }

  const supplierId = Number(supplier_id);
  const branchId = Number(branch_id);
  const total = Number(grand_total || subtotal);
  const paid = Number(paid_amount || 0);
  const remaining = total - paid;

  try {
    db.exec('BEGIN TRANSACTION;');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = db.prepare(`SELECT COUNT(*) as count FROM purchases WHERE purchase_no LIKE 'PUR-${dateStr}-%'`).get().count + 1;
    const purchaseNo = `PUR-${dateStr}-${String(count).padStart(4, '0')}`;

    const insertPurchase = db.prepare(`
      INSERT INTO purchases (
        purchase_no, supplier_invoice_no, branch_id, supplier_id, user_id,
        subtotal, discount_amount, grand_total, paid_amount, remaining_amount,
        payment_method, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insertPurchase.run(
      purchaseNo,
      supplier_invoice_no || null,
      branchId,
      supplierId,
      req.user.id,
      Number(subtotal),
      Number(discount_amount),
      total,
      paid,
      remaining,
      payment_method,
      notes || null
    );
    const purchaseId = Number(result.lastInsertRowid);

    const insertItem = db.prepare(`
      INSERT INTO purchase_items (purchase_id, product_id, quantity, purchase_price, line_total)
      VALUES (?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      INSERT INTO branch_inventory (branch_id, product_id, quantity, last_restocked)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(branch_id, product_id) DO UPDATE SET quantity = quantity + ?, last_restocked = CURRENT_TIMESTAMP
    `);

    const updateProductCost = db.prepare(`
      UPDATE products SET purchase_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `);

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id)
      VALUES (?, ?, 'purchase', ?, ?, ?, ?, 'Supplier Purchase Inward', ?)
    `);

    for (const item of items) {
      const prodId = Number(item.product_id);
      const qty = Number(item.quantity);
      const price = Number(item.purchase_price);
      const lineTotal = qty * price;

      insertItem.run(purchaseId, prodId, qty, price, lineTotal);

      // Get previous stock
      const curStock = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(branchId, prodId)?.quantity || 0;

      updateStock.run(branchId, prodId, qty, qty);
      updateProductCost.run(price, prodId);

      insertMovement.run(prodId, branchId, qty, curStock, curStock + qty, purchaseNo, req.user.id);
    }

    // Update Supplier Balance (add remaining unpaid amount)
    if (remaining > 0) {
      db.prepare(`
        UPDATE suppliers
        SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(remaining, supplierId);
    }

    // Record Payment record if paid amount > 0
    if (paid > 0) {
      const payCount = db.prepare(`SELECT COUNT(*) as count FROM supplier_payments WHERE payment_no LIKE 'PAY-SUP-${dateStr}-%'`).get().count + 1;
      const payNo = `PAY-SUP-${dateStr}-${String(payCount).padStart(4, '0')}`;
      db.prepare(`
        INSERT INTO supplier_payments (payment_no, supplier_id, branch_id, amount, payment_method, reference_no, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?, 'Paid on Purchase Inward', ?)
      `).run(payNo, supplierId, branchId, paid, payment_method, purchaseNo, req.user.id);
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId,
      action: 'PURCHASE_INWARD',
      entity: 'PURCHASES',
      entityId: purchaseId,
      details: `Saved purchase ${purchaseNo} for Rs. ${total} from supplier ID ${supplierId}`
    });

    res.status(201).json({
      message: 'Purchase saved and inventory restocked successfully',
      purchase_no: purchaseNo,
      purchase_id: purchaseId
    });

  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err.message });
  }
});

// Purchase Return to Supplier
router.post('/:id/return', authenticate, requirePermission('manage_purchases'), (req, res) => {
  const { items, reason } = req.body;
  const purchaseId = Number(req.params.id);

  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(purchaseId);
  if (!purchase) {
    return res.status(404).json({ error: 'Purchase record not found.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    let returnTotal = 0;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const retCount = db.prepare(`SELECT COUNT(*) as count FROM purchase_returns WHERE return_no LIKE 'PRET-${dateStr}-%'`).get().count + 1;
    const returnNo = `PRET-${dateStr}-${String(retCount).padStart(4, '0')}`;

    const reduceStock = db.prepare(`
      UPDATE branch_inventory SET quantity = quantity - ? WHERE branch_id = ? AND product_id = ?
    `);

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id)
      VALUES (?, ?, 'purchase_return', ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const prodId = Number(item.product_id);
      const qty = Number(item.quantity);
      const rate = Number(item.purchase_price);
      returnTotal += qty * rate;

      const curStock = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(purchase.branch_id, prodId)?.quantity || 0;
      if (curStock < qty) {
        throw new Error(`Cannot return ${qty} units. Current stock in branch is only ${curStock}.`);
      }

      reduceStock.run(qty, purchase.branch_id, prodId);
      insertMovement.run(prodId, purchase.branch_id, -qty, curStock, curStock - qty, returnNo, `Returned to supplier: ${reason || ''}`, req.user.id);
    }

    db.prepare(`
      INSERT INTO purchase_returns (return_no, purchase_id, supplier_id, branch_id, user_id, total_amount, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(returnNo, purchaseId, purchase.supplier_id, purchase.branch_id, req.user.id, returnTotal, reason || 'Stock return to supplier');

    // Deduct from supplier balance
    db.prepare(`
      UPDATE suppliers SET current_balance = MAX(0, current_balance - ?) WHERE id = ?
    `).run(returnTotal, purchase.supplier_id);

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: purchase.branch_id,
      action: 'PURCHASE_RETURN',
      entity: 'PURCHASES',
      entityId: purchaseId,
      details: `Returned items worth Rs. ${returnTotal} to supplier ID ${purchase.supplier_id} (${returnNo})`
    });

    res.json({ message: 'Purchase return completed', return_no: returnNo, total_amount: returnTotal });

  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err.message });
  }
});

export default router;
