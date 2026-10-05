import React, { useEffect, useRef, useState } from 'react';
import { X, Printer, Barcode as BarcodeIcon } from 'lucide-react';
import JsBarcode from 'jsbarcode';

export function BarcodeLabelModal({ product, onClose }) {
  const [copies, setCopies] = useState(6);
  const barcodeValue = product?.barcode || product?.code || '896400000000';

  useEffect(() => {
    // Render barcodes for all copies
    for (let i = 0; i < copies; i++) {
      const el = document.getElementById(`barcode-label-${i}`);
      if (el) {
        try {
          JsBarcode(el, barcodeValue, {
            format: 'CODE128',
            width: 1.4,
            height: 35,
            displayValue: true,
            fontSize: 11,
            margin: 2
          });
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [product, copies, barcodeValue]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto barcode-labels-print-modal">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] barcode-labels-print-modal">
        
        {/* Header (No Print) */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <BarcodeIcon className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">
              Print Barcode Labels: {product.name}
            </h3>
          </div>

          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="flex items-center space-x-1 rtl:space-x-reverse text-xs">
              <span className="font-semibold text-slate-600">Copies:</span>
              <input
                type="number"
                min="1"
                max="100"
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1 text-xs font-bold border border-slate-300 rounded-md text-center"
              />
            </div>

            <button
              onClick={() => window.print()}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Stickers</span>
            </button>

            <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Grid of Labels */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-100 flex justify-center barcode-labels-print-modal">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white shadow-sm border border-slate-200 rounded-xl w-full barcode-labels-grid">
            {Array.from({ length: copies }).map((_, idx) => (
              <div
                key={idx}
                className="border border-slate-300 rounded-lg p-2.5 flex flex-col items-center justify-center text-center bg-white shadow-2xs hover:border-amber-400 transition barcode-sticker"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-tight text-amber-700">
                  Sawera Sweet &amp; Bakers
                </p>
                <p className="text-xs font-bold text-slate-900 truncate max-w-full my-0.5">
                  {product.name}
                </p>
                <div className="my-1 flex justify-center w-full">
                  <svg id={`barcode-label-${idx}`} className="max-w-full" />
                </div>
                <div className="flex items-center justify-between w-full text-[11px] font-extrabold text-slate-900 border-t border-slate-100 pt-1">
                  <span className="text-[9px] text-slate-500">{product.code}</span>
                  <span className="text-amber-700">Rs. {Number(product.sale_price).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
