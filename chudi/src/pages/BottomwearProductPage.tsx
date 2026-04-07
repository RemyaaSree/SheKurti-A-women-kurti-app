import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { SubAppHeader } from '../components/SubAppHeader';
import { ProductDetailPage } from './ProductDetailPage';

interface BottomwearProductPageProps {
  themeMode: 'light' | 'dark';
  onThemeToggle: () => void;
  wishlistCount: number;
  cartCount: number;
  onWishlistClick: () => void;
  onCartClick: () => void;
  onFooterNavigate: (page: string) => void;
}

export const BottomwearProductPage: React.FC<BottomwearProductPageProps> = ({
  themeMode,
  onThemeToggle,
  wishlistCount,
  cartCount,
  onWishlistClick,
  onCartClick,
  onFooterNavigate,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState('');
  const productId = useMemo(() => {
    const normalized = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!normalized.startsWith('bottomwear/product/')) {
      return -1;
    }
    const [, , rawId] = normalized.split('/');
    const parsedId = Number(rawId);
    return Number.isNaN(parsedId) ? -1 : parsedId;
  }, [location.pathname]);
  return (
    <div className="bottomwear-product-page">
      <SubAppHeader
        brandLabel="SHEKURTI BOTTOMWEAR"
        brandPath="/bottomwear"
        navItems={[
          { label: 'New Arrivals', path: '/bottomwear' },
          { label: 'Leggins', path: '/bottomwear/leggins' },
          { label: 'Palazzo', path: '/bottomwear/palazzo' },
          { label: 'Straight Pants', path: '/bottomwear/straightpant' },
          { label: 'Shop All', path: '/bottomwear/shop' },
        ]}
        showSearch
        searchValue={searchQuery}
        searchPlaceholder="Search bottomwear"
        onSearchChange={setSearchQuery}
        onSearchSubmit={(query) => navigate(`/bottomwear/shop?query=${encodeURIComponent(query)}`)}
        themeMode={themeMode}
        onThemeToggle={onThemeToggle}
        wishlistCount={wishlistCount}
        cartCount={cartCount}
        onWishlistClick={onWishlistClick}
        onCartClick={onCartClick}
      />
      <ProductDetailPage
        productId={productId}
        productContext="bottomwear"
      />
      <Footer onNavigate={onFooterNavigate} />
    </div>
  );
};
