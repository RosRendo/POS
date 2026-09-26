'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { Store, Mail, Lock, ShieldCheck, ArrowRight, Eye, EyeOff, Zap, LogIn } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e?: FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    try {
      const response = await authAPI.login({ email, password });
      const { token, user } = response.data;

      // Save to localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));

      toast.success(`Welcome back, ${user.name}!`);
      router.push('/pos');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Login failed. Check your credentials or try offline mode.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick fill demo account
  const handleQuickFill = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
  };

  // Offline bypass
  const handleOfflineMode = () => {
    const guestUser = {
      id: 999,
      name: 'Cashier User',
      email: 'cashier@pos.com',
      role: 'cashier' as const,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    localStorage.setItem('token', 'offline-token-demo');
    localStorage.setItem('user', JSON.stringify(guestUser));
    toast.success('Started Offline Terminal Session');
    router.push('/pos');
  };

  return (
    <div className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-8">
        {/* Store Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gray-900 rounded-lg shadow-sm mb-4 text-white">
            <Store className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">
            STORE POS
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Cashier & Register Sign In
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input pl-10 text-sm bg-gray-100 rounded-md focus:bg-white text-gray-900 placeholder-gray-400"
                placeholder="cashier@pos.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pl-10 pr-10 text-sm bg-gray-100 rounded-md focus:bg-white text-gray-900 placeholder-gray-400"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn btn-primary py-3.5 text-sm font-bold rounded-md shadow-md flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></span>
                Signing in...
              </span>
            ) : (
              <>
                <span>Open Register</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* 1-Click Demo Accounts */}
        <div className="mt-8 pt-6 shadow-2xs">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 text-center mb-3">
            Quick 1-Click Demo Fill
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleQuickFill('admin@pos.com', 'admin123')}
              className="p-2.5 rounded-md bg-gray-100 hover:bg-gray-200 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">
                  Admin
                </span>
                <ShieldCheck className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">admin@pos.com</p>
            </button>

            <button
              type="button"
              onClick={() => handleQuickFill('cashier@pos.com', 'cashier123')}
              className="p-2.5 rounded-md bg-gray-100 hover:bg-gray-200 text-left transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900">
                  Cashier
                </span>
                <LogIn className="w-3.5 h-3.5 text-gray-500" />
              </div>
              <p className="text-[10px] text-gray-400 font-mono mt-0.5">cashier@pos.com</p>
            </button>
          </div>

          {/* Offline Mode Bypass */}
          <div className="mt-3 text-center">
            <button
              type="button"
              onClick={handleOfflineMode}
              className="text-xs text-gray-500 hover:text-gray-900 flex items-center justify-center gap-1 mx-auto transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Continue in Offline Cashier Mode</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}