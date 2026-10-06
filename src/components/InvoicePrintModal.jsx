import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Printer, X, FileText, CheckCircle2, Share2, Globe } from 'lucide-react';
import JsBarcode from 'jsbarcode';

export function InvoicePrintModal({ sale, onClose, autoPrint = false }) {
  const { lang: systemLang } = useAuth();
  const [template, setTemplate] = useState('thermal'); // 'thermal' (80mm) or 'a4'
  const [receiptLang, setReceiptLang] = useState(systemLang || 'en'); // 'en' or 'ur'
  const barcodeRef = useRef(null);

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
          width: 1.5,
          height: 35,
          displayValue: true,
          fontSize: 10,
          margin: 0
        });
      } catch (e) {
        console.error('Barcode render error:', e);
      }
    }

    if (autoPrint) {
      setTimeout(() => {
        window.print();
      }, 400);
    }
  }, [sale, template, receiptLang, autoPrint]);

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const splitDetails = sale.split_details
    ? (typeof sale.split_details === 'string' ? JSON.parse(sale.split_details) : sale.split_details)
    : null;

  const isUrdu = receiptLang === 'ur';

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[95vh]">
        
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
        <div className="p-4 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
          
          {/* THERMAL 80MM TEMPLATE */}
          {template === 'thermal' && (
            <div
              dir={isUrdu ? 'rtl' : 'ltr'}
              className={`thermal-receipt bg-white p-4 shadow-sm w-full max-w-[340px] text-slate-900 leading-tight border border-slate-200 rounded-lg ${
                isUrdu ? 'font-urdu text-[13px]' : 'font-mono text-[12px]'
              }`}
            >
              
              {/* Receipt Header */}
              <div className="text-center pb-2 border-b border-dashed border-slate-400">
                <div className="w-14 h-14 rounded-full overflow-hidden mx-auto mb-1.5 border border-slate-300 bg-white">
                  <img src="/logo.png" alt="Sawera Sweets & Bakers" className="w-full h-full object-cover" />
                </div>
                {isUrdu ? (
                  <h2 className="text-xl font-black text-slate-900">
                    سویرا سویٹس اینڈ بیکرز
                  </h2>
                ) : (
                  <h2 className="text-base font-extrabold tracking-wider uppercase font-sans">
                    SAWERA SWEET &amp; BAKERS
                  </h2>
                )}
                
                <p className="text-[11px] font-semibold mt-1">
                  {sale.branch_name || (isUrdu ? 'صدر برانچ' : 'Main Saddar Branch')}
                </p>
                <p className="text-[10px] text-slate-600">
                  {sale.branch_address || (isUrdu ? 'صدر بازار، راولپنڈی' : 'Saddar Bazar, Rawalpindi')}
                </p>
                <p className="text-[10px] text-slate-600">
                  {isUrdu ? 'فون: ' : 'Phone: '}{sale.branch_phone || '051-5551234'}
                </p>
              </div>

              {/* Receipt Metadata */}
              <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-0.5">
                <div className="flex justify-between">
                  <span>{isUrdu ? 'انوائس نمبر:' : 'Invoice:'}</span>
                  <span className="font-bold font-mono">{sale.invoice_no}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isUrdu ? 'تاریخ و وقت:' : 'Date/Time:'}</span>
                  <span>{new Date(sale.created_at || Date.now()).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>{isUrdu ? 'کیشیئر:' : 'Cashier:'}</span>
                  <span>{sale.cashier_name || (isUrdu ? 'کیشیئر' : 'Cashier')}</span>
                </div>
                {sale.customer_name && (
                  <div className="flex justify-between text-slate-800 font-bold">
                    <span>{isUrdu ? 'گاہک:' : 'Customer:'}</span>
                    <span>{sale.customer_name} {sale.customer_phone ? `(${sale.customer_phone})` : ''}</span>
                  </div>
                )}
              </div>

              {/* Line Items Table */}
              <div className="py-2 border-b border-dashed border-slate-400">
                <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-slate-300">
                  <span className="w-1/2">{isUrdu ? 'آئٹم' : 'Item'}</span>
                  <span className="w-1/6 text-center">{isUrdu ? 'تعداد' : 'Qty'}</span>
                  <span className="w-1/6 text-right rtl:text-left">{isUrdu ? 'ریٹ' : 'Rate'}</span>
                  <span className="w-1/6 text-right rtl:text-left">{isUrdu ? 'کل رقم' : 'Total'}</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {(sale.items || []).map((item, idx) => {
                    const itemName = isUrdu && item.product_name_urdu ? item.product_name_urdu : item.product_name;
                    return (
                      <div key={idx} className="py-1.5 text-[11px]">
                        {item.weight_grams ? (
                          <div>
                            <div className="font-bold text-slate-900 truncate">
                              {itemName}
                            </div>
                            <div className="flex justify-between items-center text-[11px] font-mono text-slate-800 mt-0.5">
                              <span className="font-semibold text-slate-600">
                                {isUrdu
                                  ? `${item.weight_grams} گرام × ${Number(item.rate_per_kg || item.unit_price).toLocaleString()} روپے/کلو`
                                  : `${item.weight_grams}g × Rs. ${Number(item.rate_per_kg || item.unit_price).toLocaleString()}/kg`}
                              </span>
                              <span className="font-black text-slate-900">
                                {isUrdu ? `${Number(item.line_total).toLocaleString()} روپے` : `Rs. ${Number(item.line_total).toLocaleString()}`}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-900 truncate">
                              {itemName}
                            </div>
                            <div className="flex justify-between text-slate-600 text-[10px]">
                              <span className="w-1/2 text-slate-500">{isUrdu ? (item.unit === 'Piece' ? 'عدد' : item.unit) : (item.unit || 'Piece')}</span>
                              <span className="w-1/6 text-center font-mono">{item.quantity}</span>
                              <span className="w-1/6 text-right rtl:text-left font-mono">
                                {Number(item.unit_price).toLocaleString()}
                              </span>
                              <span className="w-1/6 text-right rtl:text-left font-bold text-slate-900 font-mono">
                                {Number(item.line_total).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="py-2 border-b border-dashed border-slate-400 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>{isUrdu ? 'سب ٹوٹل:' : 'Subtotal:'}</span>
                  <span className="font-mono">Rs. {Number(sale.subtotal || 0).toLocaleString()}</span>
                </div>
                {Number(sale.discount_amount) > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
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
                    <span>{isUrdu ? 'ٹیکس:' : 'Tax / GST:'}</span>
                    <span className="font-mono">Rs. {Number(sale.tax_amount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-slate-300">
                  <span>{isUrdu ? 'کل واجب الادا رقم:' : 'GRAND TOTAL:'}</span>
                  <span className="font-mono text-amber-700">Rs. {Number(sale.grand_total || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Payment Details */}
              <div className="py-2 border-b border-dashed border-slate-400 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>{isUrdu ? 'ادائیگی کا طریقہ:' : 'Payment Mode:'}</span>
                  <span className="font-bold uppercase text-amber-800">
                    {isUrdu
                      ? (sale.payment_method === 'cash' ? 'نقد' : sale.payment_method === 'split' ? 'مشترکہ رقم' : sale.payment_method === 'credit' ? 'ادھار کھاتہ' : sale.payment_method)
                      : sale.payment_method}
                  </span>
                </div>
                {splitDetails && (
                  <div className="text-[10px] bg-slate-50 p-1 rounded space-y-0.5">
                    {splitDetails.cash && <div>{isUrdu ? 'نقد:' : 'Cash:'} Rs. {splitDetails.cash}</div>}
                    {splitDetails.easypaisa && <div>{isUrdu ? 'ایزی پیسہ:' : 'Easypaisa:'} Rs. {splitDetails.easypaisa}</div>}
                    {splitDetails.card && <div>{isUrdu ? 'کارڈ:' : 'Card:'} Rs. {splitDetails.card}</div>}
                    {splitDetails.bank && <div>{isUrdu ? 'بینک:' : 'Bank:'} Rs. {splitDetails.bank}</div>}
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{isUrdu ? 'وصول شدہ رقم:' : 'Amount Paid:'}</span>
                  <span className="font-mono">Rs. {Number(sale.paid_amount || 0).toLocaleString()}</span>
                </div>
                {Number(sale.change_amount) > 0 && (
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>{isUrdu ? 'بقایا واپس:' : 'Change Return:'}</span>
                    <span className="font-mono">Rs. {Number(sale.change_amount).toLocaleString()}</span>
                  </div>
                )}
                {Number(sale.credit_amount) > 0 && (
                  <div className="flex justify-between font-bold text-rose-700">
                    <span>{isUrdu ? 'ادھار میں شامل:' : 'Added to Credit:'}</span>
                    <span className="font-mono">Rs. {Number(sale.credit_amount).toLocaleString()}</span>
                  </div>
                )}
                {sale.customer_id && sale.customer_balance !== undefined && (
                  <div className="flex justify-between text-[10px] text-slate-600 pt-0.5">
                    <span>{isUrdu ? 'گاہک کا کل ادھار:' : 'Customer Udhaar Balance:'}</span>
                    <span className="font-bold font-mono">Rs. {Number(sale.customer_balance).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Barcode & Footer */}
              <div className="pt-3 text-center space-y-2">
                <div className="flex justify-center">
                  <svg ref={barcodeRef} className="max-w-[200px]" />
                </div>
                {isUrdu ? (
                  <div className="font-urdu font-bold text-sm text-slate-800">
                    سویرا سویٹس اینڈ بیکرز تشریف لانے کا شکریہ!
                  </div>
                ) : (
                  <p className="text-[11px] font-bold text-slate-800 font-sans">
                    Thank You for Visiting Sawera Sweet &amp; Bakers!
                  </p>
                )}
                <p className="text-[9px] text-slate-400">
                  Sawera POS &amp; Store Management System
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
                    {sale.branch_name} | {sale.branch_address}
                  </p>
                  <p className="text-xs text-slate-500">
                    {isUrdu ? 'فون: ' : 'Phone: '}{sale.branch_phone || '051-5551234'} | NTN: 8765432-1
                  </p>
                </div>
              </div>
              <div className="text-right rtl:text-left">
                  <div className="bg-amber-100 text-amber-900 font-bold px-3 py-1 rounded-md text-xs uppercase tracking-wider inline-block">
                    {isUrdu ? 'سیلز ٹیکس انوائس' : 'Retail Tax Invoice'}
                  </div>
                  <p className="text-sm font-extrabold text-slate-800 mt-2 font-mono">
                    {sale.invoice_no}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(sale.created_at || Date.now()).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Customer / Cashier Info */}
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
                  <p className="font-semibold text-slate-700">{isUrdu ? 'کیشیئر: ' : 'Cashier: '}{sale.cashier_name || 'Staff'}</p>
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

      </div>
    </div>
  );
}
