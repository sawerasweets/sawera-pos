import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requireRole, requirePermission } from '../middleware/auth.js';

const router = Router();

// Get all branches
router.get('/', authenticate, (req, res) => {
  const branches = db.prepare(`
    SELECT b.*,
      (SELECT COUNT(*) FROM users WHERE branch_id = b.id) as user_count,
      (SELECT COUNT(*) FROM sales WHERE branch_id = b.id) as total_sales_count,
      (SELECT COALESCE(SUM(grand_total), 0) FROM sales WHERE branch_id = b.id) as total_sales_amount
    FROM branches b
    ORDER BY b.id ASC
  `).all();

  res.json({ branches });
});

// Get single branch
router.get('/:id', authenticate, (req, res) => {
  const branch = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
  if (!branch) {
    return res.status(404).json({ error: 'Branch not found' });
  }
  res.json({ branch });
});

// Create new branch (e.g. Branch 5, Branch 6, etc.)
router.post('/', authenticate, requirePermission('manage_branches'), (req, res) => {
  const { code, name, name_urdu, address, phone, manager_name, opening_time, closing_time, status } = req.body;

  if (!code || !name) {
    return res.status(400).json({ error: 'Branch code and name are required.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO branches (code, name, name_urdu, address, phone, manager_name, opening_time, closing_time, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      code.toUpperCase().trim(),
      name.trim(),
      name_urdu || null,
      address || null,
      phone || null,
      manager_name || null,
      opening_time || '08:00 AM',
      closing_time || '11:00 PM',
      status || 'active'
    );

    const newBranchId = Number(result.lastInsertRowid);

    // Initialize product inventory rows for this new branch with 0 stock
    const products = db.prepare('SELECT id FROM products').all();
    const insertInv = db.prepare('INSERT OR IGNORE INTO branch_inventory (branch_id, product_id, quantity) VALUES (?, ?, 0)');
    for (const p of products) {
      insertInv.run(newBranchId, p.id);
    }

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: newBranchId,
      action: 'CREATE_BRANCH',
      entity: 'BRANCHES',
      entityId: newBranchId,
      details: `Created new branch ${name} (${code})`
    });

    const newBranch = db.prepare('SELECT * FROM branches WHERE id = ?').get(newBranchId);
    res.status(201).json({ message: 'Branch created successfully', branch: newBranch });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A branch with this code already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update branch
router.put('/:id', authenticate, requirePermission('manage_branches'), (req, res) => {
  const { code, name, name_urdu, address, phone, manager_name, opening_time, closing_time, status } = req.body;

  try {
    const stmt = db.prepare(`
      UPDATE branches
      SET code = COALESCE(?, code),
          name = COALESCE(?, name),
          name_urdu = COALESCE(?, name_urdu),
          address = COALESCE(?, address),
          phone = COALESCE(?, phone),
          manager_name = COALESCE(?, manager_name),
          opening_time = COALESCE(?, opening_time),
          closing_time = COALESCE(?, closing_time),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      code ? code.toUpperCase().trim() : null,
      name ? name.trim() : null,
      name_urdu,
      address,
      phone,
      manager_name,
      opening_time,
      closing_time,
      status,
      req.params.id
    );

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: Number(req.params.id),
      action: 'UPDATE_BRANCH',
      entity: 'BRANCHES',
      entityId: req.params.id,
      details: `Updated branch ${name || req.params.id}`
    });

    const updated = db.prepare('SELECT * FROM branches WHERE id = ?').get(req.params.id);
    res.json({ message: 'Branch updated successfully', branch: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete/Deactivate branch
router.delete('/:id', authenticate, requireRole(['admin']), (req, res) => {
  const branchId = Number(req.params.id);
  const salesCount = db.prepare('SELECT COUNT(*) as count FROM sales WHERE branch_id = ?').get(branchId).count;

  if (salesCount > 0) {
    // Soft deactivate instead of breaking relational integrity
    db.prepare("UPDATE branches SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(branchId);
    return res.json({ message: 'Branch has past sales history, so it has been set to inactive.' });
  }

  db.prepare('DELETE FROM branch_inventory WHERE branch_id = ?').run(branchId);
  db.prepare('DELETE FROM branches WHERE id = ?').run(branchId);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId,
    action: 'DELETE_BRANCH',
    entity: 'BRANCHES',
    entityId: branchId,
    details: `Deleted branch ID ${branchId}`
  });

  res.json({ message: 'Branch deleted successfully' });
});

export default router;
