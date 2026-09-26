'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { salesAPI, paymentsAPI } from '@/lib/api';
import { savePendingSale } from '@/lib/db';
import { sound } from '@/lib/sound';
import toast from 'react-hot-toast';
import type { CartItem, CreateSaleRequest, Sale } from '@/types';
import StripePayment from './StripePayment';
import {
  Banknote,
  CreditCard,
  QrCode,
  X,
  User,
  CheckCircle2,
  AlertCircle,
  Delete,
  WifiOff,
} from 'lucide-react';

interface CheckoutModalProps {
  cart: CartItem[];
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  onClose: () => void;
  onComplete: (saleData: {
    saleNumber: string;
    cart: CartItem[];
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    paymentMethod: 'cash' | 'card' | 'qr';
    cashReceived?: number;
    change?: number;
    customerName?: string;
  }) => void;
  isOnline: boolean;
}

export default function CheckoutModal({
  cart,
  total,
  subtotal,
  tax,
  discount,
  onClose,
  onComplete,
  isOnline,
}: CheckoutModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'qr'>('cash');
  const [cashReceived, setCashReceived] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [showCustomerDetails, setShowCustomerDetails] = useState<boolean>(false);
  const [showStripeForm, setShowStripeForm] = useState<boolean>(false);
  const [createdSale, setCreatedSale] = useState<Sale | null>(null);

  const queryClient = useQueryClient();

  // Cash calculations
  const parsedCash = parseFloat(cashReceived || '0');
  const change = Math.max(0, parsedCash - total);
  const remaining = Math.max(0, total - parsedCash);
  const isCashSufficient = parsedCash >= total;

  // Keypad press handler
  const handleKeypadPress = (val: string) => {
    if (val === 'CLEAR') {
      setCashReceived('');
      return;
    }
    if (val === 'BACK') {
      setCashReceived((prev) => prev.slice(0, -1));
      return;
    }
    if (val === '.') {
      if (cashReceived.includes('.')) return;
      setCashReceived((prev) => (prev === '' ? '0.' : prev + '.'));
      return;
    }
    setCashReceived((prev) => prev + val);
  };

  // Quick denomination click
  const handleSetExactCash = () => {
    setCashReceived(total.toFixed(2));
  };

  const handleSetPresetCash = (amount: number) => {
    setCashReceived(amount.toFixed(2));
  };

  const handleAddCash = (amount: number) => {
    const current = parseFloat(cashReceived || '0');
    setCashReceived((current + amount).toFixed(2));
  };

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (saleData: CreateSaleRequest) => {
      if (!isOnline) {
        const offlineSaleNumber = 'REC-' + Math.floor(100000 + Math.random() * 900000);
        const offlineSale = {
          ...saleData,
          id: Date.now(),
          sale_number: offlineSaleNumber,
          total_amount: total,
          subtotal,
          tax_amount: tax,
          discount_amount: discount,
          created_at: new Date().toISOString(),
          payment_status: 'completed' as const,
        };
        await savePendingSale(offlineSale as unknown as Sale);
        return offlineSale as unknown as Sale;
      }
      const response = await salesAPI.create(saleData);
      return response.data;
    },
    onSuccess: (sale) => {
      setCreatedSale(sale);
      if (paymentMethod === 'cash' || paymentMethod === 'qr') {
        finalizeNonCardSale(sale);
      } else if (paymentMethod === 'card') {
        setShowStripeForm(true);
      }
    },
    onError: (error: any) => {
      sound.error();
      toast.error(error.response?.data?.error || 'Failed to process payment');
    },
  });

  const finalizeNonCardSale = async (sale: Sale) => {
    try {
      if (paymentMethod === 'cash') {
        if (isOnline) {
          await paymentsAPI.processCash({
            sale_id: sale.id,
            amount: total,
            received_amount: parsedCash,
            change_amount: change,
          });
        }
      } else if (paymentMethod === 'qr') {
        if (isOnline) {
          await paymentsAPI.processQR({
            sale_id: sale.id,
            amount: total,
            qr_transaction_id: `QR-${Date.now()}`,
            provider: 'merchant_qr',
          });
        }
      }

      sound.success();
      toast.success('Sale completed!');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sales_history'] });

      onComplete({
        saleNumber: sale.sale_number || `REC-${Date.now()}`,
        cart,
        subtotal,
        tax,
        discount,
        total,
        paymentMethod,
        cashReceived: parsedCash || total,
        change,
        customerName: customerName.trim() || 'Walk-in Customer',
      });
    } catch {
      sound.success();
      toast.success('Sale saved offline');
      onComplete({
        saleNumber: sale.sale_number || `REC-${Date.now()}`,
        cart,
        subtotal,
        tax,
        discount,
        total,
        paymentMethod,
        cashReceived: parsedCash || total,
        change,
        customerName: customerName.trim() || 'Walk-in Customer',
      });
    }
  };

  // Submit checkout
  const handleCheckout = async () => {
    if (paymentMethod === 'cash' && !isCashSufficient) {
      sound.error();
      toast.error(`Short by $${remaining.toFixed(2)}`);
      return;
    }

    const salePayload: CreateSaleRequest = {
      items: cart,
      payment_method: paymentMethod,
      discount_amount: discount,
      customer_name: customerName.trim() || 'Walk-in Customer',
      customer_phone: customerPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    await createSaleMutation.mutateAsync(salePayload);
  };

  // Simulated card payment
  const handleSimulatedCardPay = async () => {
    const salePayload: CreateSaleRequest = {
      items: cart,
      payment_method: 'card',
      discount_amount: discount,
      customer_name: customerName.trim() || 'Walk-in Customer',
      customer_phone: customerPhone.trim() || undefined,
      notes: notes.trim() || undefined,
    };

    try {
      const sale = await createSaleMutation.mutateAsync(salePayload);
      sound.success();
      toast.success('Card Approved');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['sales_history'] });

      onComplete({
        saleNumber: sale.sale_number || `REC-${Date.now()}`,
        cart,
        subtotal,
        tax,
        discount,
        total,
        paymentMethod: 'card',
        customerName: customerName.trim() || 'Walk-in Customer',
      });
    } catch (err: any) {
      toast.error(err.message || 'Payment simulation failed');
    }
  };

  // Stripe success
  const handleStripeSuccess = () => {
    sound.success();
    toast.success('Stripe Payment Approved');
    queryClient.invalidateQueries({ queryKey: ['products'] });
    queryClient.invalidateQueries({ queryKey: ['sales_history'] });

    onComplete({
      saleNumber: createdSale?.sale_number || `REC-${Date.now()}`,
      cart,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod: 'card',
      customerName: customerName.trim() || 'Walk-in Customer',
    });
  };

  // If showing Stripe Card Elements
  if (showStripeForm && createdSale) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
          <StripePayment
            saleId={createdSale.id}
            amount={total}
            onSuccess={handleStripeSuccess}
            onCancel={() => {
              setShowStripeForm(false);
              setCreatedSale(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 shadow-xs flex items-center justify-between bg-white">
          <div>
            <h2 className="text-xl font-black text-gray-900">
              Payment
            </h2>
            <p className="text-xs text-gray-500">
              Amount Due: <span className="font-black text-gray-900">${total.toFixed(2)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 bg-[#f9fafb]">
          {/* Offline Notice */}
          {!isOnline && (
            <div className="p-3 rounded-md bg-amber-50 flex items-center gap-2.5 text-xs text-amber-800">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>Offline Mode: Will save locally and sync when back online.</span>
            </div>
          )}

          {/* Payment Method Selector (Structured Box Buttons) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
              Payment Method
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'cash', label: 'Cash', icon: Banknote },
                { id: 'card', label: 'Card / Tap', icon: CreditCard },
                { id: 'qr', label: 'QR Scan', icon: QrCode },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPaymentMethod(id as 'cash' | 'card' | 'qr')}
                  className={`p-3.5 rounded-md flex flex-col items-center justify-center gap-1.5 transition-all ${
                    paymentMethod === id
                      ? 'bg-gray-900 text-white font-bold shadow-xs'
                      : 'bg-white hover:bg-gray-100 text-gray-700 shadow-xs'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs font-bold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* CASH PAYMENT SECTION */}
          {paymentMethod === 'cash' && (
            <div className="space-y-4">
              {/* Cash Received Input */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Tendered Cash
                  </label>
                  <button
                    onClick={handleSetExactCash}
                    className="text-xs text-gray-900 font-bold hover:underline"
                  >
                    Exact Amount (${total.toFixed(2)})
                  </button>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-gray-400">
                    $
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="input pl-9 text-2xl font-bold tabular-nums h-14 bg-white rounded-md shadow-xs focus:bg-white"
                    autoFocus
                  />
                </div>
              </div>

              {/* Quick Cash Presets */}
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                  Quick Bills
                </p>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={handleSetExactCash}
                    className="py-2 px-2 text-xs font-bold rounded-md bg-gray-900 text-white shadow-xs"
                  >
                    Exact
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetCash(Math.ceil(total))}
                    className="py-2 px-2 text-xs font-bold rounded-md bg-white text-gray-800 shadow-xs hover:bg-gray-100"
                  >
                    ${Math.ceil(total)}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetCash(Math.ceil(total / 10) * 10 || 10)}
                    className="py-2 px-2 text-xs font-bold rounded-md bg-white text-gray-800 shadow-xs hover:bg-gray-100"
                  >
                    ${Math.ceil(total / 10) * 10 || 10}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetPresetCash(Math.ceil(total / 20) * 20 || 20)}
                    className="py-2 px-2 text-xs font-bold rounded-md bg-white text-gray-800 shadow-xs hover:bg-gray-100"
                  >
                    ${Math.ceil(total / 20) * 20 || 20}
                  </button>
                </div>

                <div className="flex gap-2">
                  {[1, 5, 10, 20, 50, 100].map((bill) => (
                    <button
                      key={bill}
                      type="button"
                      onClick={() => handleAddCash(bill)}
                      className="flex-1 py-1.5 text-xs font-bold rounded-md text-gray-700 bg-white shadow-xs hover:bg-gray-100"
                    >
                      +${bill}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clean Touch Numpad Grid */}
              <div className="grid grid-cols-3 gap-1.5 p-3 rounded-lg bg-gray-100">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '00'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="h-11 text-base font-bold rounded-md bg-white text-gray-900 shadow-xs hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    {digit}
                  </button>
                ))}
                <div className="col-span-3 flex gap-1.5 mt-1">
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('CLEAR')}
                    className="flex-1 py-2 text-xs font-bold rounded-md bg-white text-rose-600 shadow-xs hover:bg-rose-50"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleKeypadPress('BACK')}
                    className="flex-1 py-2 text-xs font-bold rounded-md bg-white text-gray-700 shadow-xs flex items-center justify-center hover:bg-gray-50"
                  >
                    <Delete className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Change Due Indicator */}
              {parsedCash > 0 && (
                <div
                  className={`p-4 rounded-lg flex items-center justify-between ${
                    isCashSufficient
                      ? 'bg-emerald-50 text-emerald-900'
                      : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {isCashSufficient ? (
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    ) : (
                      <AlertCircle className="w-6 h-6 text-amber-600" />
                    )}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider">
                        {isCashSufficient ? 'Change Due' : 'Short By'}
                      </p>
                      <p className="text-xl font-black tabular-nums">
                        ${isCashSufficient ? change.toFixed(2) : remaining.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-gray-500">Tendered: ${parsedCash.toFixed(2)}</p>
                    <p className="text-gray-500">Due: ${total.toFixed(2)}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* CARD PAYMENT SECTION */}
          {paymentMethod === 'card' && (
            <div className="space-y-4">
              <div className="p-6 rounded-lg bg-gray-100 flex flex-col items-center text-center">
                <CreditCard className="w-12 h-12 text-gray-800 mb-2" />
                <h4 className="font-bold text-gray-900 text-sm">
                  Card Terminal / Contactless
                </h4>
                <p className="text-xs text-gray-500 max-w-sm mt-1">
                  Customer can tap or insert their card on the card reader.
                </p>

                <div className="mt-5 w-full flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleSimulatedCardPay}
                    disabled={createSaleMutation.isPending}
                    className="w-full btn btn-primary py-3.5 rounded-md flex items-center justify-center gap-2"
                  >
                    <span>⚡ Quick Card Tap (Simulate Approval)</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCheckout}
                    disabled={createSaleMutation.isPending}
                    className="w-full btn btn-secondary text-xs py-2 rounded-md"
                  >
                    Enter Card via Stripe Form
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* QR CODE PAYMENT SECTION */}
          {paymentMethod === 'qr' && (
            <div className="space-y-4 flex flex-col items-center">
              <div className="p-6 rounded-lg bg-gray-100 text-center flex flex-col items-center max-w-xs w-full">
                {/* Visual QR Code Pattern */}
                <div className="w-44 h-44 bg-white p-3 rounded-lg shadow-sm flex flex-col justify-between items-center relative">
                  <div className="grid grid-cols-6 gap-1 w-full h-full p-2">
                    {Array.from({ length: 36 }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`rounded-xs ${
                          (idx % 2 === 0 && idx % 3 !== 0) || idx === 0 || idx === 5 || idx === 30 || idx === 35
                            ? 'bg-gray-900'
                            : 'bg-transparent'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="px-2 py-0.5 rounded bg-gray-900 text-white font-mono text-[10px] font-bold shadow">
                      PAY ${total.toFixed(2)}
                    </span>
                  </div>
                </div>

                <p className="text-xs font-bold text-gray-900 mt-4">
                  Customer scans with payment app
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Apple Pay, Google Pay, or Banking App
                </p>

                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={createSaleMutation.isPending}
                  className="mt-4 w-full btn btn-primary py-3 text-xs rounded-md flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simulate Customer Paid</span>
                </button>
              </div>
            </div>
          )}

          {/* Customer Details Dropdown */}
          <div className="bg-white rounded-lg shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowCustomerDetails(!showCustomerDetails)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-bold text-gray-700 hover:bg-gray-50"
            >
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-gray-500" />
                Customer & Receipt Note ({customerName || 'Walk-in'})
              </span>
              <span className="text-gray-900 font-bold">
                {showCustomerDetails ? 'Hide' : 'Edit'}
              </span>
            </button>

            {showCustomerDetails && (
              <div className="p-4 bg-gray-50 space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in Customer"
                    className="input text-xs bg-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Phone / Mobile
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Optional phone number"
                    className="input text-xs bg-white rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
                    Order Note
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Table 4, Takeaway"
                    className="input text-xs bg-white rounded-md"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white shadow-xs flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={createSaleMutation.isPending}
            className="flex-1 btn btn-secondary py-3.5 text-sm rounded-md"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={createSaleMutation.isPending || (paymentMethod === 'cash' && !isCashSufficient)}
            className="flex-2 btn btn-primary py-3.5 text-sm font-bold rounded-md shadow-md"
          >
            {createSaleMutation.isPending
              ? 'Processing...'
              : `Complete Sale ($${total.toFixed(2)})`}
          </button>
        </div>
      </div>
    </div>
  );
}
