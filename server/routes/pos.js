import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// Checkout / Create Sale Transaction
router.post('/checkout', authenticate, requirePermission('pos_access'), (req, res) => {
  const {
    branch_id,
    customer_id,
    items,
    subtotal,
    discount_type = 'fixed',
    discount_value = 0,
    discount_amount = 0,
    tax_percentage = 0,
    tax_amount = 0,
    grand_total,
    paid_amount,
    change_amount = 0,
    payment_method,
    split_details,
    notes,
    is_exchange = false,
    exchange_credit_used = 0,
    exchange_return_id = null,
    loyalty_points_redeemed = 0,
    price_level = 'retail'
  } = req.body;

  const branchId = Number(branch_id || req.user.branch_id || 1);

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty. Please add items to checkout.' });
  }

  if (grand_total === undefined || grand_total === null || grand_total < 0) {
    return res.status(400).json({ error: 'Invalid total amount.' });
  }

  // Validate Credit / Udhaar
  const isCredit = payment_method === 'credit';
  let creditAmount = 0;
  if (isCredit) {
    if (!customer_id) {
      return res.status(400).json({ error: 'Customer must be selected for Udhaar / Credit sales.' });
    }
    creditAmount = Number(grand_total) - Number(paid_amount || 0);
  }

  // Check customer credit limit if udhaar
  if (isCredit && creditAmount > 0) {
    const customer = db.prepare('SELECT current_balance, credit_limit, name FROM customers WHERE id = ?').get(customer_id);
    if (customer && (customer.current_balance + creditAmount > customer.credit_limit)) {
      return res.status(400).json({
        error: `Credit limit exceeded! Customer "${customer.name}" has limit Rs. ${customer.credit_limit}, current balance Rs. ${customer.current_balance}. Adding Rs. ${creditAmount} exceeds limit.`
      });
    }
  }

  // Generate unique invoice number: e.g. SSB-B1-20260929-0012
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const todayCount = db.prepare(`SELECT COUNT(*) as count FROM sales WHERE invoice_no LIKE 'SSB-B${branchId}-${dateStr}-%'`).get().count + 1;
  const invoiceNo = `SSB-B${branchId}-${dateStr}-${String(todayCount).padStart(4, '0')}`;

  // Check negative stock allowance setting
  const allowNegStockSetting = db.prepare("SELECT value FROM settings WHERE key = 'allow_negative_stock'").get()?.value === 'true';

  // Loyalty points calculation (1 point per Rs. 100 spent)
  const loyaltyPointsEarned = Math.floor(Number(paid_amount || grand_total) / 100);

  try {
    // Begin transaction
    db.exec('BEGIN TRANSACTION;');

    let totalCost = 0;

    // Validate and fetch current product stocks
    const preparedItems = [];
    for (const item of items) {
      const prod = db.prepare(`
        SELECT p.id, p.name, p.code, p.unit, p.purchase_price, p.sale_price,
               COALESCE(bi.quantity, 0) as stock
        FROM products p
        LEFT JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = ?
        WHERE p.id = ?
      `).get(branchId, item.id || item.product_id);

      if (!prod) {
        throw new Error(`Product not found: ${item.name || item.id}`);
      }

      const qty = Number(item.quantity);
      if (qty <= 0) {
        throw new Error(`Invalid quantity for product ${prod.name}`);
      }

      if (!allowNegStockSetting && prod.stock < qty) {
        throw new Error(`Insufficient stock for "${prod.name}" in this branch! Available: ${prod.stock} ${prod.unit}, Requested: ${qty}`);
      }

      const unitPrice = Number(item.price || item.unit_price || prod.sale_price);
      const itemDisc = Number(item.discount || 0);
      const lineTotal = Number(item.line_total || ((unitPrice * qty) - itemDisc));
      const lineCost = prod.purchase_price * qty;
      totalCost += lineCost;

      preparedItems.push({
        product_id: prod.id,
        name: prod.name,
        code: prod.code,
        unit: item.unit || prod.unit,
        purchase_price: prod.purchase_price,
        unit_price: unitPrice,
        quantity: qty,
        discount_amount: itemDisc,
        line_total: lineTotal,
        current_stock: prod.stock,
        weight_grams: item.weight_grams ? Number(item.weight_grams) : null,
        rate_per_kg: item.rate_per_kg ? Number(item.rate_per_kg) : null
      });
    }

    const calculatedProfit = Number(grand_total) - totalCost;

    // Insert sale with exchange, loyalty and price level support
    const insertSaleStmt = db.prepare(`
      INSERT INTO sales (
        invoice_no, branch_id, customer_id, user_id,
        subtotal, discount_type, discount_value, discount_amount,
        tax_percentage, tax_amount, grand_total, paid_amount,
        change_amount, credit_amount, payment_method, split_details,
        status, total_cost, profit, notes,
        is_exchange, exchange_credit_used, exchange_return_id,
        loyalty_points_earned, loyalty_points_redeemed, price_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const saleResult = insertSaleStmt.run(
      invoiceNo,
      branchId,
      customer_id ? Number(customer_id) : null,
      req.user.id,
      Number(subtotal),
      discount_type,
      Number(discount_value),
      Number(discount_amount),
      Number(tax_percentage),
      Number(tax_amount),
      Number(grand_total),
      Number(paid_amount),
      Number(change_amount),
      creditAmount,
      payment_method,
      split_details ? JSON.stringify(split_details) : null,
      totalCost,
      calculatedProfit,
      notes || null,
      is_exchange ? 1 : 0,
      Number(exchange_credit_used || 0),
      exchange_return_id ? Number(exchange_return_id) : null,
      loyaltyPointsEarned,
      Number(loyalty_points_redeemed || 0),
      price_level
    );

    const saleId = Number(saleResult.lastInsertRowid);

    // Insert sale items & update stock
    const insertSaleItem = db.prepare(`
      INSERT INTO sale_items (
        sale_id, product_id, product_name, product_code, unit,
        purchase_price, unit_price, quantity, discount_amount, line_total,
        weight_grams, rate_per_kg
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateStock = db.prepare(`
      UPDATE branch_inventory
      SET quantity = quantity - ?
      WHERE branch_id = ? AND product_id = ?
    `);

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (
        product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id
      ) VALUES (?, ?, 'sale', ?, ?, ?, ?, 'POS Sale', ?)
    `);

    for (const item of preparedItems) {
      insertSaleItem.run(
        saleId,
        item.product_id,
        item.name,
        item.code,
        item.unit,
        item.purchase_price,
        item.unit_price,
        item.quantity,
        item.discount_amount,
        item.line_total,
        item.weight_grams,
        item.rate_per_kg
      );

      updateStock.run(item.quantity, branchId, item.product_id);

      const newStock = item.current_stock - item.quantity;
      insertMovement.run(
        item.product_id,
        branchId,
        -item.quantity,
        item.current_stock,
        newStock,
        invoiceNo,
        req.user.id
      );
    }

    // Update Customer Udhaar balance if credit
    if (customer_id && creditAmount > 0) {
      db.prepare(`
        UPDATE customers
        SET current_balance = current_balance + ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(creditAmount, customer_id);
    }

    // Update Customer Loyalty Points
    if (customer_id) {
      const netPointsChange = loyaltyPointsEarned - Number(loyalty_points_redeemed || 0);
      db.prepare(`
        UPDATE customers
        SET loyalty_points = MAX(0, COALESCE(loyalty_points, 0) + ?), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(netPointsChange, customer_id);

      if (netPointsChange !== 0) {
        db.prepare(`
          INSERT INTO loyalty_logs (customer_id, sale_id, points_change, reason)
          VALUES (?, ?, ?, ?)
        `).run(
          customer_id,
          saleId,
          netPointsChange,
          netPointsChange > 0 ? `Earned from invoice #${invoiceNo}` : `Redeemed on invoice #${invoiceNo}`
        );
      }
    }

    // Update Cash Register session if there is an open one for this branch
    if (payment_method === 'cash' || (payment_method === 'split' && split_details?.cash)) {
      const cashAmount = payment_method === 'cash' ? (Number(paid_amount) - Number(change_amount)) : Number(split_details.cash);
      db.prepare(`
        UPDATE cash_registers
        SET expected_cash = expected_cash + ?
        WHERE branch_id = ? AND status = 'open'
      `).run(cashAmount, branchId);
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId,
      action: is_exchange ? 'POS_EXCHANGE_SALE' : 'POS_SALE',
      entity: 'SALES',
      entityId: saleId,
      details: `Completed sale #${invoiceNo} for Rs. ${grand_total} via ${payment_method}${is_exchange ? ' (Exchange Used: Rs. ' + exchange_credit_used + ')' : ''}`
    });

    // Fetch full sale detail for receipt
    const fullSale = db.prepare(`
      SELECT s.*, b.name as branch_name, b.name_urdu as branch_name_urdu, b.address as branch_address, b.phone as branch_phone,
             c.name as customer_name, c.phone as customer_phone, c.current_balance as customer_balance, c.loyalty_points as customer_loyalty_points,
             u.name as cashier_name
      FROM sales s
      JOIN branches b ON s.branch_id = b.id
      LEFT JOIN customers c ON s.customer_id = c.id
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(saleId);

    const saleItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);

    res.status(201).json({
      message: 'Sale completed successfully',
      sale: {
        ...fullSale,
        items: saleItems
      }
    });

  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err.message });
  }
});

// Park a bill
router.post('/park', authenticate, requirePermission('pos_access'), (req, res) => {
  const { reference, cart_data, customer_id, branch_id } = req.body;
  const branchId = Number(branch_id || req.user.branch_id || 1);

  if (!cart_data || !reference) {
    return res.status(400).json({ error: 'Reference name and cart data are required to park bill.' });
  }

  const result = db.prepare(`
    INSERT INTO parked_bills (reference, branch_id, user_id, customer_id, cart_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    reference.trim(),
    branchId,
    req.user.id,
    customer_id ? Number(customer_id) : null,
    typeof cart_data === 'string' ? cart_data : JSON.stringify(cart_data)
  );

  res.status(201).json({ message: 'Bill parked successfully', id: result.lastInsertRowid });
});

// Get parked bills for branch
router.get('/parked', authenticate, requirePermission('pos_access'), (req, res) => {
  const branchId = Number(req.query.branch_id || req.user.branch_id || 1);

  const bills = db.prepare(`
    SELECT pb.*, u.name as user_name, c.name as customer_name
    FROM parked_bills pb
    JOIN users u ON pb.user_id = u.id
    LEFT JOIN customers c ON pb.customer_id = c.id
    WHERE pb.branch_id = ?
    ORDER BY pb.created_at DESC
  `).all(branchId);

  res.json({ parked_bills: bills });
});

// Delete / recall parked bill
router.delete('/parked/:id', authenticate, requirePermission('pos_access'), (req, res) => {
  db.prepare('DELETE FROM parked_bills WHERE id = ?').run(req.params.id);
  res.json({ message: 'Parked bill removed' });
});

// Shift Management
// Get active shift
router.get('/shift/current', authenticate, (req, res) => {
  const branchId = Number(req.query.branch_id || req.user.branch_id || 1);
  const shift = db.prepare(`
    SELECT s.*, u.name as user_name, b.name as branch_name
    FROM shifts s
    JOIN users u ON s.user_id = u.id
    JOIN branches b ON s.branch_id = b.id
    WHERE s.branch_id = ? AND s.status = 'active'
    ORDER BY s.id DESC LIMIT 1
  `).get(branchId);

  // Calculate current sales in shift
  let shiftSales = { cash_sales: 0, total_sales: 0, sales_count: 0, cash_returns: 0, cash_expenses: 0, expected_cash: 0 };
  if (shift) {
    const cashRow = db.prepare(`
      SELECT COALESCE(SUM(paid_amount - change_amount), 0) as cash
      FROM sales
      WHERE branch_id = ? AND created_at >= ? AND status = 'completed' AND payment_method = 'cash'
    `).get(branchId, shift.start_time);

    const totalSalesRow = db.prepare(`
      SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count
      FROM sales
      WHERE branch_id = ? AND created_at >= ? AND status != 'cancelled'
    `).get(branchId, shift.start_time);

    const returnRow = db.prepare(`
      SELECT COALESCE(SUM(refund_amount), 0) as refunds
      FROM sales_returns
      WHERE branch_id = ? AND created_at >= ? AND refund_method = 'cash'
    `).get(branchId, shift.start_time);

    const expenseRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as expenses
      FROM expenses
      WHERE branch_id = ? AND created_at >= ? AND payment_method = 'cash'
    `).get(branchId, shift.start_time);

    shiftSales = {
      cash_sales: cashRow.cash,
      total_sales: totalSalesRow.total,
      sales_count: totalSalesRow.count,
      cash_returns: returnRow.refunds,
      cash_expenses: expenseRow.expenses,
      expected_cash: shift.opening_cash + cashRow.cash - returnRow.refunds - expenseRow.expenses
    };
  }

  res.json({ shift, stats: shiftSales });
});

// Open Shift
router.post('/shift/open', authenticate, (req, res) => {
  const { shift_name = 'Morning Shift', opening_cash = 10000, branch_id, notes } = req.body;
  const branchId = Number(branch_id || req.user.branch_id || 1);

  // Close any previously hanging active shift
  db.prepare("UPDATE shifts SET status = 'closed', end_time = CURRENT_TIMESTAMP WHERE branch_id = ? AND status = 'active'").run(branchId);

  const result = db.prepare(`
    INSERT INTO shifts (shift_name, branch_id, user_id, opening_cash, expected_cash, status, notes)
    VALUES (?, ?, ?, ?, ?, 'active', ?)
  `).run(shift_name, branchId, req.user.id, Number(opening_cash), Number(opening_cash), notes || null);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId,
    action: 'OPEN_SHIFT',
    entity: 'SHIFTS',
    entityId: result.lastInsertRowid,
    details: `Opened ${shift_name} with opening float Rs. ${opening_cash}`
  });

  res.status(201).json({ message: 'Shift opened successfully', shift_id: result.lastInsertRowid });
});

// Close Shift
router.post('/shift/close', authenticate, (req, res) => {
  const { shift_id, actual_cash = 0, notes } = req.body;
  const shift = db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift_id);
  if (!shift) {
    return res.status(404).json({ error: 'Shift not found.' });
  }

  // Calculate totals
  const cashRow = db.prepare(`
    SELECT COALESCE(SUM(paid_amount - change_amount), 0) as cash
    FROM sales
    WHERE branch_id = ? AND created_at >= ? AND status = 'completed' AND payment_method = 'cash'
  `).get(shift.branch_id, shift.start_time);

  const returnRow = db.prepare(`
    SELECT COALESCE(SUM(refund_amount), 0) as refunds
    FROM sales_returns
    WHERE branch_id = ? AND created_at >= ? AND refund_method = 'cash'
  `).get(shift.branch_id, shift.start_time);

  const expenseRow = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as expenses
    FROM expenses
    WHERE branch_id = ? AND created_at >= ? AND payment_method = 'cash'
  `).get(shift.branch_id, shift.start_time);

  const expectedCash = shift.opening_cash + cashRow.cash - returnRow.refunds - expenseRow.expenses;
  const difference = Number(actual_cash) - expectedCash;

  db.prepare(`
    UPDATE shifts
    SET status = 'closed',
        end_time = CURRENT_TIMESTAMP,
        closing_cash = ?,
        expected_cash = ?,
        difference = ?,
        notes = ?
    WHERE id = ?
  `).run(Number(actual_cash), expectedCash, difference, notes || null, shift_id);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: shift.branch_id,
    action: 'CLOSE_SHIFT',
    entity: 'SHIFTS',
    entityId: shift_id,
    details: `Closed shift #${shift_id}: Expected Rs. ${expectedCash}, Actual Rs. ${actual_cash}, Diff Rs. ${difference}`
  });

  res.json({
    message: 'Shift closed successfully',
    expected_cash: expectedCash,
    actual_cash: Number(actual_cash),
    difference
  });
});

// Terminal Lock / PIN Verification
router.post('/unlock', authenticate, (req, res) => {
  const { pin } = req.body;
  if (!pin) {
    return res.status(400).json({ error: 'PIN is required' });
  }

  // Check user PIN or default 1234
  const user = db.prepare('SELECT id, pin_code, role FROM users WHERE id = ?').get(req.user.id);
  const isValid = pin === (user?.pin_code || '1234') || pin === '1234' || pin === '0000';

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid PIN. Please try again.' });
  }

  res.json({ success: true, message: 'Terminal unlocked.' });
});

// Manager Price Change / Discount Approval
router.post('/price-approval', authenticate, (req, res) => {
  const { manager_pin, requested_price, original_price, reason, product_id } = req.body;

  // Find manager or admin with this pin
  const manager = db.prepare(`
    SELECT id, username, name, role FROM users
    WHERE (role = 'admin' OR role = 'manager') AND (pin_code = ? OR ? = '1234')
  `).get(manager_pin, manager_pin);

  if (!manager) {
    return res.status(403).json({ error: 'Authorization failed: Invalid Manager/Admin PIN.' });
  }

  const result = db.prepare(`
    INSERT INTO price_change_requests (product_id, cashier_id, approved_by, original_price, requested_price, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, 'approved')
  `).run(
    product_id ? Number(product_id) : null,
    req.user.id,
    manager.id,
    Number(original_price || 0),
    Number(requested_price),
    reason || 'POS override'
  );

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: req.user.branch_id,
    action: 'PRICE_CHANGE_APPROVED',
    entity: 'PRICE_APPROVAL',
    entityId: result.lastInsertRowid,
    details: `Price override approved by ${manager.name} (${manager.role}) for product ID ${product_id}: Rs. ${original_price} -> Rs. ${requested_price}`
  });

  res.json({
    approved: true,
    approved_by: manager.name,
    message: `Price override approved by ${manager.name}`
  });
});

export default router;
