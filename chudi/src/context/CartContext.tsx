/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { CartItem, Product } from '../types/index';
import { products } from '../data/products';
import { mapBackendProductToProduct } from '../utils/productMapper';
import {
  getCart,
  addToCart as apiAddToCart,
  updateCart as apiUpdateCart,
  removeFromCart as apiRemoveFromCart,
  getProduct,
  getBottomwearProducts,
  type BackendProduct,
  type CartEntry,
} from '../services/api';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product, quantity: number, selectedSize?: string) => Promise<void>;
  removeFromCart: (productId: number) => Promise<void>;
  updateQuantity: (productId: number, quantity: number) => Promise<void>;
  updateItemSize: (productId: number, size: string) => void;
  clearCart: () => Promise<void>;
  cartTotal: number;
  cartItemCount: number;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_SIZE_MAP_KEY = 'shekurti_cart_size_map';

const normalizeBackendProduct = (product: BackendProduct): Product => mapBackendProductToProduct(product);

const isNonNullCartItem = (item: CartItem | null): item is CartItem => item !== null;
const getDefaultSize = (product: Product): string =>
  product.sizes.find((sizeOption) => sizeOption.stock > 0)?.size ?? product.sizes[0]?.size ?? 'M';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [cartSizeMap, setCartSizeMap] = useState<Record<number, string>>(() => {
    try {
      const raw = localStorage.getItem(CART_SIZE_MAP_KEY);
      if (!raw) {
        return {};
      }
      const parsed = JSON.parse(raw) as Record<string, string>;
      return Object.entries(parsed).reduce<Record<number, string>>((accumulator, [id, size]) => {
        const parsedId = Number(id);
        if (Number.isFinite(parsedId) && typeof size === 'string' && size.trim().length > 0) {
          accumulator[parsedId] = size;
        }
        return accumulator;
      }, {});
    } catch {
      return {};
    }
  });
  const cartSizeMapRef = React.useRef(cartSizeMap);
  const bottomwearCatalogRef = React.useRef<Product[] | null>(null);
  const bottomwearCatalogPromiseRef = React.useRef<Promise<Product[]> | null>(null);

  useEffect(() => {
    cartSizeMapRef.current = cartSizeMap;
    localStorage.setItem(CART_SIZE_MAP_KEY, JSON.stringify(cartSizeMap));
  }, [cartSizeMap]);

  const upsertCartSize = useCallback((productId: number, size: string) => {
    setCartSizeMap((previous) => ({ ...previous, [productId]: size }));
  }, []);

  const loadBottomwearCatalog = useCallback(async () => {
    if (bottomwearCatalogRef.current) {
      return bottomwearCatalogRef.current;
    }
    if (bottomwearCatalogPromiseRef.current) {
      return bottomwearCatalogPromiseRef.current;
    }
    bottomwearCatalogPromiseRef.current = (async () => {
      try {
        const data = await getBottomwearProducts();
        const mapped = Array.isArray(data) ? data.map(mapBackendProductToProduct) : [];
        bottomwearCatalogRef.current = mapped;
        return mapped;
      } catch {
        bottomwearCatalogRef.current = [];
        return [];
      } finally {
        bottomwearCatalogPromiseRef.current = null;
      }
    })();
    return bottomwearCatalogPromiseRef.current;
  }, []);

  const hydrateCartItems = useCallback(async (serverCart: CartEntry[]) => {
    const items = await Promise.all(
      serverCart.map(async (cartEntry): Promise<CartItem | null> => {
        try {
          const product = await getProduct(cartEntry.product_id);
          const normalized = normalizeBackendProduct(product);
          return {
            ...normalized,
            quantity: cartEntry.quantity,
            selectedSize: cartSizeMapRef.current[cartEntry.product_id] ?? getDefaultSize(normalized),
          };
        } catch {
          try {
            const bottomwearCatalog = await loadBottomwearCatalog();
            const bottomwearMatch = bottomwearCatalog.find((candidate) => candidate.id === cartEntry.product_id);
            if (bottomwearMatch) {
              return {
                ...bottomwearMatch,
                quantity: cartEntry.quantity,
                selectedSize: cartSizeMapRef.current[cartEntry.product_id] ?? getDefaultSize(bottomwearMatch),
              };
            }
          } catch {
            // fall through to local fallback
          }
          const localProduct = products.find((candidate) => candidate.id === cartEntry.product_id);
          if (localProduct) {
            return {
              ...localProduct,
              quantity: cartEntry.quantity,
              selectedSize: cartSizeMapRef.current[cartEntry.product_id] ?? getDefaultSize(localProduct),
            };
          }
          return null;
        }
      })
    );

    return items.filter(isNonNullCartItem);
  }, [loadBottomwearCatalog]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        const serverCart = await getCart();
        const hydratedItems = await hydrateCartItems(serverCart);
        if (mounted) {
          setCartItems(hydratedItems);
        }
      } catch (error) {
        console.error('Failed to load cart', error);
        if (mounted) {
          setCartItems([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [hydrateCartItems]);

  const refreshCartFromServer = useCallback(async () => {
    setLoading(true);
    try {
      const serverCart = await getCart();
      const hydratedItems = await hydrateCartItems(serverCart);
      setCartItems(hydratedItems);
    } catch (error) {
      console.error('Failed to refresh cart', error);
    } finally {
      setLoading(false);
    }
  }, [hydrateCartItems]);

  const addToCart = useCallback(
    async (product: Product, quantity: number, selectedSize?: string) => {
      const nextSize = selectedSize ?? cartSizeMapRef.current[product.id] ?? getDefaultSize(product);
      upsertCartSize(product.id, nextSize);
      try {
        await apiAddToCart({ product_id: product.id, quantity });
        await refreshCartFromServer();
      } catch (error) {
        console.error('Failed to add to cart', error);
      }
    },
    [refreshCartFromServer, upsertCartSize]
  );

  const removeFromCart = useCallback(
    async (productId: number) => {
      try {
        await apiRemoveFromCart(productId);
        setCartSizeMap((previous) => {
          const next = { ...previous };
          delete next[productId];
          return next;
        });
        await refreshCartFromServer();
      } catch (error) {
        console.error('Failed to remove from cart', error);
      }
    },
    [refreshCartFromServer]
  );

  const updateQuantity = useCallback(
    async (productId: number, quantity: number) => {
      if (quantity <= 0) {
        await removeFromCart(productId);
        return;
      }

      try {
        await apiUpdateCart(productId, { quantity });
        await refreshCartFromServer();
      } catch (error) {
        console.error('Failed to update cart', error);
      }
    },
    [refreshCartFromServer, removeFromCart]
  );

  const clearCart = useCallback(async () => {
    try {
      await Promise.allSettled(cartItems.map((item) => apiRemoveFromCart(item.id)));
    } catch (error) {
      console.error('Failed to clear cart', error);
    } finally {
      setCartItems([]);
      setCartSizeMap({});
    }
  }, [cartItems]);

  const updateItemSize = useCallback((productId: number, size: string) => {
    if (!size) {
      return;
    }
    upsertCartSize(productId, size);
    setCartItems((previous) =>
      previous.map((item) => (item.id === productId ? { ...item, selectedSize: size } : item))
    );
  }, [upsertCartSize]);

  const cartTotal = cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
  const cartItemCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateItemSize,
        clearCart,
        cartTotal,
        cartItemCount,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};
