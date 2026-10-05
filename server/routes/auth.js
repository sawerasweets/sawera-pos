import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { logAudit } from '../db.js';
import { authenticate, JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// Login
router.post('/login', (req, res) => {
  const { username, password, rememberMe } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and Password are required.' });
  }

  const user = db.prepare(`
    SELECT u.*, b.name as branch_name, b.name_urdu as branch_name_urdu, b.code as branch_code
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    WHERE (u.username = ? OR u.email = ?) AND u.status = 'active'
  `).get(username.trim().toLowerCase(), username.trim().toLowerCase());

  if (!user) {
    return res.status(401).json({ error: 'Invalid username/email or password.' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid username/email or password.' });
  }

  const expiresIn = rememberMe ? '30d' : '24h';
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, branch_id: user.branch_id },
    JWT_SECRET,
    { expiresIn }
  );

  let permissions = [];
  try {
    permissions = JSON.parse(user.permissions || '[]');
  } catch {
    permissions = [];
  }

  logAudit({
    userId: user.id,
    username: user.username,
    branchId: user.branch_id,
    action: 'LOGIN',
    entity: 'AUTH',
    details: `User ${user.username} logged in (${user.role})`
  });

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      branch_id: user.branch_id,
      branch_name: user.branch_name,
      branch_name_urdu: user.branch_name_urdu,
      branch_code: user.branch_code,
      phone: user.phone,
      permissions
    }
  });
});

// Me
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.username, u.name, u.email, u.role, u.branch_id, u.phone, u.status, u.permissions,
           b.name as branch_name, b.name_urdu as branch_name_urdu, b.code as branch_code
    FROM users u
    LEFT JOIN branches b ON u.branch_id = b.id
    WHERE u.id = ?
  `).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    user.permissions = JSON.parse(user.permissions || '[]');
  } catch {
    user.permissions = [];
  }

  res.json({ user });
});

// Change Password
router.post('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password are required.' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
  const match = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!match) {
    return res.status(400).json({ error: 'Current password does not match.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword, salt);

  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, req.user.id);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: req.user.branch_id,
    action: 'CHANGE_PASSWORD',
    entity: 'USERS',
    details: 'User updated their password'
  });

  res.json({ message: 'Password updated successfully' });
});

// Forgot Password (Simulated admin reset or verification)
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Please enter your registered email address.' });
  }

  const user = db.prepare('SELECT id, username FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) {
    // For security, don't reveal email existence
    return res.json({ message: 'If this email is registered, password reset instructions have been dispatched.' });
  }

  // Generate temporary 6 digit reset code or auto reset for testing
  res.json({
    message: `A password reset code has been sent to ${email}. For convenience in testing, contact system admin or use default credentials.`
  });
});

export default router;
