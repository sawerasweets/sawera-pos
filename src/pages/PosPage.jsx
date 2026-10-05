import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { InvoicePrintModal } from '../components/InvoicePrintModal';
import { CameraBarcodeModal } from '../components/CameraBarcodeModal';
import { playBeep, playErrorBuzz, playSuccessChime } from '../utils/audio';
import {
  Search,
  Barcode,
  Trash2,
  Plus,
  Minus,
  User,
  ShoppingBag,
  CreditCard,
  Printer,
  PauseCircle,
  PlayCircle,
  RotateCcw,
  Sparkles,
  CheckCircle,
  AlertCircle,
  X,
  UserPlus,
  Camera,
  Check,
  AlertTriangle,
  Zap,
  Scale,
  Lock,
  Unlock,
  RefreshCw,
  FileSpreadsheet,
  ShieldCheck,
  Tag,
  Clock
} from 'lucide-react';

export function PosPage() {
  const { activeBranchId, user, t, lang } = useAuth();

  // Catalog & Filter states
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Dedicated Barcode scanner states
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [unknownBarcode, setUnknownBarcode] = useState(null);
  const [showQuickAddProduct, setShowQuickAddProduct] = useState(false);
  const [quickProductData, setQuickProductData] = useState({
    name: '',
    name_urdu: '',
    code: '',
    sku: '',
    barcode: '',
    category_id: '',
    brand: 'Sawera Sweets',
    purchase_price: '',
    sale_price: '',
    wholesale_price: 0,
    min_stock: 5,
    unit: 'Piece',
    initial_stock: 20
  });
  const [scanNotification, setScanNotification] = useState(null);
  const [allowNegativeStock, setAllowNegativeStock] = useState(false);

  // Cart state
  const [cart, setCart] = useState([]);
  const [customer, setCustomer] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [discountType, setDiscountType] = useState('fixed'); // 'fixed' or 'percent'
  const [discountValue, setDiscountValue] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [priceTier, setPriceTier] = useState('retail'); // 'retail', 'wholesale', 'special'

  // Weight-based Sweets Calculator state
  const [showWeightModal, setShowWeightModal] = useState(false);
  const [weightProduct, setWeightProduct] = useState(null);
  const [weightMode, setWeightMode] = useState('amount'); // 'amount' (Rs -> Grams) or 'weight' (Grams -> Rs)
  const [weightAmount, setWeightAmount] = useState('320');
  const [weightGrams, setWeightGrams] = useState('350');

  // Sales Return & Exchange state
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [returnSaleData, setReturnSaleData] = useState(null);
  const [returnQuantities, setReturnQuantities] = useState({});
  const [returnReason, setReturnReason] = useState('Customer Exchange / Return');
  const [isReturnExchange, setIsReturnExchange] = useState(true);
  const [isSearchingReturn, setIsSearchingReturn] = useState(false);
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [exchangeCredit, setExchangeCredit] = useState(0);
  const [exchangeReturnId, setExchangeReturnId] = useState(null);

  // Shift Management state
  const [currentShift, setCurrentShift] = useState(null);
  const [shiftStats, setShiftStats] = useState({ cash_sales: 0, total_sales: 0, sales_count: 0, expected_cash: 0 });
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState(10000);
  const [shiftNameInput, setShiftNameInput] = useState('Morning Shift');
  const [closingActualCash, setClosingActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // POS Terminal Lock with PIN state
  const [isTerminalLocked, setIsTerminalLocked] = useState(false);
  const [lockPinInput, setLockPinInput] = useState('');
  const [lockPinError, setLockPinError] = useState('');

  // Quotation / Draft state
  const [showRecallQuotationModal, setShowRecallQuotationModal] = useState(false);
  const [quotationsList, setQuotationsList] = useState([]);

  // Held Bills state
  const [parkedBills, setParkedBills] = useState([]);
  const [showParkedModal, setShowParkedModal] = useState(false);
  const [parkReference, setParkReference] = useState('');

  // Payment Modal state
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'card', 'bank', 'easypaisa', 'jazzcash', 'split', 'credit'
  const [tenderAmount, setTenderAmount] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitEasypaisa, setSplitEasypaisa] = useState('');
  const [splitCard, setSplitCard] = useState('');
  const [splitBank, setSplitBank] = useState('');
  const [saleNotes, setSaleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Completed sale for printing
  const [completedSale, setCompletedSale] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // New Customer Modal
  const [showNewCustModal, setShowNewCustModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustLimit, setNewCustLimit] = useState(50000);

  const barcodeInputRef = useRef(null);
  const searchInputRef = useRef(null);

  // Auto-dismiss scan notifications
  useEffect(() => {
    if (!scanNotification) return;
    const timer = setTimeout(() => {
      setScanNotification(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [scanNotification]);

  // Fetch products, categories, customers, settings
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const [prodRes, catRes, custRes, parkRes, setRes, shiftRes] = await Promise.all([
        fetch(`/api/products?branch_id=${activeBranchId}&status=active`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/categories', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/customers', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/pos/parked?branch_id=${activeBranchId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`/api/pos/shift/current?branch_id=${activeBranchId}`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (prodRes.ok) {
        const d = await prodRes.json();
        setProducts(d.products || []);
      }
      if (catRes.ok) {
        const d = await catRes.json();
        setCategories(d.categories || []);
      }
      if (custRes.ok) {
        const d = await custRes.json();
        setCustomers(d.customers || []);
      }
      if (parkRes.ok) {
        const d = await parkRes.json();
        setParkedBills(d.parked_bills || []);
      }
      if (setRes.ok) {
        const d = await setRes.json();
        setAllowNegativeStock(d.settings?.allow_negative_stock === 'true');
      }
      if (shiftRes.ok) {
        const d = await shiftRes.json();
        setCurrentShift(d.shift || null);
        setShiftStats(d.stats || { cash_sales: 0, total_sales: 0, sales_count: 0, expected_cash: 0 });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [activeBranchId]);

  // Auto-focus barcode input
  useEffect(() => {
    if (!isTerminalLocked) {
      barcodeInputRef.current?.focus();
    }
  }, [products, isTerminalLocked]);

  // Keyboard Shortcuts handler (F1-F10, ESC)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isTerminalLocked) return;

      if (e.key === 'Escape') {
        if (showPayModal) setShowPayModal(false);
        else if (showParkedModal) setShowParkedModal(false);
        else if (showNewCustModal) setShowNewCustModal(false);
        else if (showPrintModal) setShowPrintModal(false);
        else if (unknownBarcode) setUnknownBarcode(null);
        else if (showQuickAddProduct) setShowQuickAddProduct(false);
        else if (showCameraModal) setShowCameraModal(false);
        else if (showWeightModal) setShowWeightModal(false);
        else if (showReturnModal) setShowReturnModal(false);
        else if (showShiftModal) setShowShiftModal(false);
        else if (showRecallQuotationModal) setShowRecallQuotationModal(false);
        return;
      }

      if (e.key === 'F1') {
        e.preventDefault();
        clearCart();
      } else if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F3') {
        e.preventDefault();
        document.getElementById('customer-select')?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        handleParkCurrentBill();
      } else if (e.key === 'F5') {
        e.preventDefault();
        if (cart.length > 0) openPaymentModal();
      } else if (e.key === 'F6') {
        e.preventDefault();
        setShowCameraModal(prev => !prev);
      } else if (e.key === 'F7') {
        e.preventDefault();
        setShowReturnModal(prev => !prev);
      } else if (e.key === 'F9') {
        e.preventDefault();
        setShowShiftModal(prev => !prev);
      } else if (e.key === 'F10') {
        e.preventDefault();
        setIsTerminalLocked(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, showPayModal, showParkedModal, showNewCustModal, showPrintModal, unknownBarcode, showQuickAddProduct, showCameraModal, showWeightModal, showReturnModal, showShiftModal, showRecallQuotationModal, isTerminalLocked]);

  // Open Weight Calculator Modal for Mithai / Sweets / Bakery items
  const openWeightModal = (product, existingItem = null) => {
    setWeightProduct(product);
    setWeightMode('amount');
    if (existingItem) {
      setWeightAmount(String(existingItem.line_total || existingItem.price));
      setWeightGrams(String(existingItem.weight_grams || 250));
    } else {
      // Default amount Rs. 230 and weight 250g
      setWeightAmount('230');
      setWeightGrams('250');
    }
    setShowWeightModal(true);
  };

  const handleConfirmWeight = () => {
    if (!weightProduct) return;
    const rate = Number(weightProduct.sale_price) || 1000;
    const pricePerGram = rate / 1000; // e.g. Rs. 1,100 / 1,000g = Rs. 1.10 per gram

    let grams = 0;
    let amount = 0;

    if (weightMode === 'amount') {
      const amt = parseFloat(weightAmount) || 0;
      if (amt <= 0) {
        alert('Please enter a valid rupee amount.');
        return;
      }
      // Formula: Weight = Amount / Price per gram
      // e.g. Rs. 230 / Rs. 1.10 = 209.0909...g -> 209.09g
      grams = parseFloat((amt / pricePerGram).toFixed(2));
      amount = amt;
    } else {
      const g = parseFloat(weightGrams) || 0;
      if (g <= 0) {
        alert('Please enter a valid weight in grams.');
        return;
      }
      // Formula: Amount = Weight * Price per gram
      // e.g. 250g * Rs. 1.10 = Rs. 275
      amount = Math.round(g * pricePerGram * 100) / 100;
      grams = g;
    }

    if (grams <= 0 || amount <= 0) {
      alert('Please enter a valid weight or amount.');
      return;
    }

    // Weight in kg for branch inventory deduction: 209.09g = 0.20909 kg
    const kgQty = parseFloat((grams / 1000).toFixed(5));

    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.id === weightProduct.id);
      const newItem = {
        id: weightProduct.id,
        name: weightProduct.name,
        name_urdu: weightProduct.name_urdu,
        code: weightProduct.code,
        barcode: weightProduct.barcode,
        unit: 'Kg',
        purchase_price: weightProduct.purchase_price,
        price: rate,
        unit_price: rate,
        quantity: kgQty,
        discount: 0,
        line_total: amount,
        weight_grams: grams,
        rate_per_kg: rate,
        max_stock: weightProduct.branch_stock
      };

      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = newItem;
        return updated;
      }
      return [...prev, newItem];
    });

    playBeep();
    setShowWeightModal(false);
    setScanNotification({
      type: 'success',
      message: `✓ Added Sweet: ${weightProduct.name} — ${grams}g @ Rs. ${rate}/kg = Rs. ${amount}`
    });
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  // Price Tier Changer (Retail, Wholesale, Special)
  const handlePriceTierChange = (tier) => {
    setPriceTier(tier);
    setCart(prev => prev.map(item => {
      let p = item.price;
      const fullProd = products.find(prod => prod.id === item.id);
      if (fullProd) {
        if (tier === 'wholesale') p = fullProd.wholesale_price || fullProd.sale_price;
        else if (tier === 'special') p = fullProd.special_price || fullProd.sale_price;
        else p = fullProd.sale_price;
      }
      return {
        ...item,
        price: p,
        line_total: Math.max(0, (item.quantity * p) - item.discount)
      };
    }));
  };

  // Open Shift
  const handleOpenShift = async () => {
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/pos/shift/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          branch_id: activeBranchId,
          shift_name: shiftNameInput,
          opening_cash: Number(openingFloat)
        })
      });
      if (res.ok) {
        alert('Shift opened successfully!');
        setShowShiftModal(false);
        loadInitialData();
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Close Shift
  const handleCloseShift = async () => {
    if (!currentShift) return;
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/pos/shift/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shift_id: currentShift.id,
          actual_cash: Number(closingActualCash || 0),
          notes: closingNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Shift Closed Successfully!\nExpected Cash: Rs. ${data.expected_cash}\nActual Cash: Rs. ${data.actual_cash}\nVariance: Rs. ${data.difference}`);
        setShowShiftModal(false);
        setClosingActualCash('');
        loadInitialData();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Unlock POS Terminal PIN
  const handleUnlockPIN = async (pinToTest) => {
    const pin = pinToTest || lockPinInput;
    setLockPinError('');
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/pos/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin })
      });
      if (res.ok) {
        setIsTerminalLocked(false);
        setLockPinInput('');
        setTimeout(() => barcodeInputRef.current?.focus(), 100);
      } else {
        const d = await res.json();
        setLockPinError(d.error || 'Invalid PIN. Try again.');
      }
    } catch (err) {
      setLockPinError(err.message);
    }
  };

  // Search Sales Return Invoice
  const handleSearchReturnInvoice = async (e) => {
    e?.preventDefault();
    if (!returnSearchQuery.trim()) return;
    setIsSearchingReturn(true);
    setReturnSaleData(null);
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch(`/api/sales/${encodeURIComponent(returnSearchQuery.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.sale) {
        setReturnSaleData(data.sale);
        const initialQtys = {};
        (data.sale.items || []).forEach(it => {
          initialQtys[it.id] = 0;
        });
        setReturnQuantities(initialQtys);
      } else {
        alert('Invoice not found! Check invoice number and try again.');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSearchingReturn(false);
    }
  };

  // Process Sales Return or Exchange
  const handleProcessReturnOrExchange = async () => {
    if (!returnSaleData) return;
    const returnItems = Object.entries(returnQuantities)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([sale_item_id, quantity]) => ({
        sale_item_id: Number(sale_item_id),
        quantity: Number(quantity)
      }));

    if (returnItems.length === 0) {
      alert('Please enter return quantity for at least one item.');
      return;
    }

    setIsSubmittingReturn(true);
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch(`/api/sales/${returnSaleData.id}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          return_items: returnItems,
          reason: returnReason,
          refund_method: isReturnExchange ? 'exchange' : 'cash'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Return failed');

      if (isReturnExchange) {
        setExchangeCredit(data.refund_amount);
        setExchangeReturnId(data.return_id);
        playSuccessChime();
        setScanNotification({
          type: 'success',
          message: `✓ Exchange Approved! Rs. ${Number(data.refund_amount).toLocaleString()} credited towards active cart.`
        });
      } else {
        playSuccessChime();
        alert(`Sales return processed! Please refund Rs. ${Number(data.refund_amount).toLocaleString()} in cash to customer.`);
      }

      setShowReturnModal(false);
      setReturnSaleData(null);
      setReturnSearchQuery('');
      loadInitialData();
    } catch (err) {
      alert(`Return error: ${err.message}`);
    } finally {
      setIsSubmittingReturn(false);
    }
  };

  // Save as Quotation
  const handleSaveQuotation = async () => {
    if (cart.length === 0) return;
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          branch_id: activeBranchId,
          customer_id: customer?.id || null,
          items: cart,
          subtotal,
          discount_amount: totalDiscount,
          tax_amount: taxAmount,
          grand_total: grandTotal,
          notes: prompt('Enter quotation reference (e.g. Wedding Event / Corporate Order):', customer?.name || 'Sweet Order') || 'Quotation'
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`✓ Quotation #${data.quotation_no} created successfully! (Valid for 15 days)`);
      }
    } catch (err) {
      alert(`Error saving quotation: ${err.message}`);
    }
  };

  // Recall Quotation into Cart
  const handleOpenRecallQuotation = async () => {
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch(`/api/quotations?branch_id=${activeBranchId}&status=draft`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const d = await res.json();
        setQuotationsList(d.quotations || []);
        setShowRecallQuotationModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLoadQuotationToCart = async (quotation) => {
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch(`/api/quotations/${quotation.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.quotation) {
        const q = data.quotation;
        const loadedItems = (q.items || []).map(item => ({
          id: item.product_id,
          name: item.product_name,
          code: item.product_code,
          unit: item.unit,
          purchase_price: item.purchase_price,
          price: item.unit_price,
          quantity: item.quantity,
          discount: item.discount_amount,
          line_total: item.line_total,
          weight_grams: item.weight_grams,
          rate_per_kg: item.rate_per_kg,
          max_stock: 999
        }));

        setCart(loadedItems);
        if (q.customer_id) {
          const cust = customers.find(c => c.id === q.customer_id);
          setCustomer(cust || { id: q.customer_id, name: q.customer_name, phone: q.customer_phone });
        }
        setShowRecallQuotationModal(false);
        playSuccessChime();
        setScanNotification({
          type: 'success',
          message: `✓ Quotation #${q.quotation_no} loaded into POS cart!`
        });
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Add product to cart (or increment qty)
  const addToCart = (product) => {
    setCart(prev => {
      const existingIdx = prev.findIndex(item => item.id === product.id);
      if (existingIdx > -1) {
        const updated = [...prev];
        const currentQty = updated[existingIdx].quantity;
        const newQty = currentQty + 1;
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: newQty,
          line_total: (newQty * updated[existingIdx].price) - updated[existingIdx].discount
        };
        return updated;
      } else {
        return [...prev, {
          id: product.id,
          name: product.name,
          name_urdu: product.name_urdu,
          code: product.code,
          barcode: product.barcode,
          unit: product.unit,
          purchase_price: product.purchase_price,
          price: product.sale_price,
          quantity: 1,
          discount: 0,
          line_total: product.sale_price,
          max_stock: product.branch_stock
        }];
      }
    });
  };

  // High-Speed Barcode Scanner Lookup (USB barcode scanner or camera)
  const handleBarcodeScan = async (scannedCode) => {
    const code = (typeof scannedCode === 'string' ? scannedCode : barcodeInput).trim();
    if (!code) return;

    setBarcodeInput('');
    setScanNotification(null);

    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch(`/api/products/barcode/${encodeURIComponent(code)}?branch_id=${activeBranchId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        const product = data.product;

        // Auto-open Amount -> Weight Calculator for weight-based sweets
        if (product.unit === 'Kg' || product.unit === 'Gram' || product.category_name?.toLowerCase().includes('sweet')) {
          playBeep();
          const existingInCart = cart.find(item => item.id === product.id);
          openWeightModal(product, existingInCart);
          return;
        }

        // Check current cart quantity
        const existingInCart = cart.find(item => item.id === product.id);
        const currentQty = existingInCart ? existingInCart.quantity : 0;
        const requestedQty = currentQty + 1;

        // Stock validation
        if (product.branch_stock <= 0) {
          if (!allowNegativeStock) {
            playErrorBuzz();
            setScanNotification({
              type: 'error',
              message: `❌ Out of Stock! "${product.name}" has 0 stock in this branch.`
            });
            setTimeout(() => barcodeInputRef.current?.focus(), 60);
            return;
          } else {
            // Negative stock allowed, show warning
            setScanNotification({
              type: 'warning',
              message: `⚠️ Stock Warning: "${product.name}" has 0 stock (Negative stock allowed).`
            });
          }
        } else if (requestedQty > product.branch_stock && !allowNegativeStock) {
          playErrorBuzz();
          setScanNotification({
            type: 'error',
            message: `❌ Stock limit reached! Only ${product.branch_stock} ${product.unit} available for "${product.name}".`
          });
          setTimeout(() => barcodeInputRef.current?.focus(), 60);
          return;
        }

        // Add to cart or increment quantity
        addToCart(product);
        playBeep();

        if (product.branch_stock > 0 || allowNegativeStock) {
          setScanNotification({
            type: 'success',
            message: `✓ Added: ${product.name} — Rs. ${Number(product.sale_price).toLocaleString()} (Cart: ${requestedQty})`
          });
        }

        setTimeout(() => {
          barcodeInputRef.current?.focus();
        }, 50);

      } else if (res.status === 404) {
        // Unknown barcode
        playErrorBuzz();
        setUnknownBarcode(code);
        setScanNotification({
          type: 'error',
          message: `Unknown barcode scanned: ${code}`
        });
      } else {
        const err = await res.json();
        playErrorBuzz();
        setScanNotification({ type: 'error', message: err.error || 'Barcode scan failed' });
      }
    } catch (err) {
      console.error(err);
      playErrorBuzz();
      setScanNotification({ type: 'error', message: `Scan error: ${err.message}` });
    }
  };

  // Open Quick Product Creation Modal for Unknown Barcode
  const handleOpenQuickProductModal = (barcode) => {
    setQuickProductData({
      name: '',
      name_urdu: '',
      code: `PRD-${Date.now().toString().slice(-5)}`,
      sku: `PRD-${Date.now().toString().slice(-5)}`,
      barcode: barcode,
      category_id: categories[0]?.id || '',
      brand: 'Sawera Sweets',
      purchase_price: '',
      sale_price: '',
      wholesale_price: 0,
      min_stock: 5,
      unit: 'Piece',
      initial_stock: 20
    });
    setUnknownBarcode(null);
    setShowQuickAddProduct(true);
  };

  // Save Quick Product & Auto-add to Cart
  const handleSaveQuickProduct = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('sawera_token');
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(quickProductData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create product');

      setShowQuickAddProduct(false);
      // Add newly created product directly to cart
      const newProdWithStock = {
        ...data.product,
        branch_stock: Number(quickProductData.initial_stock)
      };
      addToCart(newProdWithStock);
      playBeep();
      setScanNotification({
        type: 'success',
        message: `✓ Created & added to cart: ${data.product.name} (Barcode: ${data.product.barcode})`
      });
      loadInitialData();
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    } catch (err) {
      alert(`Error saving product: ${err.message}`);
    }
  };

  // Adjust item qty
  const updateQty = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return {
          ...item,
          quantity: newQty,
          line_total: (newQty * item.price) - item.discount
        };
      }
      return item;
    }));
  };

  // Set exact qty
  const setExactQty = (id, val) => {
    const q = Math.max(1, parseFloat(val) || 1);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          quantity: q,
          line_total: (q * item.price) - item.discount
        };
      }
      return item;
    }));
  };

  // Update item discount
  const updateItemDiscount = (id, val) => {
    const disc = Math.max(0, parseFloat(val) || 0);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          discount: disc,
          line_total: Math.max(0, (item.quantity * item.price) - disc)
        };
      }
      return item;
    }));
  };

  // Remove item
  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // Clear cart
  const clearCart = () => {
    if (cart.length > 0 && !confirm('Are you sure you want to clear current bill?')) {
      return;
    }
    setCart([]);
    setCustomer(null);
    setDiscountValue(0);
    setTaxPercent(0);
    setExchangeCredit(0);
    setExchangeReturnId(null);
    setErrorMsg('');
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const itemDiscountsTotal = cart.reduce((sum, item) => sum + item.discount, 0);

  const orderDiscountAmount = discountType === 'percent'
    ? (subtotal * (parseFloat(discountValue) || 0)) / 100
    : (parseFloat(discountValue) || 0);

  const totalDiscount = itemDiscountsTotal + orderDiscountAmount;
  const taxableAmount = Math.max(0, subtotal - totalDiscount);
  const taxAmount = (taxableAmount * (parseFloat(taxPercent) || 0)) / 100;
  // Account for exchange credit
  const grandTotal = Math.max(0, Math.round(taxableAmount + taxAmount - exchangeCredit));

  // Open Payment modal
  const openPaymentModal = () => {
    if (cart.length === 0) return;
    setErrorMsg('');
    setTenderAmount(String(grandTotal));
    setSplitCash(String(Math.round(grandTotal / 2)));
    setSplitEasypaisa(String(Math.round(grandTotal / 2)));
    setShowPayModal(true);
  };

  // Park current bill
  const handleParkCurrentBill = async () => {
    if (cart.length === 0) return;
    const ref = prompt('Enter a reference for this held bill (e.g. Customer Name or Token):', customer?.name || `Bill #${Date.now().toString().slice(-4)}`);
    if (!ref) return;

    try {
      const res = await fetch('/api/pos/park', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          reference: ref,
          branch_id: activeBranchId,
          customer_id: customer?.id || null,
          cart_data: { cart, discountType, discountValue, taxPercent, customer }
        })
      });
      if (res.ok) {
        alert('Bill parked successfully!');
        setCart([]);
        setCustomer(null);
        loadInitialData();
      }
    } catch (err) {
      alert(`Error parking bill: ${err.message}`);
    }
  };

  // Recall parked bill
  const recallBill = async (parked) => {
    try {
      const parsed = typeof parked.cart_data === 'string' ? JSON.parse(parked.cart_data) : parked.cart_data;
      setCart(parsed.cart || []);
      setDiscountType(parsed.discountType || 'fixed');
      setDiscountValue(parsed.discountValue || 0);
      setTaxPercent(parsed.taxPercent || 0);
      setCustomer(parsed.customer || null);

      // Delete from parked table
      await fetch(`/api/pos/parked/${parked.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('sawera_token')}` }
      });

      setShowParkedModal(false);
      loadInitialData();
    } catch (err) {
      alert('Failed to restore bill.');
    }
  };

  // Submit Sale / Checkout
  const handleCheckout = async () => {
    setErrorMsg('');
    setIsSubmitting(true);

    let paidAmount = 0;
    let changeAmount = 0;
    let splitDetails = null;

    if (paymentMethod === 'cash') {
      const tendered = parseFloat(tenderAmount) || grandTotal;
      if (tendered < grandTotal) {
        setErrorMsg(`Tendered amount (Rs. ${tendered}) cannot be less than Grand Total (Rs. ${grandTotal}).`);
        setIsSubmitting(false);
        return;
      }
      paidAmount = tendered;
      changeAmount = tendered - grandTotal;
    } else if (paymentMethod === 'split') {
      const c = parseFloat(splitCash) || 0;
      const e = parseFloat(splitEasypaisa) || 0;
      const cd = parseFloat(splitCard) || 0;
      const b = parseFloat(splitBank) || 0;
      const splitSum = c + e + cd + b;
      if (splitSum < grandTotal) {
        setErrorMsg(`Split payments sum (Rs. ${splitSum}) is less than Grand Total (Rs. ${grandTotal}).`);
        setIsSubmitting(false);
        return;
      }
      paidAmount = splitSum;
      changeAmount = splitSum - grandTotal;
      splitDetails = { cash: c, easypaisa: e, card: cd, bank: b };
    } else if (paymentMethod === 'credit') {
      if (!customer) {
        setErrorMsg('Please select a customer for Credit / Udhaar sale.');
        setIsSubmitting(false);
        return;
      }
      paidAmount = 0;
      changeAmount = 0;
    } else {
      paidAmount = grandTotal;
      changeAmount = 0;
    }

    try {
      const res = await fetch('/api/pos/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          branch_id: activeBranchId,
          customer_id: customer?.id || null,
          items: cart,
          subtotal,
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: totalDiscount,
          tax_percentage: taxPercent,
          tax_amount: taxAmount,
          grand_total: grandTotal,
          paid_amount: paidAmount,
          change_amount: changeAmount,
          payment_method: paymentMethod,
          split_details: splitDetails,
          notes: saleNotes,
          is_exchange: exchangeCredit > 0,
          exchange_credit_used: exchangeCredit,
          exchange_return_id: exchangeReturnId,
          price_level: priceTier
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Checkout failed');
      }

      // Success
      playSuccessChime();
      setShowPayModal(false);
      setCompletedSale(data.sale);
      setShowPrintModal(true);

      // Reset cart & exchange credit
      setCart([]);
      setCustomer(null);
      setDiscountValue(0);
      setTaxPercent(0);
      setExchangeCredit(0);
      setExchangeReturnId(null);
      setSaleNotes('');

      // Refresh product stock
      loadInitialData();

    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Create Quick Customer
  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustName) return;
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('sawera_token')}`
        },
        body: JSON.stringify({
          name: newCustName,
          phone: newCustPhone,
          credit_limit: newCustLimit
        })
      });
      const data = await res.json();
      if (res.ok) {
        setCustomers(prev => [...prev, data.customer]);
        setCustomer(data.customer);
        setShowNewCustModal(false);
        setNewCustName('');
        setNewCustPhone('');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesCat = selectedCat === 'all' || String(p.category_id) === String(selectedCat);
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
      p.name.toLowerCase().includes(q) ||
      (p.name_urdu && p.name_urdu.includes(q)) ||
      (p.code && p.code.toLowerCase().includes(q)) ||
      (p.barcode && p.barcode.toLowerCase().includes(q));
    return matchesCat && matchesSearch;
  });

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-100px)] no-print">
      
      {/* LEFT/CENTER PANEL: Product Catalog, Category Tabs & Search Bar */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        
        {/* Top Search & Dedicated Barcode Scanner Bar */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/70 space-y-2">
          
          {/* Hardware Status & Shift Quick Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-200 text-[11px] font-bold">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Scanner: Ready</span>
              </span>
              <span className="hidden sm:flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <Printer className="w-3 h-3 text-emerald-600" />
                <span>Printer: Ready (80mm/A4)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowShiftModal(true)}
                className={`px-2 py-0.5 rounded-md border flex items-center gap-1.5 transition cursor-pointer ${
                  currentShift
                    ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                    : 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                }`}
                title="View shift or reconcile drawer"
              >
                <Clock className="w-3 h-3 text-amber-700" />
                <span>
                  {currentShift
                    ? `${currentShift.shift_name} (Cash: Rs. ${shiftStats.expected_cash?.toLocaleString()})`
                    : '⚠ Open Shift'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowReturnModal(true)}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                title="Process Sales Return or Exchange (F7)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                <span>Return / Exchange (F7)</span>
              </button>

              <button
                type="button"
                onClick={handleOpenRecallQuotation}
                className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                title="Recall Draft Quotation"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden sm:inline">Quotations</span>
              </button>

              <button
                type="button"
                onClick={() => setIsTerminalLocked(true)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                title="Lock POS Terminal (F10)"
              >
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Lock (F10)</span>
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            
            {/* Dedicated High-Speed Barcode Scanner Input */}
            <div className="relative flex-1">
              <div className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-amber-600">
                <Barcode className="w-5 h-5 animate-pulse" />
              </div>
              <input
                ref={barcodeInputRef}
                type="text"
                placeholder={t('scan_barcode_placeholder')}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeScan(barcodeInput);
                  }
                }}
                className="w-full text-xs sm:text-sm pl-11 pr-32 rtl:pl-32 rtl:pr-11 py-2.5 bg-white border-2 border-amber-400 rounded-xl shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-bold text-slate-800 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
              />
              <div className="absolute right-1.5 rtl:right-auto rtl:left-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleBarcodeScan(barcodeInput)}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold rounded-lg shadow-2xs transition cursor-pointer"
                >
                  {t('scan_btn')}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCameraModal(true)}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-300 flex items-center gap-1 transition cursor-pointer"
                  title={t('camera_btn')}
                >
                  <Camera className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden sm:inline">{t('camera_btn')}</span>
                </button>
              </div>
            </div>

            {/* Product Name Search Filter */}
            <div className="relative sm:w-52 md:w-60">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Filter by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 rtl:pl-3 rtl:pr-9 py-2.5 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
            </div>

            {/* Held Bills Button */}
            {parkedBills.length > 0 && (
              <button
                onClick={() => setShowParkedModal(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-amber-50 text-amber-900 border border-amber-200 rounded-xl text-xs font-bold hover:bg-amber-100 transition shadow-2xs flex-shrink-0 cursor-pointer"
              >
                <PauseCircle className="w-4 h-4 text-amber-600" />
                <span>Held ({parkedBills.length})</span>
              </button>
            )}

          </div>

          {/* Real-time Scanner Toast / Alert Banner */}
          {scanNotification && (
            <div className={`p-2 rounded-xl text-xs font-bold flex items-center justify-between transition animate-in fade-in slide-in-from-top-1 ${
              scanNotification.type === 'error'
                ? 'bg-rose-50 border border-rose-300 text-rose-800'
                : scanNotification.type === 'warning'
                ? 'bg-amber-50 border border-amber-300 text-amber-800'
                : 'bg-emerald-50 border border-emerald-300 text-emerald-800'
            }`}>
              <div className="flex items-center gap-2">
                {scanNotification.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-600" />}
                {scanNotification.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
                {scanNotification.type === 'success' && <Check className="w-4 h-4 text-emerald-600" />}
                <span>{scanNotification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setScanNotification(null)}
                className="p-1 hover:bg-black/5 rounded text-slate-500 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

        {/* Categories Pills */}
        <div className="px-3 py-2 border-b border-slate-100 bg-white overflow-x-auto flex gap-1.5 flex-nowrap scrollbar-none">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-shrink-0 cursor-pointer ${
              selectedCat === 'all'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t('all_categories')}
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(String(c.id))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex-shrink-0 cursor-pointer ${
                String(selectedCat) === String(c.id)
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {lang === 'ur' && c.name_urdu ? c.name_urdu : c.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 p-3 overflow-y-auto bg-slate-50/50">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {filteredProducts.map((p) => {
              const isLowStock = p.branch_stock <= p.min_stock;
              const isOutOfStock = p.branch_stock <= 0;

              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (p.unit === 'Kg' || p.unit === 'Gram' || p.category_name?.toLowerCase().includes('sweet') || p.name?.toLowerCase().includes('barfi') || p.name?.toLowerCase().includes('jamun') || p.name?.toLowerCase().includes('mithai') || p.name?.toLowerCase().includes('ladoo') || p.name?.toLowerCase().includes('jalebi') || p.name?.toLowerCase().includes('katli') || p.name?.toLowerCase().includes('chhena')) {
                      openWeightModal(p);
                    } else {
                      addToCart(p);
                    }
                  }}
                  className={`bg-white rounded-xl p-2.5 border transition cursor-pointer select-none relative flex flex-col justify-between hover:shadow-md hover:border-amber-400 group ${
                    isOutOfStock ? 'opacity-60 border-rose-200' : 'border-slate-200'
                  }`}
                >
                  <div>
                    {/* Stock badge */}
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="font-mono text-slate-400 font-bold">{p.code}</span>
                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                        isOutOfStock
                          ? 'bg-rose-100 text-rose-700'
                          : isLowStock
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {p.branch_stock} {p.unit}
                      </span>
                    </div>

                    {/* Product Name */}
                    <h4 className="font-bold text-xs text-slate-900 group-hover:text-amber-700 transition line-clamp-2">
                      {p.name}
                    </h4>
                    {p.name_urdu && (
                      <p className="font-urdu text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                        {p.name_urdu}
                      </p>
                    )}
                  </div>

                  {/* Price & Weight Button */}
                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block">{p.unit}</span>
                      <span className="text-xs font-black text-amber-700">
                        Rs. {Number(p.sale_price).toLocaleString()}
                      </span>
                    </div>

                    {(p.unit === 'Kg' || p.unit === 'Gram' || p.category_name?.toLowerCase().includes('sweet') || p.name?.toLowerCase().includes('barfi') || p.name?.toLowerCase().includes('jamun') || p.name?.toLowerCase().includes('mithai')) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openWeightModal(p);
                        }}
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-bold flex items-center gap-1 transition shadow-2xs cursor-pointer"
                        title={t('weight_calc_title')}
                      >
                        <Scale className="w-3 h-3 text-amber-700" />
                        <span>{t('weight_badge')}</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}

            {filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 text-sm">
                No products found matching "{searchQuery}".
              </div>
            )}
          </div>
        </div>

        {/* Keyboard Shortcuts Helper Footer */}
        <div className="p-2 border-t border-slate-200 bg-slate-100/70 text-[11px] font-semibold text-slate-600 flex items-center justify-between">
          <span className="truncate">{t('shortcuts_help')}</span>
          <span className="text-amber-700 font-bold">Sawera POS</span>
        </div>

      </div>

      {/* RIGHT PANEL: Current Cart & Billing Checkout */}
      <div className="w-full lg:w-[380px] xl:w-[420px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden flex-shrink-0">
        
        {/* Customer Selector Header */}
        <div className="p-3 border-b border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <User className="w-4 h-4 text-amber-600" />
              <span>Customer</span>
            </span>
            <button
              onClick={() => setShowNewCustModal(true)}
              className="text-[11px] text-amber-700 font-bold hover:underline flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t('new_customer')}</span>
            </button>
          </div>

          <select
            id="customer-select"
            value={customer?.id || ''}
            onChange={(e) => {
              const cust = customers.find(c => String(c.id) === e.target.value);
              setCustomer(cust || null);
            }}
            className="w-full text-xs font-semibold py-1.5 px-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">{t('walk_in_customer')}</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} {c.phone ? `(${c.phone})` : ''} - Udhaar: Rs. {c.current_balance}
              </option>
            ))}
          </select>

          {customer && (
            <div className="text-[11px] bg-amber-50 p-1.5 rounded-md border border-amber-200 flex justify-between text-amber-900 font-semibold">
              <span>Credit Limit: Rs. {customer.credit_limit}</span>
              <span className="text-rose-700 font-bold">Due Udhaar: Rs. {customer.current_balance}</span>
            </div>
          )}

          {/* Price Tier Selector */}
          <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200 text-[11px] font-bold">
            <span className="text-slate-600 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-amber-600" />
              <span>Price Tier:</span>
            </span>
            <div className="flex bg-slate-200/70 p-0.5 rounded-lg text-[10px]">
              {[
                { id: 'retail', label: 'Retail' },
                { id: 'wholesale', label: 'Wholesale' },
                { id: 'special', label: 'Special' }
              ].map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handlePriceTierChange(t.id)}
                  className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                    priceTier === t.id ? 'bg-amber-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2 divide-y divide-slate-100">
          {cart.map((item) => (
            <div key={item.id} className="pt-2 first:pt-0 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 pr-1 rtl:pr-0 rtl:pl-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="font-bold text-slate-900 leading-tight">{item.name}</p>
                    {item.weight_grams && (
                      <button
                        type="button"
                        onClick={() => {
                          const prod = products.find(p => p.id === item.id) || item;
                          openWeightModal(prod, item);
                        }}
                        className="text-[10px] text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                        title="Click to change weight or amount"
                      >
                        <Scale className="w-3 h-3 text-amber-700" />
                        <span>{item.weight_grams}g</span>
                      </button>
                    )}
                  </div>

                  {item.weight_grams ? (
                    <div className="text-[11px] text-slate-700 mt-1 space-y-0.5 bg-amber-50/70 p-2 rounded-lg border border-amber-200/80">
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Weight:</span>
                        <span className="font-bold text-slate-800">{item.weight_grams} g <span className="text-[10px] text-slate-400">({item.quantity} kg)</span></span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-slate-500">Rate:</span>
                        <span className="font-bold text-slate-800">Rs. {Number(item.rate_per_kg || item.price).toLocaleString()}/kg</span>
                      </div>
                      <div className="flex justify-between font-mono">
                        <span className="text-amber-800 font-bold">Amount:</span>
                        <span className="font-black text-amber-900">Rs. {Number(item.line_total).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                      <span>Rs. {item.price} / {item.unit}</span>
                      {item.discount > 0 && <span className="text-rose-600 font-semibold">-Rs. {item.discount} disc</span>}
                    </div>
                  )}
                </div>

                {/* Actions / Stepper */}
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <div className="flex items-center gap-1">
                    {item.weight_grams ? (
                      <button
                        type="button"
                        onClick={() => {
                          const prod = products.find(p => p.id === item.id) || item;
                          openWeightModal(prod, item);
                        }}
                        className="px-2 py-1 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition shadow-2xs"
                        title="Edit Sweet Weight / Amount"
                      >
                        <Scale className="w-3 h-3 text-amber-700" />
                        <span>Edit</span>
                      </button>
                    ) : (
                      <div className="flex items-center space-x-1 rtl:space-x-reverse">
                        <button
                          onClick={() => updateQty(item.id, -1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => setExactQty(item.id, e.target.value)}
                          className="w-10 text-center font-bold border border-slate-200 rounded py-0.5 text-xs"
                        />
                        <button
                          onClick={() => updateQty(item.id, 1)}
                          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center font-bold text-slate-700 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded transition cursor-pointer"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-slate-900 text-xs">
                      Rs. {Number(item.line_total).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="py-20 text-center text-slate-400 text-xs">
              <ShoppingBag className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <span>Cart is empty. Click items or scan barcode to add.</span>
            </div>
          )}
        </div>

        {/* Bill Summary Calculations */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-1.5 text-xs">
          
          <div className="flex justify-between text-slate-600">
            <span>{t('subtotal')}:</span>
            <span className="font-semibold">Rs. {subtotal.toLocaleString()}</span>
          </div>

          {/* Overall Discount Input */}
          <div className="flex items-center justify-between text-slate-600">
            <div className="flex items-center gap-1">
              <span>{t('discount')}:</span>
              <button
                type="button"
                onClick={() => setDiscountType(prev => prev === 'fixed' ? 'percent' : 'fixed')}
                className="text-[10px] font-bold bg-slate-200 px-1.5 py-0.5 rounded text-slate-700"
              >
                {discountType === 'fixed' ? 'PKR' : '%'}
              </button>
            </div>
            <input
              type="number"
              min="0"
              placeholder="0"
              value={discountValue || ''}
              onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
              className="w-20 text-right rtl:text-left px-2 py-0.5 border border-slate-300 rounded text-xs font-semibold"
            />
          </div>

          {/* Tax / GST % */}
          <div className="flex items-center justify-between text-slate-600">
            <span>GST / Tax (%):</span>
            <input
              type="number"
              min="0"
              max="100"
              placeholder="0"
              value={taxPercent || ''}
              onChange={(e) => setTaxPercent(parseFloat(e.target.value) || 0)}
              className="w-20 text-right rtl:text-left px-2 py-0.5 border border-slate-300 rounded text-xs font-semibold"
            />
          </div>

          {/* Exchange Credit Line */}
          {exchangeCredit > 0 && (
            <div className="flex items-center justify-between font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
              <span className="flex items-center gap-1">
                <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t('exchange_credit')}:</span>
              </span>
              <span>- Rs. {exchangeCredit.toLocaleString()}</span>
            </div>
          )}

          {/* Grand Total */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-slate-900">
            <span className="font-extrabold text-sm uppercase">{t('grand_total')}:</span>
            <span className="text-xl font-black text-amber-700">
              Rs. {grandTotal.toLocaleString()}
            </span>
          </div>

          {/* Checkout & Action Buttons */}
          <div className="pt-2 grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={clearCart}
              disabled={cart.length === 0}
              className="py-2 rounded-xl text-[11px] font-bold bg-slate-200 hover:bg-slate-300 text-slate-700 disabled:opacity-50 transition cursor-pointer"
            >
              {t('clear_cart_btn')}
            </button>
            <button
              type="button"
              onClick={handleParkCurrentBill}
              disabled={cart.length === 0}
              className="py-2 rounded-xl text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 disabled:opacity-50 transition cursor-pointer"
            >
              {t('hold_bill_btn')}
            </button>
            <button
              type="button"
              onClick={handleSaveQuotation}
              disabled={cart.length === 0}
              className="py-2 rounded-xl text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 disabled:opacity-50 transition cursor-pointer"
              title="Save bill as formal Quotation without deducting stock"
            >
              {t('quotation_btn')}
            </button>
            <button
              type="button"
              onClick={openPaymentModal}
              disabled={cart.length === 0}
              className="py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white shadow-md disabled:opacity-50 transition cursor-pointer"
            >
              {t('pay_btn')}
            </button>
          </div>

        </div>

      </div>

      {/* PAYMENT & TENDER MODAL */}
      {showPayModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            
            <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-base flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-400" />
                  <span>{t('receive_payment')}</span>
                </h3>
                <p className="text-xs text-slate-300">{t('total_due')}: Rs. {grandTotal.toLocaleString()}</p>
              </div>
              <button onClick={() => setShowPayModal(false)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer">
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              
              {/* Payment Methods Grid */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">{t('payment_mode')}</label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: t('cash') },
                    { id: 'easypaisa', label: t('easypaisa') },
                    { id: 'jazzcash', label: t('jazzcash') },
                    { id: 'card', label: t('card') },
                    { id: 'bank', label: t('bank') },
                    { id: 'split', label: t('split') },
                    { id: 'credit', label: t('credit_udhaar') }
                  ].map((pm) => (
                    <button
                      key={pm.id}
                      type="button"
                      onClick={() => setPaymentMethod(pm.id)}
                      className={`p-2 rounded-xl font-bold border transition text-center ${
                        paymentMethod === pm.id
                          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pm.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mode-specific Tender inputs */}
              {paymentMethod === 'cash' && (
                <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                  <label className="block font-bold text-slate-800">Cash Received / Tendered (Rs.)</label>
                  <input
                    type="number"
                    value={tenderAmount}
                    onChange={(e) => setTenderAmount(e.target.value)}
                    className="w-full text-base font-bold px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  {parseFloat(tenderAmount) >= grandTotal && (
                    <div className="flex justify-between items-center font-bold text-emerald-800 text-sm pt-1">
                      <span>Change Return to Customer:</span>
                      <span className="text-base font-black">Rs. {(parseFloat(tenderAmount) - grandTotal).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === 'split' && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="font-bold text-slate-700 mb-1">Enter Split Payment Breakdown:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="font-semibold text-slate-500">Cash (Rs.):</span>
                      <input
                        type="number"
                        value={splitCash}
                        onChange={(e) => setSplitCash(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md font-bold"
                      />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Easypaisa (Rs.):</span>
                      <input
                        type="number"
                        value={splitEasypaisa}
                        onChange={(e) => setSplitEasypaisa(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md font-bold"
                      />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Card (Rs.):</span>
                      <input
                        type="number"
                        value={splitCard}
                        onChange={(e) => setSplitCard(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md font-bold"
                      />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-500">Bank Transfer (Rs.):</span>
                      <input
                        type="number"
                        value={splitBank}
                        onChange={(e) => setSplitBank(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 rounded-md font-bold"
                      />
                    </div>
                  </div>
                  <div className="text-right rtl:text-left text-slate-600 font-bold pt-1">
                    Total Split Sum: Rs. {((parseFloat(splitCash) || 0) + (parseFloat(splitEasypaisa) || 0) + (parseFloat(splitCard) || 0) + (parseFloat(splitBank) || 0)).toLocaleString()}
                  </div>
                </div>
              )}

              {paymentMethod === 'credit' && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                  <p className="font-bold text-sm">Udhaar / Customer Credit Sale</p>
                  <p className="text-xs">
                    This full amount of <b>Rs. {grandTotal.toLocaleString()}</b> will be added to customer <b>{customer?.name || '(No Customer Selected!)'}</b>'s outstanding balance.
                  </p>
                  {!customer && (
                    <p className="text-xs text-rose-700 font-black mt-1">
                      ⚠️ Please close this modal and select a customer before finalizing credit sale.
                    </p>
                  )}
                </div>
              )}

              {/* Remarks / Notes */}
              <div>
                <label className="block font-semibold text-slate-600 mb-1">Invoice Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Special packing, birthday cake inscription"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 font-bold text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Back to Bill
                </button>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                  className="px-6 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Processing...' : 'Complete & Print Receipt'}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* HELD BILLS DRAWER / MODAL */}
      {showParkedModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-amber-600" />
                <span>Held / Parked Bills</span>
              </h3>
              <button onClick={() => setShowParkedModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {parkedBills.map((b) => (
                <div key={b.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-xs text-slate-900">{b.reference}</p>
                    <p className="text-[10px] text-slate-500">Held by {b.user_name} on {new Date(b.created_at).toLocaleTimeString()}</p>
                  </div>
                  <button
                    onClick={() => recallBill(b)}
                    className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-2xs"
                  >
                    Recall Bill
                  </button>
                </div>
              ))}

              {parkedBills.length === 0 && (
                <p className="text-center py-8 text-xs text-slate-400">No held bills found.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD CUSTOMER MODAL */}
      {showNewCustModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 text-sm">Add New Customer</h3>
              <button onClick={() => setShowNewCustModal(false)} className="p-1 hover:bg-slate-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={(e) => setNewCustName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  placeholder="e.g. Chaudhry Tariq"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={newCustPhone}
                  onChange={(e) => setNewCustPhone(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                  placeholder="0300-1234567"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Credit Limit (Rs.)</label>
                <input
                  type="number"
                  value={newCustLimit}
                  onChange={(e) => setNewCustLimit(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustModal(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 text-white font-bold rounded-lg"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT RECEIPT MODAL */}
      {showPrintModal && completedSale && (
        <InvoicePrintModal
          sale={completedSale}
          onClose={() => {
            setShowPrintModal(false);
            setCompletedSale(null);
          }}
          autoPrint={true}
        />
      )}

      {/* UNKNOWN BARCODE MODAL */}
      {unknownBarcode && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-base text-slate-900">Product Not Found</h3>
            <p className="text-xs text-slate-500 mt-1">
              No product found matching scanned barcode:
            </p>
            <div className="my-3 p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 text-sm tracking-wider">
              {unknownBarcode}
            </div>
            <p className="text-[11px] text-slate-400 mb-4">
              Would you like to register a new product with this barcode?
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setUnknownBarcode(null);
                  barcodeInputRef.current?.focus();
                }}
                className="py-2 px-3 border border-slate-300 rounded-xl font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Dismiss (Esc)
              </button>
              <button
                type="button"
                onClick={() => handleOpenQuickProductModal(unknownBarcode)}
                className="py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Product</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QUICK ADD PRODUCT MODAL (Pre-fills scanned barcode) */}
      {showQuickAddProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm">Quick Add Product</h3>
                <p className="text-[10px] text-slate-400">Pre-filled with scanned barcode</p>
              </div>
              <button onClick={() => setShowQuickAddProduct(false)} className="p-1 hover:bg-white/10 rounded cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveQuickProduct} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Scanned Barcode</label>
                <input
                  type="text"
                  required
                  value={quickProductData.barcode}
                  onChange={(e) => setQuickProductData({ ...quickProductData, barcode: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-mono font-bold bg-slate-50 text-slate-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Product Name (English) *</label>
                <input
                  type="text"
                  required
                  value={quickProductData.name}
                  onChange={(e) => setQuickProductData({ ...quickProductData, name: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-semibold"
                  placeholder="e.g. Special Barfi"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{t('product_name_urdu_label')}</label>
                <input
                  type="text"
                  value={quickProductData.name_urdu}
                  onChange={(e) => setQuickProductData({ ...quickProductData, name_urdu: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-urdu text-right"
                  placeholder={lang === 'ur' ? 'برفی اسپیشل' : 'e.g. Special Barfi'}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{lang === 'ur' ? 'کیٹیگری' : 'Category'}</label>
                  <select
                    value={quickProductData.category_id}
                    onChange={(e) => setQuickProductData({ ...quickProductData, category_id: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="">{lang === 'ur' ? 'جنرل' : 'General'}</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{lang === 'ur' && c.name_urdu ? c.name_urdu : c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{t('unit')}</label>
                  <select
                    value={quickProductData.unit}
                    onChange={(e) => setQuickProductData({ ...quickProductData, unit: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold"
                  >
                    <option value="Piece">{t('unit_piece')}</option>
                    <option value="Kg">{t('unit_kg')}</option>
                    <option value="Gram">{t('unit_gram')}</option>
                    <option value="Box">{t('unit_box')}</option>
                    <option value="Pack">{t('unit_pack')}</option>
                    <option value="Bottle">{t('unit_bottle')}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cost Price (Rs.)</label>
                  <input
                    type="number"
                    value={quickProductData.purchase_price}
                    onChange={(e) => setQuickProductData({ ...quickProductData, purchase_price: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-semibold"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Sale Price (Rs.) *</label>
                  <input
                    type="number"
                    required
                    value={quickProductData.sale_price}
                    onChange={(e) => setQuickProductData({ ...quickProductData, sale_price: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-amber-700"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Initial Stock (This Branch)</label>
                <input
                  type="number"
                  value={quickProductData.initial_stock}
                  onChange={(e) => setQuickProductData({ ...quickProductData, initial_stock: e.target.value })}
                  className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold text-emerald-700"
                  placeholder="20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowQuickAddProduct(false)}
                  className="px-3 py-1.5 text-slate-600 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-sm cursor-pointer"
                >
                  Save &amp; Add to Cart
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CAMERA BARCODE SCANNER MODAL */}
      <CameraBarcodeModal
        isOpen={showCameraModal}
        onClose={() => {
          setShowCameraModal(false);
          barcodeInputRef.current?.focus();
        }}
        onScan={(scannedCode) => {
          handleBarcodeScan(scannedCode);
        }}
        title={lang === 'ur' ? 'کیمرہ سکینر' : 'POS Camera Barcode Scanner'}
        allowContinuous={true}
      />

      {/* WEIGHT-BASED SWEETS & BAKERY CALCULATOR MODAL (Amount -> Weight Calculator) */}
      {showWeightModal && weightProduct && (() => {
        const currentRate = Number(weightProduct.sale_price) || 1000;
        const currentPricePerGram = currentRate / 1000;
        let liveGrams = 0;
        let liveAmount = 0;

        if (weightMode === 'amount') {
          const amt = parseFloat(weightAmount) || 0;
          liveAmount = amt;
          liveGrams = amt > 0 ? parseFloat((amt / currentPricePerGram).toFixed(2)) : 0;
        } else {
          const g = parseFloat(weightGrams) || 0;
          liveGrams = g;
          liveAmount = g > 0 ? Math.round(g * currentPricePerGram * 100) / 100 : 0;
        }
        const liveKg = (liveGrams / 1000).toFixed(5);

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
              
              {/* Header */}
              <div className="p-4 bg-gradient-to-r from-amber-600 to-rose-600 text-white flex justify-between items-center">
                <div>
                  <h3 className="font-black text-sm sm:text-base flex items-center gap-1.5">
                    <Scale className="w-5 h-5 text-amber-200" />
                    <span>{t('weight_calc_title')}</span>
                  </h3>
                  <p className="text-xs text-amber-100 mt-0.5">
                    {lang === 'ur' && weightProduct.name_urdu ? weightProduct.name_urdu : weightProduct.name}
                  </p>
                </div>
                <button
                  onClick={() => setShowWeightModal(false)}
                  className="p-1 hover:bg-white/20 rounded-lg text-white cursor-pointer transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                
                {/* Product Rate Banner */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center text-amber-900 font-bold">
                  <div>
                    <span className="text-[11px] text-amber-700 block">{t('stored_rate')}</span>
                    <span className="text-base font-black">Rs. {Number(weightProduct.sale_price).toLocaleString()} / kg</span>
                  </div>
                  <div className="text-right rtl:text-left">
                    <span className="text-[11px] text-amber-700 block">{t('price_per_gram')}</span>
                    <span className="text-sm font-extrabold font-mono text-emerald-800">
                      Rs. {currentPricePerGram.toFixed(2)} / g
                    </span>
                  </div>
                </div>

                {/* Mode Selector Tabs: [Enter Weight] [Enter Amount] */}
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl font-bold">
                  <button
                    type="button"
                    onClick={() => setWeightMode('amount')}
                    className={`py-2.5 px-3 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      weightMode === 'amount'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{t('enter_amount_tab')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightMode('weight')}
                    className={`py-2.5 px-3 rounded-lg text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      weightMode === 'weight'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{t('enter_weight_tab')}</span>
                  </button>
                </div>

                {/* MODE 1: ENTER AMOUNT (e.g. Rs. 230 -> 209.09g) */}
                {weightMode === 'amount' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {t('enter_amount_label')}
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 font-black text-slate-500 text-sm">Rs.</span>
                        <input
                          type="number"
                          min="1"
                          step="any"
                          autoFocus
                          value={weightAmount}
                          onChange={(e) => setWeightAmount(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleConfirmWeight();
                            }
                          }}
                          className="w-full text-lg font-black pl-11 pr-3 rtl:pl-3 rtl:pr-11 py-2.5 border-2 border-amber-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                          placeholder="e.g. 230"
                        />
                      </div>
                    </div>

                    {/* Quick Amount Buttons */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">{t('rupee_presets')}</span>
                      <div className="grid grid-cols-5 sm:grid-cols-9 gap-1">
                        {[50, 100, 200, 230, 250, 300, 320, 500, 1000].map(amt => (
                          <button
                            key={amt}
                            type="button"
                            onClick={() => setWeightAmount(String(amt))}
                            className={`py-1 rounded-lg border font-mono font-bold text-center text-[11px] transition cursor-pointer ${
                              weightAmount === String(amt)
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-slate-100 hover:bg-amber-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {amt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* MODE 2: ENTER WEIGHT (e.g. 250g -> Rs. 275) */}
                {weightMode === 'weight' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {t('enter_weight_label')}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          step="any"
                          autoFocus
                          value={weightGrams}
                          onChange={(e) => setWeightGrams(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleConfirmWeight();
                            }
                          }}
                          className="w-full text-lg font-black pl-4 pr-16 rtl:pl-16 rtl:pr-4 py-2.5 border-2 border-amber-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
                          placeholder="e.g. 250"
                        />
                        <span className="absolute right-3.5 rtl:right-auto rtl:left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-500 text-sm">
                          {lang === 'ur' ? 'گرام' : 'Grams'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Weight Presets */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 block mb-1">{t('sweet_presets')}</span>
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        {[
                          { g: 125, label: lang === 'ur' ? '125 گرام (آدھ پاؤ)' : '125g (Adha Pao)' },
                          { g: 200, label: lang === 'ur' ? '200 گرام' : '200g' },
                          { g: 250, label: lang === 'ur' ? '250 گرام (1 پاؤ)' : '250g (1 Pao)' },
                          { g: 320, label: lang === 'ur' ? '320 گرام' : '320g' },
                          { g: 500, label: lang === 'ur' ? '500 گرام (آدھ کلو)' : '500g (Adha Kilo)' },
                          { g: 750, label: lang === 'ur' ? '750 گرام (3 پاؤ)' : '750g (3 Pao)' },
                          { g: 1000, label: lang === 'ur' ? '1000 گرام (1 کلو)' : '1000g (1 Kg)' },
                          { g: 2000, label: lang === 'ur' ? '2000 گرام (2 کلو)' : '2000g (2 Kg)' }
                        ].map(preset => (
                          <button
                            key={preset.g}
                            type="button"
                            onClick={() => setWeightGrams(String(preset.g))}
                            className={`py-1 px-1.5 rounded-lg border font-bold text-center text-[10px] transition cursor-pointer ${
                              weightGrams === String(preset.g)
                                ? 'bg-amber-600 text-white border-amber-600'
                                : 'bg-slate-100 hover:bg-amber-100 text-slate-800 border-slate-200'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* CLEAR CALCULATION BREAKDOWN DISPLAY MATCHING SPEC */}
                <div className="p-4 bg-amber-50/80 border-2 border-amber-300 rounded-2xl space-y-2.5">
                  <div className="flex justify-between items-center border-b border-amber-200 pb-1.5">
                    <h4 className="font-extrabold text-sm text-slate-900">
                      {lang === 'ur' && weightProduct.name_urdu ? weightProduct.name_urdu : weightProduct.name}
                    </h4>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-2 py-0.5 rounded-full uppercase">
                      {weightMode === 'amount'
                        ? (lang === 'ur' ? 'رقم سے وزن' : 'Amount → Weight')
                        : (lang === 'ur' ? 'وزن سے رقم' : 'Weight → Amount')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                    <div className="bg-white p-2 rounded-xl border border-amber-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">{t('calc_weight')}</span>
                      <span className="text-base sm:text-lg font-black text-emerald-800 font-mono">
                        {liveGrams} g
                      </span>
                      <span className="text-[9px] text-slate-400 block font-mono">({liveKg} kg)</span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-amber-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">{t('calc_rate')}</span>
                      <span className="text-base sm:text-lg font-black text-slate-800 font-mono">
                        Rs. {Number(weightProduct.sale_price).toLocaleString()}
                      </span>
                      <span className="text-[9px] text-slate-400 block">/ kg</span>
                    </div>

                    <div className="bg-white p-2 rounded-xl border border-amber-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">{t('calc_amount')}</span>
                      <span className="text-base sm:text-lg font-black text-amber-700 font-mono">
                        Rs. {liveAmount}
                      </span>
                      <span className="text-[9px] text-slate-400 block font-mono">PKR</span>
                    </div>
                  </div>

                  {/* Formula Breakdown as instructed */}
                  <div className="bg-white/90 p-2.5 rounded-xl border border-amber-200 text-[11px] text-slate-700 space-y-1">
                    <div className="flex justify-between font-semibold text-slate-600">
                      <span>{t('formula_rate_per_g')}</span>
                      <span>Rs. {Number(weightProduct.sale_price).toLocaleString()} ÷ 1,000g = <strong className="text-slate-900">Rs. {currentPricePerGram.toFixed(2)}/g</strong></span>
                    </div>
                    {weightMode === 'amount' ? (
                      <div className="flex justify-between font-mono text-emerald-800 font-bold border-t border-slate-100 pt-1">
                        <span>{t('formula_weight')}</span>
                        <span>Rs. {liveAmount} ÷ Rs. {currentPricePerGram.toFixed(2)} = {liveGrams}g ({liveKg} kg)</span>
                      </div>
                    ) : (
                      <div className="flex justify-between font-mono text-emerald-800 font-bold border-t border-slate-100 pt-1">
                        <span>{t('formula_amount')}</span>
                        <span>{liveGrams}g × Rs. {currentPricePerGram.toFixed(2)} = Rs. {liveAmount} ({liveKg} kg)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 flex justify-end gap-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowWeightModal(false)}
                    className="px-4 py-2 text-slate-600 font-semibold cursor-pointer hover:bg-slate-100 rounded-xl transition"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmWeight}
                    className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t('add_to_cart')} ({liveGrams}g = Rs. {liveAmount})</span>
                  </button>
                </div>

              </div>
            </div>
          </div>
        );
      })()}

      {/* SALES RETURN & PRODUCT EXCHANGE MODAL */}
      {showReturnModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-400" />
                  <span>{t('sales_return_exchange_title')}</span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  {lang === 'ur' ? 'گاہک کی انوائس تلاش کر کے رقم واپسی یا تبادلہ کریں' : 'Search customer invoice to process cash refund or exchange credit'}
                </p>
              </div>
              <button
                onClick={() => setShowReturnModal(false)}
                className="p-1 hover:bg-white/10 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Search Invoice Form */}
              <form onSubmit={handleSearchReturnInvoice} className="flex gap-2">
                <input
                  type="text"
                  placeholder={lang === 'ur' ? 'انوائس نمبر درج کریں...' : 'Enter Invoice No (e.g. SSB-B1-2026...)...'}
                  value={returnSearchQuery}
                  onChange={(e) => setReturnSearchQuery(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-xl font-mono text-xs font-bold"
                />
                <button
                  type="submit"
                  disabled={isSearchingReturn}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer"
                >
                  {isSearchingReturn ? (lang === 'ur' ? 'تلاش ہو رہی ہے...' : 'Searching...') : (lang === 'ur' ? 'انوائس تلاش کریں' : 'Find Invoice')}
                </button>
              </form>

              {returnSaleData && (
                <div className="space-y-4">
                  {/* Invoice Header Info */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500">{lang === 'ur' ? 'انوائس: ' : 'Invoice: '}</span>
                      <span className="font-bold font-mono text-slate-800">{returnSaleData.invoice_no}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">{lang === 'ur' ? 'تاریخ: ' : 'Date: '}</span>
                      <span className="font-bold">{new Date(returnSaleData.created_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">{lang === 'ur' ? 'گاہک: ' : 'Customer: '}</span>
                      <span className="font-bold">{returnSaleData.customer_name || (lang === 'ur' ? 'عام گاہک' : 'Walk-in Customer')}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">{lang === 'ur' ? 'کل ادا شدہ: ' : 'Total Paid: '}</span>
                      <span className="font-bold text-amber-700">Rs. {Number(returnSaleData.grand_total).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Return Items Selection */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {lang === 'ur' ? 'واپس کرنے والے آئٹمز اور تعداد منتخب کریں:' : 'Select Items and Quantities to Return:'}
                    </label>
                    <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-48 overflow-y-auto">
                      {(returnSaleData.items || []).map((item) => {
                        const maxReturn = item.quantity - (item.returned_quantity || 0);
                        const currentReturnQty = returnQuantities[item.id] || 0;
                        const effectiveRate = item.line_total / item.quantity;
                        const itemRefund = Math.round(effectiveRate * currentReturnQty);

                        return (
                          <div key={item.id} className="p-2.5 flex items-center justify-between hover:bg-slate-50">
                            <div className="flex-1">
                              <p className="font-bold text-slate-900">{lang === 'ur' && item.product_name_urdu ? item.product_name_urdu : item.product_name}</p>
                              <p className="text-[10px] text-slate-500">
                                {item.quantity} {item.unit} @ Rs. {item.unit_price} ({lang === 'ur' ? 'زیادہ سے زیادہ: ' : 'Max returnable: '} {maxReturn})
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-1">
                                <span className="text-slate-500 text-[10px]">{lang === 'ur' ? 'تعداد:' : 'Return Qty:'}</span>
                                <input
                                  type="number"
                                  min="0"
                                  max={maxReturn}
                                  step="0.01"
                                  value={currentReturnQty}
                                  onChange={(e) => {
                                    const val = Math.min(maxReturn, Math.max(0, parseFloat(e.target.value) || 0));
                                    setReturnQuantities(prev => ({ ...prev, [item.id]: val }));
                                  }}
                                  className="w-16 text-center font-bold px-1.5 py-1 border border-slate-300 rounded text-xs"
                                />
                              </div>
                              <span className="font-black text-rose-700 w-16 text-right rtl:text-left">
                                Rs. {itemRefund}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Return Option: Exchange vs Cash Refund */}
                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                    <span className="block font-bold text-slate-800">{lang === 'ur' ? 'طریقہ کار:' : 'Return Action Mode:'}</span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsReturnExchange(true)}
                        className={`p-2 rounded-lg font-bold border transition text-center ${
                          isReturnExchange ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        🔄 {t('product_exchange_mode')}
                        <span className="block text-[10px] font-normal opacity-90">{lang === 'ur' ? 'رقم موجودہ بل میں شامل ہو جائے گی' : 'Credits returned value into cart'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsReturnExchange(false)}
                        className={`p-2 rounded-lg font-bold border transition text-center ${
                          !isReturnExchange ? 'bg-amber-600 text-white border-amber-600 shadow-xs' : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        💵 {t('cash_refund_mode')}
                        <span className="block text-[10px] font-normal opacity-90">{lang === 'ur' ? 'دراز سے نقد رقم واپس کریں' : 'Give cash back to customer'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Reason for Return</label>
                    <input
                      type="text"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setShowReturnModal(false)}
                      className="px-4 py-2 text-slate-600 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingReturn}
                      onClick={handleProcessReturnOrExchange}
                      className="px-6 py-2 bg-gradient-to-r from-amber-600 to-rose-600 text-white font-bold rounded-xl shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingReturn ? 'Processing...' : (isReturnExchange ? 'Apply Credit to Current Cart' : 'Refund Cash')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SHIFT MANAGEMENT MODAL */}
      {showShiftModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>{t('shift_management_title')}</span>
              </h3>
              <button onClick={() => setShowShiftModal(false)} className="p-1 hover:bg-white/10 rounded cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {currentShift ? (
                /* Active Shift Overview & Close Form */
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-600">{lang === 'ur' ? 'شفٹ کا نام:' : 'Shift Name:'}</span>
                      <span className="text-slate-900">{currentShift.shift_name}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span className="text-slate-600">{lang === 'ur' ? 'شروع کا وقت:' : 'Opened At:'}</span>
                      <span>{new Date(currentShift.start_time).toLocaleTimeString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{lang === 'ur' ? 'اوپننگ کیش فلوٹ:' : 'Opening Cash Float:'}</span>
                      <span className="font-bold">Rs. {Number(currentShift.opening_cash).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{lang === 'ur' ? 'شفٹ میں نقد فروخت:' : 'Shift Cash Sales:'}</span>
                      <span className="font-bold text-emerald-700">+Rs. {Number(shiftStats.cash_sales).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{lang === 'ur' ? 'واپسی و اخراجات:' : 'Returns & Expenses:'}</span>
                      <span className="font-bold text-rose-700">-Rs. {((shiftStats.cash_returns || 0) + (shiftStats.cash_expenses || 0)).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-300 font-extrabold text-sm text-slate-900">
                      <span>{lang === 'ur' ? 'دراز میں متوقع کیش:' : 'Expected Drawer Cash:'}</span>
                      <span className="text-amber-700">Rs. {Number(shiftStats.expected_cash).toLocaleString()}</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {lang === 'ur' ? 'دراز میں موجود نقد رقم گن کر درج کریں *' : 'Physically Counted Drawer Cash (Rs.) *'}
                    </label>
                    <input
                      type="number"
                      required
                      placeholder={lang === 'ur' ? 'نوٹ اور سکے گن کر درج کریں...' : 'Count notes & coins in drawer...'}
                      value={closingActualCash}
                      onChange={(e) => setClosingActualCash(e.target.value)}
                      className="w-full text-base font-black px-3 py-2 border-2 border-amber-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>

                  {closingActualCash !== '' && (
                    <div className={`p-3 rounded-xl font-bold flex justify-between items-center ${
                      Number(closingActualCash) - shiftStats.expected_cash === 0
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : Number(closingActualCash) - shiftStats.expected_cash > 0
                        ? 'bg-blue-50 text-blue-800 border border-blue-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}>
                      <span>{t('drawer_variance')}:</span>
                      <span className="text-base font-black">
                        {Number(closingActualCash) - shiftStats.expected_cash === 0 ? (lang === 'ur' ? '✓ بالکل برابر ہے (0 روپے)' : '✓ Perfectly Balanced (Rs. 0)') : `Rs. ${(Number(closingActualCash) - shiftStats.expected_cash).toLocaleString()}`}
                      </span>
                    </div>
                  )}

                  <div>
                    <label className="block font-semibold text-slate-600 mb-1">Closing Shift Notes</label>
                    <input
                      type="text"
                      placeholder="e.g. End of morning shift hand-over"
                      value={closingNotes}
                      onChange={(e) => setClosingNotes(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t">
                    <button
                      type="button"
                      onClick={() => setShowShiftModal(false)}
                      className="px-4 py-2 text-slate-600 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCloseShift}
                      className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                    >
                      Reconcile &amp; Close Shift
                    </button>
                  </div>
                </div>
              ) : (
                /* Open New Shift Form */
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 font-semibold">
                    No active shift is currently open for this branch. Open a new register shift to start billing.
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Shift Name</label>
                    <input
                      type="text"
                      value={shiftNameInput}
                      onChange={(e) => setShiftNameInput(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 rounded-lg font-bold"
                      placeholder="Morning Shift"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Opening Cash Float (Rs.)</label>
                    <input
                      type="number"
                      value={openingFloat}
                      onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
                      className="w-full text-base font-black px-3 py-2 border border-slate-300 rounded-xl text-amber-700"
                    />
                  </div>

                  <div className="pt-2 flex justify-end gap-2 border-t">
                    <button
                      type="button"
                      onClick={() => setShowShiftModal(false)}
                      className="px-4 py-2 text-slate-600 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenShift}
                      className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md transition cursor-pointer"
                    >
                      Open Register Shift
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* POS TERMINAL LOCK OVERLAY WITH PIN */}
      {isTerminalLocked && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95">
          <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-6 text-white text-center shadow-2xl border border-slate-800">
            <div className="w-16 h-16 bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/30">
              <Lock className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-amber-400">
              {lang === 'ur' ? 'سویرا سویٹس اینڈ بیکرز' : 'SAWERA SWEET & BAKERS'}
            </h2>
            <p className="text-xs text-slate-400 mt-2">{t('terminal_locked')}</p>

            {/* PIN Dots Display */}
            <div className="my-5 flex justify-center items-center gap-3">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    lockPinInput.length > i ? 'bg-amber-400 border-amber-400 scale-110' : 'border-slate-600'
                  }`}
                />
              ))}
            </div>

            {lockPinError && (
              <p className="text-xs text-rose-400 font-bold mb-3 animate-shake">{lockPinError}</p>
            )}

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-2.5 max-w-[260px] mx-auto mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => {
                    if (lockPinInput.length < 6) {
                      const next = lockPinInput + num;
                      setLockPinInput(next);
                      if (next.length === 4) handleUnlockPIN(next);
                    }
                  }}
                  className="py-3 bg-slate-800 hover:bg-slate-700 text-white text-xl font-bold rounded-2xl border border-slate-700 active:scale-95 transition cursor-pointer"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setLockPinInput('')}
                className="py-3 bg-rose-900/40 hover:bg-rose-900/60 text-rose-400 font-bold text-sm rounded-2xl border border-rose-800/40 active:scale-95 transition cursor-pointer"
              >
                {lang === 'ur' ? 'صاف' : 'Clear'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (lockPinInput.length < 6) {
                    const next = lockPinInput + '0';
                    setLockPinInput(next);
                    if (next.length === 4) handleUnlockPIN(next);
                  }
                }}
                className="py-3 bg-slate-800 hover:bg-slate-700 text-white text-xl font-bold rounded-2xl border border-slate-700 active:scale-95 transition cursor-pointer"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleUnlockPIN()}
                className="py-3 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-2xl border border-amber-500 active:scale-95 transition cursor-pointer flex items-center justify-center"
              >
                <Unlock className="w-5 h-5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              {lang === 'ur' ? 'ڈیفالٹ پن کوڈ: 1234' : 'Default Cashier PIN: 1234'}
            </p>
          </div>
        </div>
      )}

      {/* RECALL QUOTATION MODAL */}
      {showRecallQuotationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <span>{t('recall_quotations_title')}</span>
              </h3>
              <button onClick={() => setShowRecallQuotationModal(false)} className="p-1 hover:bg-slate-100 rounded cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {quotationsList.map((q) => (
                <div key={q.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center">
                  <div>
                    <span className="font-mono font-bold text-xs text-indigo-700">{q.quotation_no}</span>
                    <p className="font-bold text-slate-900 text-xs">{q.customer_name || 'Walk-in Client'}</p>
                    <p className="text-[10px] text-slate-500">
                      Total: Rs. {Number(q.grand_total).toLocaleString()} • {new Date(q.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleLoadQuotationToCart(q)}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-2xs cursor-pointer"
                  >
                    Load into Cart →
                  </button>
                </div>
              ))}

              {quotationsList.length === 0 && (
                <p className="text-center py-8 text-xs text-slate-400">No pending quotations found for this branch.</p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

