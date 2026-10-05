import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, requirePermission } from '../middleware/auth.js';

const router = Router();

// List all recipes with their ingredients
router.get('/', authenticate, (req, res) => {
  const recipes = db.prepare(`
    SELECT r.*, p.name as finished_product_name, p.name_urdu as finished_product_name_urdu,
           p.code as finished_product_code, p.sale_price as finished_product_sale_price
    FROM recipes r
    JOIN products p ON r.finished_product_id = p.id
    ORDER BY r.name ASC
  `).all();

  const getIngredients = db.prepare(`
    SELECT ri.*, p.name as raw_product_name, p.code as raw_product_code,
           p.purchase_price as raw_cost_price, p.unit as raw_unit
    FROM recipe_ingredients ri
    JOIN products p ON ri.raw_product_id = p.id
    WHERE ri.recipe_id = ?
  `);

  const enriched = recipes.map(r => ({
    ...r,
    ingredients: getIngredients.all(r.id)
  }));

  res.json({ recipes: enriched });
});

// Create recipe
router.post('/', authenticate, requirePermission('manage_inventory'), (req, res) => {
  const { name, name_urdu, finished_product_id, expected_yield, yield_unit, instructions, ingredients } = req.body;

  if (!name || !finished_product_id || !expected_yield || !ingredients || !ingredients.length) {
    return res.status(400).json({ error: 'Recipe name, finished product, yield, and at least one ingredient are required.' });
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    const insertRecipe = db.prepare(`
      INSERT INTO recipes (name, name_urdu, finished_product_id, expected_yield, yield_unit, instructions)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const rResult = insertRecipe.run(
      name.trim(),
      name_urdu || null,
      Number(finished_product_id),
      Number(expected_yield),
      yield_unit || 'Kg',
      instructions || null
    );
    const recipeId = Number(rResult.lastInsertRowid);

    const insertIng = db.prepare(`
      INSERT INTO recipe_ingredients (recipe_id, raw_product_id, quantity, unit)
      VALUES (?, ?, ?, ?)
    `);

    for (const ing of ingredients) {
      if (!ing.raw_product_id || !ing.quantity || Number(ing.quantity) <= 0) continue;
      insertIng.run(recipeId, Number(ing.raw_product_id), Number(ing.quantity), ing.unit || 'Kg');
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId: req.user.branch_id,
      action: 'CREATE_RECIPE',
      entity: 'RECIPES',
      entityId: recipeId,
      details: `Created recipe "${name}" for product ID ${finished_product_id}`
    });

    res.status(201).json({ message: 'Recipe created successfully', recipe_id: recipeId });
  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// Execute Sweet & Bakery Production
router.post('/produce', authenticate, requirePermission('manage_inventory'), (req, res) => {
  const { recipe_id, branch_id, batches_count = 1, notes } = req.body;
  const branchId = Number(branch_id || req.user.branch_id || 1);
  const batches = Math.max(0.1, Number(batches_count));

  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipe_id);
  if (!recipe) {
    return res.status(404).json({ error: 'Recipe not found.' });
  }

  const ingredients = db.prepare(`
    SELECT ri.*, p.name as raw_name, p.purchase_price as raw_cost,
           COALESCE(bi.quantity, 0) as current_branch_stock
    FROM recipe_ingredients ri
    JOIN products p ON ri.raw_product_id = p.id
    LEFT JOIN branch_inventory bi ON bi.product_id = p.id AND bi.branch_id = ?
    WHERE ri.recipe_id = ?
  `).all(branchId, recipe_id);

  if (!ingredients.length) {
    return res.status(400).json({ error: 'This recipe has no ingredients defined.' });
  }

  // 1. Verify all raw materials have sufficient branch inventory
  for (const ing of ingredients) {
    const requiredQty = ing.quantity * batches;
    if (ing.current_branch_stock < requiredQty) {
      return res.status(400).json({
        error: `Insufficient stock for raw material "${ing.raw_name}"! Required: ${requiredQty} ${ing.unit}, Available in branch: ${ing.current_branch_stock} ${ing.unit}.`
      });
    }
  }

  try {
    db.exec('BEGIN TRANSACTION;');

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prodCount = db.prepare(`SELECT COUNT(*) as count FROM productions WHERE production_no LIKE 'PRD-${dateStr}-%'`).get().count + 1;
    const productionNo = `PRD-${dateStr}-${String(prodCount).padStart(4, '0')}`;

    let totalProductionCost = 0;
    const totalYield = recipe.expected_yield * batches;

    // Deduct raw materials & log movements
    const updateRawStock = db.prepare('UPDATE branch_inventory SET quantity = quantity - ? WHERE branch_id = ? AND product_id = ?');
    const insertMovement = db.prepare(`
      INSERT INTO stock_movements (product_id, branch_id, type, quantity, previous_stock, new_stock, reference_id, reason, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const productionItemsData = [];

    for (const ing of ingredients) {
      const usedQty = ing.quantity * batches;
      const lineCost = usedQty * ing.raw_cost;
      totalProductionCost += lineCost;

      updateRawStock.run(usedQty, branchId, ing.raw_product_id);

      insertMovement.run(
        ing.raw_product_id,
        branchId,
        'manual_adjustment',
        -usedQty,
        ing.current_branch_stock,
        ing.current_branch_stock - usedQty,
        productionNo,
        `Raw material consumed for ${recipe.name}`,
        req.user.id
      );

      productionItemsData.push({
        raw_product_id: ing.raw_product_id,
        quantity_used: usedQty,
        unit_cost: ing.raw_cost,
        line_cost: lineCost
      });
    }

    // Add finished product stock
    const currentFinishedStock = db.prepare('SELECT quantity FROM branch_inventory WHERE branch_id = ? AND product_id = ?').get(branchId, recipe.finished_product_id)?.quantity || 0;

    db.prepare(`
      INSERT INTO branch_inventory (branch_id, product_id, quantity, last_restocked)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(branch_id, product_id) DO UPDATE SET quantity = quantity + ?, last_restocked = CURRENT_TIMESTAMP
    `).run(branchId, recipe.finished_product_id, totalYield, totalYield);

    insertMovement.run(
      recipe.finished_product_id,
      branchId,
      'manual_adjustment',
      totalYield,
      currentFinishedStock,
      currentFinishedStock + totalYield,
      productionNo,
      `Finished batch from production ${recipe.name}`,
      req.user.id
    );

    // Record production
    const pResult = db.prepare(`
      INSERT INTO productions (production_no, recipe_id, branch_id, finished_product_id, quantity_produced, total_cost, user_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      productionNo,
      recipe.id,
      branchId,
      recipe.finished_product_id,
      totalYield,
      totalProductionCost,
      req.user.id,
      notes || `Produced ${totalYield} ${recipe.yield_unit} of ${recipe.name}`
    );
    const productionId = Number(pResult.lastInsertRowid);

    const insertProdItem = db.prepare(`
      INSERT INTO production_items (production_id, raw_product_id, quantity_used, unit_cost, line_cost)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const pItem of productionItemsData) {
      insertProdItem.run(productionId, pItem.raw_product_id, pItem.quantity_used, pItem.unit_cost, pItem.line_cost);
    }

    db.exec('COMMIT;');

    logAudit({
      userId: req.user.id,
      username: req.user.username,
      branchId,
      action: 'PRODUCTION_ENTRY',
      entity: 'PRODUCTION',
      entityId: productionId,
      details: `Produced ${totalYield} ${recipe.yield_unit} of "${recipe.name}" (Total Cost: Rs. ${totalProductionCost})`
    });

    res.status(201).json({
      message: 'Production entry recorded successfully! Raw materials deducted and finished stock updated.',
      production: {
        id: productionId,
        production_no: productionNo,
        yield: totalYield,
        unit: recipe.yield_unit,
        total_cost: totalProductionCost
      }
    });

  } catch (err) {
    db.exec('ROLLBACK;');
    res.status(500).json({ error: err.message });
  }
});

// List past productions
router.get('/history', authenticate, (req, res) => {
  const { branch_id, limit = 50 } = req.query;
  let query = `
    SELECT pr.*, r.name as recipe_name, r.yield_unit,
           p.name as finished_product_name, p.code as finished_product_code,
           b.name as branch_name, u.name as user_name
    FROM productions pr
    LEFT JOIN recipes r ON pr.recipe_id = r.id
    JOIN products p ON pr.finished_product_id = p.id
    JOIN branches b ON pr.branch_id = b.id
    JOIN users u ON pr.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (branch_id && branch_id !== 'all') {
    query += ` AND pr.branch_id = ?`;
    params.push(Number(branch_id));
  }

  query += ` ORDER BY pr.created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const productions = db.prepare(query).all(...params);
  res.json({ productions });
});

export default router;
