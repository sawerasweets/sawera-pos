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
  'price_change_requests'
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
    console.log('[Turso Cloud] Connecting to Turso database:', TURSO_URL);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS sawera_cloud_state (
        table_name TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        row_count INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if cloud has saved tables
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

          // Delete existing local table records
          db.exec(`DELETE FROM ${tableName};`);

          if (records.length > 0) {
            const cols = Object.keys(records[0]);
            const placeholders = cols.map(() => '?').join(', ');
            const stmt = db.prepare(`INSERT OR REPLACE INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`);
            
            for (const item of records) {
              stmt.run(...cols.map(c => item[c]));
            }
          }
          restoredCount++;
        } catch (tableErr) {
          console.error(`[Turso Cloud] Error restoring table ${tableName}:`, tableErr.message);
        }
      }

      db.exec('COMMIT;');
      db.exec('PRAGMA foreign_keys = ON;');
      console.log(`[Turso Cloud] Successfully restored ${restoredCount} tables from Turso Cloud!`);
    } else {
      console.log('[Turso Cloud] Cloud storage is clean/empty. Pushing current base configurations to cloud...');
      await flushCloudSyncNow();
    }

    // Set recurring auto-sync interval (every 60 seconds)
    setInterval(() => {
      triggerCloudSync();
    }, 60 * 1000);

  } catch (err) {
    console.error('[Turso Cloud] Error during initialization:', err.message);
  }
}

/**
 * Debounced push to Turso Cloud (waits 1.5s after any write so batch operations don't spam API)
 */
export function triggerCloudSync() {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => {
    flushCloudSyncNow().catch(err => {
      console.error('[Turso Cloud] Error syncing to cloud:', err.message);
    });
  }, 1500);
}

/**
 * Flush all current SQLite tables to Turso Cloud immediately
 */
export async function flushCloudSyncNow() {
  const client = getTursoClient();
  if (!client || isSyncing) return;

  isSyncing = true;
  try {
    const batchStatements = [];

    for (const table of SYNC_TABLES) {
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
      console.log(`[Turso Cloud] Synced ${batchStatements.length} tables to Cloud at ${new Date().toLocaleTimeString()} (Permanent lifetime storage active)`);
    }
  } catch (err) {
    console.error('[Turso Cloud] Sync flush error:', err.message);
  } finally {
    isSyncing = false;
  }
}
