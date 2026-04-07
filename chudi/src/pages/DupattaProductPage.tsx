import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { SubAppHeader } from '../components/SubAppHeader';
import { ProductDetailPage } from './ProductDetailPage';

interface DupattaProductPageProps {
  themeMode: 'light' | 'dark';
  onThemeToggle: () => void;
  wishlistCount: number;
  cartCount: number;
  onWishlistClick: () => void;
  onCartClick: () => void;
  onFooterNavigate: (page: string) => void;
}

export const DupattaProductPage: React.FC<DupattaProductPageProps> = ({
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
    if (!normalized.startsWith('dupatta/product/')) {
      return -1;
    }
    const [, , rawId] = normalized.split('/');
    const parsedId = Number(rawId);
    return Number.isNaN(parsedId) ? -1 : parsedId;
  }, [location.pathname]);

  return (
    <div className="dupatta-product-page">
      <SubAppHeader
        brandLabel="SHEKURTI DUPATTA"
        brandPath="/dupatta"
        navItems={[
          { label: 'New Arrivals', path: '/dupatta' },
          { label: 'Festive', path: '/dupatta' },
          { label: 'Everyday', path: '/dupatta' },
          { label: 'Bridal', path: '/dupatta' },
          { label: 'Shop All', path: '/dupatta/shop' },
        ]}
        showSearch
        searchValue={searchQuery}
        searchPlaceholder="Search dupatta"
        onSearchChange={setSearchQuery}
        onSearchSubmit={(query) => navigate(`/dupatta?query=${encodeURIComponent(query)}`)}
        themeMode={themeMode}
        onThemeToggle={onThemeToggle}
        wishlistCount={wishlistCount}
        cartCount={cartCount}
        onWishlistClick={onWishlistClick}
        onCartClick={onCartClick}
      />
      <ProductDetailPage productId={productId} productContext="dupatta" />
      <Footer onNavigate={onFooterNavigate} />
    </div>
  );
};
