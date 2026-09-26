'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { salesAPI } from '@/lib/api';
import { getPendingSales } from '@/lib/db';
import { Receipt, Search, X, Calendar, CreditCard, QrCode, Banknote, RefreshCw } from 'lucide-react';
import type { Sale } from '@/types';
import ReceiptModal from './ReceiptModal';

interface SalesHistoryModalProps {
  onClose: () => void;
  isOnline: boolean;
}

export default function SalesHistoryModal({ onClose, isOnline }: SalesHistoryModalProps) {
  const [search, setSearch] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Fetch sales
  const { data: sales = [], isLoading, refetch } = useQuery<Sale[]>({
    queryKey: ['sales_history'],
    queryFn: async () => {
      try {
        if (!isOnline) {
          const offlineSales = await getPendingSales();
          return offlineSales as unknown as Sale[];
        }
        const res = await salesAPI.getAll({ limit: 50 });
        return res.data;
      } catch {
        const offlineSales = await getPendingSales();
        return offlineSales as unknown as Sale[];
      }
    },
  });

  const filteredSales = sales.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.sale_number?.toLowerCase().includes(q) ||
      s.customer_name?.toLowerCase().includes(q) ||
      s.payment_method?.toLowerCase().includes(q)
    );
  });

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case 'card':
        return <CreditCard className="w-3.5 h-3.5 text-gray-700" />;
      case 'qr':
        return <QrCode className="w-3.5 h-3.5 text-gray-700" />;
      default:
        return <Banknote className="w-3.5 h-3.5 text-gray-700" />;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
        <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[88vh]">
          {/* Header */}
          <div className="px-6 py-4 shadow-xs flex items-center justify-between bg-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-800">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-black text-gray-900">
                  Sales History & Receipts
                </h2>
                <p className="text-xs text-gray-500">
                  Browse previous transactions and view receipts
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => refetch()}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                title="Refresh list"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="p-4 shadow-xs bg-white">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by receipt # or customer name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="input pl-10 text-sm bg-gray-100 rounded-md focus:bg-white"
              />
            </div>
          </div>

          {/* Sales List */}
          <div className="p-6 overflow-y-auto flex-1 space-y-2 bg-[#f3f4f6]">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30 text-gray-400" />
                <p className="font-bold text-gray-700">No completed sales recorded</p>
                <p className="text-xs text-gray-400 mt-1">
                  Completed orders will appear here automatically.
                </p>
              </div>
            ) : (
              filteredSales.map((sale) => (
                <div
                  key={sale.id}
                  className="p-3.5 rounded-lg bg-white shadow-xs hover:shadow-md transition-all flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-gray-900 font-mono">
                        {sale.sale_number}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 flex items-center gap-1 capitalize font-medium">
                        {getPaymentIcon(sale.payment_method)}
                        {sale.payment_method}
                      </span>
                      {sale.payment_status === 'completed' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-semibold">
                          Paid
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                      <span className="flex items-center gap-1 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        {new Date(sale.created_at).toLocaleString()}
                      </span>
                      {sale.customer_name && (
                        <span>• {sale.customer_name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-base font-black text-gray-900 tabular-nums">
                      ${parseFloat(sale.total_amount?.toString() || '0').toFixed(2)}
                    </span>
                    <button
                      onClick={() => setSelectedSale(sale)}
                      className="btn btn-secondary text-xs py-1.5 px-3 rounded-md flex items-center gap-1.5"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>Receipt</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-4 bg-white shadow-xs flex justify-between items-center text-xs text-gray-500">
            <span>{filteredSales.length} transaction{filteredSales.length !== 1 ? 's' : ''}</span>
            <button onClick={onClose} className="btn btn-secondary text-sm rounded-md">
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Selected Receipt Modal */}
      {selectedSale && (
        <ReceiptModal
          saleNumber={selectedSale.sale_number}
          cart={selectedSale.items || []}
          subtotal={parseFloat(selectedSale.subtotal?.toString() || selectedSale.total_amount?.toString() || '0')}
          tax={parseFloat(selectedSale.tax_amount?.toString() || '0')}
          discount={parseFloat(selectedSale.discount_amount?.toString() || '0')}
          total={parseFloat(selectedSale.total_amount?.toString() || '0')}
          paymentMethod={selectedSale.payment_method}
          cashierName={selectedSale.cashier_name || 'Cashier'}
          customerName={selectedSale.customer_name || 'Walk-in Customer'}
          date={new Date(selectedSale.created_at).toLocaleString()}
          onClose={() => setSelectedSale(null)}
        />
      )}
    </>
  );
}
