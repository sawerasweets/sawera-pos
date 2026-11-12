import db from './db.js';
import { flushCloudSyncNow, getTursoClient } from './tursoSync.js';

async function testFlush() {
  const pCount = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
  console.log('Local products count:', pCount);

  console.log('Testing flush to Turso...');
  await flushCloudSyncNow();
  console.log('Done flush.');

  const client = getTursoClient();
  const res = await client.execute("SELECT table_name, row_count, updated_at FROM sawera_cloud_state WHERE table_name = 'products'");
  console.log('Turso Products table state after flush:', res.rows);
}

testFlush().catch(err => console.error('Error in testFlush:', err));
