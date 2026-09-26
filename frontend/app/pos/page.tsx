'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { productsAPI } from '@/lib/api';
import {
  getProducts,
  saveProducts,
  getHeldOrders,
  saveHeldOrder,
  removeHeldOrder,
  DEFAULT_CATEGORIES,
} from '@/lib/db';
import { sound } from '@/lib/sound';
import toast from 'react-hot-toast';
import {
  ShoppingCart,
  Search,
  Grid,
  List,
  Wifi,
  WifiOff,
  LogOut,
  PauseCircle,
  Receipt,
  BarChart3,
  Volume2,
  VolumeX,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  Percent,
  PackageX,
  AlertTriangle,
  Store,
} from 'lucide-react';
import type { Product, CartItem, User, HeldOrder } from '@/types';
import CheckoutModal from '@/components/CheckoutModal';
import ReceiptModal from '@/components/ReceiptModal';
import HeldOrdersModal from '@/components/HeldOrdersModal';
import SalesHistoryModal from '@/components/SalesHistoryModal';
import ShiftSummaryModal from '@/components/ShiftSummaryModal';

export default function POSPage() {
  const router = useRouter();

  // State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isMuted, setIsMuted] = useState(false);

  // Discount
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customDiscount, setCustomDiscount] = useState<number>(0);

  // Modals state
  const [showCheckout, setShowCheckout] = useState(false);
  const [showHeldOrders, setShowHeldOrders] = useState(false);
  const [showSalesHistory, setShowSalesHistory] = useState(false);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [lastCompletedSale, setLastCompletedSale] = useState<{
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
  } | null>(null);

  // Held orders count
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);

  // Search input ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load session, held orders on mount
  useEffect(() => {
    // Ensure clean white theme by removing any dark class
    document.documentElement.classList.remove('dark');

    const rawUser = localStorage.getItem('user');
    if (rawUser) {
      try {
        setCurrentUser(JSON.parse(rawUser));
      } catch {
        // invalid
      }
    }

    setHeldOrders(getHeldOrders());
    setIsMuted(sound.isMuted());

    // Network status listeners
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Connection restored: Online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('Network lost: Switched to Offline mode');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' || (e.key === '/' && (e.target as HTMLElement).tagName !== 'INPUT')) {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0) {
          clearCart();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (cart.length > 0) {
          handleHoldOrder();
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (cart.length > 0 && !showCheckout) {
          setShowCheckout(true);
        }
      } else if (e.key === 'Escape') {
        setShowCheckout(false);
        setShowHeldOrders(false);
        setShowSalesHistory(false);
        setShowShiftSummary(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, showCheckout]);

  // Toggle Audio
  const toggleSound = () => {
    const next = !isMuted;
    setIsMuted(next);
    sound.setMuted(next);
    if (!next) {
      sound.beep();
      toast.success('Sound enabled');
    } else {
      toast('Sound muted');
    }
  };

  // Fetch Products
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products', searchQuery, selectedCategory],
    queryFn: async () => {
      try {
        const params: Record<string, any> = { is_active: 'true' };
        if (searchQuery) params.search = searchQuery;
        if (selectedCategory) params.category_id = selectedCategory;

        const response = await productsAPI.getAll(params);
        const data = response.data;
        if (data && data.length > 0) {
          await saveProducts(data);
          return data;
        }
        return await getProducts();
      } catch {
        // Fallback to IndexedDB (populated with demo seeds if first time)
        const offlineItems = await getProducts();
        if (!selectedCategory && !searchQuery) return offlineItems;

        return offlineItems.filter((p) => {
          const matchCat = selectedCategory ? p.category_id === selectedCategory : true;
          const matchSearch = searchQuery
            ? p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (p.barcode && p.barcode.includes(searchQuery))
            : true;
          return matchCat && matchSearch;
        });
      }
    },
  });

  const categories = DEFAULT_CATEGORIES;

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) {
      sound.error();
      toast.error(`${product.name} is sold out`);
      return;
    }

    sound.beep();
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          toast.error(`Max stock available (${product.stock_quantity}) reached`);
          return currentCart;
        }
        return currentCart.map((item) =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...currentCart,
        {
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: 1,
          unit_price: parseFloat(product.price.toString()),
          discount_amount: 0,
        },
      ];
    });
  };

  // Barcode / SKU quick-add on enter key in search bar
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const exactMatch = products.find(
        (p) =>
          p.barcode?.toLowerCase() === searchQuery.trim().toLowerCase() ||
          p.sku.toLowerCase() === searchQuery.trim().toLowerCase()
      );
      if (exactMatch) {
        addToCart(exactMatch);
        toast.success(`Added: ${exactMatch.name}`);
        setSearchQuery('');
      } else if (products.length === 1) {
        addToCart(products[0]);
        toast.success(`Added: ${products[0].name}`);
        setSearchQuery('');
      }
    }
  };

  // Update item quantity
  const updateQuantity = (productId: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const prod = products.find((p) => p.id === productId);
    if (prod && newQuantity > prod.stock_quantity) {
      sound.error();
      toast.error(`Only ${prod.stock_quantity} available in stock`);
      return;
    }

    sound.beep(660, 0.04);
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.product_id === productId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  // Remove single item from cart
  const removeFromCart = (productId: number) => {
    sound.beep(440, 0.05);
    setCart((currentCart) => currentCart.filter((item) => item.product_id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDiscountPercent(0);
    setCustomDiscount(0);
    toast.success('Cart cleared');
  };

  // Hold current order
  const handleHoldOrder = () => {
    if (cart.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    const orderNumber = 'PARK-' + Math.floor(1000 + Math.random() * 9000);
    const newOrder: HeldOrder = {
      id: String(Date.now()),
      orderNumber,
      createdAt: new Date().toISOString(),
      items: [...cart],
      discountAmount: totalDiscount,
      total,
    };
    saveHeldOrder(newOrder);
    setHeldOrders(getHeldOrders());
    setCart([]);
    setDiscountPercent(0);
    setCustomDiscount(0);
    sound.beep(750, 0.1);
    toast.success(`Order ${orderNumber} parked`);
  };

  // Resume a held order
  const handleResumeOrder = (order: HeldOrder) => {
    removeHeldOrder(order.id);
    setHeldOrders(getHeldOrders());
    setCart(order.items);
    setShowHeldOrders(false);
    sound.beep(880, 0.1);
    toast.success(`Resumed order ${order.orderNumber}`);
  };

  // Discard a held order
  const handleDiscardHeldOrder = (orderId: string) => {
    removeHeldOrder(orderId);
    setHeldOrders(getHeldOrders());
    toast.success('Parked order removed');
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    toast.success('Signed out');
    router.push('/login');
  };

  // Financial calculations
  const rawSubtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const percentDiscountAmount = (rawSubtotal * discountPercent) / 100;
  const totalDiscount = Math.min(rawSubtotal, percentDiscountAmount + customDiscount);
  const netSubtotal = Math.max(0, rawSubtotal - totalDiscount);
  const taxRate = 0.1; // 10% VAT
  const tax = netSubtotal * taxRate;
  const total = netSubtotal + tax;
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="min-h-screen bg-[#f3f4f6] text-gray-900 flex flex-col antialiased">
      {/* ================= CLEAN WHITE HEADER (NO BORDERS) ================= */}
      <header className="bg-white sticky top-0 z-30 shadow-xs">
        <div className="px-6 py-3.5">
          <div className="flex items-center justify-between gap-4">
            {/* Store Branding */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-900 flex items-center justify-center text-white">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black tracking-tight text-gray-900">
                    STORE POS
                  </h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 uppercase tracking-wider">
                    Register 01
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {isOnline ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 font-medium text-[11px]">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Cloud Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-amber-600 font-medium text-[11px]">
                      <WifiOff className="w-3 h-3" />
                      Offline Mode
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2">
              {/* Parked Orders Trigger */}
              <button
                onClick={() => setShowHeldOrders(true)}
                className="btn btn-secondary text-xs py-2 px-3 rounded-md flex items-center gap-1.5"
                title="View parked orders (F8)"
              >
                <PauseCircle className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline font-semibold">Parked</span>
                {heldOrders.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-md bg-amber-500 text-white font-bold text-[10px]">
                    {heldOrders.length}
                  </span>
                )}
              </button>

              {/* Sales History Trigger */}
              <button
                onClick={() => setShowSalesHistory(true)}
                className="btn btn-secondary text-xs py-2 px-3 rounded-md flex items-center gap-1.5"
                title="View past sales and receipts"
              >
                <Receipt className="w-4 h-4 text-gray-500" />
                <span className="hidden sm:inline font-semibold">Receipts</span>
              </button>

              {/* Shift Summary Trigger */}
              <button
                onClick={() => setShowShiftSummary(true)}
                className="btn btn-secondary text-xs py-2 px-3 rounded-md flex items-center gap-1.5"
                title="Today's sales summary"
              >
                <BarChart3 className="w-4 h-4 text-gray-500" />
                <span className="hidden sm:inline font-semibold">Daily Report</span>
              </button>

              <div className="h-5 w-px bg-gray-200 mx-1 hidden md:block"></div>

              {/* Sound Toggle */}
              <button
                onClick={toggleSound}
                className="p-2 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4" />}
              </button>

              {/* Cashier Badge & Logout */}
              <div className="flex items-center gap-2.5 pl-2">
                <div className="w-8 h-8 rounded-md bg-gray-900 text-white font-bold text-xs flex items-center justify-center">
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'C'}
                </div>
                <div className="hidden lg:block text-left text-xs">
                  <p className="font-bold leading-none text-gray-900">
                    {currentUser?.name || 'Cashier User'}
                  </p>
                  <p className="text-[10px] text-gray-400 capitalize mt-0.5">
                    {currentUser?.role || 'Cashier'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-md text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ================= MAIN SPLIT INTERFACE ================= */}
      <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-65px)] overflow-hidden">
        {/* LEFT: PRODUCTS BROWSER (NO BORDER) */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f3f4f6]">
          {/* Top Search & Filter Bar (Clean White Box Surface) */}
          <div className="p-4 bg-white shadow-xs space-y-3">
            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search products or scan barcode... (Press / to focus)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="input pl-10 pr-9 text-sm bg-gray-100 rounded-md focus:bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center p-1 bg-gray-100 rounded-md">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white text-gray-900 shadow-xs font-bold'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="Grid view"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-1.5 rounded-md transition-colors ${
                    viewMode === 'list'
                      ? 'bg-white text-gray-900 shadow-xs font-bold'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Filter Tabs (Structured Rectangular Box Buttons) */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-4 py-2 rounded-md text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  selectedCategory === null
                    ? 'bg-gray-900 text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span>All Products</span>
                <span className="text-[10px] opacity-75">({products.length})</span>
              </button>

              {categories.map((cat) => {
                const count = products.filter((p) => p.category_id === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                    className={`px-4 py-2 rounded-md text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      selectedCategory === cat.id
                        ? 'bg-gray-900 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <span>{cat.name}</span>
                    {count > 0 && <span className="text-[10px] opacity-75">({count})</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Product Grid / List Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-3"></div>
                <p className="text-sm font-medium">Loading inventory...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <PackageX className="w-12 h-12 mb-3 opacity-30 text-gray-500" />
                <p className="font-bold text-gray-800">No matching products found</p>
                <p className="text-xs text-gray-400 mt-1">Try another search term or category</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory(null);
                  }}
                  className="mt-4 btn btn-secondary text-xs rounded-md"
                >
                  Clear Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              /* CLEAN BOX & GRID VIEW (COMMERCIAL POS LAYOUT, NO BENTO PILLS) */
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((product) => {
                  const inCartItem = cart.find((i) => i.product_id === product.id);
                  const inCartQty = inCartItem?.quantity || 0;
                  const isOutOfStock = product.stock_quantity <= 0;
                  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= product.low_stock_threshold;

                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={`relative rounded-lg text-left transition-all duration-150 flex flex-col justify-between group select-none active:scale-[0.99] overflow-hidden ${
                        isOutOfStock
                          ? 'opacity-50 cursor-not-allowed bg-gray-200 shadow-xs'
                          : inCartQty > 0
                          ? 'bg-white shadow-md ring-2 ring-gray-900'
                          : 'bg-white shadow-xs hover:shadow-md'
                      }`}
                    >
                      {/* Top Image Box */}
                      <div className="h-40 sm:h-44 w-full bg-gray-100 relative overflow-hidden flex items-center justify-center">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt={product.name}
                            loading="lazy"
                            className="w-full h-full object-cover object-center group-hover:scale-103 transition-transform duration-300"
                          />
                        ) : (
                          <div className="text-gray-300 text-3xl font-black">📦</div>
                        )}

                        {/* In-Cart Count Badge */}
                        {inCartQty > 0 && (
                          <div className="absolute top-2 left-2 bg-gray-900 text-white text-[11px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                            {inCartQty} in cart
                          </div>
                        )}
                      </div>

                      {/* Structured Info Box Below Photo */}
                      <div className="p-3.5 flex-1 flex flex-col justify-between w-full bg-white">
                        <div>
                          <div className="flex items-center justify-between text-[11px] text-gray-500 font-mono mb-1">
                            <span className="uppercase tracking-wider font-semibold text-[10px] text-gray-600">
                              {product.category_name}
                            </span>
                            <span>{product.sku}</span>
                          </div>
                          <h3 className="font-bold text-sm text-gray-900 line-clamp-1 leading-snug group-hover:text-black">
                            {product.name}
                          </h3>

                          {/* Clean Structured Stock Text */}
                          <div className="mt-1">
                            {isOutOfStock ? (
                              <span className="text-[11px] font-bold text-rose-600">
                                Sold Out
                              </span>
                            ) : isLowStock ? (
                              <span className="text-[11px] font-bold text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Low stock: {product.stock_quantity} left
                              </span>
                            ) : (
                              <span className="text-[11px] font-medium text-gray-500">
                                Stock: {product.stock_quantity}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Price & Plus Add Box */}
                        <div className="flex items-baseline justify-between mt-3 pt-2 w-full">
                          <p className="text-lg font-black text-gray-900 tabular-nums">
                            ${parseFloat(product.price.toString()).toFixed(2)}
                          </p>
                          <span className="w-8 h-8 rounded-md bg-gray-100 group-hover:bg-gray-900 group-hover:text-white transition-colors flex items-center justify-center font-bold text-gray-800">
                            <Plus className="w-4 h-4" />
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              /* CLEAN BOX & GRID LIST VIEW */
              <div className="space-y-2">
                {products.map((product) => {
                  const inCartItem = cart.find((i) => i.product_id === product.id);
                  const inCartQty = inCartItem?.quantity || 0;
                  const isOutOfStock = product.stock_quantity <= 0;

                  return (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      disabled={isOutOfStock}
                      className={`w-full p-3 rounded-lg flex items-center justify-between text-left transition-all ${
                        isOutOfStock
                          ? 'opacity-50 cursor-not-allowed bg-gray-200'
                          : inCartQty > 0
                          ? 'bg-white ring-2 ring-gray-900 shadow-md'
                          : 'bg-white shadow-xs hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-3.5 flex-1 pr-4">
                        {/* Thumbnail Box */}
                        <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                          {product.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-full h-full object-cover object-center"
                            />
                          ) : (
                            <span className="text-gray-300">📦</span>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-gray-900">
                              {product.name}
                            </h4>
                            <span className="text-[10px] font-mono text-gray-400">
                              {product.sku}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {product.category_name} • Stock: {product.stock_quantity}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {inCartQty > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-900 text-white">
                            {inCartQty} in cart
                          </span>
                        )}
                        <span className="text-base font-black tabular-nums text-gray-900">
                          ${parseFloat(product.price.toString()).toFixed(2)}
                        </span>
                        <div className="w-8 h-8 rounded-md bg-gray-100 text-gray-700 flex items-center justify-center font-bold hover:bg-gray-900 hover:text-white transition-colors">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: CLEAN WHITE CART & REGISTER PANEL (NO BORDERS) */}
        <div className="w-full lg:w-[420px] bg-white flex flex-col h-full shadow-lg z-10">
          {/* Cart Header */}
          <div className="px-5 py-4 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-gray-100 text-gray-800 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-base text-gray-900 leading-tight">
                  Current Order
                </h2>
                <p className="text-[11px] text-gray-400">
                  {totalItemsCount} {totalItemsCount === 1 ? 'item' : 'items'}
                </p>
              </div>
            </div>

            {/* Cart Header Actions */}
            {cart.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleHoldOrder}
                  className="px-2.5 py-1 text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-50 rounded-md transition-colors flex items-center gap-1"
                  title="Park current order (F8)"
                >
                  <PauseCircle className="w-3.5 h-3.5" />
                  <span>Hold</span>
                </button>
                <button
                  onClick={clearCart}
                  className="p-1.5 text-xs text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                  title="Clear cart (F4)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f9fafb]">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                <div className="w-14 h-14 rounded-lg bg-white shadow-xs flex items-center justify-center mb-3">
                  <ShoppingCart className="w-6 h-6 opacity-30 text-gray-500" />
                </div>
                <p className="font-bold text-gray-700">Order is Empty</p>
                <p className="text-xs text-gray-400 mt-1 max-w-[200px]">
                  Select products or scan barcodes to begin order
                </p>
                <div className="mt-4 px-3 py-1.5 rounded-md bg-white shadow-xs text-[11px] text-gray-500 font-mono">
                  Shortcut: Press / to search
                </div>
              </div>
            ) : (
              cart.map((item) => {
                const matchedProduct = products.find((p) => p.id === item.product_id);

                return (
                  <div
                    key={item.product_id}
                    className="p-3 rounded-lg bg-white shadow-xs hover:shadow-sm flex items-center justify-between gap-3 transition-all"
                  >
                    {/* Item Thumbnail */}
                    <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                      {matchedProduct?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={matchedProduct.image_url}
                          alt={item.product_name}
                          className="w-full h-full object-cover object-center"
                        />
                      ) : (
                        <span className="text-gray-400 text-xs">📦</span>
                      )}
                    </div>

                    {/* Item Description */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-xs text-gray-900 truncate">
                        {item.product_name}
                      </h4>
                      <p className="text-[11px] font-mono text-gray-400 mt-0.5">
                        ${item.unit_price.toFixed(2)} each
                      </p>
                      <p className="text-xs font-black text-gray-900 mt-0.5 tabular-nums">
                        ${(item.unit_price * item.quantity).toFixed(2)}
                      </p>
                    </div>

                    {/* Quantity Controller Box */}
                    <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                        className="w-6 h-6 rounded-md text-gray-700 hover:bg-white flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-bold text-xs tabular-nums text-gray-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                        className="w-6 h-6 rounded-md text-gray-700 hover:bg-white flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Remove Button */}
                    <button
                      onClick={() => removeFromCart(item.product_id)}
                      className="p-1 text-gray-300 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Footer: Calculations & Checkout (Clean White Box Surface) */}
          {cart.length > 0 && (
            <div className="p-5 bg-white shadow-lg space-y-3">
              {/* Discount Preset Chips (Rectangular Box Buttons) */}
              <div>
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1">
                    <Percent className="w-3 h-3 text-gray-400" />
                    Discount
                  </span>
                  {totalDiscount > 0 && (
                    <span className="text-emerald-600 font-bold">
                      -${totalDiscount.toFixed(2)} applied
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => {
                        setDiscountPercent(pct);
                        sound.beep(550, 0.04);
                      }}
                      className={`py-1.5 rounded-md text-xs font-bold transition-all ${
                        discountPercent === pct
                          ? 'bg-gray-900 text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {pct === 0 ? 'None' : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="space-y-1.5 text-xs text-gray-500 pt-1">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    ${rawSubtotal.toFixed(2)}
                  </span>
                </div>

                {totalDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Discount</span>
                    <span className="tabular-nums">-${totalDiscount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Sales Tax (10% VAT)</span>
                  <span className="font-semibold text-gray-900 tabular-nums">
                    ${tax.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-baseline pt-2">
                  <span className="text-base font-black text-gray-900 uppercase tracking-tight">
                    Total Due
                  </span>
                  <span className="text-2xl font-black text-gray-900 tabular-nums">
                    ${total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Pay Now Button */}
              <button
                onClick={() => setShowCheckout(true)}
                className="w-full btn btn-primary py-4 text-base font-black rounded-md shadow-md tracking-wide flex items-center justify-center gap-2 group"
              >
                <span>PAY NOW (${total.toFixed(2)})</span>
                <span className="text-xs font-normal opacity-70 bg-white/20 px-2 py-0.5 rounded-md font-mono">
                  F9
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ================= MODALS ================= */}

      {/* Checkout Modal */}
      {showCheckout && (
        <CheckoutModal
          cart={cart}
          total={total}
          subtotal={rawSubtotal}
          tax={tax}
          discount={totalDiscount}
          onClose={() => setShowCheckout(false)}
          onComplete={(saleData) => {
            setShowCheckout(false);
            setLastCompletedSale(saleData);
            clearCart();
          }}
          isOnline={isOnline}
        />
      )}

      {/* Digital Thermal Receipt Modal */}
      {lastCompletedSale && (
        <ReceiptModal
          saleNumber={lastCompletedSale.saleNumber}
          cart={lastCompletedSale.cart}
          subtotal={lastCompletedSale.subtotal}
          tax={lastCompletedSale.tax}
          discount={lastCompletedSale.discount}
          total={lastCompletedSale.total}
          paymentMethod={lastCompletedSale.paymentMethod}
          cashReceived={lastCompletedSale.cashReceived}
          change={lastCompletedSale.change}
          cashierName={currentUser?.name || 'Cashier User'}
          customerName={lastCompletedSale.customerName || 'Walk-in Customer'}
          onClose={() => setLastCompletedSale(null)}
        />
      )}

      {/* Held / Parked Orders Drawer */}
      {showHeldOrders && (
        <HeldOrdersModal
          orders={heldOrders}
          onResume={handleResumeOrder}
          onDiscard={handleDiscardHeldOrder}
          onClose={() => setShowHeldOrders(false)}
        />
      )}

      {/* Sales History Modal */}
      {showSalesHistory && (
        <SalesHistoryModal
          onClose={() => setShowSalesHistory(false)}
          isOnline={isOnline}
        />
      )}

      {/* Shift Summary Modal */}
      {showShiftSummary && (
        <ShiftSummaryModal
          onClose={() => setShowShiftSummary(false)}
          isOnline={isOnline}
        />
      )}
    </div>
  );
}