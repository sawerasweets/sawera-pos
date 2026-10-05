import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// Get all categories with product counts
router.get('/', authenticate, (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `).all();

  res.json({ categories });
});

// Add category
router.post('/', authenticate, requirePermission('manage_products'), (req, res) => {
  const { name, name_urdu, icon, color, sort_order } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const result = db.prepare(`
    INSERT INTO categories (name, name_urdu, icon, color, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(name.trim(), name_urdu || null, icon || 'ShoppingBag', color || 'amber', sort_order || 0);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    action: 'CREATE_CATEGORY',
    entity: 'CATEGORIES',
    entityId: result.lastInsertRowid,
    details: `Created category ${name}`
  });

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ message: 'Category created', category });
});

// Update category
router.put('/:id', authenticate, requirePermission('manage_products'), (req, res) => {
  const { name, name_urdu, icon, color, sort_order } = req.body;
  db.prepare(`
    UPDATE categories
    SET name = COALESCE(?, name),
        name_urdu = COALESCE(?, name_urdu),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        sort_order = COALESCE(?, sort_order)
    WHERE id = ?
  `).run(name, name_urdu, icon, color, sort_order, req.params.id);

  const category = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  res.json({ message: 'Category updated', category });
});

// Delete category
router.delete('/:id', authenticate, requirePermission('manage_products'), (req, res) => {
  const catId = Number(req.params.id);
  const productsCount = db.prepare('SELECT COUNT(*) as count FROM products WHERE category_id = ?').get(catId).count;

  if (productsCount > 0) {
    return res.status(400).json({ error: 'Cannot delete category that still has products assigned.' });
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(catId);
  res.json({ message: 'Category deleted' });
});

export default router;
