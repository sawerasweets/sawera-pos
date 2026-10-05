import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// List promotions
router.get('/', authenticate, (req, res) => {
  const promos = db.prepare(`
    SELECT pr.*, c.name as category_name, p.name as product_name
    FROM promotions pr
    LEFT JOIN categories c ON pr.category_id = c.id
    LEFT JOIN products p ON pr.product_id = p.id
    ORDER BY pr.id DESC
  `).all();
  res.json({ promotions: promos });
});

// Create promotion
router.post('/', authenticate, requirePermission('manage_settings'), (req, res) => {
  const { title, type, value = 0, category_id, product_id, min_order_amount = 0, start_date, end_date } = req.body;

  if (!title || !type) {
    return res.status(400).json({ error: 'Promotion title and type are required.' });
  }

  const result = db.prepare(`
    INSERT INTO promotions (title, type, value, category_id, product_id, min_order_amount, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(
    title.trim(),
    type,
    Number(value),
    category_id ? Number(category_id) : null,
    product_id ? Number(product_id) : null,
    Number(min_order_amount),
    start_date || null,
    end_date || null
  );

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: req.user.branch_id,
    action: 'CREATE_PROMOTION',
    entity: 'PROMOTIONS',
    entityId: result.lastInsertRowid,
    details: `Created promotion "${title}" (${type}: ${value})`
  });

  res.status(201).json({ message: 'Promotion created successfully', id: result.lastInsertRowid });
});

// Toggle promotion status
router.put('/:id', authenticate, requirePermission('manage_settings'), (req, res) => {
  const { status, title, value } = req.body;
  db.prepare(`
    UPDATE promotions
    SET status = COALESCE(?, status),
        title = COALESCE(?, title),
        value = COALESCE(?, value)
    WHERE id = ?
  `).run(status, title, value !== undefined ? Number(value) : null, req.params.id);

  res.json({ message: 'Promotion updated successfully' });
});

export default router;
