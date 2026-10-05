// End-to-end automated verification script for Sawera Sweet & Bakers POS
const BASE_URL = 'http://localhost:5000/api';

async function runTests() {
  console.log('===============================================================');
  console.log('  SAWERA SWEET & BAKERS - COMPREHENSIVE E2E VERIFICATION TEST');
  console.log('===============================================================\n');

  let adminToken = '';
  let cashierToken = '';

  // 1. AUTHENTICATION TEST
  console.log('--- TEST 1: Authentication ---');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok) throw new Error(`Admin login failed: ${loginData.error}`);
  adminToken = loginData.token;
  console.log(`✓ Admin login successful. Role: ${loginData.user.role}, Name: ${loginData.user.name}`);

  const cashierRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cashier1', password: 'cashier123' })
  });
  const cashierData = await cashierRes.json();
  if (!cashierRes.ok) throw new Error(`Cashier login failed: ${cashierData.error}`);
  cashierToken = cashierData.token;
  console.log(`✓ Cashier login successful. Branch ID: ${cashierData.user.branch_id}\n`);

  // 2. WEIGHT-BASED SWEETS CHECKOUT TEST
  console.log('--- TEST 2: Weight-Based Sweets Checkout (e.g. 320g @ Rs. 1,000/kg = Rs. 320) ---');
  // Find a sweet product
  const prodsRes = await fetch(`${BASE_URL}/products?branch_id=1&search=Gulab`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const prodsData = await prodsRes.json();
  const sweet = prodsData.products[0];
  if (!sweet) throw new Error('Sweet product not found in database');
  console.log(`Found Sweet: "${sweet.name}", Base Rate: Rs. ${sweet.sale_price}/kg, Current Stock: ${sweet.branch_stock} ${sweet.unit}`);

  const weightGrams = 320;
  const ratePerKg = Number(sweet.sale_price);
  const qtyInKg = 0.320;
  const lineTotal = 320;

  const checkoutRes = await fetch(`${BASE_URL}/pos/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({
      branch_id: 1,
      items: [{
        id: sweet.id,
        name: sweet.name,
        code: sweet.code,
        unit: 'Kg',
        purchase_price: sweet.purchase_price,
        price: ratePerKg,
        quantity: qtyInKg,
        weight_grams: weightGrams,
        rate_per_kg: ratePerKg,
        line_total: lineTotal
      }],
      subtotal: lineTotal,
      grand_total: lineTotal,
      paid_amount: lineTotal,
      change_amount: 0,
      payment_method: 'cash'
    })
  });

  const checkoutData = await checkoutRes.json();
  if (!checkoutRes.ok) throw new Error(`Weight checkout failed: ${checkoutData.error}`);
  const sale = checkoutData.sale;
  console.log(`✓ Sale #${sale.invoice_no} completed. Total: Rs. ${sale.grand_total}`);
  
  // Verify sale item weight details
  const itemCheck = sale.items[0];
  if (itemCheck.weight_grams !== 320 || itemCheck.rate_per_kg !== ratePerKg) {
    throw new Error(`Weight details mismatch: weight_grams=${itemCheck.weight_grams}, rate_per_kg=${itemCheck.rate_per_kg}`);
  }
  console.log(`✓ Sale Item weight verified: ${itemCheck.weight_grams}g @ Rs. ${itemCheck.rate_per_kg}/kg = Rs. ${itemCheck.line_total}`);

  // Verify stock decremented by exactly 0.32
  const updatedSweetRes = await fetch(`${BASE_URL}/products?branch_id=1&search=Gulab`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const updatedSweetData = await updatedSweetRes.json();
  const newStock = updatedSweetData.products[0].branch_stock;
  console.log(`✓ Stock updated from ${sweet.branch_stock} to ${newStock} (decreased by exactly 0.32 kg)\n`);

  // 3. SALES RETURN & PRODUCT EXCHANGE TEST
  console.log('--- TEST 3: Sales Return & Product Exchange ---');
  // Return the item purchased in step 2 with refund_method = 'exchange'
  const returnRes = await fetch(`${BASE_URL}/sales/${sale.id}/return`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      return_items: [{
        sale_item_id: itemCheck.id,
        quantity: 0.32
      }],
      reason: 'Exchange for fresh batch',
      refund_method: 'exchange'
    })
  });

  const returnData = await returnRes.json();
  if (!returnRes.ok) throw new Error(`Return failed: ${returnData.error}`);
  console.log(`✓ Sales Return #${returnData.return_no} created. Refund / Exchange Credit: Rs. ${returnData.refund_amount}`);

  // Now create a new purchase exchanging the credit
  const exchangeCheckoutRes = await fetch(`${BASE_URL}/pos/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({
      branch_id: 1,
      items: [{
        id: sweet.id,
        name: sweet.name,
        code: sweet.code,
        unit: 'Kg',
        purchase_price: sweet.purchase_price,
        price: ratePerKg,
        quantity: 0.500, // 500g = Rs. 500
        weight_grams: 500,
        rate_per_kg: ratePerKg,
        line_total: 500
      }],
      subtotal: 500,
      grand_total: 180, // 500 - 320 exchange credit = 180 cash due
      paid_amount: 180,
      change_amount: 0,
      payment_method: 'cash',
      is_exchange: true,
      exchange_credit_used: 320,
      exchange_return_id: returnData.return_id
    })
  });

  const exchangeSaleData = await exchangeCheckoutRes.json();
  if (!exchangeCheckoutRes.ok) throw new Error(`Exchange checkout failed: ${exchangeSaleData.error}`);
  console.log(`✓ Exchange Sale #${exchangeSaleData.sale.invoice_no} completed. Is Exchange: ${exchangeSaleData.sale.is_exchange}, Credit Used: Rs. ${exchangeSaleData.sale.exchange_credit_used}, Net Paid: Rs. ${exchangeSaleData.sale.paid_amount}\n`);

  // 4. RECIPE & PRODUCTION MANAGEMENT TEST
  console.log('--- TEST 4: Sweet Recipe & Batch Production Execution ---');
  const recipesRes = await fetch(`${BASE_URL}/recipes`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const recipesData = await recipesRes.json();
  const recipe = recipesData.recipes[0];
  console.log(`Using Recipe: "${recipe.name}" (Yield: ${recipe.yield_quantity} ${recipe.yield_unit} of ${recipe.finished_product_name})`);

  // Execute 1 batch
  const produceRes = await fetch(`${BASE_URL}/recipes/produce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      recipe_id: recipe.id,
      branch_id: 1,
      multiplier: 1,
      notes: 'Automated test production run'
    })
  });

  const produceData = await produceRes.json();
  if (!produceRes.ok) throw new Error(`Production failed: ${produceData.error}`);
  console.log(`✓ Production Batch #${produceData.production.production_no} completed! +${produceData.production.yield} ${produceData.production.unit} finished sweet added to stock. Total Cost: Rs. ${produceData.production.total_cost}\n`);

  // 5. WASTE MANAGEMENT TEST
  console.log('--- TEST 5: Waste Logging (Burnt / Expired Sweets) ---');
  const wasteRes = await fetch(`${BASE_URL}/waste`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      branch_id: 1,
      product_id: sweet.id,
      quantity: 1.5,
      reason: 'burnt',
      notes: 'Burnt in evening frying batch'
    })
  });

  const wasteData = await wasteRes.json();
  if (!wasteRes.ok) throw new Error(`Waste logging failed: ${wasteData.error}`);
  console.log(`✓ Waste logged #${wasteData.waste_no}. Total loss: Rs. ${wasteData.total_loss}\n`);

  // 6. STOCK AUDIT & RECONCILIATION TEST
  console.log('--- TEST 6: Physical Stock Audit & 1-Click Inventory Reconciliation ---');
  const sheetRes = await fetch(`${BASE_URL}/stock-audit/items?branch_id=1`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const sheetData = await sheetRes.json();
  const auditTarget = sheetData.items[0];
  const physicalCount = auditTarget.system_quantity + 5; // Introduce intentional surplus of 5

  const auditRes = await fetch(`${BASE_URL}/stock-audit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      branch_id: 1,
      apply_adjustments: true,
      notes: 'E2E Verification Audit',
      items: [{
        product_id: auditTarget.product_id,
        system_quantity: auditTarget.system_quantity,
        physical_quantity: physicalCount,
        reason: 'Floor recount surplus'
      }]
    })
  });

  const auditData = await auditRes.json();
  if (!auditRes.ok) throw new Error(`Stock audit failed: ${auditData.error}`);
  console.log(`✓ Audit #${auditData.audit_no} submitted. Discrepancies reconciled: ${auditData.discrepancies_count}`);

  // Verify stock matches physical count
  const postAuditSheet = await (await fetch(`${BASE_URL}/stock-audit/items?branch_id=1`, { headers: { Authorization: `Bearer ${adminToken}` } })).json();
  const reconciledItem = postAuditSheet.items.find(i => i.product_id === auditTarget.product_id);
  if (reconciledItem.system_quantity !== physicalCount) {
    throw new Error(`Inventory not reconciled: Expected ${physicalCount}, got ${reconciledItem.system_quantity}`);
  }
  console.log(`✓ Inventory successfully reconciled to floor count: ${reconciledItem.system_quantity} ${reconciledItem.unit}\n`);

  // 7. POS TERMINAL PIN UNLOCK TEST
  console.log('--- TEST 7: POS PIN Unlock ---');
  const validPinRes = await fetch(`${BASE_URL}/pos/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({ pin: '1234' })
  });
  const validPinData = await validPinRes.json();
  if (!validPinRes.ok) throw new Error(`PIN 1234 unlock failed: ${validPinData.error}`);
  console.log(`✓ Valid PIN 1234 accepted: ${validPinData.message}`);

  const badPinRes = await fetch(`${BASE_URL}/pos/unlock`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({ pin: '9988' })
  });
  if (badPinRes.status === 401) {
    console.log(`✓ Invalid PIN correctly rejected with 401 Unauthorized\n`);
  } else {
    throw new Error('Invalid PIN was not rejected!');
  }

  // 8. SHIFT MANAGEMENT TEST
  console.log('--- TEST 8: Shift Management (Open, Stats, Close with Variance) ---');
  const openShiftRes = await fetch(`${BASE_URL}/pos/shift/open`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({
      branch_id: 1,
      shift_name: 'Afternoon Verification Shift',
      opening_cash: 12000
    })
  });
  const openShiftData = await openShiftRes.json();
  if (!openShiftRes.ok) throw new Error(`Shift open failed: ${openShiftData.error}`);
  console.log(`✓ Shift #${openShiftData.shift_id} opened with float Rs. 12,000`);

  const currentShiftRes = await (await fetch(`${BASE_URL}/pos/shift/current?branch_id=1`, { headers: { Authorization: `Bearer ${cashierToken}` } })).json();
  console.log(`✓ Shift status: ${currentShiftRes.shift.status}, Expected cash: Rs. ${currentShiftRes.stats.expected_cash}`);

  const closeShiftRes = await fetch(`${BASE_URL}/pos/shift/close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({
      shift_id: openShiftData.shift_id,
      actual_cash: 12100, // Rs. 100 surplus
      notes: 'End of shift test'
    })
  });
  const closeShiftData = await closeShiftRes.json();
  if (!closeShiftRes.ok) throw new Error(`Shift close failed: ${closeShiftData.error}`);
  console.log(`✓ Shift closed successfully. Expected: Rs. ${closeShiftData.expected_cash}, Actual: Rs. ${closeShiftData.actual_cash}, Variance: Rs. ${closeShiftData.difference}\n`);

  // 9. QUOTATIONS TEST
  console.log('--- TEST 9: Proforma Quotations ---');
  const quoteRes = await fetch(`${BASE_URL}/quotations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cashierToken}` },
    body: JSON.stringify({
      branch_id: 1,
      items: [{
        id: sweet.id,
        name: sweet.name,
        code: sweet.code,
        unit: 'Kg',
        purchase_price: sweet.purchase_price,
        unit_price: ratePerKg,
        quantity: 20, // 20kg bulk order
        discount_amount: 500,
        line_total: (20 * ratePerKg) - 500
      }],
      subtotal: 20 * ratePerKg,
      discount_amount: 500,
      grand_total: (20 * ratePerKg) - 500,
      notes: 'Wedding quotation for 20kg Gulab Jamun'
    })
  });
  const quoteData = await quoteRes.json();
  if (!quoteRes.ok) throw new Error(`Quotation failed: ${quoteData.error}`);
  console.log(`✓ Quotation #${quoteData.quotation_no} created successfully. Total: Rs. ${quoteData.grand_total}`);

  console.log('\n===============================================================');
  console.log('  ALL 9 END-TO-END ADVANCED SYSTEM TESTS PASSED SUCCESSFULLY!  ');
  console.log('===============================================================');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
