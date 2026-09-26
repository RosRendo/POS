'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardAPI } from '@/lib/api';
import { BarChart3, DollarSign, ShoppingBag, TrendingUp, AlertTriangle, X, CreditCard, Banknote, QrCode } from 'lucide-react';
import type { DashboardStats } from '@/types';

interface ShiftSummaryModalProps {
  onClose: () => void;
  isOnline: boolean;
}

export default function ShiftSummaryModal({ onClose, isOnline }: ShiftSummaryModalProps) {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard_stats_today'],
    queryFn: async () => {
      try {
        const res = await dashboardAPI.getStats('today');
        return res.data;
      } catch {
        return {
          overview: {
            total_sales: 0,
            total_revenue: 0,
            average_sale: 0,
            days_with_sales: 1,
          },
          payment_breakdown: [],
          top_products: [],
          low_stock: [],
          recent_sales: [],
          sales_trend: [],
          period: 'today',
        };
      }
    },
    enabled: isOnline,
  });

  const overview = stats?.overview || {
    total_sales: 0,
    total_revenue: 0,
    average_sale: 0,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 shadow-xs flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-800">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">
                Shift & Daily Summary
              </h2>
              <p className="text-xs text-gray-500">
                Performance snapshot and inventory status
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 bg-[#f3f4f6]">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <>
              {/* Stat Cards Grid (Crisp Boxes) */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 rounded-lg bg-white shadow-xs">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs font-semibold mb-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Revenue</span>
                  </div>
                  <p className="text-xl font-black text-gray-900 tabular-nums">
                    ${parseFloat(overview.total_revenue?.toString() || '0').toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Today's total</p>
                </div>

                <div className="p-4 rounded-lg bg-white shadow-xs">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs font-semibold mb-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-gray-700" />
                    <span>Orders</span>
                  </div>
                  <p className="text-xl font-black text-gray-900 tabular-nums">
                    {overview.total_sales || 0}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Completed</p>
                </div>

                <div className="p-4 rounded-lg bg-white shadow-xs">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs font-semibold mb-1">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" />
                    <span>Avg Ticket</span>
                  </div>
                  <p className="text-xl font-black text-gray-900 tabular-nums">
                    ${parseFloat(overview.average_sale?.toString() || '0').toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">Per order</p>
                </div>
              </div>

              {/* Payment Methods Breakdown */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
                  Payment Methods
                </h3>
                <div className="grid grid-cols-3 gap-2.5">
                  {['cash', 'card', 'qr'].map((method) => {
                    const item = stats?.payment_breakdown?.find(
                      (p) => p.payment_method.toLowerCase() === method
                    );
                    const total = item ? parseFloat(item.total.toString()) : 0;
                    const count = item ? item.count : 0;

                    return (
                      <div
                        key={method}
                        className="p-3.5 rounded-lg bg-white shadow-xs"
                      >
                        <div className="flex items-center gap-1.5 capitalize text-xs font-bold text-gray-700 mb-1">
                          {method === 'cash' && <Banknote className="w-3.5 h-3.5 text-gray-600" />}
                          {method === 'card' && <CreditCard className="w-3.5 h-3.5 text-gray-600" />}
                          {method === 'qr' && <QrCode className="w-3.5 h-3.5 text-gray-600" />}
                          <span>{method}</span>
                        </div>
                        <p className="text-sm font-black text-gray-900 tabular-nums">
                          ${total.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-gray-400">{count} transaction{count !== 1 ? 's' : ''}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Low Stock Alerts */}
              {stats?.low_stock && stats.low_stock.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold uppercase tracking-wider mb-2.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Low Stock Items ({stats.low_stock.length})</span>
                  </div>
                  <div className="space-y-2 max-h-56 overflow-y-auto">
                    {stats.low_stock.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-lg bg-white shadow-xs flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                            {item.image_url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover object-center"
                              />
                            ) : (
                              <span className="text-gray-400">📦</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-gray-900">{item.name}</p>
                            <p className="text-[10px] text-gray-500 font-mono">{item.sku}</p>
                          </div>
                        </div>
                        <span className="font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md text-xs">
                          {item.stock_quantity} left
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white shadow-xs flex justify-end">
          <button onClick={onClose} className="btn btn-secondary text-sm rounded-md">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
