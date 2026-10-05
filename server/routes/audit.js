import { Router } from 'express';
import db from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, requireRole(['admin']), (req, res) => {
  const { action, user_id, branch_id, search, limit = 100 } = req.query;

  let query = `
    SELECT a.*, b.name as branch_name
    FROM audit_logs a
    LEFT JOIN branches b ON a.branch_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (action && action !== 'all') {
    query += ` AND a.action = ?`;
    params.push(action);
  }

  if (user_id) {
    query += ` AND a.user_id = ?`;
    params.push(Number(user_id));
  }

  if (branch_id && branch_id !== 'all') {
    query += ` AND a.branch_id = ?`;
    params.push(Number(branch_id));
  }

  if (search) {
    const s = `%${search.trim()}%`;
    query += ` AND (a.details LIKE ? OR a.entity LIKE ? OR a.username LIKE ?)`;
    params.push(s, s, s);
  }

  query += ` ORDER BY a.created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const logs = db.prepare(query).all(...params);
  res.json({ logs });
});

export default router;
