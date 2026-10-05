import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Sparkles,
  Layers,
  Plus,
  History,
  CheckCircle,
  AlertCircle,
  Clock,
  Search,
  DollarSign,
  ArrowRight,
  TrendingUp,
  PackageCheck
} from 'lucide-react';

export function ProductionPage() {
  const { activeBranchId, branches, user, lang } = useAuth();
  const [activeTab, setActiveTab] = useState('produce'); // 'produce', 'recipes', 'history'
  
  // Data states
  const [recipes, setRecipes] = useState([]);
  const [productions, setProductions] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState(activeBranchId || 1);

  // Produce form state
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [batchMultiplier, setBatchMultiplier] = useState(1);
  const [productionNotes, setProductionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [produceNotification, setProduceNotification] = useState(null);

  // New Recipe modal state
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    name_urdu: '',
    finished_product_id: '',
    yield_quantity: 10,
    yield_unit: 'Kg',
    preparation_time_minutes: 60,
    labor_cost: 300,
    instructions: '',
    ingredients: [
      { raw_product_id: '', quantity: 1, unit: 'Kg' }
    ]
  });

  useEffect(() => {
    setSelectedBranch(activeBranchId);
  }, [activeBranchId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const [recRes, prodHistRes, allProdRes] = await Promise.all([
        fetch('/api/recipes', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/recipes/history?branch_id=${selectedBranch}&limit=50`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/products?branch_id=${selectedBranch}&limit=300`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (recRes.ok) {
        const d = await recRes.json();
        setRecipes(d.recipes || []);
        if (d.recipes?.length > 0 && !selectedRecipeId) {
          setSelectedRecipeId(String(d.recipes[0].id));
        }
      }

      if (prodHistRes.ok) {
        const d = await prodHistRes.json();
        setProductions(d.productions || []);
      }

      if (allProdRes.ok) {
        const d = await allProdRes.json();
        setProducts(d.products || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranch]);

  // Selected recipe details
  const activeRecipe = recipes.find(r => String(r.id) === String(selectedRecipeId));

  // Compute required ingredients for selected multiplier
  const mult = Math.max(0.1, parseFloat(batchMultiplier) || 1);
  const computedIngredients = activeRecipe?.ingredients?.map(ing => {
    const rawProd = products.find(p => p.id === ing.raw_product_id);
    const reqQty = (ing.quantity * mult).toFixed(2);
    const currentStock = rawProd ? rawProd.branch_stock : 0;
    const hasEnough = currentStock >= reqQty;
    return {
      ...ing,
      reqQty: parseFloat(reqQty),
      currentStock,
      hasEnough,
      totalCost: (ing.cost_per_unit || rawProd?.purchase_price || 0) * reqQty
    };
  }) || [];

  const totalRawCost = computedIngredients.reduce((sum, item) => sum + item.totalCost, 0);
  const totalLaborCost = (activeRecipe?.labor_cost || 0) * mult;
  const grandProductionCost = Math.round(totalRawCost + totalLaborCost);
  const expectedYield = activeRecipe ? (activeRecipe.yield_quantity * mult).toFixed(2) : 0;

  // Handle Execute Production
  const handleExecuteProduction = async (e) => {
    e.preventDefault();
    if (!selectedRecipeId) return;

    // Check if any ingredient has insufficient stock
    const missing = computedIngredients.filter(i => !i.hasEnough);
    if (missing.length > 0) {
      const confirmShortage = confirm(
        `Warning: Some raw materials have low branch inventory:\n` +
        missing.map(m => `• ${m.raw_product_name}: Requires ${m.reqQty} ${m.unit}, Stock is ${m.currentStock}`).join('\n') +
        `\nDo you still want to proceed with production? (Stock will go negative if allowed)`
      );
      if (!confirmShortage) return;
    }

    setIsSubmitting(true);
    setProduceNotification(null);

    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/recipes/produce', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipe_id: selectedRecipeId,
          branch_id: selectedBranch,
          multiplier: mult,
          notes: productionNotes
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Production execution failed');

      setProduceNotification({
        type: 'success',
        message: `✓ Batch #${data.production?.production_no} completed! +${data.production?.yield} ${data.production?.unit} added to stock. Total Cost: Rs. ${Number(data.production?.total_cost).toLocaleString()}`
      });

      setProductionNotes('');
      loadData();
    } catch (err) {
      setProduceNotification({
        type: 'error',
        message: err.message
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add / Remove ingredient row in new recipe form
  const addIngredientRow = () => {
    setNewRecipe(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { raw_product_id: '', quantity: 1, unit: 'Kg' }]
    }));
  };

  const removeIngredientRow = (idx) => {
    setNewRecipe(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== idx)
    }));
  };

  const updateIngredientField = (idx, field, value) => {
    setNewRecipe(prev => {
      const updated = [...prev.ingredients];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, ingredients: updated };
    });
  };

  // Save New Recipe
  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/recipes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newRecipe)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save recipe');

      alert('Recipe created successfully!');
      setShowRecipeModal(false);
      loadData();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const rawMaterialsList = products.filter(p => p.product_type === 'raw_material' || p.category_name === 'Raw Materials' || p.category_id === 7);
  const finishedProductsList = products.filter(p => p.product_type !== 'raw_material');

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-100 text-amber-800 rounded-xl">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </span>
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {lang === 'ur' ? 'مٹھائی و بیکری پروڈکشن' : 'Sweet & Bakery Production'}
              </h1>
              <p className="text-xs text-slate-500">
                {lang === 'ur'
                  ? 'خام مال (کھویا، دیسی گھی، چینی) کی خودکار کٹوتی اور تیار مٹھائی کا اسٹاک اندراج'
                  : 'Automatic Recipe deduction of Raw Materials (Khoya, Ghee, Sugar) & Finished Sweet stock crediting'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Branch Selector */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(Number(e.target.value))}
            className="text-xs font-bold py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                📍 {lang === 'ur' && b.name_urdu ? b.name_urdu : b.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowRecipeModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ur' ? 'نئی ترکیب شامل کریں' : 'New Recipe'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-xs font-bold text-slate-500">
        <button
          onClick={() => setActiveTab('produce')}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'produce' ? 'border-amber-600 text-amber-700' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>{lang === 'ur' ? 'بیچ پروڈکشن مکمل کریں' : 'Execute Batch Production'}</span>
        </button>
        <button
          onClick={() => setActiveTab('recipes')}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'recipes' ? 'border-amber-600 text-amber-700' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Formulas &amp; Recipes ({recipes.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-2 flex items-center gap-2 border-b-2 transition cursor-pointer ${
            activeTab === 'history' ? 'border-amber-600 text-amber-700' : 'border-transparent hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Production History ({productions.length})</span>
        </button>
      </div>

      {/* TAB 1: EXECUTE PRODUCTION */}
      {activeTab === 'produce' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Form: Select Recipe & Multiplier */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="font-extrabold text-sm text-slate-800 border-b pb-2">
              Step 1: Select Recipe &amp; Quantity
            </h3>

            {produceNotification && (
              <div className={`p-3 rounded-xl text-xs font-bold flex items-start gap-2 ${
                produceNotification.type === 'error'
                  ? 'bg-rose-50 border border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              }`}>
                {produceNotification.type === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5" /> : <CheckCircle className="w-4 h-4 mt-0.5" />}
                <span>{produceNotification.message}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Select Sweet / Cake Recipe *</label>
              <select
                value={selectedRecipeId}
                onChange={(e) => setSelectedRecipeId(e.target.value)}
                className="w-full text-xs font-bold py-2.5 px-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500"
              >
                {recipes.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} {r.name_urdu ? `(${r.name_urdu})` : ''} - Standard: {r.yield_quantity} {r.yield_unit}
                  </option>
                ))}
              </select>
            </div>

            {activeRecipe && (
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-600">Finished Product:</span>
                  <span className="font-bold text-slate-900">{activeRecipe.finished_product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Sale Price:</span>
                  <span className="font-bold text-amber-700">Rs. {activeRecipe.finished_product_sale_price} / {activeRecipe.yield_unit}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Base Yield:</span>
                  <span className="font-bold">{activeRecipe.yield_quantity} {activeRecipe.yield_unit}</span>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'ur' ? 'بیچ ضرب کار (کتنے گنا بنانا ہے؟)' : 'Batch Multiplier'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={batchMultiplier}
                  onChange={(e) => setBatchMultiplier(e.target.value)}
                  className="w-full text-sm font-black py-2 px-3 border border-slate-300 rounded-xl"
                />
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">x Batches</span>
              </div>
              <div className="flex gap-1.5 mt-2">
                {[0.5, 1, 2, 3, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setBatchMultiplier(v)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      Number(batchMultiplier) === v ? 'bg-amber-600 text-white border-amber-600' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {v}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {lang === 'ur' ? 'پروڈکشن نوٹس (اختیاری)' : 'Production Notes (Optional)'}
              </label>
              <input
                type="text"
                placeholder={lang === 'ur' ? 'آرڈر کی تفصیل یا نوٹس درج کریں...' : 'e.g. Morning fresh sweet preparation for wedding order'}
                value={productionNotes}
                onChange={(e) => setProductionNotes(e.target.value)}
                className="w-full text-xs py-2 px-3 border border-slate-300 rounded-xl"
              />
            </div>

            {/* Expected Yield Output Card */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Output Product to Stock</span>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-2xl font-black text-emerald-800">
                  +{expectedYield} {activeRecipe?.yield_unit || 'Kg'}
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  Est. Cost: Rs. {grandProductionCost.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExecuteProduction}
              disabled={isSubmitting || !activeRecipe}
              className="w-full py-3 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-extrabold text-sm rounded-xl shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <PackageCheck className="w-5 h-5" />
              <span>{isSubmitting ? (lang === 'ur' ? 'اسٹاک کم کر کے پروسیس ہو رہا ہے...' : 'Deducting Raw Stock & Processing...') : (lang === 'ur' ? 'پروڈکشن مکمل کریں' : 'Execute Production')}</span>
            </button>
          </div>

          {/* Right 2 Columns: Recipe Ingredients & Stock Availability Table */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b pb-2 mb-3">
                <h3 className="font-extrabold text-sm text-slate-800">
                  Step 2: Raw Material Deductions Breakdown
                </h3>
                <span className="text-xs text-slate-500 font-semibold">
                  Branch ID #{selectedBranch} Inventory Check
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                      <th className="py-2.5 px-3">{lang === 'ur' ? 'خام مال' : 'Raw Material'}</th>
                      <th className="py-2.5 px-3 text-center">Standard / 1x</th>
                      <th className="py-2.5 px-3 text-center font-black text-amber-700">Required ({mult}x)</th>
                      <th className="py-2.5 px-3 text-center">Current Stock</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                      <th className="py-2.5 px-3 text-right">Cost (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {computedIngredients.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {item.raw_product_name}
                          <span className="block text-[10px] text-slate-400 font-mono">{item.raw_product_code}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-black text-amber-700 text-sm">
                          {item.reqQty} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {item.currentStock} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {item.hasEnough ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              ✓ Available
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                              ⚠ Shortage
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-800">
                          Rs. {Math.round(item.totalCost).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {computedIngredients.length === 0 && (
                      <tr>
                        <td colSpan="6" className="text-center py-10 text-slate-400">
                          No ingredients found for this recipe.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Production Summary Cards */}
            <div className="pt-4 border-t border-slate-200 mt-4 grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500 font-semibold">Raw Material Cost:</span>
                <p className="text-base font-black text-slate-900 mt-0.5">Rs. {Math.round(totalRawCost).toLocaleString()}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="text-slate-500 font-semibold">Labor &amp; Fuel/Overhead:</span>
                <p className="text-base font-black text-slate-900 mt-0.5">Rs. {Math.round(totalLaborCost).toLocaleString()}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs">
                <span className="text-amber-800 font-bold">Total Batch Cost:</span>
                <p className="text-lg font-black text-amber-700 mt-0.5">Rs. {grandProductionCost.toLocaleString()}</p>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: RECIPES CATALOG */}
      {activeTab === 'recipes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between hover:shadow-md transition">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">{r.name}</h3>
                    {r.name_urdu && <p className="font-urdu text-xs text-slate-500">{r.name_urdu}</p>}
                  </div>
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold text-[10px] rounded-full">
                    Yield: {r.yield_quantity} {r.yield_unit}
                  </span>
                </div>

                <div className="my-2 p-2 bg-slate-50 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Finished Sweet:</span>
                    <span className="font-bold text-slate-800">{r.finished_product_name}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Retail Price:</span>
                    <span className="font-bold text-amber-700">Rs. {r.finished_product_sale_price} / {r.yield_unit}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Estimated Cost:</span>
                    <span className="font-bold text-slate-800">Rs. {r.cost_per_batch} / batch</span>
                  </div>
                </div>

                <div className="mt-3">
                  <span className="text-[11px] font-bold text-slate-500 block mb-1">Recipe Ingredients ({r.ingredients?.length}):</span>
                  <div className="space-y-1">
                    {r.ingredients?.map((ing, i) => (
                      <div key={i} className="text-[11px] flex justify-between bg-slate-100/70 px-2 py-1 rounded">
                        <span className="font-medium text-slate-700">{ing.raw_product_name}</span>
                        <span className="font-bold text-slate-900">{ing.quantity} {ing.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[10px] text-slate-400">Prep: {r.preparation_time_minutes} mins</span>
                <button
                  onClick={() => {
                    setSelectedRecipeId(String(r.id));
                    setActiveTab('produce');
                  }}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition"
                >
                  Produce Batch →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: PRODUCTION HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-800">Production Batches Log</h3>
            <span className="text-xs text-slate-500">Showing last {productions.length} batches</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Batch #</th>
                  <th className="py-2.5 px-3">Date &amp; Time</th>
                  <th className="py-2.5 px-3">Branch</th>
                  <th className="py-2.5 px-3">Finished Sweet</th>
                  <th className="py-2.5 px-3 text-center">Batch Mult</th>
                  <th className="py-2.5 px-3 text-center">Stock Added</th>
                  <th className="py-2.5 px-3 text-right">Production Cost</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productions.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{p.batch_no}</td>
                    <td className="py-2.5 px-3 text-slate-600">{new Date(p.created_at).toLocaleString()}</td>
                    <td className="py-2.5 px-3 font-semibold">{p.branch_name}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{p.product_name}</td>
                    <td className="py-2.5 px-3 text-center font-bold text-amber-700">{p.batch_multiplier}x</td>
                    <td className="py-2.5 px-3 text-center font-black text-emerald-700">+{p.yield_quantity} {p.yield_unit}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-800">Rs. {Number(p.total_cost).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-600">{p.user_name}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                        Completed
                      </span>
                    </td>
                  </tr>
                ))}
                {productions.length === 0 && (
                  <tr>
                    <td colSpan="9" className="text-center py-12 text-slate-400">
                      No production batches recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* NEW RECIPE MODAL */}
      {showRecipeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="font-bold text-slate-800 text-base mb-3">Add Sweet / Bakery Recipe Formula</h3>
            
            <form onSubmit={handleSaveRecipe} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Recipe Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={newRecipe.name}
                    onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                    placeholder="e.g. Special Rasgulla 10kg"
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">
                    {lang === 'ur' ? 'ریسیپی کا نام (اردو)' : 'Recipe Name (Urdu)'}
                  </label>
                  <input
                    type="text"
                    value={newRecipe.name_urdu}
                    onChange={(e) => setNewRecipe({ ...newRecipe, name_urdu: e.target.value })}
                    placeholder={lang === 'ur' ? 'رس گلہ اسپیشل' : 'e.g. Special Rasgulla'}
                    className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-urdu text-right"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block font-bold mb-1">Finished Product to Stock *</label>
                  <select
                    required
                    value={newRecipe.finished_product_id}
                    onChange={(e) => setNewRecipe({ ...newRecipe, finished_product_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="">Select Finished Sweet...</option>
                    {finishedProductsList.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold mb-1">Yield Quantity *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={newRecipe.yield_quantity}
                    onChange={(e) => setNewRecipe({ ...newRecipe, yield_quantity: parseFloat(e.target.value) || 1 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
                  />
                </div>
              </div>

              {/* Raw Material Ingredients Builder */}
              <div className="border border-slate-200 p-3 rounded-xl bg-slate-50 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">Raw Material Ingredients</span>
                  <button
                    type="button"
                    onClick={addIngredientRow}
                    className="text-amber-700 font-bold hover:underline"
                  >
                    + Add Ingredient
                  </button>
                </div>

                {newRecipe.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      required
                      value={ing.raw_product_id}
                      onChange={(e) => updateIngredientField(idx, 'raw_product_id', e.target.value)}
                      className="flex-1 px-2 py-1 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="">Select Raw Material (Khoya, Ghee, Sugar...)</option>
                      {rawMaterialsList.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.unit})</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Qty"
                      value={ing.quantity}
                      onChange={(e) => updateIngredientField(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-slate-300 rounded-lg bg-white font-bold"
                    />
                    <select
                      value={ing.unit}
                      onChange={(e) => updateIngredientField(idx, 'unit', e.target.value)}
                      className="w-20 px-1 py-1 border border-slate-300 rounded-lg bg-white"
                    >
                      <option value="Kg">Kg</option>
                      <option value="Gram">Gram</option>
                      <option value="Liter">Liter</option>
                      <option value="Piece">Piece</option>
                    </select>
                    {newRecipe.ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeIngredientRow(idx)}
                        className="text-rose-600 font-bold px-1"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowRecipeModal(false)}
                  className="px-4 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 bg-amber-600 text-white font-bold rounded-lg shadow-sm"
                >
                  Save Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
