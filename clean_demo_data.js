import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'data', 'sawera_pos.sqlite');
const db = new DatabaseSync(DB_PATH);

console.log('--- Cleaning Demo Data for Sawera Sweet & Bakers ---');

// Disable foreign keys temporarily for bulk purge
db.exec('PRAGMA foreign_keys = OFF;');

// 1. Reset all inventory quantities to exactly 0.00
db.exec('UPDATE branch_inventory SET quantity = 0, last_restocked = NULL;');
console.log('✓ All branch inventory quantities reset to 0.00');

// 2. Clear stock movements ledger
db.exec('DELETE FROM stock_movements;');
console.log('✓ Stock movements ledger cleared');

// 3. Clear sales & sale items
db.exec('DELETE FROM sales_return_items;');
db.exec('DELETE FROM sales_returns;');
db.exec('DELETE FROM sale_items;');
db.exec('DELETE FROM sales;');
console.log('✓ All sales and return invoices cleared');

// 4. Clear purchases & purchase items
db.exec('DELETE FROM purchase_items;');
db.exec('DELETE FROM purchases;');
db.exec('DELETE FROM purchase_returns;');
console.log('✓ All purchases and supplier bills cleared');

// 5. Clear expenses
db.exec('DELETE FROM expenses;');
console.log('✓ All shop expenses cleared');

// 6. Clear cash register sessions & shifts
db.exec('DELETE FROM cash_registers;');
db.exec('DELETE FROM shifts;');
console.log('✓ Cash drawer and shift sessions cleared');

// 7. Clear waste & damages
db.exec('DELETE FROM waste_logs;');
console.log('✓ Waste & damage logs cleared');

// 8. Clear production run history (keep recipes)
db.exec('DELETE FROM production_items;');
db.exec('DELETE FROM productions;');
console.log('✓ Production run logs cleared (recipes preserved)');

// 9. Clear stock audit count runs
db.exec('DELETE FROM stock_audit_items;');
db.exec('DELETE FROM stock_audits;');
console.log('✓ Stock audits cleared');

// 10. Clear quotations, parked bills, transfers, loyalty, price requests
db.exec('DELETE FROM quotation_items;');
db.exec('DELETE FROM quotations;');
db.exec('DELETE FROM branch_transfer_items;');
db.exec('DELETE FROM branch_transfers;');
db.exec('DELETE FROM parked_bills;');
db.exec('DELETE FROM loyalty_logs;');
db.exec('DELETE FROM price_change_requests;');
db.exec('DELETE FROM customer_payments;');
db.exec('DELETE FROM supplier_payments;');
db.exec('DELETE FROM audit_logs;');
console.log('✓ Quotations, transfers, and audit logs cleared');

// 11. Reset Customers to 1 default Walk-in Customer with 0 balance
db.exec('DELETE FROM customers;');
db.exec(`
  INSERT INTO customers (id, name, phone, email, address, opening_balance, current_balance, credit_limit, status)
  VALUES (1, 'Walk-in Customer (عام گاہک)', '0300-0000000', '', 'Counter Sale', 0, 0, 50000, 'active');
`);
console.log('✓ Customers reset to default Walk-in Customer (0 balance)');

// 12. Reset Suppliers to 0 balance
db.exec('UPDATE suppliers SET opening_balance = 0, current_balance = 0;');
console.log('✓ Supplier balances reset to 0');

// Re-enable foreign keys
db.exec('PRAGMA foreign_keys = ON;');

// Checkpoint SQLite WAL
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');

// Verify counts
const prodCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
const invCount = db.prepare('SELECT COUNT(*) as c, SUM(quantity) as s FROM branch_inventory').get();
const salesCount = db.prepare('SELECT COUNT(*) as c FROM sales').get().c;
const expCount = db.prepare('SELECT COUNT(*) as c FROM expenses').get().c;

console.log('----------------------------------------------------');
console.log(`Summary:`);
console.log(`  Products preserved : ${prodCount}`);
console.log(`  Total Stock Units  : ${invCount.s || 0} across ${invCount.c} branch records`);
console.log(`  Total Sales        : ${salesCount}`);
console.log(`  Total Expenses     : ${expCount}`);
console.log('----------------------------------------------------');
console.log('Demo data successfully cleaned!');

db.close();
