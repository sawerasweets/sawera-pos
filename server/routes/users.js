import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { logAudit } from '../db.js';
import { authenticate, requireRole, requirePermission } from '../middleware/auth.js';

const router = Router();

// List Users
router.get('/', authenticate, requirePermission('manage_users'), (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.role, u.branch_id, u.phone, u.status, u.permissions, u.created_at,
           b.name as branch_name, b.code as branch_code
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    ORDER BY u.id ASC
  `).all();

  const formatted = users.map(u => ({
    ...u,
    permissions: JSON.parse(u.permissions || '[]')
  }));

  res.json({ users: formatted });
});

// Create User
router.post('/', authenticate, requireRole(['admin']), (req, res) => {
  const { username, name, email, password, role = 'cashier', branch_id, phone, permissions } = req.body;

  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Username, password and full name are required.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);

  const adminPerms = [
    'pos_access', 'view_dashboard', 'view_reports', 'view_profit', 'manage_products',
    'delete_products', 'manage_inventory', 'manage_purchases', 'manage_expenses',
    'manage_customers', 'manage_suppliers', 'manage_branches', 'manage_users',
    'manage_settings', 'manage_backup', 'process_returns', 'view_all_branches', 'cash_register'
  ];

  try {
    const result = db.prepare(`
      INSERT INTO users (username, name, email, password_hash, role, branch_id, phone, status, permissions)
      VALUES (?, ?, ?, ?, 'admin', ?, ?, 'active', ?)
    `).run(
      username.trim().toLowerCase(),
      name.trim(),
      email ? email.trim().toLowerCase() : null,
      passwordHash,
      branch_id ? Number(branch_id) : null,
      phone || null,
      JSON.stringify(adminPerms)
    );

    const newUserId = Number(result.lastInsertRowid);

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: branch_id,
      action: 'CREATE_USER',
      entity: 'USERS',
      entityId: newUserId,
      details: `Created user account ${username} (${role})`
    });

    res.status(201).json({ message: 'User created successfully', id: newUserId });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Username or email already in use.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update User & Permissions
router.put('/:id', authenticate, requireRole(['admin']), (req, res) => {
  const { name, email, role, branch_id, phone, status, permissions, password } = req.body;
  const targetId = Number(req.params.id);

  let passwordClause = '';
  const params = [
    name,
    email ? email.trim().toLowerCase() : null,
    role,
    branch_id ? Number(branch_id) : null,
    phone,
    status,
    permissions ? JSON.stringify(permissions) : null
  ];

  if (password && password.length >= 6) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);
    passwordClause = ', password_hash = ?';
    params.push(hash);
  }

  params.push(targetId);

  db.prepare(`
    UPDATE users
    SET name = COALESCE(?, name),
        email = COALESCE(?, email),
        role = COALESCE(?, role),
        branch_id = COALESCE(?, branch_id),
        phone = COALESCE(?, phone),
        status = COALESCE(?, status),
        permissions = COALESCE(?, permissions),
        updated_at = CURRENT_TIMESTAMP
        ${passwordClause}
    WHERE id = ?
  `).run(...params);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: branch_id,
    action: 'UPDATE_USER',
    entity: 'USERS',
    entityId: targetId,
    details: `Updated user ID ${targetId}`
  });

  res.json({ message: 'User updated successfully' });
});

// Deactivate user
router.delete('/:id', authenticate, requireRole(['admin']), (req, res) => {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own account.' });
  }

  db.prepare("UPDATE users SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(targetId);
  res.json({ message: 'User deactivated successfully' });
});

export default router;
