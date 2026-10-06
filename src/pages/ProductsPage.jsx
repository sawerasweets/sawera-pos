import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarcodeLabelModal } from '../components/BarcodeLabelModal';
import { CameraBarcodeModal } from '../components/CameraBarcodeModal';
import {
  Package,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Barcode,
  Tag,
  AlertTriangle,
  Layers,
  X,
  CheckCircle2,
  Sparkles,
  Camera,
  AlertCircle
} from 'lucide-react';

export function ProductsPage() {
  const { activeBranchId, hasPermission, lang } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Add / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    name_urdu: '',
    code: '',
    sku: '',
    barcode: '',
    category_id: '',
    brand: 'Sawera Sweets',
    purchase_price: 0,
    sale_price: 0,
    wholesale_price: 0,
    min_stock: 5,
    unit: 'Kg',
    supplier_id: '',
    expiry_date: '',
    image_url: '',
    description: '',
    initial_stock: 20
  });

  // Barcode Label Modal
  const [selectedProductForBarcode, setSelectedProductForBarcode] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const [pRes, cRes, sRes] = await Promise.all([
        fetch(`/api/products?branch_id=${activeBranchId}&category_id=${selectedCat !== 'all' ? selectedCat : ''}&search=${search}&low_stock=${lowStockFilter}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/suppliers', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (pRes.ok) {
        const pd = await pRes.json();
        setProducts(pd.products || []);
      }
      if (cRes.ok) {
        const cd = await cRes.json();
        setCategories(cd.categories || []);
      }
      if (sRes.ok) {
        const sd = await sRes.json();
        setSuppliers(sd.suppliers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeBranchId, selectedCat, search, lowStockFilter]);

  // Check URL parameters for pre-filling barcode from POS unknown barcode prompt
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const barcodeParam = params.get('barcode');
    const newParam = params.get('new');
    if (newParam || barcodeParam) {
      openCreateModal(barcodeParam || '');
    }
  }, []);

  const handleGenerateBarcode = async () => {
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/products/utils/generate-barcode', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFormData(prev => ({ ...prev, barcode: String(data.barcode || '') }));
        setFormError('');
      } else {
        setFormData(prev => ({ ...prev, barcode: `8964${Date.now().toString().slice(-8)}` }));
      }
    } catch (err) {
      console.error('Failed to generate barcode', err);
      setFormData(prev => ({ ...prev, barcode: `8964${Date.now().toString().slice(-8)}` }));
    }
  };

  const openCreateModal = (prefillBarcode = '') => {
    setEditId(null);
    setFormError('');
    const barcodeStr = (typeof prefillBarcode === 'string' && prefillBarcode.trim() && !prefillBarcode.includes('[object')) 
      ? prefillBarcode.trim() 
      : '';
    const randCode = `PRD-${Date.now().toString().slice(-5)}`;
    const randBarcode = barcodeStr || `8964${Date.now().toString().slice(-8)}`;
    setFormData({
      name: '',
      name_urdu: '',
      code: randCode,
      sku: randCode,
      barcode: randBarcode,
      category_id: categories[0]?.id || '',
      brand: 'Sawera Sweets',
      purchase_price: 0,
      sale_price: 0,
      wholesale_price: 0,
      min_stock: 5,
      unit: 'Piece',
      supplier_id: suppliers[0]?.id || '',
      expiry_date: '',
      image_url: 'https://images.unsplash.com/photo-1599785209707-a456fc1337bb?w=200&auto=format&fit=crop&q=60',
      description: '',
      initial_stock: 0
    });
    setShowModal(true);
  };

  const openEditModal = (p) => {
    setEditId(p.id);
    setFormError('');
    setFormData({
      name: p.name,
      name_urdu: p.name_urdu || '',
      code: p.code,
      sku: p.sku || '',
      barcode: p.barcode || '',
      category_id: p.category_id || '',
      brand: p.brand || '',
      purchase_price: p.purchase_price,
      sale_price: p.sale_price,
      wholesale_price: p.wholesale_price || 0,
      min_stock: p.min_stock,
      unit: p.unit || 'Piece',
      supplier_id: p.supplier_id || '',
      expiry_date: p.expiry_date || '',
      image_url: p.image_url || '',
      description: p.description || '',
      status: p.status || 'active'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const url = editId ? `/api/products/${editId}` : '/api/products';
      const method = editId ? 'PUT' : 'POST';

      const rawBarcode = typeof formData.barcode === 'string' ? formData.barcode.trim() : '';
      const cleanBarcode = (rawBarcode && !rawBarcode.includes('[object'))
        ? rawBarcode
        : `8964${Date.now().toString().slice(-8)}`;

      const payload = {
        name: String(formData.name || '').trim(),
        name_urdu: String(formData.name_urdu || '').trim(),
        code: String(formData.code || `PRD-${Date.now().toString().slice(-5)}`).trim(),
        sku: String(formData.sku || formData.code || '').trim(),
        barcode: cleanBarcode,
        category_id: formData.category_id ? Number(formData.category_id) : null,
        brand: String(formData.brand || 'Sawera Sweets').trim(),
        purchase_price: parseFloat(formData.purchase_price) || 0,
        sale_price: parseFloat(formData.sale_price) || 0,
        wholesale_price: parseFloat(formData.wholesale_price) || 0,
        min_stock: parseFloat(formData.min_stock) || 5,
        unit: String(formData.unit || 'Piece').trim(),
        supplier_id: formData.supplier_id ? Number(formData.supplier_id) : null,
        expiry_date: formData.expiry_date || null,
        image_url: String(formData.image_url || '').trim(),
        description: String(formData.description || '').trim(),
        initial_stock: parseFloat(formData.initial_stock) || 0
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || 'Failed to save product');
        setIsSubmitting(false);
        return;
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      setFormError(`Error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to deactivate "${name}"?`)) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });
      if (res.ok) {
        loadData();
      }
    } catch (err) {
      alert('Delete failed.');
    }
  };

  return (
    <div className="space-y-5 pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>{lang === 'ur' ? 'پراڈکٹس کیٹلاگ' : 'Products & Sweets Catalog'}</span>
            <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full">
              {products.length} Products
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manage Pakistani sweets, bakery, cosmetics, cold drinks, barcode generation and stock pricing
          </p>
        </div>

        {hasPermission('manage_products') && (
          <button
            onClick={() => openCreateModal('')}
            className="flex items-center space-x-2 rtl:space-x-reverse bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-md transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Product</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, barcode, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

        {/* Category & Low stock filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="text-xs font-semibold py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <button
            onClick={() => setLowStockFilter(!lowStockFilter)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
              lowStockFilter
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-50 text-slate-600 border-slate-300 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Low Stock Alerts</span>
          </button>
        </div>

      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left rtl:text-right">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Product Name</th>
                <th className="py-3 px-3">Code / Barcode</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-center">Unit</th>
                <th className="py-3 px-3 text-right">Cost Price</th>
                <th className="py-3 px-3 text-right">Sale Price</th>
                <th className="py-3 px-3 text-center">Branch Stock</th>
                <th className="py-3 px-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const isLow = p.branch_stock <= p.min_stock;
                const isOut = p.branch_stock <= 0;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      {p.name_urdu && <div className="font-urdu text-[11px] text-slate-500">{p.name_urdu}</div>}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-600">
                      <div>{p.code}</div>
                      <div className="text-[10px] text-slate-400">{p.barcode}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">
                        {p.category_name || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-600 font-medium">
                      {p.unit}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 font-medium">
                      Rs. {Number(p.purchase_price).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-amber-700">
                      Rs. {Number(p.sale_price).toLocaleString()}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        isOut
                          ? 'bg-rose-100 text-rose-700'
                          : isLow
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {p.branch_stock} {p.unit}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center space-x-1 rtl:space-x-reverse">
                        <button
                          onClick={() => setSelectedProductForBarcode(p)}
                          className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                          title="Print Barcode Labels"
                        >
                          <Barcode className="w-4 h-4" />
                        </button>
                        {hasPermission('manage_products') && (
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit Product"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                        {hasPermission('delete_products') && (
                          <button
                            onClick={() => handleDelete(p.id, p.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="Deactivate Product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {products.length === 0 && (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT PRODUCT MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6">
            
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-base flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-400" />
                <span>{editId ? 'Edit Product Details' : 'Create New Product'}</span>
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* English Name */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Product Name (English) *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                    placeholder="e.g. Special Gulab Jamun"
                  />
                </div>

                {/* Urdu Name */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {lang === 'ur' ? 'پراڈکٹ کا نام (اردو)' : 'Product Name (Urdu)'}
                  </label>
                  <input
                    type="text"
                    value={formData.name_urdu}
                    onChange={(e) => setFormData({ ...formData, name_urdu: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-urdu text-right"
                    placeholder={lang === 'ur' ? 'گلاب جامن دیسی گھی' : 'e.g. Special Gulab Jamun'}
                  />
                </div>

                {/* Code */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Product Code / SKU *</label>
                  <input
                    type="text"
                    required
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value, sku: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>

                {/* Barcode */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">Barcode (EAN-13 / Code128)</label>
                    <span className="text-[10px] text-slate-400">Scan, Generate or Type</span>
                  </div>
                  <input
                    type="text"
                    value={typeof formData.barcode === 'string' ? formData.barcode : ''}
                    onChange={(e) => {
                      setFormData({ ...formData, barcode: e.target.value });
                      setFormError('');
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="e.g. 8964..."
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    <button
                      type="button"
                      onClick={() => setShowCameraModal(true)}
                      className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg flex items-center justify-center gap-1.5 text-[11px] border border-slate-300 transition cursor-pointer"
                    >
                      <Camera className="w-3.5 h-3.5 text-amber-600" />
                      <span>Scan Barcode</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateBarcode()}
                      className="flex-1 py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold rounded-lg flex items-center justify-center gap-1.5 text-[11px] border border-amber-200 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      <span>Generate</span>
                    </button>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="">Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Unit */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Unit of Measurement</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="Piece">{lang === 'ur' ? 'عدد' : 'Piece'}</option>
                    <option value="Kg">{lang === 'ur' ? 'کلوگرام' : 'Kg'}</option>
                    <option value="Gram">{lang === 'ur' ? 'گرام' : 'Gram'}</option>
                    <option value="Box">{lang === 'ur' ? 'ڈبہ' : 'Box'}</option>
                    <option value="Pack">{lang === 'ur' ? 'پیکٹ' : 'Pack'}</option>
                    <option value="Bottle">{lang === 'ur' ? 'بوتل' : 'Bottle'}</option>
                    <option value="Liter">{lang === 'ur' ? 'لیٹر' : 'Liter'}</option>
                    <option value="Dozen">{lang === 'ur' ? 'درجن' : 'Dozen'}</option>
                  </select>
                </div>

                {/* Purchase Price */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Purchase / Cost Price (Rs.)</label>
                  <input
                    type="number"
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold"
                  />
                </div>

                {/* Sale Price */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Retail Sale Price (Rs.) *</label>
                  <input
                    type="number"
                    required
                    value={formData.sale_price}
                    onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-amber-700"
                  />
                </div>

                {/* Minimum Stock Alert Level */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Low Stock Alert Level</label>
                  <input
                    type="number"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  />
                </div>

                {/* Supplier */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Preferred Supplier</label>
                  <select
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.company})</option>
                    ))}
                  </select>
                </div>

                {!editId && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Initial Opening Stock in Branch</label>
                    <input
                      type="number"
                      value={formData.initial_stock}
                      onChange={(e) => setFormData({ ...formData, initial_stock: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-emerald-700"
                    />
                  </div>
                )}

              </div>

              {/* Description */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Description / Recipe notes</label>
                <textarea
                  rows="2"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Ingredients, pure cow desi ghee, freshness details..."
                />
              </div>

              {/* Duplicate Barcode or Form Error Display */}
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 font-bold text-xs flex items-center gap-2.5 animate-shake">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
                  <div className="flex-1">{formError}</div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Saving...' : editId ? 'Update Product' : 'Save Product'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* CAMERA BARCODE SCANNER MODAL */}
      <CameraBarcodeModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onScan={(scannedCode) => {
          setFormData(prev => ({ ...prev, barcode: scannedCode }));
          setFormError('');
          setShowCameraModal(false);
        }}
        title="Scan Barcode to Pre-fill Product Form"
        allowContinuous={false}
      />

      {/* BARCODE STICKER LABEL MODAL */}
      {selectedProductForBarcode && (
        <BarcodeLabelModal
          product={selectedProductForBarcode}
          onClose={() => setSelectedProductForBarcode(null)}
        />
      )}

    </div>
  );
}
