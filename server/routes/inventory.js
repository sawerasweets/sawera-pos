import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// Inventory listing & valuation
router.get('/', authenticate, (req, res) => {
  const { branch_id, category_id, filter, search } = req.query;
  const branchId = branch_id && branch_id !== 'all' ? Number(branch_id) : null;

  let query = `
    SELECT p.id as product_id, p.name as product_name, p.name_urdu as product_name_urdu,
           p.code as product_code, p.barcode, p.unit, p.brand,
           p.purchase_price, p.sale_price, p.min_stock, p.expiry_date,
           c.name as category_name, c.name_urdu as category_name_urdu,
           b.id as branch_id, b.name as branch_name,
           COALESCE(bi.quantity, 0) as quantity,
           (COALESCE(bi.quantity, 0) * p.purchase_price) as stock_cost_value,
           (COALESCE(bi.quantity, 0) * p.sale_price) as stock_sale_value
    FROM products p
    CROSS JOIN branches b
    LEFT JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = b.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.status = 'active' AND b.status = 'active'
  `;
  const params = [];

  if (branchId) {
    query += ` AND b.id = ?`;
    params.push(branchId);
  }

  if (category_id) {
    query += ` AND p.category_id = ?`;
    params.push(Number(category_id));
  }

  if (search) {
    const s = `%${search.trim()}%`;
    query += ` AND (p.name LIKE ? OR p.name_urdu LIKE ? OR p.code LIKE ? OR p.barcode LIKE ?)`;
    params.push(s, s, s, s);
  }

  if (filter === 'low_stock') {
    query += ` AND COALESCE(bi.quantity, 0) <= p.min_stock AND COALESCE(bi.quantity, 0) > 0`;
  } else if (filter === 'out_of_stock') {
    query += ` AND COALESCE(bi.quantity, 0) <= 0`;
  }

  query += ` ORDER BY p.name ASC, b.id ASC`;

  const inventory = db.prepare(query).all(...params);

  // Calculate totals
  let totalCostValuation = 0;
  let totalSaleValuation = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const item of inventory) {
    totalCostValuation += item.stock_cost_value;
    totalSaleValuation += item.stock_sale_value;
    if (item.quantity <= 0) {
      outOfStockCount++;
    } else if (item.quantity <= item.min_stock) {
      lowStockCount++;
    }
  }

  res.json({
    inventory,
    summary: {
      total_items: inventory.length,
      total_cost_valuation: totalCostValuation,
      total_sale_valuation: totalSaleValuation,
      low_stock_count: lowStockCount,
      out_of_stock_count: outOfStockCount
    }
  });
});

// Manual Stock Adjustment
router.post('/adjust', authenticate, requirePermission('manage_inventory'), (req, res) => {
  const { product_id, branch_id, adjustment_type, quantity, reason } = req.body;

  if (!product_id || !branch_id || !quantity || quantity <= 0) {
    return res.status(400).json({ error: 'Product, branch, and valid positive quantity are required.' });
  }

  const prodId = Number(product_id);
  const brId = Number(branch_id);
  const qty = Number(quantity);

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const currentInv = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(brId, prodId);
  const curStock = currentInv ? currentInv.quantity : 0;

  let newStock = curStock;
  let movementQty = 0;

  if (adjustment_type === 'add') {
    newStock = curStock + qty;
    movementQty = qty;
  } else if (adjustment_type === 'remove' || adjustment_type === 'damage' || adjustment_type === 'expired') {
    if (curStock < qty) {
      return res.status(400).json({ error: `Cannot subtract ${qty} items. Current stock is only ${curStock}.` });
    }
    newStock = curStock - qty;
    movementQty = -qty;
  } else if (adjustment_type === 'set_exact') {
    newStock = qty;
    movementQty = newStock - curStock;
  } else {
    return res.status(400).json({ error: 'Invalid adjustment type.' });
  }

  db.prepare(`
    INSERT INTO branch_inventory (branch_id, product_id, quantity, last_restocked)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(branch_id, product_id) DO UPDATE SET quantity = ?, last_restocked = CURRENT_TIMESTAMP
  `).run(brId, prodId, newStock, newStock);

  db.prepare(`
    INSERT INTO stock_movements (product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id)
    VALUES (?, ?, ?, ?, ?, ?, 'MANUAL-ADJ', ?, ?)
  `).run(prodId, brId, adjustment_type === 'damage' ? 'damage' : 'manual_adjustment', movementQty, curStock, newStock, reason || 'Manual stock adjustment', req.user.id);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: brId,
    action: 'STOCK_ADJUSTMENT',
    entity: 'INVENTORY',
    entityId: prodId,
    details: `Adjusted stock for "${product.name}" in branch ${brId}: ${curStock} -> ${newStock} (${reason || adjustment_type})`
  });

  res.json({
    message: 'Stock adjusted successfully',
    previous_stock: curStock,
    new_stock: newStock
  });
});

// Branch to Branch Stock Transfer
router.post('/transfer', authenticate, requirePermission('manage_inventory'), (req, res) => {
  const { from_branch_id, to_branch_id, items, notes } = req.body;

  if (!from_branch_id || !to_branch_id || from_branch_id === to_branch_id) {
    return res.status(400).json({ error: 'Source and destination branches must be selected and different.' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Please select items to transfer.' });
  }

  const fromBr = Number(from_branch_id);
  const toBr = Number(to_branch_id);

  try {
    db.exec('BEGIN TRANSACTION;');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const transferCount = db.prepare(`SELECT COUNT(*) as count FROM branch_transfers WHERE transfer_no LIKE 'TRF-${dateStr}-%'`).get().count + 1;
    const transferNo = `TRF-${dateStr}-${String(transferCount).padStart(4, '0')}`;

    const insertTransfer = db.prepare(`
      INSERT INTO branch_transfers (transfer_no, from_branch_id, to_branch_id, user_id, status, notes)
      VALUES (?, ?, ?, ?, 'completed', ?)
    `);
    const trfResult = insertTransfer.run(transferNo, fromBr, toBr, req.user.id, notes || null);
    const transferId = Number(trfResult.lastInsertRowid);

    const insertTrfItem = db.prepare(`
      INSERT INTO branch_transfer_items (transfer_id, product_id, quantity)
      VALUES (?, ?, ?)
    `);

    const updateSourceStock = db.prepare(`
      UPDATE branch_inventory SET quantity = quantity - ? WHERE branch_id = ? AND product_id = ?
    `);

    const updateDestStock = db.prepare(`
      INSERT INTO branch_inventory (branch_id, product_id, quantity, last_restocked)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(branch_id, product_id) DO UPDATE SET quantity = quantity + ?, last_restocked = CURRENT_TIMESTAMP
    `);

    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      const prodId = Number(item.product_id);
      const qty = Number(item.quantity);
      if (qty <= 0) continue;

      const sourceStock = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(fromBr, prodId)?.quantity || 0;
      if (sourceStock < qty) {
        throw new Error(`Insufficient stock for product ID ${prodId} at source branch. Available: ${sourceStock}, Requested: ${qty}`);
      }

      const destStock = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(toBr, prodId)?.quantity || 0;

      insertTrfItem.run(transferId, prodId, qty);
      updateSourceStock.run(qty, fromBr, prodId);
      updateDestStock.run(toBr, prodId, qty, qty);

      // Ledger for Source Branch
      insertMovement.run(
        prodId,
        fromBr,
        'transfer_out',
        -qty,
        sourceStock,
        sourceStock - qty,
        transferNo,
        `Transferred to Branch ${toBr}`,
        req.user.id
      );

      // Ledger for Destination Branch
      insertMovement.run(
        prodId,
        toBr,
        'transfer_in',
        qty,
        destStock,
        destStock + qty,
        transferNo,
        `Transferred from Branch ${fromBr}`,
        req.user.id
      );
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: fromBr,
      action: 'STOCK_TRANSFER',
      entity: 'TRANSFERS',
      entityId: transferId,
      details: `Transferred stock via ${transferNo} from Branch ${fromBr} to Branch ${toBr}`
    });

    res.status(201).json({
      message: 'Stock transfer completed successfully',
      transfer_no: transferNo
    });

  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(400).json({ error: err.message });
  }
});

// Stock Movements Ledger
router.get('/movements', authenticate, (req, res) => {
  const { product_id, branch_id, type, date_from, date_to, limit = 100 } = req.query;

  let query = `
    SELECT sm.*, p.name as product_name, p.code as product_code, p.unit,
           b.name as branch_name, b.code as branch_code,
           u.name as user_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    JOIN branches b ON sm.branch_id = b.id
    LEFT JOIN users u ON sm.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (branch_id && branch_id !== 'all') {
    query += ` AND sm.branch_id = ?`;
    params.push(Number(branch_id));
  }

  if (product_id) {
    query += ` AND sm.product_id = ?`;
    params.push(Number(product_id));
  }

  if (type && type !== 'all') {
    query += ` AND sm.type = ?`;
    params.push(type);
  }

  if (date_from) {
    query += ` AND date(sm.created_at) >= date(?)`;
    params.push(date_from);
  }

  if (date_to) {
    query += ` AND date(sm.created_at) <= date(?)`;
    params.push(date_to);
  }

  query += ` ORDER BY sm.created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const movements = db.prepare(query).all(...params);
  res.json({ movements });
});

// Transfer history
router.get('/transfers', authenticate, (req, res) => {
  const transfers = db.prepare(`
    SELECT bt.*, b1.name as from_branch_name, b2.name as to_branch_name, u.name as user_name,
           (SELECT COUNT(*) FROM branch_transfer_items WHERE transfer_id = bt.id) as item_count,
           (SELECT SUM(quantity) FROM branch_transfer_items WHERE transfer_id = bt.id) as total_qty
    FROM branch_transfers bt
    JOIN branches b1 ON bt.from_branch_id = b1.id
    JOIN branches b2 ON bt.to_branch_id = b2.id
    JOIN users u ON bt.user_id = u.id
    ORDER BY bt.created_at DESC
    LIMIT 50
  `).all();

  res.json({ transfers });
});

export default router;
