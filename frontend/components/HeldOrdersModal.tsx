'use client';

import { PauseCircle, Trash2, ArrowUpRight, X, Clock, ShoppingCart } from 'lucide-react';
import type { HeldOrder } from '@/types';

interface HeldOrdersModalProps {
  orders: HeldOrder[];
  onResume: (order: HeldOrder) => void;
  onDiscard: (orderId: string) => void;
  onClose: () => void;
}

export default function HeldOrdersModal({
  orders,
  onResume,
  onDiscard,
  onClose,
}: HeldOrdersModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 shadow-xs flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-amber-50 flex items-center justify-center text-amber-600">
              <PauseCircle className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-gray-900">
                Parked Orders ({orders.length})
              </h2>
              <p className="text-xs text-gray-500">
                Orders on hold ready to be resumed
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

        {/* Orders list */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3 bg-[#f3f4f6]">
          {orders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30 text-gray-400" />
              <p className="font-bold text-gray-700">No orders currently on hold</p>
              <p className="text-xs text-gray-400 mt-1">
                You can park an active cart anytime using the "Hold" button.
              </p>
            </div>
          ) : (
            orders.map((order) => {
              const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
              const formattedTime = new Date(order.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={order.id}
                  className="p-4 rounded-lg bg-white shadow-xs hover:shadow-md transition-all flex flex-col gap-2.5"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-gray-900">
                          {order.orderNumber}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-gray-400" />
                          {formattedTime}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5 font-medium">
                        {order.customerName || 'Walk-in Customer'}
                        {order.notes && <span className="text-gray-400 ml-1.5 font-normal">({order.notes})</span>}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-gray-900 tabular-nums">
                        ${order.total.toFixed(2)}
                      </span>
                      <p className="text-[11px] text-gray-400">{totalItems} item{totalItems !== 1 ? 's' : ''}</p>
                    </div>
                  </div>

                  {/* Items preview */}
                  <div className="text-xs text-gray-500 line-clamp-1 bg-gray-50 p-2 rounded-md font-mono">
                    {order.items.map((i) => `${i.product_name} (${i.quantity})`).join(', ')}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      onClick={() => onDiscard(order.id)}
                      className="px-3 py-1.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors flex items-center gap-1 font-medium"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Discard
                    </button>
                    <button
                      onClick={() => onResume(order)}
                      className="btn btn-primary text-xs py-1.5 px-3 rounded-md flex items-center gap-1"
                    >
                      <span>Resume</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
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
