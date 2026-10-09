import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Printer, X, FileText, CheckCircle2, Share2, Globe } from 'lucide-react';
import JsBarcode from 'jsbarcode';

export function InvoicePrintModal({ sale, onClose, autoPrint = false }) {
  const { lang: systemLang } = useAuth();
  const [template, setTemplate] = useState('thermal'); // 'thermal' (80mm) or 'a4'
  const [receiptLang, setReceiptLang] = useState(systemLang || 'en'); // 'en' or 'ur'
  const barcodeRef = useRef(null);
  const printedRef = useRef(false);

  const shareOnWhatsApp = () => {
    const isUrdu = receiptLang === 'ur';
    const itemsText = (sale.items || []).map(i => {
      const pName = isUrdu && i.product_name_urdu ? i.product_name_urdu : i.product_name;
      return i.weight_grams
        ? `• ${pName}%0A  ${i.weight_grams}g × Rs. ${Number(i.rate_per_kg || i.unit_price).toLocaleString()}/kg = Rs. ${Number(i.line_total).toLocaleString()}`
        : `• ${pName} x ${i.quantity} = Rs. ${Number(i.line_total).toLocaleString()}`;
    }).join('%0A');

    const header = isUrdu ? '*سویرا سویٹس اینڈ بیکرز*' : '*SAWERA SWEET %26 BAKERS*';
    const invLabel = isUrdu ? 'انوائس' : 'Invoice';
    const totLabel = isUrdu ? 'کل رقم' : 'Total';
    const footer = isUrdu ? '_سویرا سویٹس اینڈ بیکرز کا انتخاب کرنے کا شکریہ!_' : '_Thank you for visiting Sawera Sweet %26 Bakers!_';

    const text = `${header}%0A*${invLabel}:* ${sale.invoice_no}%0A*${isUrdu ? 'تاریخ' : 'Date'}:* ${new Date(sale.created_at || Date.now()).toLocaleDateString()}%0A%0A*${isUrdu ? 'تفصیل' : 'Items'}:*%0A${itemsText}%0A%0A*${totLabel}:* Rs. ${Number(sale.grand_total).toLocaleString()}%0A%0A${footer}`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  useEffect(() => {
    if (barcodeRef.current && sale?.invoice_no) {
      try {
        JsBarcode(barcodeRef.current, sale.invoice_no, {
          format: 'CODE128',
          width: 1.1,
          height: 18,
          displayValue: false,
          margin: 0
        });
      } catch (e) {
        console.error('Barcode render error:', e);
      }
    }
  }, [sale?.invoice_no, template]);

  useEffect(() => {
    if (autoPrint && !printedRef.current && sale?.id) {
      printedRef.current = true;
      const timer = setTimeout(() => {
        handlePrint();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [sale?.id, autoPrint]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!sale) return null;

  const handlePrint = () => {
    const printableElement = document.getElementById('printable-receipt-area');
    if (!printableElement) {
      window.print();
      return;
    }

    let iframe = document.getElementById('thermal-print-iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'thermal-print-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow || iframe.contentDocument;
    const iframeDoc = doc.document || doc;
    const receiptHtml = printableElement.innerHTML;

    iframeDoc.open();
    iframeDoc.write(`
      <!DOCTYPE html>
      <html dir="${isUrdu ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="utf-8">
          <title>Sawera Receipt #${sale.invoice_no}</title>
          <style>
            @page {
              size: ${template === 'thermal' ? '80mm auto' : 'A4'};
              margin: 0mm;
            }
            body {
              margin: 0;
              padding: ${template === 'thermal' ? '2mm 3mm' : '10mm'};
              color: #000;
              background: #fff;
              font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
              width: ${template === 'thermal' ? '72mm' : '100%'};
              box-sizing: border-box;
              font-size: ${template === 'thermal' ? '11px' : '12px'};
              line-height: 1.3;
              -webkit-font-smoothing: antialiased;
              text-rendering: optimizeLegibility;
            }
            * { box-sizing: border-box; }
            img { width: 62px !important; height: 62px !important; max-width: 62px !important; max-height: 62px !important; object-fit: cover !important; margin: 0 auto 5px auto !important; display: block !important; border-radius: 9999px !important; }
            svg { max-width: 100%; }
            .thermal-receipt {
              width: 72mm !important;
              max-width: 72mm !important;
              padding: 0 !important;
              margin: 0 auto !important;
              border: none !important;
              box-shadow: none !important;
              color: #000 !important;
              font-family: Arial, "Helvetica Neue", Helvetica, sans-serif !important;
            }
            .thermal-receipt table {
              width: 100% !important;
              border-collapse: collapse !important;
              border: 1px solid #000 !important;
            }
            .thermal-receipt th, .thermal-receipt td {
              border: 1px solid #000 !important;
            }
            .a4-invoice {
              width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-center { align-items: center; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .text-left { text-align: left; }
            .font-bold, .font-semibold { font-weight: bold; }
            .font-black { font-weight: 900; }
            .uppercase { text-transform: uppercase; }
            .space-y-0\\.5 > * + * { margin-top: 2px; }
            .border-t { border-top: 1px solid #000; }
            .border-b { border-bottom: 1px solid #000; }
            .border-dashed { border-style: dashed; }
          </style>
          ${Array.from(document.querySelectorAll('style, link[rel="stylesheet"]')).map(s => s.outerHTML).join('\n')}
        </head>
        <body>
          ${receiptHtml}
        </body>
      </html>
    `);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    }, 250);
  };

  const splitDetails = sale.split_details
    ? (typeof sale.split_details === 'string' ? JSON.parse(sale.split_details) : sale.split_details)
    : null;

  const isUrdu = receiptLang === 'ur';

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto invoice-modal-overlay"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh] invoice-modal-box"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Modal Header (Hidden during print) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <Printer className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              {isUrdu ? `انوائس #${sale.invoice_no}` : `Invoice #${sale.invoice_no}`}
            </h3>
          </div>

          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            {/* Language Selector: English | اردو */}
            <div className="bg-slate-200 p-0.5 rounded-lg flex text-xs font-bold">
              <button
                type="button"
                onClick={() => setReceiptLang('en')}
                className={`px-2 py-1 rounded-md transition ${receiptLang === 'en' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700'}`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setReceiptLang('ur')}
                className={`px-2 py-1 rounded-md transition font-urdu ${receiptLang === 'ur' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-700'}`}
              >
                اردو
              </button>
            </div>

            {/* Format Selector */}
            <div className="bg-slate-200 p-0.5 rounded-lg flex text-xs font-semibold">
              <button
                type="button"
                onClick={() => setTemplate('thermal')}
                className={`px-2.5 py-1 rounded-md transition ${template === 'thermal' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                {isUrdu ? 'تھرمل 80mm' : 'Thermal (80mm)'}
              </button>
              <button
                type="button"
                onClick={() => setTemplate('a4')}
                className={`px-2.5 py-1 rounded-md transition ${template === 'a4' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                {isUrdu ? 'A4 انوائس' : 'A4 Standard'}
              </button>
            </div>

            <button
              onClick={shareOnWhatsApp}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
              title="Share digital invoice on WhatsApp"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>

            <button
              onClick={handlePrint}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isUrdu ? 'پرنٹ کریں' : 'Print Now'}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div id="printable-receipt-area" className="p-4 overflow-y-auto flex-1 bg-slate-100 flex justify-center invoice-printable-wrapper">
          
          {/* THERMAL 80MM TEMPLATE (Exact Replica of Reference POS Receipt) */}
          {template === 'thermal' && (
            <div
              dir={isUrdu ? 'rtl' : 'ltr'}
              className="thermal-receipt bg-white p-3 shadow-sm w-full max-w-[320px] text-black leading-tight border border-slate-300 rounded-lg"
              style={{ fontFamily: 'Arial, "Helvetica Neue", Helvetica, sans-serif' }}
            >
              
              {/* Receipt Header: Circular Logo, Name, Address, Phone, POS No */}
              <div className="text-center pb-2">
                <img
                  src="/logo.png"
                  alt="Sawera Sweets & Bakers"
                  className="w-[62px] h-[62px] rounded-full object-cover mx-auto mb-1 border border-black/20"
                />
                <h2 className="text-sm font-black tracking-wide text-black uppercase">
                  {isUrdu ? 'سویرا سویٹس اینڈ بیکرز' : 'Sawera Sweets & Bakers'}
                </h2>
                <p className="text-[10px] text-black mt-0.5 font-medium">
                  {sale.branch_address && !sale.branch_address.includes('Rawalpindi') ? sale.branch_address : (isUrdu ? 'گوجرہ روڈ بالمقابل ڈی ایچ کیو ہسپتال' : 'Gojra Road opp DHQ Hospital')}
                </p>
                <p className="text-[10px] text-black font-semibold">
                  Cell: 0322-7434080
                </p>
                <p className="text-[10px] text-black">
                  POS No: {sale.branch_id || 1}
                </p>
              </div>

              {/* Order Meta Header: Receipt No, Date, Mop */}
              <div className="text-[10.5px] text-black pt-1 mb-1 space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-[11px]">Receipt No: {sale.invoice_no}</span>
                  <span>Mop : {sale.payment_method ? sale.payment_method.toUpperCase() : 'CASH'} Sales</span>
                </div>
                <div>
                  Date: {new Date(sale.created_at || Date.now()).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')} {new Date(sale.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>

              {/* TABLE WITH REAL BORDERS (Sr. | Product | Price | Qty | Disc | Total) */}
              <table className="w-full border-collapse border border-black text-[10px] my-1">
                <thead>
                  <tr className="border-b border-black">
                    <th className="border-r border-black p-0.5 text-center w-[8%] font-bold">Sr.</th>
                    <th className="border-r border-black p-0.5 px-1 text-left rtl:text-right w-[44%] font-bold">Product</th>
                    <th className="border-r border-black p-0.5 text-right rtl:text-left w-[16%] font-bold">Price</th>
                    <th className="border-r border-black p-0.5 text-center w-[10%] font-bold">Qty</th>
                    <th className="border-r border-black p-0.5 text-right rtl:text-left w-[10%] font-bold">Disc</th>
                    <th className="p-0.5 text-right rtl:text-left w-[12%] font-bold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(sale.items || []).map((item, idx) => (
                    <tr key={idx} className="border-b border-black">
                      <td className="border-r border-black p-0.5 text-center">{idx + 1}</td>
                      <td className="border-r border-black p-0.5 px-1 text-left rtl:text-right">
                        <div className="font-semibold">{isUrdu && item.product_name_urdu ? item.product_name_urdu : item.product_name}</div>
                        {item.weight_grams && (
                          <div className="text-[8.5px] text-gray-700">({item.weight_grams}g @ Rs.{item.rate_per_kg}/kg)</div>
                        )}
                      </td>
                      <td className="border-r border-black p-0.5 text-right rtl:text-left">{Number(item.unit_price).toFixed(2)}</td>
                      <td className="border-r border-black p-0.5 text-center">{item.quantity}</td>
                      <td className="border-r border-black p-0.5 text-right rtl:text-left">{Number(item.discount_amount || 0).toFixed(0)}</td>
                      <td className="p-0.5 text-right rtl:text-left font-semibold">{Number(item.line_total).toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold border-t border-black">
                    <td colSpan="3" className="border-r border-black p-0.5 px-1 text-left rtl:text-right">Gross Total:</td>
                    <td className="border-r border-black p-0.5 text-center">
                      {(sale.items || []).reduce((acc, i) => acc + (Number(i.quantity) || 0), 0)}
                    </td>
                    <td className="border-r border-black p-0.5 text-right rtl:text-left">
                      {(sale.items || []).reduce((acc, i) => acc + (Number(i.discount_amount) || 0), 0).toFixed(0)}
                    </td>
                    <td className="p-0.5 text-right rtl:text-left">
                      {(sale.items || []).reduce((acc, i) => acc + (Number(i.line_total) || 0), 0).toFixed(0)}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Totals Section */}
              <div className="text-[10.5px] text-black pt-1 space-y-0.5">
                {Number(sale.tax_amount) > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>Value Excluding Sales Tax:</span>
                      <span className="font-semibold">{(Number(sale.grand_total) - Number(sale.tax_amount)).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Sales Tax :</span>
                      <span className="font-semibold">{Number(sale.tax_amount).toFixed(2)}</span>
                    </div>
                  </>
                )}

                {Number(sale.discount_amount) > 0 && (
                  <div className="flex justify-between">
                    <span>Discount :</span>
                    <span className="font-semibold">-{Number(sale.discount_amount).toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between font-black text-xs pt-1 border-t border-black">
                  <span>Net Total {Number(sale.tax_amount) > 0 ? '(Including Sales Tax)' : ''}:</span>
                  <span className="text-sm font-black">{Number(sale.grand_total || 0).toFixed(0)}</span>
                </div>

                <div className="flex justify-between font-semibold pt-0.5">
                  <span>Cash:</span>
                  <span>{Number(sale.paid_amount || sale.grand_total || 0).toFixed(2)}</span>
                </div>

                <div className="flex justify-between font-semibold">
                  <span>Balance:</span>
                  <span>{Number(sale.change_amount || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Clean Footer */}
              <div className="pt-2 text-center border-t border-dashed border-black mt-2">
                <p className="text-[11px] font-bold tracking-wide uppercase">
                  THANKS FOR SHOPPING!
                </p>
              </div>

            </div>
          )}

          {/* A4 INVOICE TEMPLATE */}
          {template === 'a4' && (
            <div
              dir={isUrdu ? 'rtl' : 'ltr'}
              className={`a4-invoice bg-white p-8 shadow-sm w-full max-w-2xl text-slate-900 border border-slate-200 rounded-lg ${
                isUrdu ? 'font-urdu' : 'font-sans'
              }`}
            >
              <div className="flex justify-between items-start border-b-2 border-emerald-600 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden border border-emerald-600/40 shrink-0 bg-white shadow-xs">
                    <img src="/logo.png" alt="Sawera Sweets & Bakers" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    {isUrdu ? (
                      <h1 className="text-2xl font-black text-emerald-800">
                        سویرا سویٹس اینڈ بیکرز
                      </h1>
                    ) : (
                      <h1 className="text-2xl font-black text-emerald-800 tracking-tight">
                        SAWERA SWEET &amp; BAKERS
                      </h1>
                    )}
                  <p className="text-xs font-semibold text-slate-600 mt-1">
                    {sale.branch_address && !sale.branch_address.includes('Rawalpindi') ? sale.branch_address : 'Gojra Road opp DHQ Hospital'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isUrdu ? 'فون: ' : 'Phone: '}0322-7434080
                  </p>
                </div>
              </div>
              <div className="text-right rtl:text-left">
                  <div className="bg-amber-100 text-amber-900 font-bold px-3 py-1 rounded-md text-xs uppercase tracking-wider inline-block">
                    {isUrdu ? 'سیلز انوائس' : 'Sales Invoice'}
                  </div>
                  <p className="text-sm font-extrabold text-slate-800 mt-2 font-mono">
                    {sale.invoice_no}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(sale.created_at || Date.now()).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Customer / Transaction Info */}
              <div className="grid grid-cols-2 gap-4 py-4 text-xs border-b border-slate-200">
                <div>
                  <p className="text-slate-500 font-semibold uppercase text-[10px]">
                    {isUrdu ? 'گاہک کی معلومات:' : 'Customer Details:'}
                  </p>
                  <p className="font-bold text-sm text-slate-800">{sale.customer_name || (isUrdu ? 'عام گاہک' : 'Walk-in Customer')}</p>
                  {sale.customer_phone && <p className="text-slate-600">{isUrdu ? 'فون: ' : 'Phone: '}{sale.customer_phone}</p>}
                </div>
                <div className="text-right rtl:text-left">
                  <p className="text-slate-500 font-semibold uppercase text-[10px]">
                    {isUrdu ? 'معاملہ کی تفصیل:' : 'Transaction Info:'}
                  </p>
                  <p className="font-semibold text-slate-700 uppercase">{isUrdu ? 'ادائیگی: ' : 'Payment: '}{sale.payment_method}</p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-xs text-left rtl:text-right my-4">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold border-b border-slate-200">
                    <th className="py-2 px-3">#</th>
                    <th className="py-2 px-3">{isUrdu ? 'تفصیل آئٹم' : 'Description'}</th>
                    <th className="py-2 px-3 text-center">{isUrdu ? 'یونٹ' : 'Unit'}</th>
                    <th className="py-2 px-3 text-center">{isUrdu ? 'تعداد' : 'Qty'}</th>
                    <th className="py-2 px-3 text-right rtl:text-left">{isUrdu ? 'قیمت' : 'Unit Price'}</th>
                    <th className="py-2 px-3 text-right rtl:text-left">{isUrdu ? 'کل رقم' : 'Total (PKR)'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(sale.items || []).map((item, idx) => {
                    const itemName = isUrdu && item.product_name_urdu ? item.product_name_urdu : item.product_name;
                    return (
                      <tr key={idx}>
                        <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          <div>{itemName}</div>
                          {item.weight_grams && (
                            <div className="text-[11px] text-amber-800 font-mono font-bold mt-0.5">
                              {isUrdu
                                ? `${item.weight_grams} گرام × ${Number(item.rate_per_kg || item.unit_price).toLocaleString()} روپے/کلو`
                                : `${item.weight_grams}g × Rs. ${Number(item.rate_per_kg || item.unit_price).toLocaleString()}/kg`}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-slate-500">
                          {isUrdu ? (item.weight_grams ? 'کلوگرام' : 'عدد') : (item.weight_grams ? 'Kg' : (item.unit || 'Piece'))}
                        </td>
                        <td className="py-2 px-3 text-center font-bold font-mono">
                          {item.weight_grams ? (isUrdu ? `${item.weight_grams} گرام` : `${item.weight_grams}g`) : item.quantity}
                        </td>
                        <td className="py-2 px-3 text-right rtl:text-left font-mono">
                          Rs. {Number(item.rate_per_kg || item.unit_price).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-right rtl:text-left font-bold text-slate-900 font-mono">
                          Rs. {Number(item.line_total).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Totals Box */}
              <div className="flex justify-end pt-4 border-t border-slate-200">
                <div className="w-64 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">{isUrdu ? 'سب ٹوٹل:' : 'Subtotal:'}</span>
                    <span className="font-semibold font-mono">Rs. {Number(sale.subtotal || 0).toLocaleString()}</span>
                  </div>
                  {Number(sale.discount_amount) > 0 && (
                    <div className="flex justify-between text-rose-600">
                      <span>{isUrdu ? 'رعایت:' : 'Discount:'}</span>
                      <span className="font-mono">- Rs. {Number(sale.discount_amount).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(sale.exchange_credit_used) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>{isUrdu ? 'تبادلہ کریڈٹ:' : 'Exchange Credit:'}</span>
                      <span className="font-mono">- Rs. {Number(sale.exchange_credit_used).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(sale.tax_amount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">{isUrdu ? 'ٹیکس:' : 'Tax / GST:'}</span>
                      <span className="font-mono">Rs. {Number(sale.tax_amount).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-extrabold text-amber-700 pt-2 border-t border-slate-300">
                    <span>{isUrdu ? 'کل واجب الادا رقم:' : 'Grand Total:'}</span>
                    <span className="font-mono">Rs. {Number(sale.grand_total || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>{isUrdu ? 'وصول شدہ رقم:' : 'Amount Paid:'}</span>
                    <span className="font-mono">Rs. {Number(sale.paid_amount || 0).toLocaleString()}</span>
                  </div>
                  {Number(sale.change_amount) > 0 && (
                    <div className="flex justify-between text-emerald-700 font-semibold">
                      <span>{isUrdu ? 'بقایا واپس:' : 'Change Returned:'}</span>
                      <span className="font-mono">Rs. {Number(sale.change_amount).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
                {isUrdu ? (
                  <p className="font-urdu font-bold text-sm text-slate-800">
                    سویرا سویٹس اینڈ بیکرز تشریف لانے کا شکریہ!
                  </p>
                ) : (
                  <p className="font-semibold text-slate-700">
                    Thank you for your visit to Sawera Sweet &amp; Bakers!
                  </p>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Action Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 no-print">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <X className="w-4 h-4" />
            <span>{isUrdu ? 'بند کریں (Close)' : 'Close (Esc)'}</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Printer className="w-4 h-4" />
            <span>{isUrdu ? 'دوبارہ پرنٹ کریں' : 'Print Again'}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isUrdu ? 'مکمل / نیا بل (Done)' : 'Done / New Sale'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
