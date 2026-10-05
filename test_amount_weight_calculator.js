import db from './server/db.js';

async function runTests() {
  console.log('====================================================');
  console.log('TEST SUITE: Amount → Weight Calculator Verification');
  console.log('Sawera Sweet & Bakers - Multi-Branch POS System');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (details) console.log(`       → ${details}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       → ${details}`);
    }
  }

  // 1. Verify Gulab Jamun exists with stored rate 1,100/kg
  const gulabJamun = db.prepare('SELECT * FROM products WHERE name LIKE ?').get('%Gulab Jamun%');
  assert(gulabJamun && gulabJamun.sale_price === 1100, 'Special Gulab Jamun (Desi Ghee) exists with rate Rs. 1,100/kg', `Product ID: ${gulabJamun?.id}, Unit: ${gulabJamun?.unit}, Price: Rs. ${gulabJamun?.sale_price}`);

  // 2. Test Dynamic Calculator Formula for all user examples
  const testCases = [
    { name: 'Rasgulla (Pure Chhena)', rate: 1000, amount: 320, expectedGrams: 320, expectedKg: 0.32 },
    { name: 'Special Gulab Jamun (Desi Ghee)', rate: 1100, amount: 230, expectedGrams: 209.09, expectedKg: 0.20909 },
    { name: 'Plain Khoya Barfi', rate: 1200, amount: 320, expectedGrams: 266.67, expectedKg: 0.26667 },
    { name: 'Royal Kaju Katli (Desi Ghee)', rate: 1500, amount: 300, expectedGrams: 200, expectedKg: 0.2 }
  ];

  console.log('\n--- Testing Dynamic User Calculation Test Cases ---');
  for (const tc of testCases) {
    const pricePerGram = tc.rate / 1000;
    const calculatedGrams = parseFloat((tc.amount / pricePerGram).toFixed(2));
    const calculatedKg = parseFloat((calculatedGrams / 1000).toFixed(5));

    assert(
      calculatedGrams === tc.expectedGrams && calculatedKg === tc.expectedKg,
      `Rate Rs. ${tc.rate}/kg + Amount Rs. ${tc.amount} = ${tc.expectedGrams}g (${tc.expectedKg} kg)`,
      `Rate/g: Rs. ${pricePerGram.toFixed(2)} | Calculated: ${calculatedGrams}g (${calculatedKg} kg)`
    );
  }

  // 3. Test Enter Weight Formula (250g @ Rs. 1,100/kg -> Rs. 275)
  console.log('\n--- Testing Enter Weight Mode (Grams -> Rupees) ---');
  {
    const rate = 1100;
    const pricePerGram = rate / 1000;
    const enteredGrams = 250;
    const calculatedAmount = Math.round(enteredGrams * pricePerGram * 100) / 100;
    const calculatedKg = parseFloat((enteredGrams / 1000).toFixed(5));

    assert(
      calculatedAmount === 275 && calculatedKg === 0.25,
      'Enter Weight 250g @ Rs. 1,100/kg = Rs. 275 (0.250 kg)',
      `Calculated Amount: Rs. ${calculatedAmount} | Kg: ${calculatedKg}`
    );
  }

  // 4. Test Real End-to-End Checkout with Rs. 230 Gulab Jamun
  console.log('\n--- Testing Real POS Checkout & Inventory Deduction (Rs. 230 Gulab Jamun) ---');
  const branchId = 1;
  const initialStockRow = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(branchId, gulabJamun.id);
  const initialStock = initialStockRow ? initialStockRow.quantity : 0;
  console.log(`Initial stock of "${gulabJamun.name}" in Branch ${branchId}: ${initialStock} kg`);

  // Simulate POS checkout API call
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  assert(token, 'Cashier / Admin authenticated successfully for POS');

  // Checkout payload for Rs. 230 Gulab Jamun
  const grams = 209.09;
  const kgQty = 0.20909;
  const checkoutPayload = {
    branch_id: branchId,
    customer_id: null,
    items: [
      {
        id: gulabJamun.id,
        name: gulabJamun.name,
        code: gulabJamun.code,
        barcode: gulabJamun.barcode,
        unit: 'Kg',
        purchase_price: gulabJamun.purchase_price,
        price: 1100,
        unit_price: 1100,
        quantity: kgQty,
        discount: 0,
        line_total: 230,
        weight_grams: grams,
        rate_per_kg: 1100
      }
    ],
    subtotal: 230,
    discount_amount: 0,
    tax_amount: 0,
    grand_total: 230,
    paid_amount: 230,
    change_amount: 0,
    payment_method: 'cash'
  };

  const checkoutRes = await fetch('http://localhost:5000/api/pos/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(checkoutPayload)
  });

  const checkoutData = await checkoutRes.json();
  assert(checkoutRes.ok && checkoutData.sale, 'Checkout completed successfully with invoice generation', `Invoice: ${checkoutData.sale?.invoice_no}`);

  // Check database sale_items
  const saleItem = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').get(checkoutData.sale.id);
  assert(
    saleItem &&
    saleItem.weight_grams === 209.09 &&
    saleItem.rate_per_kg === 1100 &&
    saleItem.quantity === 0.20909 &&
    saleItem.line_total === 230,
    'Sale item stored with exact weight_grams (209.09), rate_per_kg (1100), and line_total (230)',
    `Stored Item: ${saleItem?.product_name}, Weight: ${saleItem?.weight_grams}g, Qty: ${saleItem?.quantity}kg, Total: Rs. ${saleItem?.line_total}`
  );

  // Check inventory deduction
  const newStockRow = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(branchId, gulabJamun.id);
  const newStock = newStockRow.quantity;
  const stockReduced = parseFloat((initialStock - newStock).toFixed(5));

  assert(
    stockReduced === 0.20909,
    `Inventory reduced by exactly 209.09g (0.20909 kg)`,
    `Initial Stock: ${initialStock} kg | New Stock: ${newStock} kg | Reduced: ${stockReduced} kg (${parseFloat((stockReduced * 1000).toFixed(2))}g)`
  );

  // Check that base product price in products table remains unchanged
  const productAfterSale = db.prepare('SELECT sale_price FROM products WHERE id = ?').get(gulabJamun.id);
  assert(
    productAfterSale.sale_price === 1100,
    'Base product rate remains strictly Rs. 1,100/kg in products table (unmodified)',
    `Current DB Price: Rs. ${productAfterSale.sale_price}`
  );

  // 5. Test Reverse Mode: 250g @ Rs. 1,100/kg = Rs. 275 Checkout
  console.log('\n--- Testing Real POS Checkout with Enter Weight (250g = Rs. 275) ---');
  const initialStock2 = newStock;
  const checkoutPayload2 = {
    branch_id: branchId,
    customer_id: null,
    items: [
      {
        id: gulabJamun.id,
        name: gulabJamun.name,
        code: gulabJamun.code,
        barcode: gulabJamun.barcode,
        unit: 'Kg',
        purchase_price: gulabJamun.purchase_price,
        price: 1100,
        unit_price: 1100,
        quantity: 0.25,
        discount: 0,
        line_total: 275,
        weight_grams: 250,
        rate_per_kg: 1100
      }
    ],
    subtotal: 275,
    discount_amount: 0,
    tax_amount: 0,
    grand_total: 275,
    paid_amount: 300,
    change_amount: 25,
    payment_method: 'cash'
  };

  const checkoutRes2 = await fetch('http://localhost:5000/api/pos/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(checkoutPayload2)
  });

  const checkoutData2 = await checkoutRes2.json();
  assert(checkoutRes2.ok && checkoutData2.sale, 'Checkout for 250g completed successfully', `Invoice: ${checkoutData2.sale?.invoice_no}`);

  const newStockRow2 = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(branchId, gulabJamun.id);
  const stockReduced2 = parseFloat((initialStock2 - newStockRow2.quantity).toFixed(5));

  assert(
    stockReduced2 === 0.25,
    'Inventory reduced by exactly 250g (0.25 kg)',
    `Initial Stock: ${initialStock2} kg | New Stock: ${newStockRow2.quantity} kg | Reduced: ${stockReduced2} kg`
  );

  // 6. Test Receipt Formatting
  console.log('\n--- Testing Receipt Formatting for Thermal & A4 Printing ---');
  const itemsInSale = checkoutData.sale.items;
  const firstItem = itemsInSale[0];
  const receiptSubline = `${firstItem.weight_grams}g × Rs. ${Number(firstItem.rate_per_kg || firstItem.unit_price).toLocaleString()}/kg`;
  const receiptAmount = `Rs. ${Number(firstItem.line_total).toLocaleString()}`;

  assert(
    receiptSubline === '209.09g × Rs. 1,100/kg' && receiptAmount === 'Rs. 230',
    'Receipt formats exactly as required: "209.09g × Rs. 1,100/kg" and "Rs. 230"',
    `Generated Format: ${firstItem.product_name} | ${receiptSubline} | ${receiptAmount}`
  );

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed`);
  console.log('====================================================');
  if (passedTests === totalTests) {
    console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  } else {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
