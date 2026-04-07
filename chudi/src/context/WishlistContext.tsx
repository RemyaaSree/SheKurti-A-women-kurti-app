/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

const WISHLIST_STORAGE_KEY_PREFIX = 'shekurti_wishlist';

interface WishlistContextType {
  wishlistIds: number[];
  isInWishlist: (productId: number) => boolean;
  toggleWishlist: (productId: number) => void;
  clearWishlist: () => void;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const parseWishlist = (raw: string | null): number[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as number[];
    if (Array.isArray(parsed)) {
      return parsed.filter((id) => Number.isInteger(id));
    }
    return [];
  } catch {
    return [];
  }
};

export const WishlistProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, sessionId } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<number[]>([]);
  const wishlistStorageKey = useMemo(() => {
    if (!user) {
      return `${WISHLIST_STORAGE_KEY_PREFIX}_guest`;
    }
    return `${WISHLIST_STORAGE_KEY_PREFIX}_${user.id}_${sessionId ?? 'no-session'}`;
  }, [user, sessionId]);

  useEffect(() => {
    // Sync local state whenever account/session namespace changes.
    setWishlistIds(parseWishlist(localStorage.getItem(wishlistStorageKey)));
  }, [wishlistStorageKey]);

  useEffect(() => {
    localStorage.setItem(wishlistStorageKey, JSON.stringify(wishlistIds));
  }, [wishlistIds, wishlistStorageKey]);

  const toggleWishlist = useCallback((productId: number) => {
    setWishlistIds((previous) =>
      previous.includes(productId)
        ? previous.filter((id) => id !== productId)
        : [...previous, productId]
    );
  }, []);

  const isInWishlist = useCallback((productId: number) => wishlistIds.includes(productId), [wishlistIds]);

  const clearWishlist = useCallback(() => setWishlistIds([]), []);

  const value: WishlistContextType = { wishlistIds, isInWishlist, toggleWishlist, clearWishlist };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
};
