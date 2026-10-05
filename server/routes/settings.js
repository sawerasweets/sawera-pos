import { Router } from 'express';
import db, { logAudit, seedInitialData } from '../db.js';
import { authenticate, requireRole, requirePermission } from '../middleware/auth.js';

const router = Router();

// Get all settings
router.get('/', authenticate, (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) {
    settings[r.key] = r.value;
  }
  res.json({ settings });
});

// Update settings
router.post('/', authenticate, requirePermission('manage_settings'), (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'Settings object is required.' });
  }

  const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');

  for (const [key, value] of Object.entries(settings)) {
    setSetting.run(key, String(value));
  }

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: req.user.branch_id,
    action: 'UPDATE_SETTINGS',
    entity: 'SETTINGS',
    details: `Updated system settings`
  });

  res.json({ message: 'Settings saved successfully' });
});

// Reset / Re-seed Demo Data (Convenient for testing)
router.post('/reset-demo', authenticate, requireRole(['admin']), (req, res) => {
  try {
    seedInitialData(true);
    res.json({ message: 'Demo data re-seeded successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
