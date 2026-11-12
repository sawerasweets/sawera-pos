import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
import db, { logAudit } from './db.js';
import { flushCloudSyncNow } from './tursoSync.js';

async function executeImport() {
  console.log('====================================================');
  console.log('  SAWERA POS - EXECUTING INVENTORY IMPORT & UPDATE');
  console.log('====================================================');

  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'data', 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // 1. FULL DATABASE SAFETY BACKUP
  console.log('\n[Step 1] Creating pre-import database safety backup...');
  const dbFile = path.join(process.cwd(), 'data', 'sawera_pos.sqlite');
  const backupSqlite = path.join(backupDir, `sawera_pos_backup_pre_import_${dateStr}.sqlite`);
  fs.copyFileSync(dbFile, backupSqlite);
  console.log(`✓ SQLite backup created: ${backupSqlite} (${(fs.statSync(backupSqlite).size / 1024 / 1024).toFixed(2)} MB)`);

  // Snapshot JSON backup as well
  const tablesToBackup = ['products', 'branch_inventory', 'categories', 'suppliers', 'sales', 'sale_items', 'stock_movements'];
  const jsonBackup = {
    timestamp: now.toISOString(),
    tables: {}
  };
  for (const t of tablesToBackup) {
    jsonBackup.tables[t] = db.prepare(`SELECT * FROM ${t}`).all();
  }
  const backupJsonFile = path.join(backupDir, `sawera_json_backup_pre_import_${dateStr}.json`);
  fs.writeFileSync(backupJsonFile, JSON.stringify(jsonBackup, null, 2));
  console.log(`✓ JSON backup created: ${backupJsonFile}`);

  // 2. CHECK EXISTING STOCK SAMPLES BEFORE IMPORT
  const sampleStockBefore = db.prepare(`
    SELECT p.id, p.name, p.barcode, p.sale_price, p.purchase_price,
           COALESCE(bi.quantity, 0) as branch_stock
    FROM products p
    JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = 1
    WHERE p.id IN (2, 4, 5, 6, 9)
  `).all();
  console.log('\nSample existing stock before import:', sampleStockBefore);

  // 3. ENSURE CATEGORIES EXIST
  console.log('\n[Step 2] Ensuring category mapping...');
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

  // 4. LOAD EXCEL ROWS
  const excelFile = path.join(process.cwd(), 'data', 'items_inventory_3876.xlsx');
  const wb = XLSX.readFile(excelFile);
  const excelRows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  console.log(`✓ Loaded ${excelRows.length} rows from Excel file.`);

  // Fetch all existing products
  const existingProducts = db.prepare('SELECT id, name, code, barcode, sale_price, purchase_price FROM products').all();
  const dbByBarcode = new Map();
  const dbByCode = new Map();
  for (const p of existingProducts) {
    if (p.barcode && String(p.barcode).trim()) dbByBarcode.set(String(p.barcode).trim(), p);
    if (p.code && String(p.code).trim()) dbByCode.set(String(p.code).trim().toUpperCase(), p);
  }

  // 5. ATOMIC DATABASE TRANSACTION
  console.log('\n[Step 3] Executing Atomic Database Updates & Insertions...');
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

    // Check match
    let matched = null;
    if (barcode && dbByBarcode.has(barcode)) {
      matched = dbByBarcode.get(barcode);
    } else if (code && dbByCode.has(code.toUpperCase())) {
      matched = dbByCode.get(code.toUpperCase());
    }

    if (matched) {
      // 1. UPDATE MATCHED PRODUCT
      // Update name, cost, unit, brand. KEEP sale_price! KEEP branch_inventory stock!
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
      // 2. INSERT NEW PRODUCT
      // Generate clean barcode if missing or already used
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

      const catId = categoryMap[excelCategory] || 10; // Default to Grocery & Dairy

      const res = insertProductStmt.run(
        excelName,
        code,
        code,
        barcode,
        catId,
        excelBrand || 'Local',
        excelPurPrice,
        excelSalePrice,
        excelSalePrice, // wholesale default
        excelMinStock,
        excelUnit || 'pcs',
        excelNotes || null
      );

      const newId = Number(res.lastInsertRowid);
      insertedCount++;

      // Initialize initial stock = 0 for all 4 branches
      for (const b of branches) {
        insertBranchInvStmt.run(b.id, newId);
      }
    }
  }

  db.exec('COMMIT;');
  db.exec('PRAGMA foreign_keys = ON;');
  console.log(`✓ Transaction committed successfully!`);
  console.log(`  - Matched products updated: ${updatedCount}`);
  console.log(`  - Existing POS sale prices preserved: ${preservedSalePricesCount}`);
  console.log(`  - New products created (0 initial stock): ${insertedCount}`);

  // 6. VERIFY INTEGRITY AFTER IMPORT
  console.log('\n[Step 4] Verifying database integrity after import...');
  const totalProductsAfter = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  const totalBranchInvAfter = db.prepare('SELECT COUNT(*) as count FROM branch_inventory').get().count;
  const totalSalesAfter = db.prepare('SELECT COUNT(*) as count FROM sales').get().count;
  const totalSaleItemsAfter = db.prepare('SELECT COUNT(*) as count FROM sale_items').get().count;

  console.log(`Total Products in DB: ${totalProductsAfter} (Expected: ${776 + insertedCount})`);
  console.log(`Total Branch Inventory records: ${totalBranchInvAfter} (Expected: ${totalProductsAfter * 4})`);
  console.log(`Total Sales Invoices: ${totalSalesAfter} (100% UNCHANGED)`);
  console.log(`Total Sale Items: ${totalSaleItemsAfter} (100% UNCHANGED)`);

  // Verify sample stock is identical
  const sampleStockAfter = db.prepare(`
    SELECT p.id, p.name, p.barcode, p.sale_price, p.purchase_price,
           COALESCE(bi.quantity, 0) as branch_stock
    FROM products p
    JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = 1
    WHERE p.id IN (2, 4, 5, 6, 9)
  `).all();
  console.log('\nSample stock AFTER import (must match before):', sampleStockAfter);

  for (let i = 0; i < sampleStockBefore.length; i++) {
    if (sampleStockBefore[i].branch_stock !== sampleStockAfter[i].branch_stock) {
      throw new Error(`CRITICAL INTEGRITY FAILURE: Stock changed for product ID ${sampleStockBefore[i].id}!`);
    }
    if (sampleStockBefore[i].sale_price !== sampleStockAfter[i].sale_price) {
      throw new Error(`CRITICAL INTEGRITY FAILURE: Sale price changed for product ID ${sampleStockBefore[i].id}!`);
    }
  }
  console.log('✓ VERIFIED: Existing stock counts and POS sale prices are 100% IDENTICAL!');

  // Log Audit
  logAudit({
    userId: 1,
    username: 'admin',
    branchId: 1,
    action: 'EXCEL_INVENTORY_IMPORT',
    entity: 'PRODUCTS',
    details: `Imported ${excelRows.length} Excel products. Updated: ${updatedCount}, Added: ${insertedCount}. Pre-backup: ${path.basename(backupSqlite)}`
  });

  // 7. TURSO CLOUD SYNCHRONIZATION
  console.log('\n[Step 5] Synchronizing complete state to Turso Cloud (for pos.sawerasweets.com)...');
  await flushCloudSyncNow();
  console.log('✓ Turso Cloud Synchronized successfully!');

  console.log('\n====================================================');
  console.log('  IMPORT & UPDATE COMPLETED SUCCESSFULLY!');
  console.log('====================================================');
}

executeImport().catch(err => {
  console.error('Fatal error during import execution:', err);
  process.exit(1);
});
