import { createClient } from '@libsql/client';
import db from './db.js';

const TURSO_URL = process.env.TURSO_DATABASE_URL || 'libsql://sawera-pos-sawerasweets.aws-ap-south-1.turso.io';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTE1NzUzMDQsImlkIjoiMDFhMTIyMzEtNWUwMS03ODlmLWIzY2MtMTJlOGFmMzFjYzRmIiwia2lkIjoibmUyRlRTU21pOVR1N1FWZ3pFMzhEa3dvU0lueFpDOUxjNzFNWEQ2WFFrbyIsInJpZCI6IjBiYjA5OTQ0LTcxMzgtNDFiOS05NWExLTI4YzhmNWYxOGNmNCJ9.gCDE1pK1xFrgb8ZRZvIlIInPvUhEbk7NuwiMvpmIBrZ6QeTxm_hkU2fF9UnWxmbOTLOP06BWpcc4vu9rM-1WBA';

let tursoClient = null;
let syncTimeout = null;
let isSyncing = false;

const SYNC_TABLES = [
  'settings',
  'branches',
  'users',
  'categories',
  'products',
  'branch_inventory',
  'stock_movements',
  'sales',
  'sale_items',
  'purchases',
  'purchase_items',
  'suppliers',
  'customers',
  'customer_payments',
  'supplier_payments',
  'sales_returns',
  'sales_return_items',
  'purchase_returns',
  'expenses',
  'cash_registers',
  'audit_logs',
  'recipes',
  'recipe_ingredients',
  'productions',
  'production_items',
  'waste_logs',
  'stock_audits',
  'stock_audit_items',
  'quotations',
  'quotation_items',
  'promotions',
  'price_change_requests',
  'khata_accounts',
  'khata_entries'
];

export function getTursoClient() {
  if (!tursoClient && TURSO_URL && TURSO_AUTH_TOKEN) {
    try {
      tursoClient = createClient({
        url: TURSO_URL,
        authToken: TURSO_AUTH_TOKEN
      });
    } catch (err) {
      console.error('[Turso Cloud] Error initializing client:', err.message);
    }
  }
  return tursoClient;
}

/**
 * Restore database tables from Turso Cloud into local SQLite database
 */
export async function restoreFromCloud(client = getTursoClient()) {
  if (!client) return { success: false, error: 'No Turso client' };

  console.log('[Turso Cloud] Connecting to Turso database:', TURSO_URL);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS sawera_cloud_state (
      table_name TEXT PRIMARY KEY,
      data_json TEXT NOT NULL,
      row_count INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const remoteState = await client.execute('SELECT table_name, data_json, row_count, updated_at FROM sawera_cloud_state');
  
  if (remoteState.rows && remoteState.rows.length > 0) {
    console.log(`[Turso Cloud] Found ${remoteState.rows.length} tables in cloud! Restoring state to local POS...`);
    
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec('BEGIN TRANSACTION;');

    let restoredCount = 0;
    for (const row of remoteState.rows) {
      const tableName = String(row.table_name);
      if (!SYNC_TABLES.includes(tableName)) continue;

      try {
        const records = JSON.parse(String(row.data_json));
        if (!Array.isArray(records)) continue;

        if (records.length > 0) {
          db.exec(`DELETE FROM ${tableName};`);
          const cols = Object.keys(records[0]);
          const placeholders = cols.map(() => '?').join(', ');
          const stmt = db.prepare(`INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`);
          
          for (const item of records) {
            stmt.run(...cols.map(c => item[c]));
          }
          restoredCount++;
        } else {
          // If cloud snapshot has 0 records, do NOT wipe local table if local already has rows
          const localCount = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get()?.count || 0;
          if (localCount === 0) {
            db.exec(`DELETE FROM ${tableName};`);
          } else {
            console.log(`[Turso Cloud] Preserving ${localCount} local records in "${tableName}" because cloud snapshot was empty.`);
          }
        }
      } catch (tableErr) {
        console.error(`[Turso Cloud] Error restoring table ${tableName}:`, tableErr.message);
      }
    }

    db.exec('COMMIT;');
    db.exec('PRAGMA foreign_keys = ON;');

    // Safeguard: Clean up any orphaned foreign keys in restored products table
    try {
      db.exec(`
        UPDATE products SET supplier_id = NULL WHERE supplier_id IS NOT NULL AND supplier_id NOT IN (SELECT id FROM suppliers);
        UPDATE products SET category_id = NULL WHERE category_id IS NOT NULL AND category_id NOT IN (SELECT id FROM categories);
      `);
    } catch (cleanErr) {
      console.warn('[Turso Cloud] Foreign key integrity cleanup:', cleanErr.message);
    }

    console.log(`[Turso Cloud] Successfully restored ${restoredCount} tables from Turso Cloud!`);
    return { success: true, restoredCount };
  } else {
    return { success: false, reason: 'Remote storage is empty' };
  }
}

const OPERATIONAL_TABLES = [
  'sales',
  'sale_items',
  'branch_inventory',
  'stock_movements',
  'cash_registers',
  'customers',
  'customer_payments',
  'supplier_payments',
  'expenses',
  'khata_accounts',
  'khata_entries',
  'audit_logs'
];

let pendingDirtyTables = new Set();

function getTablesForRoute(routePath = '') {
  if (!routePath) return null;
  const p = routePath.toLowerCase();

  if (p.startsWith('/api/pos') || p.startsWith('/api/sales')) {
    return ['sales', 'sale_items', 'branch_inventory', 'stock_movements', 'cash_registers', 'customers', 'audit_logs'];
  }
  if (p.startsWith('/api/products')) {
    return ['products', 'branch_inventory', 'audit_logs'];
  }
  if (p.startsWith('/api/inventory-import')) {
    return null; // full sync
  }
  if (p.startsWith('/api/inventory')) {
    return ['branch_inventory', 'stock_movements', 'audit_logs'];
  }
  if (p.startsWith('/api/purchases')) {
    return ['purchases', 'purchase_items', 'branch_inventory', 'stock_movements', 'supplier_payments', 'audit_logs'];
  }
  if (p.startsWith('/api/expenses')) {
    return ['expenses', 'cash_registers', 'audit_logs'];
  }
  if (p.startsWith('/api/customers')) {
    return ['customers', 'customer_payments', 'audit_logs'];
  }
  if (p.startsWith('/api/suppliers')) {
    return ['suppliers', 'supplier_payments', 'audit_logs'];
  }
  if (p.startsWith('/api/khata')) {
    return ['khata_accounts', 'khata_entries', 'audit_logs'];
  }
  if (p.startsWith('/api/cash-register')) {
    return ['cash_registers', 'audit_logs'];
  }
  return null;
}

/**
 * Initialize Cloud Sync on Server Startup:
 * 1. Checks if Turso cloud has saved state.
 * 2. If found, restores tables into local SQLite database.
 * 3. If Turso is empty, pushes current clean local database to Turso.
 */
export async function initTursoSync() {
  const client = getTursoClient();
  if (!client) {
    console.warn('[Turso Cloud] No credentials provided, running with local storage only.');
    return;
  }

  try {
    const res = await restoreFromCloud(client);
    if (!res.success && res.reason === 'Remote storage is empty') {
      console.log('[Turso Cloud] Cloud storage is clean/empty. Pushing current base configurations to cloud...');
      await flushCloudSyncNow(true);
    }

    // Set recurring auto-sync interval for active operations (every 3 minutes, only operational tables)
    setInterval(() => {
      triggerCloudSync(OPERATIONAL_TABLES);
    }, 3 * 60 * 1000);

    // Full catalog sync every 20 minutes (static master tables)
    setInterval(() => {
      flushCloudSyncNow(false).catch(err => {
        console.error('[Turso Cloud] Periodic full sync error:', err.message);
      });
    }, 20 * 60 * 1000);

  } catch (err) {
    console.error('[Turso Cloud] Error during initialization:', err.message);
  }
}

/**
 * Debounced push to Turso Cloud (waits 2s after write, syncs only dirty/affected tables)
 */
export function triggerCloudSync(routeOrTables = null) {
  if (typeof routeOrTables === 'string') {
    const routeTables = getTablesForRoute(routeOrTables);
    if (routeTables) {
      for (const t of routeTables) pendingDirtyTables.add(t);
    } else {
      for (const t of SYNC_TABLES) pendingDirtyTables.add(t);
    }
  } else if (Array.isArray(routeOrTables)) {
    for (const t of routeOrTables) pendingDirtyTables.add(t);
  } else {
    for (const t of OPERATIONAL_TABLES) pendingDirtyTables.add(t);
  }

  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    const tablesToSync = pendingDirtyTables.size > 0 ? Array.from(pendingDirtyTables) : null;
    pendingDirtyTables.clear();
    flushCloudSyncNow(false, tablesToSync).catch(err => {
      console.error('[Turso Cloud] Error syncing to cloud:', err.message);
    });
  }, 2000);
}

/**
 * Flush SQLite tables to Turso Cloud (supports targeted tables for ultra-low latency)
 */
export async function flushCloudSyncNow(force = false, specificTables = null) {
  const client = getTursoClient();
  if (!client || isSyncing) return;

  isSyncing = true;
  try {
    const tablesToProcess = specificTables && Array.isArray(specificTables) && specificTables.length > 0
      ? specificTables.filter(t => SYNC_TABLES.includes(t))
      : SYNC_TABLES;

    // Critical Overwrite Guard (only needed if syncing products master table)
    if (!force && tablesToProcess.includes('products')) {
      try {
        const localProductCount = db.prepare('SELECT COUNT(*) as count FROM products').get()?.count || 0;
        const remoteProdRow = await client.execute("SELECT row_count FROM sawera_cloud_state WHERE table_name = 'products'");
        const remoteProductCount = remoteProdRow.rows?.[0]?.row_count ? Number(remoteProdRow.rows[0].row_count) : 0;
        
        if (remoteProductCount > localProductCount) {
          console.warn(`[Turso Cloud] Remote has ${remoteProductCount} products vs local ${localProductCount}. Overwrite prevented! Auto-pulling richer cloud catalog into local database...`);
          isSyncing = false;
          await restoreFromCloud(client);
          return;
        }
      } catch (checkErr) {
        // Table or row might not exist yet, proceed
      }
    }

    const batchStatements = [];

    for (const table of tablesToProcess) {
      try {
        const rows = db.prepare(`SELECT * FROM ${table}`).all();
        batchStatements.push({
          sql: `
            INSERT OR REPLACE INTO sawera_cloud_state (table_name, data_json, row_count, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          `,
          args: [table, JSON.stringify(rows), rows.length]
        });
      } catch (tableErr) {
        // Table might not exist yet, skip
      }
    }

    if (batchStatements.length > 0) {
      await client.batch(batchStatements);
      console.log(`[Turso Cloud] Synced ${batchStatements.length} tables to Cloud (${tablesToProcess.slice(0, 4).join(', ')}${tablesToProcess.length > 4 ? '...' : ''}) at ${new Date().toLocaleTimeString()}`);
    }
  } catch (err) {
    console.error('[Turso Cloud] Sync flush error:', err.message);
  } finally {
    isSyncing = false;
  }
}
