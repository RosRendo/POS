/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance } from 'axios';
import type {
  User,
  Product,
  Sale,
  Payment,
  DashboardStats,
  InventoryLog,
  LoginRequest,
  LoginResponse,
  CreateSaleRequest,
  ProcessStripePaymentRequest,
  ProcessCashPaymentRequest,
  ProcessQRPaymentRequest,
  InventoryAdjustmentRequest,
} from '@/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear auth data and redirect to login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (data: LoginRequest) => 
    api.post<LoginResponse>('/auth/login', data),
  logout: () => 
    api.post('/auth/logout'),
  me: () => 
    api.get<User>('/auth/me'),
  register: (data: Partial<User> & { password: string }) => 
    api.post<User>('/auth/register', data),
};

// Products APIs
export const productsAPI = {
  getAll: (params?: Record<string, any>) => 
    api.get<Product[]>('/products', { params }),
  getOne: (id: number) => 
    api.get<Product>(`/products/${id}`),
  create: (data: Partial<Product>) => 
    api.post<Product>('/products', data),
  update: (id: number, data: Partial<Product>) => 
    api.put<Product>(`/products/${id}`, data),
  delete: (id: number) => 
    api.delete(`/products/${id}`),
};

// Sales APIs
export const salesAPI = {
  getAll: (params?: Record<string, any>) => 
    api.get<Sale[]>('/sales', { params }),
  getOne: (id: number) => 
    api.get<Sale>(`/sales/${id}`),
  create: (data: CreateSaleRequest) => 
    api.post<Sale>('/sales', data),
};

// Payments APIs
export const paymentsAPI = {
  processStripe: (data: ProcessStripePaymentRequest) => 
    api.post<Payment>('/payments/stripe', data),
  processCash: (data: ProcessCashPaymentRequest) => 
    api.post<Payment>('/payments/cash', data),
  processQR: (data: ProcessQRPaymentRequest) => 
    api.post<Payment>('/payments/qr', data),
  getOne: (id: number) => 
    api.get<Payment>(`/payments/${id}`),
};

// Dashboard APIs
export const dashboardAPI = {
  getStats: (period?: string) => 
    api.get<DashboardStats>('/dashboard/stats', { params: { period } }),
  getReport: (params: Record<string, any>) => 
    api.get('/dashboard/report', { params }),
};

// Inventory APIs
export const inventoryAPI = {
  getLogs: (params?: Record<string, any>) => 
    api.get<InventoryLog[]>('/inventory/logs', { params }),
  adjust: (data: InventoryAdjustmentRequest) => 
    api.post<InventoryLog>('/inventory/adjust', data),
};

// Users APIs
export const usersAPI = {
  getAll: () => 
    api.get<User[]>('/users'),
  getOne: (id: number) => 
    api.get<User>(`/users/${id}`),
  update: (id: number, data: Partial<User> & { password?: string }) => 
    api.put<User>(`/users/${id}`, data),
  delete: (id: number) => 
    api.delete(`/users/${id}`),
};

export default api;