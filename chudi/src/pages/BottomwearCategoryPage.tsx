import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { SubAppHeader } from '../components/SubAppHeader';
import { ProductCard } from '../components/ProductCard';
import { Sidebar } from '../components/Sidebar';
import { bottomwearProducts } from '../data/bottomwearProducts';
import { getBottomwearProducts, type BackendProduct } from '../services/api';
import { type FilterOptions, type Product } from '../types/index';
import { mapBackendProductToProduct } from '../utils/productMapper';
import { parseNaturalLanguageSearch } from '../utils/searchParser';
import '../styles/BottomwearCategoryPage.css';

const CATEGORY_MAP: Record<string, string> = {
  leggins: 'Leggins',
  bellbottom: 'Bell Bottom Pants',
  palazzo: 'Palazzo Pants',
  straightpant: 'Straight Pants',
  wideleg: 'Wide Leg Pants',
  printedpalazzo: 'Printed Palazzo Pants',
};

interface BottomwearCategoryPageProps {
  themeMode: 'light' | 'dark';
  onThemeToggle: () => void;
  wishlistCount: number;
  cartCount: number;
  onWishlistClick: () => void;
  onCartClick: () => void;
  onFooterNavigate: (page: string) => void;
}

export const BottomwearCategoryPage: React.FC<BottomwearCategoryPageProps> = ({
  themeMode,
  onThemeToggle,
  wishlistCount,
  cartCount,
  onWishlistClick,
  onCartClick,
  onFooterNavigate,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    priceRange: [0, 5000],
    color: '',
    size: '',
    rating: 0,
    materials: [],
  });

  const categorySlug = useMemo(() => {
    const normalized = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (!normalized.startsWith('bottomwear/')) {
      return '';
    }
    return normalized.split('/')[1] ?? '';
  }, [location.pathname]);

  const categoryName = useMemo(() => CATEGORY_MAP[categorySlug] ?? '', [categorySlug]);

  const matchesQuery = (product: Product, query: string) => {
    if (!query.trim()) return true;
    const normalized = query.trim().toLowerCase();
    const haystack = [
      product.name,
      product.description,
      product.category,
      product.material,
      product.color,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalized);
  };

  const visibleProducts = useMemo(() => {
    const parsed = parseNaturalLanguageSearch(searchQuery);
    const parsedColor = parsed.filters.color ?? '';
    const parsedCategory = parsed.filters.category ?? '';
    const parsedSize = parsed.filters.size ?? '';
    const parsedMinPrice = parsed.filters.min_price;
    const parsedMaxPrice = parsed.filters.max_price;
    let filtered = [...products];
    filtered = filtered.filter((item) => matchesQuery(item, searchQuery));
    if (filters.categories.length > 0) {
      filtered = filtered.filter((item) => filters.categories.includes(item.category));
    }
    if (parsedCategory) {
      const normalizedCategory = parsedCategory.toLowerCase();
      filtered = filtered.filter((item) => item.category.toLowerCase().includes(normalizedCategory));
    }
    if (filters.color) {
      filtered = filtered.filter((item) => item.color === filters.color);
    }
    if (parsedColor) {
      const normalizedColor = parsedColor.toLowerCase();
      filtered = filtered.filter((item) => item.color.toLowerCase().includes(normalizedColor));
    }
    if (filters.materials.length > 0) {
      filtered = filtered.filter((item) => filters.materials.includes(item.material));
    }
    if (filters.size) {
      filtered = filtered.filter((item) => item.sizes.some((size) => size.size === filters.size));
    }
    if (parsedSize) {
      filtered = filtered.filter((item) => item.sizes.some((size) => size.size === parsedSize));
    }
    if (filters.rating) {
      filtered = filtered.filter((item) => item.rating >= filters.rating);
    }
    const effectiveMinPrice =
      parsedMinPrice !== undefined && parsedMinPrice !== null ? parsedMinPrice : filters.priceRange[0];
    const effectiveMaxPrice =
      parsedMaxPrice !== undefined && parsedMaxPrice !== null ? parsedMaxPrice : filters.priceRange[1];
    return filtered.filter((item) => item.price >= effectiveMinPrice && item.price <= effectiveMaxPrice);
  }, [products, filters, searchQuery]);

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      setLoading(true);
      const fallbackCategoryProducts = categoryName
        ? bottomwearProducts.filter((item) => item.category === categoryName)
        : bottomwearProducts;
      try {
        const data = await getBottomwearProducts(categoryName ? { category: categoryName } : undefined);
        let mapped = data.map((item: BackendProduct) => mapBackendProductToProduct(item));
        if (mapped.length === 0 && categoryName) {
          const all = await getBottomwearProducts();
          mapped = all
            .filter((item: BackendProduct) => item.category === categoryName)
            .map((item: BackendProduct) => mapBackendProductToProduct(item));
        }
        if (mounted) {
          setProducts(mapped.length > 0 ? mapped : fallbackCategoryProducts);
        }
      } catch {
        if (mounted) {
          setProducts(fallbackCategoryProducts);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };
    loadProducts();
    return () => {
      mounted = false;
    };
  }, [categoryName]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const query = params.get('query') ?? '';
    setSearchQuery(query);
  }, [location.search]);

  const syncQueryToUrl = (nextQuery: string) => {
    const params = new URLSearchParams(location.search);
    if (nextQuery.trim()) {
      params.set('query', nextQuery.trim());
    } else {
      params.delete('query');
    }
    const nextSearch = params.toString();
    navigate(`${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
  };

  if (!categoryName) {
    return (
      <div className="bottomwear-category-page">
        <div className="container">
          <div className="bottomwear-category-header">
            <h1>Bottomwear Category</h1>
            <p>We could not find that category.</p>
            <button type="button" className="bottomwear-category-btn" onClick={() => navigate('/bottomwear')}>
              Back to Bottomwear Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bottomwear-category-page">
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
        onSearchChange={(value) => {
          setSearchQuery(value);
          syncQueryToUrl(value);
        }}
        onSearchSubmit={(value) => {
          setSearchQuery(value);
          syncQueryToUrl(value);
        }}
        themeMode={themeMode}
        onThemeToggle={onThemeToggle}
        wishlistCount={wishlistCount}
        cartCount={cartCount}
        onWishlistClick={onWishlistClick}
        onCartClick={onCartClick}
      />
      <div className="container">
        <div className="bottomwear-category-header">
          <div>
            <p className="bottomwear-category-tag">SheKurti Bottomwear</p>
            <h1>{categoryName}</h1>
            <p>Tap any product to view details, add to cart, and checkout.</p>
          </div>
          <div className="bottomwear-category-actions">
            <button type="button" className="bottomwear-category-btn secondary" onClick={() => navigate('/bottomwear')}>
              Bottomwear Home
            </button>
          </div>
        </div>

        {loading ? (
          <p className="bottomwear-category-loading">Loading products...</p>
        ) : (
          <div className="bottomwear-category-body">
            <Sidebar filters={filters} onFilterChange={setFilters} products={products} />
            <div className="bottomwear-category-main">
              {visibleProducts.length === 0 ? (
                <p className="bottomwear-category-loading">No products found. Please restart the backend.</p>
              ) : (
                <div className="bottomwear-category-grid">
                  {visibleProducts.map((product, idx) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isNew={idx % 5 === 0}
                      onViewDetails={(item) => navigate(`/bottomwear/product/${item.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <Footer onNavigate={onFooterNavigate} />
    </div>
  );
};
