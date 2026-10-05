import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// Get all products with branch stock
router.get('/', authenticate, (req, res) => {
  const { branch_id, category_id, search, low_stock, out_of_stock, status = 'active' } = req.query;

  let query = `
    SELECT p.*, c.name as category_name, c.name_urdu as category_name_urdu,
           s.name as supplier_name,
           COALESCE(bi.quantity, 0) as branch_stock,
           COALESCE((SELECT SUM(quantity) FROM branch_inventory WHERE product_id = p.id), 0) as total_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN suppliers s ON p.supplier_id = s.id
    LEFT JOIN branch_inventory bi ON (bi.product_id = p.id AND bi.branch_id = ?)
    WHERE 1=1
  `;
  const params = [branch_id ? Number(branch_id) : 1];

  if (status && status !== 'all') {
    query += ` AND p.status = ?`;
    params.push(status);
  }

  if (category_id) {
    query += ` AND p.category_id = ?`;
    params.push(Number(category_id));
  }

  if (search) {
    const s = `%${search.trim()}%`;
    query += ` AND (p.name LIKE ? OR p.name_urdu LIKE ? OR p.code LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)`;
    params.push(s, s, s, s, s);
  }

  if (low_stock === 'true') {
    query += ` AND COALESCE(bi.quantity, 0) <= p.min_stock AND COALESCE(bi.quantity, 0) > 0`;
  }

  if (out_of_stock === 'true') {
    query += ` AND COALESCE(bi.quantity, 0) <= 0`;
  }

  query += ` ORDER BY p.name ASC`;

  const products = db.prepare(query).all(...params);
  res.json({ products });
});

// Barcode Lookup (for fast POS scanner)
router.get('/barcode/:barcode', authenticate, (req, res) => {
  const rawBarcode = req.params.barcode ? req.params.barcode.trim() : '';
  const branchId = Number(req.query.branch_id || req.user.branch_id || 1);

  // 1. Highest priority: exact barcode match
  let product = db.prepare(`
    SELECT p.*, c.name as category_name, c.name_urdu as category_name_urdu,
           COALESCE(bi.quantity, 0) as branch_stock
    FROM products p
    LEFT JOIN categories c ON p.category_id = c.id
    LEFT JOIN branch_inventory bi ON (bi.product_id = p.id AND bi.branch_id = ?)
    WHERE p.barcode = ? AND p.status = 'active'
  `).get(branchId, rawBarcode);

  // 2. Fallback: exact code or SKU match
  if (!product) {
    product = db.prepare(`
      SELECT p.*, c.name as category_name, c.name_urdu as category_name_urdu,
             COALESCE(bi.quantity, 0) as branch_stock
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN branch_inventory bi ON (bi.product_id = p.id AND bi.branch_id = ?)
      WHERE (UPPER(p.code) = UPPER(?) OR UPPER(p.sku) = UPPER(?)) AND p.status = 'active'
    `).get(branchId, rawBarcode, rawBarcode);
  }

  if (!product) {
    return res.status(404).json({ error: 'Product not found with this barcode.', barcode: rawBarcode });
  }

  res.json({ product });
});

// Generate next unique barcode (Pakistani prefix 8964...)
router.get('/utils/generate-barcode', authenticate, (req, res) => {
  let barcode = '';
  let exists = true;
  let attempts = 0;
  while (exists && attempts < 100) {
    attempts++;
    const rand = Math.floor(10000000 + Math.random() * 90000000);
    barcode = `8964${rand}`;
    const found = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode);
    if (!found) {
      exists = false;
    }
  }
  res.json({ barcode });
});

// Create product
router.post('/', authenticate, requirePermission('manage_products'), (req, res) => {
  const {
    name, name_urdu, code, sku, barcode, category_id, brand,
    purchase_price = 0, sale_price = 0, wholesale_price = 0,
    min_stock = 5, unit = 'Piece', supplier_id, expiry_date, image_url, description,
    initial_stock = 0
  } = req.body;

  if (!name || !sale_price) {
    return res.status(400).json({ error: 'Product name and sale price are required.' });
  }

  const generatedCode = (code || `PRD-${Date.now().toString().slice(-6)}`).trim();
  const generatedBarcode = (barcode || `8964${Date.now().toString().slice(-8)}`).trim();

  // Validate duplicate barcode among active products
  const existingBarcode = db.prepare("SELECT id, name, code, barcode FROM products WHERE barcode = ? AND status = 'active'").get(generatedBarcode);
  if (existingBarcode) {
    return res.status(400).json({
      error: `Barcode '${generatedBarcode}' already belongs to product: '${existingBarcode.name}' (Code: ${existingBarcode.code}). Duplicate barcodes are not allowed.`,
      duplicate: 'barcode',
      existing_product: existingBarcode
    });
  }

  // Validate duplicate code among active products
  const existingCode = db.prepare("SELECT id, name, code FROM products WHERE code = ? AND status = 'active'").get(generatedCode);
  if (existingCode) {
    return res.status(400).json({
      error: `Product code '${generatedCode}' already belongs to product: '${existingCode.name}'. Duplicate codes are not allowed.`,
      duplicate: 'code',
      existing_product: existingCode
    });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO products (name, name_urdu, code, sku, barcode, category_id, brand, purchase_price, sale_price, wholesale_price, min_stock, unit, supplier_id, expiry_date, image_url, description, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `);

    const result = stmt.run(
      name.trim(),
      name_urdu || null,
      generatedCode,
      sku ? sku.trim() : generatedCode,
      generatedBarcode,
      category_id ? Number(category_id) : null,
      brand || 'Sawera Sweets',
      Number(purchase_price),
      Number(sale_price),
      Number(wholesale_price),
      Number(min_stock),
      unit || 'Piece',
      supplier_id ? Number(supplier_id) : null,
      expiry_date || null,
      image_url || 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=200&auto=format&fit=crop&q=60',
      description || null
    );

    const newProdId = Number(result.lastInsertRowid);

    // Initialize inventory for all branches
    const branches = db.prepare('SELECT id FROM branches').all();
    const insertInv = db.prepare('INSERT INTO branch_inventory (branch_id, product_id, quantity) VALUES (?, ?, ?)');
    const insertMov = db.prepare(`
      INSERT INTO stock_movements (product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id)
      VALUES (?, ?, 'manual_adjustment', ?, 0, ?, 'NEW-PRODUCT', 'Initial Product Stock', ?)
    `);

    for (const b of branches) {
      const stock = (b.id === Number(req.user.branch_id || 1)) ? Number(initial_stock || 0) : 0;
      insertInv.run(b.id, newProdId, stock);
      if (stock > 0) {
        insertMov.run(newProdId, b.id, stock, stock, req.user.id);
      }
    }

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: req.user.branch_id,
      action: 'CREATE_PRODUCT',
      entity: 'PRODUCTS',
      entityId: newProdId,
      details: `Created product "${name}" with code ${generatedCode} (Retail: Rs. ${sale_price})`
    });

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(newProdId);
    res.status(201).json({ message: 'Product created successfully', product });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'A product with this Code or Barcode already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Update product
router.put('/:id', authenticate, requirePermission('manage_products'), (req, res) => {
  const {
    name, name_urdu, code, sku, barcode, category_id, brand,
    purchase_price, sale_price, wholesale_price, min_stock, unit,
    supplier_id, expiry_date, image_url, description, status
  } = req.body;

  const prodId = Number(req.params.id);
  const oldProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
  if (!oldProduct) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Check duplicate barcode
  if (barcode && barcode.trim() !== oldProduct.barcode) {
    const existingBarcode = db.prepare("SELECT id, name, code, barcode FROM products WHERE barcode = ? AND id != ? AND status = 'active'").get(barcode.trim(), prodId);
    if (existingBarcode) {
      return res.status(400).json({
        error: `Barcode '${barcode.trim()}' already belongs to product: '${existingBarcode.name}' (Code: ${existingBarcode.code}). Duplicate barcodes are not allowed.`,
        duplicate: 'barcode',
        existing_product: existingBarcode
      });
    }
  }

  // Check duplicate code
  if (code && code.trim() !== oldProduct.code) {
    const existingCode = db.prepare("SELECT id, name, code FROM products WHERE code = ? AND id != ? AND status = 'active'").get(code.trim(), prodId);
    if (existingCode) {
      return res.status(400).json({
        error: `Product code '${code.trim()}' already belongs to product: '${existingCode.name}'. Duplicate codes are not allowed.`,
        duplicate: 'code',
        existing_product: existingCode
      });
    }
  }

  try {
    db.prepare(`
      UPDATE products
      SET name = COALESCE(?, name),
          name_urdu = COALESCE(?, name_urdu),
          code = COALESCE(?, code),
          sku = COALESCE(?, sku),
          barcode = COALESCE(?, barcode),
          category_id = COALESCE(?, category_id),
          brand = COALESCE(?, brand),
          purchase_price = COALESCE(?, purchase_price),
          sale_price = COALESCE(?, sale_price),
          wholesale_price = COALESCE(?, wholesale_price),
          min_stock = COALESCE(?, min_stock),
          unit = COALESCE(?, unit),
          supplier_id = COALESCE(?, supplier_id),
          expiry_date = COALESCE(?, expiry_date),
          image_url = COALESCE(?, image_url),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      name_urdu || null,
      code ? code.trim() : null,
      sku ? sku.trim() : null,
      barcode ? barcode.trim() : null,
      category_id ? Number(category_id) : null,
      brand,
      purchase_price !== undefined ? Number(purchase_price) : null,
      sale_price !== undefined ? Number(sale_price) : null,
      wholesale_price !== undefined ? Number(wholesale_price) : null,
      min_stock !== undefined ? Number(min_stock) : null,
      unit,
      supplier_id ? Number(supplier_id) : null,
      expiry_date, image_url, description, status,
      prodId
    );

    // Track price changes specifically in audit
    if (sale_price !== undefined && Number(sale_price) !== oldProduct.sale_price) {
      logAudit({
        userId: req.user.id,
        username: req.user.username,
        branchId: req.user.branch_id,
        action: 'PRICE_CHANGE',
        entity: 'PRODUCTS',
        entityId: prodId,
        details: `Changed sale price of "${oldProduct.name}" from Rs. ${oldProduct.sale_price} to Rs. ${sale_price}`
      });
    }

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: req.user.branch_id,
      action: 'UPDATE_PRODUCT',
      entity: 'PRODUCTS',
      entityId: prodId,
      details: `Updated product "${oldProduct.name}"`
    });

    const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
    res.json({ message: 'Product updated successfully', product: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete product (Soft delete to preserve past invoice history)
router.delete('/:id', authenticate, requirePermission('delete_products'), (req, res) => {
  const prodId = Number(req.params.id);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  // Soft delete
  db.prepare("UPDATE products SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(prodId);

  logAudit({
    userId: req.user.id,
    username: req.user.username,
    branchId: req.user.branch_id,
    action: 'DELETE_PRODUCT',
    entity: 'PRODUCTS',
    entityId: prodId,
    details: `Deactivated product "${product.name}" (${product.code})`
  });

  res.json({ message: 'Product deactivated successfully' });
});

export default router;
