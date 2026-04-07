import axios from 'axios';

export interface BackendProduct {
  id: number;
  name: string;
  price: number;
  original_price?: number;
  image_url?: string;
  category?: string;
  color?: string;
  material?: string;
  sizes?: string[];
  rating?: number;
  reviews?: number;
  description?: string;
  match_reasons?: string[];
}

export interface CartEntry {
  product_id: number;
  quantity: number;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  is_admin?: boolean;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  created_at?: number;
  is_admin?: boolean;
}

export interface AuthResponse {
  token: string;
  session_id?: string;
  user: AuthUser;
}

export interface CurrentUserResponse {
  user: AuthUser;
  session_id?: string;
}

export interface AddressPayload {
  full_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

export interface AddressResponse extends AddressPayload {
  id: number;
}

export interface OrderItem {
  product_id: number;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface TrackingEvent {
  stage: string;
  status: 'completed' | 'pending';
  timestamp?: string | null;
}

export interface OrderResponse {
  id: string;
  status: string;
  created_at: string;
  payment_method: string;
  payment_details?: Record<string, string>;
  address_id?: number | null;
  shipping_address?: AddressPayload | null;
  notes?: string | null;
  currency: string;
  items: OrderItem[];
  total_amount: number;
  expected_delivery_at?: string;
  tracking_events?: TrackingEvent[];
}

export interface AdminOrder extends OrderResponse {
  user_id?: number | string;
  user_name?: string | null;
  user_email?: string | null;
}

export interface AISearchRequestPayload {
  query?: string;
  source?: 'text' | 'voice' | 'image';
  dominant_color?: string;
  visual_tags?: string[];
  candidate_product_ids?: number[];
  structured_filters?: Record<string, string | number | null | undefined>;
  limit?: number;
}

export interface AISearchResponse {
  query: string;
  source: string;
  count: number;
  analysis: {
    tokens: string[];
    smart_filters?: Record<string, string | number | string[] | null>;
    inferred: {
      categories: string[];
      materials: string[];
      colors: string[];
    };
    summary: string[];
  };
  results: BackendProduct[];
}

export interface PersonalizedRecommendationsResponse {
  level: 'basic' | 'intermediate' | 'advanced';
  count: number;
  cold_start: boolean;
  explanations: string[];
  results: BackendProduct[];
}

export interface StyleQuizProfile {
  preferred_categories: string[];
  preferred_colors: string[];
  preferred_materials: string[];
  budget_max?: number | null;
  occasions: string[];
  updated_at?: number;
}

export interface StyleQuizResponse {
  exists: boolean;
  profile: StyleQuizProfile;
}

export interface ChatAssistantLink {
  id: number;
  name: string;
  color: string;
  price: number;
  category?: string;
  image_url?: string;
}

export interface ChatAssistantResponse {
  reply: string;
  context: {
    filters: Record<string, string | number>;
    ask_next: string;
  };
  links: ChatAssistantLink[];
  model_used: boolean;
}

export interface ProductReview {
  id: number;
  product_id: number;
  user_id: number;
  author: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
}

export interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface ContactMessage {
  id: number;
  created_at: string;
  user_id: number | null;
  session_id: string | null;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export interface AdminProductPayload {
  id?: number;
  name: string;
  price: number;
  original_price: number;
  image_url: string;
  category: string;
  color: string;
  material: string;
  sizes: string[];
  rating: number;
  reviews: number;
  description: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/$/, '');
const AUTH_TOKEN_KEY = 'shekurti_auth_token';

const client = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
  timeout: 20000,
});

let authToken: string | null = localStorage.getItem(AUTH_TOKEN_KEY);
if (authToken) {
  client.defaults.headers.common.Authorization = `Bearer ${authToken}`;
}

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    client.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    delete client.defaults.headers.common.Authorization;
  }
};

export const getStoredAuthToken = () => authToken;

// Local fallback if backend is not available.
const mockCartData: CartEntry[] = [];

export const register = async (payload: { name: string; email: string; password: string }) => {
  const res = await client.post<AuthResponse>('/auth/register', payload);
  return res.data;
};

export const login = async (payload: { email: string; password: string }) => {
  const res = await client.post<AuthResponse>('/auth/login', payload);
  return res.data;
};

export const adminLogin = async (payload: { email: string; password: string }) => {
  const res = await client.post<AuthResponse>('/auth/admin/login', payload);
  return res.data;
};

export const getCurrentUser = async () => {
  const res = await client.get<CurrentUserResponse>('/auth/me');
  return res.data;
};

export const getProducts = async (params?: Record<string, string | number | boolean>) => {
  const res = await client.get<BackendProduct[]>('/products/', params ? { params } : undefined);
  return res.data;
};

export const getBottomwearProducts = async (params?: Record<string, string | number | boolean>) => {
  const res = await client.get<BackendProduct[]>('/products/bottomwear/products', params ? { params } : undefined);
  return res.data;
};

export const getDupattaProducts = async (params?: Record<string, string | number | boolean>) => {
  const res = await client.get<BackendProduct[]>('/products/dupatta/products', params ? { params } : undefined);
  return res.data;
};

export const getProduct = async (id: number) => {
  const res = await client.get<BackendProduct>(`/products/${id}`);
  return res.data;
};

export const getProductReviews = async (productId: number) => {
  const res = await client.get<ProductReview[]>(`/products/${productId}/reviews`);
  return res.data;
};

export const createProductReview = async (
  productId: number,
  payload: { rating: number; title: string; comment: string }
) => {
  const res = await client.post<{ success: boolean; data: ProductReview }>(`/products/${productId}/reviews`, payload);
  return res.data;
};

export const aiSearchProducts = async (payload: AISearchRequestPayload) => {
  const res = await client.post<AISearchResponse>('/products/ai-search', payload);
  return res.data;
};

export const getPersonalizedRecommendations = async (
  level: 'basic' | 'intermediate' | 'advanced' = 'intermediate',
  limit = 12
) => {
  const res = await client.get<PersonalizedRecommendationsResponse>('/recommendations/personalized', {
    params: { level, limit },
  });
  return res.data;
};

export const getStyleQuizProfile = async () => {
  const res = await client.get<StyleQuizResponse>('/recommendations/style-quiz/me');
  return res.data;
};

export const saveStyleQuizProfile = async (payload: {
  preferred_categories: string[];
  preferred_colors: string[];
  preferred_materials: string[];
  budget_max?: number | null;
  occasions: string[];
}) => {
  const res = await client.post<{ success: boolean; profile: StyleQuizProfile }>('/recommendations/style-quiz', payload);
  return res.data;
};

export const trackSearchEvent = async (query: string) => {
  const res = await client.post<{ success: boolean }>('/recommendations/track-search', { query });
  return res.data;
};

export const chatAssistant = async (payload: {
  message: string;
  context?: Record<string, unknown>;
}) => {
  const res = await client.post<ChatAssistantResponse>('/chat/assistant', payload);
  return res.data;
};

export const getBlog = async () => {
  const res = await client.get('/pages/blog');
  return res.data;
};

export const getFaqs = async () => {
  const res = await client.get('/pages/faqs');
  return res.data;
};

export const postContact = async (payload: ContactPayload) => {
  const res = await client.post<{ success: boolean; message: string; data: ContactMessage }>('/pages/contact', payload);
  return res.data;
};

export const getMyContactMessages = async () => {
  const res = await client.get<ContactMessage[]>('/pages/contact');
  return res.data;
};

export const getAdminProducts = async () => {
  const res = await client.get<BackendProduct[]>('/products/admin/products');
  return res.data;
};

export const createAdminProduct = async (payload: AdminProductPayload) => {
  const res = await client.post<{ success: boolean; data: BackendProduct }>('/products/admin/products', payload);
  return res.data;
};

export const updateAdminProduct = async (productId: number, payload: AdminProductPayload) => {
  const res = await client.put<{ success: boolean; data: BackendProduct }>(`/products/admin/products/${productId}`, payload);
  return res.data;
};

export const deleteAdminProduct = async (productId: number) => {
  const res = await client.delete<{ success: boolean }>(`/products/admin/products/${productId}`);
  return res.data;
};

export const uploadAdminProductImage = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await client.post<{ success: boolean; image_url: string }>('/products/admin/upload-image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getAdminContacts = async () => {
  const res = await client.get<ContactMessage[]>('/pages/admin/contact');
  return res.data;
};

export const getAdminUsers = async () => {
  const res = await client.get<AdminUser[]>('/auth/admin/users');
  return res.data;
};

export const getAdminOrders = async () => {
  const res = await client.get<AdminOrder[]>('/orders/admin/all');
  return res.data;
};

export const getCart = async () => {
  try {
    const res = await client.get<CartEntry[]>('/cart/');
    return res.data;
  } catch {
    return mockCartData;
  }
};

export const addToCart = async (payload: CartEntry) => {
  try {
    const res = await client.post('/cart/', payload);
    return res.data;
  } catch {
    const existingItem = mockCartData.find((item) => item.product_id === payload.product_id);
    if (existingItem) {
      existingItem.quantity += payload.quantity;
    } else {
      mockCartData.push(payload);
    }
    return { success: true };
  }
};

export const updateCart = async (product_id: number, payload: { quantity: number }) => {
  try {
    const res = await client.put(`/cart/${product_id}`, payload);
    return res.data;
  } catch {
    const item = mockCartData.find((entry) => entry.product_id === product_id);
    if (item) {
      item.quantity = payload.quantity;
    }
    return { success: true };
  }
};

export const removeFromCart = async (product_id: number) => {
  try {
    const res = await client.delete(`/cart/${product_id}`);
    return res.data;
  } catch {
    const index = mockCartData.findIndex((entry) => entry.product_id === product_id);
    if (index > -1) {
      mockCartData.splice(index, 1);
    }
    return { success: true };
  }
};

export const getOrders = async () => {
  const res = await client.get<OrderResponse[]>('/orders/');
  return res.data;
};

export const checkout = async (payload?: {
  address_id?: number;
  shipping_address?: AddressPayload;
  payment_method?: string;
  payment_details?: Record<string, string>;
  notes?: string;
  items?: CartEntry[];
}) => {
  const res = await client.post<{ success: boolean; order: OrderResponse }>('/orders/checkout', payload || {});
  return res.data;
};

export const getAddresses = async () => {
  const res = await client.get<AddressResponse[]>('/profile/addresses');
  return res.data;
};

export const createAddress = async (payload: AddressPayload) => {
  const res = await client.post<AddressResponse>('/profile/addresses', payload);
  return res.data;
};

export const updateAddressRecord = async (addressId: number, payload: AddressPayload) => {
  const res = await client.put<AddressResponse>(`/profile/addresses/${addressId}`, payload);
  return res.data;
};

export const deleteAddressRecord = async (addressId: number) => {
  const res = await client.delete<{ success: boolean }>(`/profile/addresses/${addressId}`);
  return res.data;
};

export default client;
