import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import XLSX from 'xlsx';
import db, { logAudit } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { flushCloudSyncNow } from '../tursoSync.js';

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

// 1. PREVIEW & DRY-RUN ANALYSIS
router.post('/preview', authenticate, requireRole(['admin', 'manager']), upload.single('file'), (req, res) => {
  try {
    let filePath = req.file?.path;
    if (!filePath) {
      // Default to stored excel if none uploaded in body
      const defaultExcel = path.join(process.cwd(), 'data', 'items_inventory_3876.xlsx');
      if (fs.existsSync(defaultExcel)) {
        filePath = defaultExcel;
      } else {
        return res.status(400).json({ error: 'Please upload an Excel (.xlsx / .xls) file.' });
      }
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

// 2. DOWNLOAD REPORT
router.get('/download-report', authenticate, (req, res) => {
  const reportPath = path.join(process.cwd(), 'public', 'sawera_inventory_preview_report.xlsx');
  if (fs.existsSync(reportPath)) {
    res.download(reportPath, 'sawera_inventory_preview_report.xlsx');
  } else {
    res.status(404).json({ error: 'Report file not found. Please run preview first.' });
  }
});

// 3. GET IMPORT AUDIT HISTORY
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
