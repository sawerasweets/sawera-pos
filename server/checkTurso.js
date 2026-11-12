import { createClient } from '@libsql/client';

const client = createClient({
  url: 'libsql://sawera-pos-sawerasweets.aws-ap-south-1.turso.io',
  authToken: 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTE1NzUzMDQsImlkIjoiMDFhMTIyMzEtNWUwMS03ODlmLWIzY2MtMTJlOGFmMzFjYzRmIiwia2lkIjoibmUyRlRTU21pOVR1N1FWZ3pFMzhEa3dvU0lueFpDOUxjNzFNWEQ2WFFrbyIsInJpZCI6IjBiYjA5OTQ0LTcxMzgtNDFiOS05NWExLTI4YzhmNWYxOGNmNCJ9.gCDE1pK1xFrgb8ZRZvIlIInPvUhEbk7NuwiMvpmIBrZ6QeTxm_hkU2fF9UnWxmbOTLOP06BWpcc4vu9rM-1WBA'
});

async function check() {
  const res = await client.execute("SELECT table_name, row_count, updated_at FROM sawera_cloud_state WHERE table_name = 'products'");
  console.log('Turso Products table state:', res.rows);
}
check();
