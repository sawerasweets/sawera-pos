import { Router } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { JWT_SECRET } from '../middleware/auth.js';

const router = Router();

// Helper to get rate checker PIN from settings (defaults to '1234')
function getRateCheckerPin() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = 'rate_checker_pin'").get();
    return row?.value?.trim() || '1234';
  } catch {
    return '1234';
  }
}

// Middleware: Authenticate either via JWT (Admin/POS user OR rate_checker worker) OR direct x-worker-pin header
function authenticateWorker(req, res, next) {
  // 1. Check direct PIN in header or query
  const providedPin = req.headers['x-worker-pin'] || req.query.pin;
  const expectedPin = getRateCheckerPin();

  if (providedPin && String(providedPin).trim() === expectedPin) {
    req.worker = { role: 'rate_checker', verifiedBy: 'pin' };
    return next();
  }

  // 2. Check Bearer token
  const authHeader = req.headers.authorization;
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query?.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      // Valid worker token or full POS user
      req.worker = decoded;
      return next();
    } catch (err) {
      // Invalid token, proceed to 401
    }
  }

  return res.status(401).json({
    error: 'Worker authorization required. Please enter the Rate Checker PIN.',
    error_urdu: 'ریٹ چیکر استعمال کرنے کے لیے پن کوڈ درج کریں۔',
    require_pin: true
  });
}

// 1. Public Config for Rate Checker App (Branding, Branches, Currency)
router.get('/config', (req, res) => {
  try {
    const settingsRows = db.prepare("SELECT key, value FROM settings WHERE key IN ('business_name', 'business_name_urdu', 'currency', 'phone')").all();
    const settingsMap = {};
    for (const r of settingsRows) {
      settingsMap[r.key] = r.value;
    }

    const branches = db.prepare("SELECT id, code, name, name_urdu FROM branches WHERE status = 'active' ORDER BY id ASC").all();

    res.json({
      business_name: settingsMap.business_name || 'Sawera Sweet & Bakers',
      business_name_urdu: settingsMap.business_name_urdu || 'سویرا سویٹس اینڈ بیکرز',
      currency: settingsMap.currency || 'Rs.',
      phone: settingsMap.phone || '',
      branches,
      require_pin: true
    });
  } catch (err) {
    console.error('Error fetching rate checker config:', err);
    res.status(500).json({ error: 'Failed to load configuration' });
  }
});

// 2. Verify Worker PIN and issue a lightweight read-only token
router.post('/verify-pin', (req, res) => {
  try {
    const { pin } = req.body;
    const expectedPin = getRateCheckerPin();

    if (!pin || String(pin).trim() !== expectedPin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Worker PIN / غلط پن کوڈ',
        error_urdu: 'درج کردہ پن کوڈ درست نہیں ہے۔ برائے مہربانی ایڈمن سے درست کوڈ معلوم کریں۔'
      });
    }

    // Issue a read-only token valid for 30 days on worker mobile
    const token = jwt.sign(
      {
        role: 'rate_checker',
        access: 'read_only',
        issued_at: Date.now()
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      message: 'Worker PIN verified / تصدیق کامیاب'
    });
  } catch (err) {
    console.error('Error verifying worker PIN:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// 3. Authoritative Read-Only Barcode Lookup (Real-time DB query)
router.get('/lookup/:barcode', authenticateWorker, (req, res) => {
  try {
    const rawBarcode = req.params.barcode ? req.params.barcode.trim() : '';
    if (!rawBarcode) {
      return res.status(400).json({ error: 'Barcode parameter is required.' });
    }

    const branchId = Number(req.query.branch_id || 1);

    // Query authoritative products table.
    // STRICT SECURITY: We deliberately omit purchase_price, wholesale_margin, supplier_id, profit, etc.
    const query = `
      SELECT
        p.id,
        p.name,
        p.name_urdu,
        p.code,
        p.sku,
        p.barcode,
        p.unit,
        p.sale_price,
        p.image_url,
        p.description,
        p.status,
        c.name as category_name,
        c.name_urdu as category_name_urdu,
        COALESCE(bi.quantity, 0) as branch_stock,
        b.name as branch_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN branch_inventory bi ON (bi.product_id = p.id AND bi.branch_id = ?)
      LEFT JOIN branches b ON b.id = ?
      WHERE (p.barcode = ? OR UPPER(p.code) = UPPER(?) OR UPPER(p.sku) = UPPER(?))
        AND p.status = 'active'
      LIMIT 1
    `;

    const product = db.prepare(query).get(branchId, branchId, rawBarcode, rawBarcode, rawBarcode);

    if (!product) {
      return res.status(404).json({
        found: false,
        barcode: rawBarcode,
        error: `Product not found with barcode: ${rawBarcode}`,
        error_urdu: `اس بارکوڈ (${rawBarcode}) کی کوئی پروڈکٹ سسٹم میں موجود نہیں ہے۔`
      });
    }

    res.json({
      found: true,
      product: {
        id: product.id,
        name: product.name,
        name_urdu: product.name_urdu || '',
        code: product.code,
        sku: product.sku,
        barcode: product.barcode,
        unit: product.unit || 'Piece',
        sale_price: Number(product.sale_price) || 0,
        image_url: product.image_url || '',
        description: product.description || '',
        category_name: product.category_name || 'General',
        category_name_urdu: product.category_name_urdu || '',
        branch_name: product.branch_name || 'Main Branch',
        in_stock: product.branch_stock > 0,
        branch_stock: product.branch_stock
      }
    });
  } catch (err) {
    console.error('Error looking up product price:', err);
    res.status(500).json({ error: 'Server error while checking price' });
  }
});

export default router;
