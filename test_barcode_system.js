// Comprehensive Barcode System Verification Suite for Sawera Sweet & Bakers
// Validates all 12 test points specified in the prompt

const BASE_URL = 'http://localhost:5000';

async function runTests() {
  console.log('====================================================');
  console.log('  SAWERA SWEET & BAKERS - BARCODE VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Authenticate as Admin
  console.log('--- Step 1: Admin Authentication ---');
  let token = '';
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const data = await res.json();
    token = data.token;
    assert(token && data.user.role === 'admin', 'Admin logged in successfully and received JWT token');
  } catch (e) {
    console.error('Login failed:', e);
    return;
  }

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Barcode Generator
  console.log('\n--- Step 2: Unique Barcode Generator (/api/products/utils/generate-barcode) ---');
  let generatedBarcode = '';
  try {
    const res = await fetch(`${BASE_URL}/api/products/utils/generate-barcode`, { headers: authHeaders });
    const data = await res.json();
    generatedBarcode = data.barcode;
    assert(res.ok && generatedBarcode.startsWith('8964') && generatedBarcode.length === 12, `Generated valid Pakistani EAN prefix barcode: ${generatedBarcode}`);
  } catch (e) {
    assert(false, `Generate barcode failed: ${e.message}`);
  }

  // 3. Exact Barcode Lookup
  console.log('\n--- Step 3: Exact Barcode Lookup (/api/products/barcode/:barcode) ---');
  let existingProduct = null;
  try {
    // 896400100101 is Special Gulab Jamun in seed
    const res = await fetch(`${BASE_URL}/api/products/barcode/896400100101?branch_id=1`, { headers: authHeaders });
    const data = await res.json();
    existingProduct = data.product;
    assert(res.ok && data.product && data.product.name.includes('Gulab Jamun'), `Exact barcode lookup found: "${data.product.name}" (Stock: ${data.product.branch_stock})`);
  } catch (e) {
    assert(false, `Exact barcode lookup failed: ${e.message}`);
  }

  // 4. Fallback SKU / Code Barcode Lookup
  console.log('\n--- Step 4: Fallback Code / SKU Lookup ---');
  try {
    // SWT-002 is Rasgulla in seed
    const res = await fetch(`${BASE_URL}/api/products/barcode/SWT-002?branch_id=1`, { headers: authHeaders });
    const data = await res.json();
    assert(res.ok && data.product && data.product.code === 'SWT-002', `Fallback lookup by Code found: "${data.product.name}"`);
  } catch (e) {
    assert(false, `Fallback code lookup failed: ${e.message}`);
  }

  // 5. Unknown Barcode Lookup (404 handling)
  console.log('\n--- Step 5: Unknown Barcode Handling (404) ---');
  try {
    const unknownCode = 'UNKNOWN999888777';
    const res = await fetch(`${BASE_URL}/api/products/barcode/${unknownCode}?branch_id=1`, { headers: authHeaders });
    const data = await res.json();
    assert(res.status === 404 && data.error && data.barcode === unknownCode, `Unknown barcode correctly returned 404 with error payload: "${data.error}"`);
  } catch (e) {
    assert(false, `Unknown barcode test failed: ${e.message}`);
  }

  // 6. Create New Product with Scanned Barcode
  console.log('\n--- Step 6: Create Product with Scanned Barcode ---');
  const testBarcode = `8964${Date.now().toString().slice(-8)}`;
  let testProductId = null;
  try {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Barcode Test Kalakand',
        name_urdu: 'ٹیسٹ کلاکند',
        code: `TST-${Date.now().toString().slice(-4)}`,
        barcode: testBarcode,
        category_id: 1,
        purchase_price: 600,
        sale_price: 900,
        unit: 'Kg',
        initial_stock: 15
      })
    });
    const data = await res.json();
    testProductId = data.product?.id;
    assert(res.status === 201 && testProductId, `Product created with barcode ${testBarcode}, ID: ${testProductId}`);
  } catch (e) {
    assert(false, `Create product failed: ${e.message}`);
  }

  // 7. Duplicate Barcode Rejection on POST
  console.log('\n--- Step 7: Duplicate Barcode Rejection on POST (400) ---');
  try {
    const res = await fetch(`${BASE_URL}/api/products`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Duplicate Barcode Product',
        code: `DUP-${Date.now().toString().slice(-4)}`,
        barcode: testBarcode, // Same barcode as above!
        sale_price: 500,
        purchase_price: 300
      })
    });
    const data = await res.json();
    assert(res.status === 400 && data.duplicate === 'barcode' && data.error.includes('already belongs to product'), `Duplicate barcode correctly blocked: "${data.error}"`);
  } catch (e) {
    assert(false, `Duplicate barcode check failed: ${e.message}`);
  }

  // 8. Duplicate Barcode Rejection on PUT
  console.log('\n--- Step 8: Duplicate Barcode Rejection on PUT (400) ---');
  try {
    // Try to edit an existing product (e.g. ID 2) to use testBarcode
    const res = await fetch(`${BASE_URL}/api/products/2`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        barcode: testBarcode // Conflicting with testProductId
      })
    });
    const data = await res.json();
    assert(res.status === 400 && data.duplicate === 'barcode', `PUT rejected duplicate barcode: "${data.error}"`);
  } catch (e) {
    assert(false, `Duplicate PUT check failed: ${e.message}`);
  }

  // 9. Verify Stock Levels Before POS Sale
  console.log('\n--- Step 9: Verify Stock Levels Before POS Sale ---');
  let stockBefore = 0;
  try {
    const res = await fetch(`${BASE_URL}/api/products/barcode/${testBarcode}?branch_id=1`, { headers: authHeaders });
    const data = await res.json();
    stockBefore = data.product.branch_stock;
    assert(res.ok && stockBefore === 15, `Branch 1 initial stock for "${data.product.name}": ${stockBefore}`);
  } catch (e) {
    assert(false, `Stock check failed: ${e.message}`);
  }

  // 10. POS Sale with Scanned Item (Simulate Scanning Item Twice -> Quantity 2)
  console.log('\n--- Step 10: POS Checkout with Scanned Item (Qty: 2) ---');
  try {
    const salePayload = {
      branch_id: 1,
      items: [
        {
          id: testProductId,
          name: 'Barcode Test Kalakand',
          price: 900,
          quantity: 2,
          discount: 0,
          line_total: 1800
        }
      ],
      subtotal: 1800,
      discount_type: 'fixed',
      discount_value: 0,
      discount_amount: 0,
      tax_percentage: 0,
      tax_amount: 0,
      grand_total: 1800,
      paid_amount: 2000,
      change_amount: 200,
      payment_method: 'cash'
    };

    const res = await fetch(`${BASE_URL}/api/pos/checkout`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(salePayload)
    });
    const data = await res.json();
    assert(res.status === 201 && data.sale && data.sale.invoice_no, `Sale completed! Invoice: ${data.sale.invoice_no} (Paid: Rs. 2000, Change: Rs. 200)`);
  } catch (e) {
    assert(false, `Checkout failed: ${e.message}`);
  }

  // 11. Verify Stock Decrement after POS Sale
  console.log('\n--- Step 11: Verify Stock Decrement after POS Sale ---');
  try {
    const res = await fetch(`${BASE_URL}/api/products/barcode/${testBarcode}?branch_id=1`, { headers: authHeaders });
    const data = await res.json();
    const stockAfter = data.product.branch_stock;
    assert(res.ok && stockAfter === (stockBefore - 2), `Stock decremented accurately from ${stockBefore} to ${stockAfter} (-2)`);
  } catch (e) {
    assert(false, `Post-sale stock check failed: ${e.message}`);
  }

  // 12. Negative Stock Protection Test
  console.log('\n--- Step 12: Negative Stock Protection ---');
  try {
    // Ensure allow_negative_stock is false
    await fetch(`${BASE_URL}/api/settings`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ settings: { allow_negative_stock: 'false' } })
    });

    // Try to sell 100 units when only 13 are left
    const res = await fetch(`${BASE_URL}/api/pos/checkout`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        branch_id: 1,
        items: [{ id: testProductId, name: 'Barcode Test Kalakand', price: 900, quantity: 100, line_total: 90000 }],
        grand_total: 90000,
        paid_amount: 90000,
        payment_method: 'cash'
      })
    });
    const data = await res.json();
    assert(res.status === 400 && data.error.includes('Insufficient stock'), `Sale blocked due to insufficient stock: "${data.error}"`);
  } catch (e) {
    assert(false, `Negative stock test failed: ${e.message}`);
  }

  console.log('\n====================================================');
  console.log(`  VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed === 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
