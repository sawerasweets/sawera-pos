import XLSX from 'xlsx';
import db from '../server/db.js';

function analyzeImport() {
  const filePath = 'd:/antigravity/sawera swees software/data/items_inventory_3876.xlsx';
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelRows = XLSX.utils.sheet_to_json(sheet);

  console.log(`=== DRY-RUN INVENTORY ANALYSIS FOR SAWERA POS ===`);
  console.log(`Total Excel rows: ${excelRows.length}`);

  // Fetch all existing active products from DB
  const existingProducts = db.prepare(`
    SELECT id, name, code, barcode, sale_price, purchase_price, category_id, unit, brand
    FROM products
  `).all();

  console.log(`Total existing DB products: ${existingProducts.length}`);

  // Map existing by barcode and by code
  const dbByBarcode = new Map();
  const dbByCode = new Map();
  for (const p of existingProducts) {
    if (p.barcode && String(p.barcode).trim()) {
      dbByBarcode.set(String(p.barcode).trim(), p);
    }
    if (p.code && String(p.code).trim()) {
      dbByCode.set(String(p.code).trim().toUpperCase(), p);
    }
  }

  // Tracking categories
  const matchedProducts = [];
  const newProducts = [];
  const duplicateExcelBarcodes = [];
  const missingBarcodes = [];
  const nameUpdates = [];
  const purchasePriceUpdates = [];
  const salePriceDiffs = [];
  const zeroOrMissingPurchasePrices = [];
  const conflictingBarcodes = [];

  const seenExcelBarcodes = new Map();

  for (let idx = 0; idx < excelRows.length; idx++) {
    const row = excelRows[idx];
    const excelName = String(row['Item Name'] || '').trim();
    const rawBarcode = row['Barcode'] !== undefined && row['Barcode'] !== null ? String(row['Barcode']).trim() : '';
    const rawCode = row['Code'] !== undefined && row['Code'] !== null ? String(row['Code']).trim() : '';
    const excelSalePrice = Number(row['Sale Price']) || 0;
    const excelPurPrice = Number(row['Purchase Price']) || 0;
    const excelCategory = String(row['Category'] || '').trim();
    const excelUnit = String(row['Unit'] || 'pcs').trim();
    const excelBrand = String(row['Brand'] || '').trim();

    // Check duplicate barcodes in Excel
    if (rawBarcode) {
      if (seenExcelBarcodes.has(rawBarcode)) {
        duplicateExcelBarcodes.push({
          barcode: rawBarcode,
          firstRow: seenExcelBarcodes.get(rawBarcode),
          secondRow: { index: idx + 2, name: excelName }
        });
      } else {
        seenExcelBarcodes.set(rawBarcode, { index: idx + 2, name: excelName });
      }
    } else {
      missingBarcodes.push({ index: idx + 2, name: excelName, code: rawCode });
    }

    if (excelPurPrice <= 0) {
      zeroOrMissingPurchasePrices.push({ name: excelName, barcode: rawBarcode, cost: excelPurPrice });
    }

    // Match with existing DB
    let matchedDb = null;
    if (rawBarcode && dbByBarcode.has(rawBarcode)) {
      matchedDb = dbByBarcode.get(rawBarcode);
    } else if (rawCode && dbByCode.has(rawCode.toUpperCase())) {
      matchedDb = dbByCode.get(rawCode.toUpperCase());
    }

    if (matchedDb) {
      matchedProducts.push({
        excelRow: row,
        dbProduct: matchedDb
      });

      // Name comparison
      if (excelName && excelName.toLowerCase() !== matchedDb.name.toLowerCase()) {
        nameUpdates.push({
          id: matchedDb.id,
          barcode: matchedDb.barcode || rawBarcode,
          oldName: matchedDb.name,
          newName: excelName
        });
      }

      // Purchase price comparison
      if (excelPurPrice > 0 && Math.abs(excelPurPrice - matchedDb.purchase_price) > 0.01) {
        purchasePriceUpdates.push({
          id: matchedDb.id,
          name: excelName,
          barcode: matchedDb.barcode || rawBarcode,
          oldCost: matchedDb.purchase_price,
          newCost: excelPurPrice
        });
      }

      // Sale price comparison (PRESERVED)
      if (Math.abs(excelSalePrice - matchedDb.sale_price) > 0.01) {
        salePriceDiffs.push({
          id: matchedDb.id,
          name: excelName,
          barcode: matchedDb.barcode || rawBarcode,
          posPrice: matchedDb.sale_price,
          excelPrice: excelSalePrice,
          diff: excelSalePrice - matchedDb.sale_price
        });
      }
    } else {
      newProducts.push({
        name: excelName,
        barcode: rawBarcode,
        code: rawCode,
        sale_price: excelSalePrice,
        purchase_price: excelPurPrice,
        category: excelCategory,
        unit: excelUnit,
        brand: excelBrand
      });
    }
  }

  console.log(`\n--- 10-POINT ANALYSIS RESULTS ---`);
  console.log(`1. Total Excel Products: ${excelRows.length}`);
  console.log(`2. Existing Products Matched: ${matchedProducts.length}`);
  console.log(`3. Product Names to be Updated: ${nameUpdates.length}`);
  console.log(`4. Purchase Prices to be Updated: ${purchasePriceUpdates.length}`);
  console.log(`5. Sale Price Differences (POS vs Excel): ${salePriceDiffs.length} items have different rates (POS price will be preserved)`);
  console.log(`6. Existing Stock Quantities: Exactly 0 stock changes (100% Preserved)`);
  console.log(`7. New Products to be Added: ${newProducts.length} (with 0 initial stock across all 4 branches)`);
  console.log(`8. Duplicate Barcodes inside Excel: ${duplicateExcelBarcodes.length}`);
  console.log(`9. Missing Barcodes in Excel: ${missingBarcodes.length}`);
  console.log(`10. Missing / Zero Purchase Prices in Excel: ${zeroOrMissingPurchasePrices.length}`);

  console.log(`\n--- SAMPLE NAME UPDATES (First 5) ---`);
  console.table(nameUpdates.slice(0, 5));

  console.log(`\n--- SAMPLE PURCHASE PRICE UPDATES (First 5) ---`);
  console.table(purchasePriceUpdates.slice(0, 5));

  console.log(`\n--- SAMPLE SALE PRICE COMPARISON (First 5) ---`);
  console.table(salePriceDiffs.slice(0, 5));

  console.log(`\n--- SAMPLE NEW PRODUCTS (First 5) ---`);
  console.table(newProducts.slice(0, 5));
}

analyzeImport();
