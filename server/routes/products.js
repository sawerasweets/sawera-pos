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
    min_stock = 0, unit = 'Piece', supplier_id, expiry_date, image_url, description,
    initial_stock = 0
  } = req.body;

  if (!name || !sale_price) {
    return res.status(400).json({ error: 'Product name and sale price are required.' });
  }

  const generatedCode = (code || `PRD-${Date.now().toString().slice(-6)}`).trim();
  const generatedBarcode = (barcode || `8964${Date.now().toString().slice(-8)}`).trim();

  // Validate duplicate barcode among active products
  const existingActiveBarcode = db.prepare("SELECT id, name, code, barcode FROM products WHERE barcode = ? AND status = 'active'").get(generatedBarcode);
  if (existingActiveBarcode) {
    return res.status(400).json({
      error: `Barcode '${generatedBarcode}' already belongs to product: '${existingActiveBarcode.name}' (Code: ${existingActiveBarcode.code}). Duplicate barcodes are not allowed.`,
      duplicate: 'barcode',
      existing_product: existingActiveBarcode
    });
  }

  // Validate duplicate code among active products
  const existingActiveCode = db.prepare("SELECT id, name, code FROM products WHERE code = ? AND status = 'active'").get(generatedCode);
  if (existingActiveCode) {
    return res.status(400).json({
      error: `Product code '${generatedCode}' already belongs to product: '${existingActiveCode.name}'. Duplicate codes are not allowed.`,
      duplicate: 'code',
      existing_product: existingActiveCode
    });
  }

  // Clean or release any inactive product holding this barcode/code so SQLite UNIQUE constraint is satisfied
  try {
    const inactiveBarcodeHolder = db.prepare("SELECT id FROM products WHERE barcode = ? AND status != 'active'").get(generatedBarcode);
    if (inactiveBarcodeHolder) {
      const saleCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?').get(inactiveBarcodeHolder.id)?.count || 0;
      const purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE product_id = ?').get(inactiveBarcodeHolder.id)?.count || 0;
      if (saleCount === 0 && purchaseCount === 0) {
        db.prepare('DELETE FROM branch_inventory WHERE product_id = ?').run(inactiveBarcodeHolder.id);
        db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(inactiveBarcodeHolder.id);
        db.prepare('DELETE FROM products WHERE id = ?').run(inactiveBarcodeHolder.id);
      } else {
        db.prepare("UPDATE products SET barcode = ? WHERE id = ?").run(`${generatedBarcode}_del_${Date.now()}`, inactiveBarcodeHolder.id);
      }
    }

    const inactiveCodeHolder = db.prepare("SELECT id FROM products WHERE code = ? AND status != 'active'").get(generatedCode);
    if (inactiveCodeHolder) {
      const saleCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?').get(inactiveCodeHolder.id)?.count || 0;
      const purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE product_id = ?').get(inactiveCodeHolder.id)?.count || 0;
      if (saleCount === 0 && purchaseCount === 0) {
        db.prepare('DELETE FROM branch_inventory WHERE product_id = ?').run(inactiveCodeHolder.id);
        db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(inactiveCodeHolder.id);
        db.prepare('DELETE FROM products WHERE id = ?').run(inactiveCodeHolder.id);
      } else {
        db.prepare("UPDATE products SET code = ? WHERE id = ?").run(`${generatedCode}_del_${Date.now()}`, inactiveCodeHolder.id);
      }
    }
  } catch (cleanErr) {
    console.warn('[Products] Notice while releasing inactive barcodes:', cleanErr.message);
  }

  let safeCategoryId = null;
  if (category_id && Number(category_id) > 0) {
    const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(category_id));
    if (cat) safeCategoryId = cat.id;
  }

  let safeSupplierId = null;
  if (supplier_id && Number(supplier_id) > 0) {
    const sup = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(Number(supplier_id));
    if (sup) safeSupplierId = sup.id;
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
      safeCategoryId,
      brand || 'Sawera Sweets',
      Number(purchase_price),
      Number(sale_price),
      Number(wholesale_price),
      Number(min_stock),
      unit || 'Piece',
      safeSupplierId,
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

    // Release any inactive product holding this barcode
    try {
      const inactiveHolder = db.prepare("SELECT id FROM products WHERE barcode = ? AND id != ? AND status != 'active'").get(barcode.trim(), prodId);
      if (inactiveHolder) {
        db.prepare("UPDATE products SET barcode = ? WHERE id = ?").run(`${barcode.trim()}_del_${Date.now()}`, inactiveHolder.id);
      }
    } catch (_) {}
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

    // Release any inactive product holding this code
    try {
      const inactiveHolder = db.prepare("SELECT id FROM products WHERE code = ? AND id != ? AND status != 'active'").get(code.trim(), prodId);
      if (inactiveHolder) {
        db.prepare("UPDATE products SET code = ? WHERE id = ?").run(`${code.trim()}_del_${Date.now()}`, inactiveHolder.id);
      }
    } catch (_) {}
  }

  // Validate category_id (safeguard against non-existent category foreign key)
  let safeCategoryId = null;
  if (category_id !== undefined && category_id !== null && category_id !== '' && Number(category_id) > 0) {
    const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(Number(category_id));
    safeCategoryId = cat ? cat.id : null;
  } else if (category_id === undefined && oldProduct.category_id) {
    const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(oldProduct.category_id);
    safeCategoryId = cat ? cat.id : null;
  }

  // Validate supplier_id (safeguard against deleted/non-existent supplier foreign key)
  let safeSupplierId = null;
  if (supplier_id !== undefined && supplier_id !== null && supplier_id !== '' && Number(supplier_id) > 0) {
    const sup = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(Number(supplier_id));
    safeSupplierId = sup ? sup.id : null;
  } else if (supplier_id === undefined && oldProduct.supplier_id) {
    const sup = db.prepare('SELECT id FROM suppliers WHERE id = ?').get(oldProduct.supplier_id);
    safeSupplierId = sup ? sup.id : null;
  }

  try {
    db.prepare(`
      UPDATE products
      SET name = COALESCE(?, name),
          name_urdu = COALESCE(?, name_urdu),
          code = COALESCE(?, code),
          sku = COALESCE(?, sku),
          barcode = COALESCE(?, barcode),
          category_id = ?,
          brand = COALESCE(?, brand),
          purchase_price = COALESCE(?, purchase_price),
          sale_price = COALESCE(?, sale_price),
          wholesale_price = COALESCE(?, wholesale_price),
          min_stock = COALESCE(?, min_stock),
          unit = COALESCE(?, unit),
          supplier_id = ?,
          expiry_date = COALESCE(?, expiry_date),
          image_url = COALESCE(?, image_url),
          description = COALESCE(?, description),
          status = COALESCE(?, status),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name !== undefined && name !== null ? String(name).trim() : null,
      name_urdu !== undefined && name_urdu !== null ? String(name_urdu).trim() : null,
      code !== undefined && code !== null ? String(code).trim() : null,
      sku !== undefined && sku !== null ? String(sku).trim() : null,
      barcode !== undefined && barcode !== null ? String(barcode).trim() : null,
      safeCategoryId,
      brand !== undefined && brand !== null ? String(brand).trim() : null,
      purchase_price !== undefined && purchase_price !== null && purchase_price !== '' ? Number(purchase_price) : null,
      sale_price !== undefined && sale_price !== null && sale_price !== '' ? Number(sale_price) : null,
      wholesale_price !== undefined && wholesale_price !== null && wholesale_price !== '' ? Number(wholesale_price) : null,
      min_stock !== undefined && min_stock !== null && min_stock !== '' ? Number(min_stock) : null,
      unit !== undefined && unit !== null ? String(unit).trim() : null,
      safeSupplierId,
      expiry_date !== undefined && expiry_date !== null && expiry_date !== '' ? expiry_date : null,
      image_url !== undefined && image_url !== null ? image_url : null,
      description !== undefined && description !== null ? description : null,
      status !== undefined && status !== null ? status : null,
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

// Delete product:
// If never sold or purchased, HARD delete so barcode & code are completely freed.
// If sold, soft delete but release barcode & code by appending _del_<timestamp>.
router.delete('/:id', authenticate, requirePermission('delete_products'), (req, res) => {
  const prodId = Number(req.params.id);
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(prodId);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const saleCount = db.prepare('SELECT COUNT(*) as count FROM sale_items WHERE product_id = ?').get(prodId)?.count || 0;
  const purchaseCount = db.prepare('SELECT COUNT(*) as count FROM purchase_items WHERE product_id = ?').get(prodId)?.count || 0;

  if (saleCount === 0 && purchaseCount === 0) {
    // Hard delete: completely removes product & its inventory records
    db.prepare('DELETE FROM branch_inventory WHERE product_id = ?').run(prodId);
    db.prepare('DELETE FROM stock_movements WHERE product_id = ?').run(prodId);
    db.prepare('DELETE FROM products WHERE id = ?').run(prodId);

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: req.user.branch_id,
      action: 'DELETE_PRODUCT',
      entity: 'PRODUCTS',
      entityId: prodId,
      details: `Permanently deleted product "${product.name}" (${product.code}) and freed barcode ${product.barcode || ''}`
    });

    return res.json({ message: 'Product deleted permanently and barcode freed.' });
  } else {
    // Soft delete: keep row for historical receipts, but release barcode & code
    const freedBarcode = product.barcode ? `${product.barcode}_del_${Date.now()}` : null;
    const freedCode = `${product.code}_del_${Date.now()}`;

    db.prepare("UPDATE products SET status = 'inactive', barcode = ?, code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(freedBarcode, freedCode, prodId);

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: req.user.branch_id,
      action: 'DEACTIVATE_PRODUCT',
      entity: 'PRODUCTS',
      entityId: prodId,
      details: `Deactivated product "${product.name}" (${product.code}) and released original barcode`
    });

    return res.json({ message: 'Product deactivated and barcode freed for future use.' });
  }
});

export default router;
