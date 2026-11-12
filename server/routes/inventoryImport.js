import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import XLSX from 'xlsx';
import db, { logAudit } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { flushCloudSyncNow, restoreFromCloud, getTursoClient } from '../tursoSync.js';

const router = Router();
const upload = multer({
  dest: path.join(process.cwd(), 'uploads', 'imports'),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Ensure upload directory exists
const importUploadDir = path.join(process.cwd(), 'uploads', 'imports');
if (!fs.existsSync(importUploadDir)) {
  fs.mkdirSync(importUploadDir, { recursive: true });
}

function resolveExcelPath(uploadedFilePath) {
  if (uploadedFilePath && fs.existsSync(uploadedFilePath)) return uploadedFilePath;
  const publicPath = path.join(process.cwd(), 'public', 'items_inventory_3876.xlsx');
  if (fs.existsSync(publicPath)) return publicPath;
  const dataPath = path.join(process.cwd(), 'data', 'items_inventory_3876.xlsx');
  if (fs.existsSync(dataPath)) return dataPath;
  return null;
}

// 1. PREVIEW & DRY-RUN ANALYSIS
router.post('/preview', authenticate, requireRole(['admin', 'manager']), upload.single('file'), (req, res) => {
  try {
    const filePath = resolveExcelPath(req.file?.path);
    if (!filePath) {
      return res.status(400).json({ error: 'Please upload an Excel (.xlsx / .xls) file.' });
    }

    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const excelRows = XLSX.utils.sheet_to_json(sheet);

    const existingProducts = db.prepare('SELECT id, name, code, barcode, sale_price, purchase_price, category_id, unit, brand FROM products').all();
    const dbByBarcode = new Map();
    const dbByCode = new Map();
    for (const p of existingProducts) {
      if (p.barcode && String(p.barcode).trim()) dbByBarcode.set(String(p.barcode).trim(), p);
      if (p.code && String(p.code).trim()) dbByCode.set(String(p.code).trim().toUpperCase(), p);
    }

    const matchedList = [];
    const newList = [];
    const nameUpdates = [];
    const costUpdates = [];
    const priceDiffs = [];
    const missingBarcodes = [];
    const warnings = [];

    for (let i = 0; i < excelRows.length; i++) {
      const row = excelRows[i];
      const name = String(row['Item Name'] || row['Product Name'] || row['Name'] || '').trim();
      if (!name) continue;

      const barcode = row['Barcode'] !== undefined && row['Barcode'] !== null ? String(row['Barcode']).trim() : '';
      const code = row['Code'] !== undefined && row['Code'] !== null ? String(row['Code']).trim() : '';
      const excelSalePrice = Number(row['Sale Price'] || row['Price'] || 0) || 0;
      const excelCost = Number(row['Purchase Price'] || row['Cost'] || 0) || 0;
      const category = String(row['Category'] || 'General Store').trim();
      const unit = String(row['Unit'] || 'pcs').trim();
      const brand = String(row['Brand'] || 'Local').trim();

      if (!barcode) {
        missingBarcodes.push({ row: i + 2, name, code });
      }

      let matched = null;
      if (barcode && dbByBarcode.has(barcode)) matched = dbByBarcode.get(barcode);
      else if (code && dbByCode.has(code.toUpperCase())) matched = dbByCode.get(code.toUpperCase());

      if (matched) {
        matchedList.push({ id: matched.id, name, barcode });
        if (name.toLowerCase() !== matched.name.toLowerCase()) {
          nameUpdates.push({ id: matched.id, barcode, oldName: matched.name, newName: name });
        }
        if (excelCost > 0 && Math.abs(excelCost - matched.purchase_price) > 0.01) {
          costUpdates.push({ id: matched.id, name, barcode, oldCost: matched.purchase_price, newCost: excelCost });
        }
        if (Math.abs(excelSalePrice - matched.sale_price) > 0.01) {
          priceDiffs.push({
            id: matched.id,
            name,
            barcode,
            posPrice: matched.sale_price,
            excelPrice: excelSalePrice,
            diff: Number((excelSalePrice - matched.sale_price).toFixed(2))
          });
        }
      } else {
        newList.push({
          name,
          barcode,
          code,
          sale_price: excelSalePrice,
          purchase_price: excelCost,
          category,
          unit,
          brand
        });
      }
    }

    res.json({
      success: true,
      summary: {
        totalExcel: excelRows.length,
        matchedCount: matchedList.length,
        newCount: newList.length,
        nameUpdatesCount: nameUpdates.length,
        costUpdatesCount: costUpdates.length,
        priceDiffsCount: priceDiffs.length,
        stockPreserved: true,
        missingBarcodesCount: missingBarcodes.length,
        warningsCount: warnings.length
      },
      sampleNameUpdates: nameUpdates.slice(0, 50),
      sampleCostUpdates: costUpdates.slice(0, 50),
      samplePriceDiffs: priceDiffs.slice(0, 50),
      sampleNewProducts: newList.slice(0, 50)
    });

  } catch (err) {
    console.error('Error generating import preview:', err);
    res.status(500).json({ error: err.message || 'Failed to process Excel file' });
  }
});

// 2. EXECUTE ACTUAL IMPORT & UPDATE
router.post('/execute', authenticate, requireRole(['admin']), upload.single('file'), async (req, res) => {
  try {
    const filePath = resolveExcelPath(req.file?.path);
    if (!filePath) {
      return res.status(400).json({ error: 'Excel file not found. Please upload a file.' });
    }

    const now = new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(process.cwd(), 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Safety backup of DB before execution
    const dbFile = path.join(process.cwd(), 'data', 'sawera_pos.sqlite');
    if (fs.existsSync(dbFile)) {
      const backupSqlite = path.join(backupDir, `sawera_pos_backup_pre_import_${dateStr}.sqlite`);
      fs.copyFileSync(dbFile, backupSqlite);
    }

    let genStoreCat = db.prepare("SELECT id FROM categories WHERE name = 'General Store' OR name = 'Genral Stor'").get();
    if (!genStoreCat) {
      const resCat = db.prepare("INSERT INTO categories (name, name_urdu, icon, color, sort_order) VALUES ('General Store', 'جنرل سٹور', 'ShoppingBag', 'blue', 12)").run();
      genStoreCat = { id: Number(resCat.lastInsertRowid) };
    }
    const categoryMap = {
      'SWEETS': 1,
      'BAKERS': 2,
      'Raw Materials': 11,
      'Genral Stor': genStoreCat.id,
      'General Store': genStoreCat.id
    };

    const wb = XLSX.readFile(filePath);
    const excelRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

    const existingProducts = db.prepare('SELECT id, name, code, barcode, sale_price, purchase_price FROM products').all();
    const dbByBarcode = new Map();
    const dbByCode = new Map();
    for (const p of existingProducts) {
      if (p.barcode && String(p.barcode).trim()) dbByBarcode.set(String(p.barcode).trim(), p);
      if (p.code && String(p.code).trim()) dbByCode.set(String(p.code).trim().toUpperCase(), p);
    }

    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN TRANSACTION;');

    let updatedCount = 0;
    let insertedCount = 0;
    let preservedSalePricesCount = 0;

    const branches = db.prepare('SELECT id FROM branches').all();
    const updateProductStmt = db.prepare(`
      UPDATE products
      SET name = ?,
          purchase_price = CASE WHEN ? > 0 THEN ? ELSE purchase_price END,
          unit = COALESCE(?, unit),
          brand = COALESCE(?, brand),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    const insertProductStmt = db.prepare(`
      INSERT INTO products (
        name, name_urdu, code, sku, barcode, category_id, brand,
        purchase_price, sale_price, wholesale_price, min_stock, unit,
        supplier_id, expiry_date, image_url, description, status
      ) VALUES (
        ?, NULL, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        NULL, NULL, 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=200&auto=format&fit=crop&q=60', ?, 'active'
      )
    `);

    const insertBranchInvStmt = db.prepare(`
      INSERT INTO branch_inventory (branch_id, product_id, quantity)
      VALUES (?, ?, 0)
    `);

    const usedBarcodesInImport = new Set();
    for (const p of existingProducts) {
      if (p.barcode) usedBarcodesInImport.add(p.barcode);
    }

    let autoBarcodeCounter = 896400900000;

    for (let i = 0; i < excelRows.length; i++) {
      const row = excelRows[i];
      const excelName = String(row['Item Name'] || '').trim();
      if (!excelName) continue;

      let barcode = row['Barcode'] !== undefined && row['Barcode'] !== null ? String(row['Barcode']).trim() : '';
      let code = row['Code'] !== undefined && row['Code'] !== null ? String(row['Code']).trim() : '';
      const excelSalePrice = Number(row['Sale Price']) || 0;
      const excelPurPrice = Number(row['Purchase Price']) || 0;
      const excelCategory = String(row['Category'] || '').trim();
      const excelUnit = String(row['Unit'] || 'pcs').trim();
      const excelBrand = String(row['Brand'] || 'Local').trim();
      const excelMinStock = Number(row['Minimum Stock']) || 0;
      const excelNotes = String(row['Description / Notes'] || '').trim();

      let matched = null;
      if (barcode && dbByBarcode.has(barcode)) {
        matched = dbByBarcode.get(barcode);
      } else if (code && dbByCode.has(code.toUpperCase())) {
        matched = dbByCode.get(code.toUpperCase());
      }

      if (matched) {
        // Update matched product name, cost, unit, brand.
        // POS sale price and branch inventory quantities remain UNTOUCHED!
        updateProductStmt.run(
          excelName,
          excelPurPrice,
          excelPurPrice,
          excelUnit || null,
          excelBrand || null,
          matched.id
        );
        updatedCount++;
        preservedSalePricesCount++;
      } else {
        if (!barcode || usedBarcodesInImport.has(barcode)) {
          while (usedBarcodesInImport.has(String(autoBarcodeCounter))) {
            autoBarcodeCounter++;
          }
          barcode = String(autoBarcodeCounter);
          autoBarcodeCounter++;
        }
        usedBarcodesInImport.add(barcode);

        if (!code) {
          code = `ITM-${barcode}`;
        }

        const catId = categoryMap[excelCategory] || 10;

        const resProd = insertProductStmt.run(
          excelName,
          code,
          code,
          barcode,
          catId,
          excelBrand || 'Local',
          excelPurPrice,
          excelSalePrice,
          excelSalePrice,
          excelMinStock,
          excelUnit || 'pcs',
          excelNotes || null
        );

        const newId = Number(resProd.lastInsertRowid);
        insertedCount++;

        // Initialize 0 stock across all 4 branches for new items
        for (const b of branches) {
          insertBranchInvStmt.run(b.id, newId);
        }
      }
    }

    db.exec('COMMIT;');
    db.exec('PRAGMA foreign_keys = ON;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: req.user.branch_id || 1,
      action: 'EXCEL_INVENTORY_IMPORT',
      entity: 'PRODUCTS',
      details: `Imported ${excelRows.length} Excel products. Updated: ${updatedCount}, Added: ${insertedCount}.`
    });

    // Flush immediately to Turso Cloud (force = true)
    await flushCloudSyncNow(true);

    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    res.json({
      success: true,
      message: 'Inventory imported successfully! All stock & sales 100% preserved.',
      stats: {
        totalProducts,
        updatedProducts: updatedCount,
        newProducts: insertedCount,
        preservedSalePrices: preservedSalePricesCount
      }
    });

  } catch (err) {
    db.exec('ROLLBACK;');
    db.exec('PRAGMA foreign_keys = ON;');
    console.error('Error executing inventory import:', err);
    res.status(500).json({ error: err.message || 'Failed to execute import' });
  }
});

// 3. FORCE RESTORE / SYNC FROM TURSO CLOUD
router.post('/sync-from-cloud', authenticate, requireRole(['admin']), async (req, res) => {
  try {
    const client = getTursoClient();
    const result = await restoreFromCloud(client);
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const totalSales = db.prepare('SELECT COUNT(*) as count FROM sales').get().count;
    res.json({
      success: true,
      result,
      stats: { totalProducts, totalSales }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. DOWNLOAD REPORT
router.get('/download-report', authenticate, (req, res) => {
  const reportPath = path.join(process.cwd(), 'public', 'sawera_inventory_preview_report.xlsx');
  if (fs.existsSync(reportPath)) {
    res.download(reportPath, 'sawera_inventory_preview_report.xlsx');
  } else {
    res.status(404).json({ error: 'Report file not found. Please run preview first.' });
  }
});

// 5. GET IMPORT AUDIT HISTORY
router.get('/history', authenticate, requireRole(['admin']), (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT * FROM audit_logs
      WHERE action = 'EXCEL_INVENTORY_IMPORT'
      ORDER BY id DESC
      LIMIT 10
    `).all();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
