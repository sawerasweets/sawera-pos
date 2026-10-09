import jwt from 'jsonwebtoken';
import db from '../db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'sawera-sweets-secret-key-2026-pakistan';

export function authenticate(req, res, next) {
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query?.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please login.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch fresh user from DB to ensure user is still active
    const user = db.prepare('SELECT id, username, name, email, role, branch_id, permissions, status FROM users WHERE id = ?').get(decoded.id);
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'User account is inactive or not found.' });
    }

    try {
      user.permissions = JSON.parse(user.permissions || '[]');
    } catch {
      user.permissions = [];
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session. Please login again.' });
  }
}

export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // All authorized users operate as Admin with Full Access
    next();
  };
}

export function requirePermission(permissionKey) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // All authorized users operate as Admin with Full Access
    next();
  };
}
