'use client';

import { Printer, CheckCircle, Download, ArrowRight, X } from 'lucide-react';
import type { CartItem } from '@/types';

interface ReceiptModalProps {
  saleNumber: string;
  cart: CartItem[];
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  paymentMethod: 'cash' | 'card' | 'qr';
  cashReceived?: number;
  change?: number;
  cashierName?: string;
  customerName?: string;
  date?: string;
  onClose: () => void;
}

export default function ReceiptModal({
  saleNumber,
  cart,
  subtotal,
  tax,
  discount,
  total,
  paymentMethod,
  cashReceived,
  change = 0,
  cashierName = 'Cashier',
  customerName = 'Walk-in Customer',
  date = new Date().toLocaleString(),
  onClose,
}: ReceiptModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const textReceipt = `
========================================
               STORE POS                
       100 Commerce Way, Suite 200      
            Tel: (555) 019-2834         
========================================
Receipt: ${saleNumber}
Date:    ${date}
Cashier: ${cashierName}
Customer:${customerName}
----------------------------------------
ITEMS:
${cart
  .map(
    (item) =>
      `${item.product_name.slice(0, 20).padEnd(20)} x${item.quantity.toString().padStart(2)} $${(
        item.unit_price * item.quantity
      ).toFixed(2)}`
  )
  .join('\n')}
----------------------------------------
Subtotal:          $${subtotal.toFixed(2)}
Discount:         -$${discount.toFixed(2)}
Tax (10%):         $${tax.toFixed(2)}
TOTAL:             $${total.toFixed(2)}
----------------------------------------
Payment Method:    ${paymentMethod.toUpperCase()}
${paymentMethod === 'cash' ? `Cash Tendered:     $${(cashReceived || total).toFixed(2)}\nChange Returned:   $${change.toFixed(2)}` : ''}
========================================
       THANK YOU FOR YOUR VISIT!        
========================================
`;
    const blob = new Blob([textReceipt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${saleNumber}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 shadow-xs flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base text-gray-900 leading-tight">Payment Complete</h2>
              <p className="text-xs text-gray-500 font-mono">Receipt #{saleNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#f3f4f6]">
          {/* Printable Receipt Container (Crisp White Slip) */}
          <div
            id="printable-receipt"
            className="bg-white p-5 rounded-lg shadow-xs font-mono text-xs text-gray-800"
          >
            {/* Store Info */}
            <div className="text-center border-b border-dashed border-gray-200 pb-3 mb-3">
              <h3 className="font-bold text-sm tracking-wider uppercase text-gray-900">
                ✦ STORE POS ✦
              </h3>
              <p className="text-gray-500 text-[11px] mt-0.5">
                100 Commerce Way, Suite 200
              </p>
              <p className="text-gray-500 text-[11px]">Tel: (555) 019-2834</p>
            </div>

            {/* Metadata */}
            <div className="space-y-1 mb-3 text-[11px] border-b border-dashed border-gray-200 pb-3 text-gray-600">
              <div className="flex justify-between">
                <span>Receipt:</span>
                <span className="font-bold text-gray-900">{saleNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{date}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{cashierName}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer:</span>
                <span>{customerName}</span>
              </div>
            </div>

            {/* Items List */}
            <div className="space-y-2 mb-3 border-b border-dashed border-gray-200 pb-3">
              <div className="flex justify-between font-bold text-gray-400 text-[10px] uppercase">
                <span>Item</span>
                <span>Amount</span>
              </div>
              {cart.map((item) => (
                <div key={item.product_id} className="flex justify-between items-start">
                  <div className="flex-1 pr-2">
                    <p className="font-medium text-gray-900 leading-tight">
                      {item.product_name}
                    </p>
                    <p className="text-gray-400 text-[10px]">
                      {item.quantity} × ${item.unit_price.toFixed(2)}
                    </p>
                  </div>
                  <span className="font-bold text-gray-900 tabular-nums">
                    ${(item.unit_price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            {/* Calculations */}
            <div className="space-y-1 text-xs border-b border-dashed border-gray-200 pb-3 mb-3">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Discount</span>
                  <span className="tabular-nums">-${discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600">
                <span>Tax (10%)</span>
                <span className="tabular-nums">${tax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-100">
                <span>TOTAL</span>
                <span className="tabular-nums">${total.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="space-y-1 text-[11px] mb-4 text-gray-600">
              <div className="flex justify-between">
                <span>Payment Method</span>
                <span className="font-bold uppercase text-gray-900">
                  {paymentMethod}
                </span>
              </div>
              {paymentMethod === 'cash' && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Tendered</span>
                    <span className="tabular-nums">${(cashReceived || total).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700">
                    <span>Change Returned</span>
                    <span className="tabular-nums">${change.toFixed(2)}</span>
                  </div>
                </>
              )}
            </div>

            {/* Fake Barcode Graphic */}
            <div className="text-center pt-2">
              <div className="inline-block tracking-widest text-gray-800 select-none text-base">
                ||| | |||| | ||| |||| | || ||||| | ||
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Thank you for shopping with us!</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white shadow-xs flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 btn btn-secondary rounded-md flex items-center justify-center gap-2 py-3"
            title="Print receipt"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
          <button
            onClick={handleDownload}
            className="btn btn-secondary rounded-md flex items-center justify-center gap-2 py-3 px-3.5"
            title="Download text file"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={onClose}
            className="flex-1 btn btn-primary rounded-md flex items-center justify-center gap-2 py-3"
          >
            <span>Next Customer</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
