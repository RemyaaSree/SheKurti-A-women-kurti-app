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
import '../styles/BottomwearListingPage.css';

type SortOption = 'recommended' | 'price-low' | 'price-high' | 'rating';

interface BottomwearListingPageProps {
  themeMode: 'light' | 'dark';
  onThemeToggle: () => void;
  wishlistCount: number;
  cartCount: number;
  onWishlistClick: () => void;
  onCartClick: () => void;
  onFooterNavigate: (page: string) => void;
}

export const BottomwearListingPage: React.FC<BottomwearListingPageProps> = ({
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
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<FilterOptions>({
    categories: [],
    priceRange: [0, 5000],
    color: '',
    size: '',
    rating: 0,
    materials: [],
  });

  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      setLoading(true);
      try {
        const data = await getBottomwearProducts();
        const mapped = data.map((item: BackendProduct) => mapBackendProductToProduct(item));
        if (mounted) {
          setProducts(mapped.length > 0 ? mapped : bottomwearProducts);
        }
      } catch {
        if (mounted) {
          setProducts(bottomwearProducts);
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
  }, []);

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
    navigate(`/bottomwear/shop${nextSearch ? `?${nextSearch}` : ''}`, { replace: true });
  };

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
    filtered = filtered.filter((item) => item.price >= effectiveMinPrice && item.price <= effectiveMaxPrice);

    const result = [...filtered];
    if (sortBy === 'price-low') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else {
      for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
    }
    return result;
  }, [products, filters, sortBy, searchQuery]);

  return (
    <div className="bottomwear-listing-page">
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
        <div className="bottomwear-listing-header">
          <div>
            <p className="bottomwear-listing-tag">SheKurti Bottomwear</p>
            <h1>Bottomwear Collection</h1>
            <p>Browse the full bottomwear catalog with sorting and category filters.</p>
          </div>
          <div className="bottomwear-listing-actions">
            <button type="button" className="bottomwear-listing-btn secondary" onClick={() => navigate('/bottomwear')}>
              Bottomwear Home
            </button>
          </div>
        </div>

        <div className="bottomwear-listing-toolbar">
          <div className="bottomwear-sort">
            <label htmlFor="bottomwear-sort">Sort by:</label>
            <select
              id="bottomwear-sort"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as SortOption)}
            >
              <option value="recommended">Recommended</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {loading ? (
          <p className="bottomwear-listing-loading">Loading bottomwear products...</p>
        ) : (
          <div className="bottomwear-listing-body">
            <Sidebar filters={filters} onFilterChange={setFilters} products={products} />
            <div className="bottomwear-listing-grid">
              {visibleProducts.map((product, idx) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isNew={idx % 5 === 0}
                  onViewDetails={(item) => navigate(`/bottomwear/product/${item.id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <Footer onNavigate={onFooterNavigate} />
    </div>
  );
};
