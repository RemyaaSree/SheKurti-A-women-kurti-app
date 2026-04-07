import { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  TopBanner,
  Header,
  Hero,
  ExploreVarieties,
  ShopByValue,
  HomeCurations,
  NewStoreSection,
  Sidebar,
  ProductCard,
  ProductModal,
  Cart,
  Wishlist,
  Footer,
  ChatWidget,
  AuthGate,
} from './components';
import {
  ContactPage,
  FAQPage,
  AboutPage,
  StoryPage,
  BlogPage,
  PaymentPage,
  ProductDetailPage,
  ServiceInfoPage,
  ProfileDashboardPage,
  AdminProductsPage,
  BottomWearPage,
  BottomwearCategoryPage,
  BottomwearProductPage,
  BottomwearListingPage,
  DupattaPage,
  DupattaListingPage,
  DupattaProductPage,
  NewStorePage,
} from './pages';
import { products as fallbackProducts } from './data/products';
import { type Product, type FilterOptions } from './types/index';
import { getCollectionBySlug, getFiltersForCollection } from './data/collections';
import { useAuth } from './context/AuthContext';
import { useCart } from './context/CartContext';
import { useWishlist } from './context/WishlistContext';
import { aiSearchProducts, getPersonalizedRecommendations, getProducts, trackSearchEvent } from './services/api';
import { mapBackendProductToProduct } from './utils/productMapper';
import { parseNaturalLanguageSearch } from './utils/searchParser';
import './App.css';

type ThemeMode = 'light' | 'dark';

function App() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const { cartItemCount } = useCart();
  const { wishlistIds } = useWishlist();
  const location = useLocation();
  const navigate = useNavigate();
  const [showCart, setShowCart] = useState(false);
  const [showWishlist, setShowWishlist] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePage, setActivePage] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('recommended');
  const [filters, setFilters] = useState<FilterOptions>(getFiltersForCollection());
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(fallbackProducts);
  const [personalizedProducts, setPersonalizedProducts] = useState<Product[]>([]);
  const [aiResultProducts, setAiResultProducts] = useState<Product[] | null>(null);
  const [searchHighlightTerms, setSearchHighlightTerms] = useState<string[]>([]);
  const [aiSearchLoading, setAiSearchLoading] = useState(false);
  const [aiSearchError, setAiSearchError] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(true);
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem('shekurti_theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const servicePageContent: Record<string, { title: string; content: string[] }> = {
    returns: {
      title: 'Returns & Exchanges',
      content: [
        'You can request return or exchange within 7 days from delivery.',
        'Products should be unused, unwashed, and with original tags attached.',
        'Refunds are processed to the original payment mode after a quality check.',
      ],
    },
    shipping: {
      title: 'Shipping Policy',
      content: [
        'Standard shipping takes 3-7 business days depending on your location.',
        'Shipping updates are shared through email and SMS once dispatched.',
        'Prepaid orders are prioritized for dispatch where possible.',
      ],
    },
    track: {
      title: 'Track Order',
      content: [
        'Use your order ID from confirmation message to track status.',
        'Tracking details are updated once the parcel is handed to courier.',
        'For issues, contact support with order ID and registered phone number.',
      ],
    },
    'size-guide': {
      title: 'Size Guide',
      content: [
        'Measure bust, waist, and hip using a measuring tape.',
        'Compare your measurements against the size chart shown on products.',
        'If you are between sizes, choose the larger size for a comfortable fit.',
      ],
    },
    privacy: {
      title: 'Privacy Policy',
      content: [
        'We collect only necessary details such as name, contact, address, and order history to process purchases.',
        'Payment details are handled through secure payment providers and are not stored in plain text by the app.',
        'We do not sell your personal data to third parties. Data is used only for order fulfillment, support, and service improvement.',
        'You can request account data correction or deletion by contacting support@shekurti.com.',
      ],
    },
    terms: {
      title: 'Terms of Service',
      content: [
        'By using this app, you agree to provide accurate account and order information.',
        'Prices, offers, and product availability may change without prior notice.',
        'Misuse of the app, fraudulent transactions, or policy abuse may result in account suspension.',
        'All purchases are subject to return, shipping, and payment policies shown in the app.',
      ],
    },
    disclaimer: {
      title: 'Disclaimer',
      content: [
        'Product colors may vary slightly due to lighting, camera, and display differences.',
        'Size and fit can vary slightly by fabric and design. Please use size guide before ordering.',
        'Delivery timelines are estimates and may vary due to courier or regional conditions.',
        'The app content is provided as-is without guarantees of uninterrupted availability.',
      ],
    },
    cookies: {
      title: 'Cookie Policy',
      content: [
        'This app may use cookies or local storage to keep you logged in and remember preferences.',
        'Session and functional cookies improve performance and shopping experience.',
        'You can clear browser/app storage at any time, which may reset saved preferences.',
        'Continuing to use the app indicates consent to these essential storage practices.',
      ],
    },
  };

  const normalizedPath = useMemo(
    () => location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase(),
    [location.pathname]
  );
  const isHomePage = normalizedPath === '';
  const isPaymentPage = normalizedPath === 'payment';
  const isProductDetailPage = normalizedPath.startsWith('product/');
  const isProfilePage = normalizedPath === 'profile' || normalizedPath.startsWith('profile/');
  const isAdminPage = normalizedPath === 'admin' || normalizedPath.startsWith('admin/');
  const isBottomwearApp = normalizedPath.startsWith('bottomwear');
  const isDupattaApp = normalizedPath.startsWith('dupatta');
  const isBottomWearPage = normalizedPath === 'bottomwear';
  const isBottomwearCategoryPage = normalizedPath.startsWith('bottomwear/');
  const isBottomwearProductPage = normalizedPath.startsWith('bottomwear/product/');
  const isBottomwearListingPage = normalizedPath === 'bottomwear/shop';
  const isDupattaPage = normalizedPath === 'dupatta';
  const isDupattaListingPage = normalizedPath === 'dupatta/shop';
  const isDupattaProductPage = normalizedPath.startsWith('dupatta/product/');
  const isNewStorePage = normalizedPath === 'newstore';
  const productIdFromPath = useMemo(() => {
    if (!isProductDetailPage) return null;
    const [, id] = normalizedPath.split('/');
    const parsedId = Number(id);
    return Number.isNaN(parsedId) ? null : parsedId;
  }, [isProductDetailPage, normalizedPath]);

  const activeCollection = useMemo(() => {
    if (isHomePage || normalizedPath === 'shop' || isPaymentPage || isProductDetailPage) return undefined;
    return getCollectionBySlug(normalizedPath);
  }, [isHomePage, isPaymentPage, isProductDetailPage, normalizedPath]);
  const listingTitle = useMemo(() => {
    if (activeCollection?.name) {
      return activeCollection.name;
    }
    return 'All Products';
  }, [activeCollection]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
    window.localStorage.setItem('shekurti_theme', themeMode);
  }, [themeMode]);

  useEffect(() => {
    setFilters(getFiltersForCollection(activeCollection));
  }, [activeCollection]);

  const handleShopCollection = () => {
    navigate('/shop');
  };

  const handleShopByValue = (maxPrice: number) => {
    setAiResultProducts(null);
    setSearchQuery('');
    setSearchHighlightTerms([]);
    setFilters({
      categories: [],
      priceRange: [0, maxPrice],
      color: '',
      size: '',
      rating: 0,
      materials: [],
    });
    navigate('/shop');
  };

  const handleFooterNavigate = (page: string) => {
    setActivePage(page);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setAiSearchError(null);
    if (!query.trim()) {
      setAiResultProducts(null);
      setSearchHighlightTerms([]);
    }
  };

  const normalizeText = (value: string) => value.trim().toLowerCase();
  const genericTokens = new Set(['kurti', 'kurtis', 'kurta', 'set', 'sets', 'wear', 'women', 'womens']);

  const toTokens = (value: string) =>
    normalizeText(value)
      .split(/[\s/-]+/)
      .filter(Boolean);

  const queryTokenMatches = (query: string, product: Product) => {
    const tokens = toTokens(query).filter((token) => token.length > 1);
    if (tokens.length === 0) return true;
    const haystack = [
      product.name,
      product.description,
      product.category,
      product.material,
      product.color,
    ]
      .map(normalizeText)
      .join(' ');
    const meaningfulTokens = tokens.filter((token) => !genericTokens.has(token));
    const activeTokens = meaningfulTokens.length > 0 ? meaningfulTokens : tokens;
    return activeTokens.some((token) => haystack.includes(token));
  };

  const colorMatches = (productColor: string, filterColor: string) => {
    if (!filterColor) return true;
    const product = normalizeText(productColor);
    const filter = normalizeText(filterColor);
    if (product === filter) return true;
    if (product.includes(filter) || filter.includes(product)) return true;
    const productTokens = new Set(toTokens(product));
    const filterTokens = toTokens(filter);
    return filterTokens.some((token) => productTokens.has(token));
  };

  const categoryMatches = (productCategory: string, filterCategory: string) => {
    if (!filterCategory) return true;
    const product = normalizeText(productCategory);
    const filter = normalizeText(filterCategory);
    if (product === filter) return true;
    if (product.includes(filter) || filter.includes(product)) return true;
    const productTokens = new Set(toTokens(product));
    const filterTokens = toTokens(filter);
    return filterTokens.some((token) => productTokens.has(token));
  };

  const resolveCategoryFilters = (categoryQuery: string, products: Product[]) => {
    const normalizedQuery = normalizeText(categoryQuery);
    if (!normalizedQuery) return [];
    const categories = Array.from(new Set(products.map((product) => product.category).filter(Boolean)));
    return categories.filter((category) => categoryMatches(category, normalizedQuery));
  };

  const buildLocalSearchMatches = (
    query: string,
    parsedQuery: ReturnType<typeof parseNaturalLanguageSearch>,
    products: Product[]
  ) => {
    const normalizedQuery = normalizeText(query);
    const categoryFilter = parsedQuery.filters.category ?? '';
    const colorFilter = parsedQuery.filters.color ?? '';
    return products.filter((product) => {
      const matchesQuery = !normalizedQuery || queryTokenMatches(normalizedQuery, product);
      const matchesColor = colorFilter ? colorMatches(product.color, colorFilter) : true;
      const matchesCategory = categoryFilter ? categoryMatches(product.category, categoryFilter) : true;
      return matchesQuery && matchesColor && matchesCategory;
    });
  };

  const handleAISearch = async (payload: {
    query?: string;
    source: 'text' | 'voice' | 'image';
    dominantColor?: string;
    visualTags?: string[];
    candidateProductIds?: number[];
  }) => {
    setAiSearchLoading(true);
    setAiSearchError(null);
    try {
      const parsed = parseNaturalLanguageSearch(payload.query ?? '');
      const response = await aiSearchProducts({
        query: payload.query,
        source: payload.source,
        dominant_color: payload.dominantColor,
        visual_tags: payload.visualTags,
        candidate_product_ids: payload.candidateProductIds,
        structured_filters: { ...parsed.filters },
        limit: 48,
      });

      if (payload.query?.trim()) {
        void trackSearchEvent(payload.query.trim()).catch(() => undefined);
      }

      const mapped = response.results.map(mapBackendProductToProduct).filter((item) => item.id > 0);
      setSearchHighlightTerms(parsed.highlightTerms);
      if (payload.query) {
        setSearchQuery(payload.query);
      }

      if (mapped.length === 0) {
        const fallbackBase = getFiltersForCollection(activeCollection);
        const categories = parsed.filters.category
          ? resolveCategoryFilters(parsed.filters.category, catalogProducts)
          : fallbackBase.categories;
        setFilters({
          ...fallbackBase,
          categories,
          color: parsed.filters.color ?? '',
          size: parsed.filters.size ?? '',
          priceRange: [
            parsed.filters.min_price ?? fallbackBase.priceRange[0],
            parsed.filters.max_price ?? fallbackBase.priceRange[1],
          ],
        });
        setAiResultProducts(null);
      } else {
        const localMatches = buildLocalSearchMatches(
          payload.query ?? '',
          parsed,
          catalogProducts.length > 0 ? catalogProducts : fallbackProducts
        );
        const merged = [...mapped];
        for (const candidate of localMatches) {
          if (!merged.some((item) => item.id === candidate.id)) {
            merged.push(candidate);
          }
        }
        setAiResultProducts(merged);
      }

      if (isHomePage) {
        navigate('/shop');
      }
    } catch (error) {
      console.error('AI search failed', error);
      setAiSearchError('Search failed. Please retry.');
      setAiResultProducts(null);
    } finally {
      setAiSearchLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const loadProducts = async () => {
      setIsCatalogLoading(true);
      try {
        const params = activeCollection?.backendSection
          ? { section: activeCollection.backendSection }
          : undefined;
        const data = await getProducts(params);
        if (mounted && Array.isArray(data) && data.length > 0) {
          setCatalogProducts(data.map(mapBackendProductToProduct));
        } else if (mounted) {
          setCatalogProducts(fallbackProducts);
        }
      } catch (error) {
        console.error('Failed to fetch products from backend', error);
        if (mounted) {
          setCatalogProducts(fallbackProducts);
        }
      } finally {
        if (mounted) {
          setIsCatalogLoading(false);
        }
      }
    };

    loadProducts();
    return () => {
      mounted = false;
    };
  }, [activeCollection?.backendSection]);

  useEffect(() => {
    let mounted = true;
    const loadPersonalized = async () => {
      try {
        const response = await getPersonalizedRecommendations('intermediate', 8);
        if (!mounted || !Array.isArray(response.results)) {
          return;
        }
        const mapped = response.results.map(mapBackendProductToProduct).filter((item) => item.id > 0);
        setPersonalizedProducts(mapped);
      } catch {
        if (mounted) {
          setPersonalizedProducts([]);
        }
      }
    };
    loadPersonalized();
    return () => {
      mounted = false;
    };
  }, []);


  const filteredProducts = useMemo(() => {
    const searchUniverse = aiResultProducts ?? catalogProducts;
    const isAIResultMode = aiResultProducts !== null;
    const parsedQuery = parseNaturalLanguageSearch(searchQuery);
    const parsedColor = parsedQuery.filters.color ?? '';
    const parsedCategory = parsedQuery.filters.category ?? '';
    const parsedSize = parsedQuery.filters.size ?? '';
    const parsedMinPrice = parsedQuery.filters.min_price;
    const parsedMaxPrice = parsedQuery.filters.max_price;
    const result = searchUniverse.filter((product) => {
      const normalizedQuery = normalizeText(searchQuery);
      const matchesSearch = isAIResultMode || !normalizedQuery || queryTokenMatches(normalizedQuery, product);

      const matchesCategory =
        filters.categories.length > 0
          ? filters.categories.includes(product.category)
          : parsedCategory
            ? categoryMatches(product.category, parsedCategory)
            : true;
      const effectiveMinPrice =
        parsedMinPrice !== undefined && parsedMinPrice !== null ? parsedMinPrice : filters.priceRange[0];
      const effectiveMaxPrice =
        parsedMaxPrice !== undefined && parsedMaxPrice !== null ? parsedMaxPrice : filters.priceRange[1];
      const matchesPrice = product.price >= effectiveMinPrice && product.price <= effectiveMaxPrice;
      const effectiveColor = filters.color || parsedColor;
      const matchesColor = !effectiveColor || colorMatches(product.color, effectiveColor);
      const matchesSize =
        filters.size
          ? product.sizes.some((productSize) => productSize.size === filters.size)
          : parsedSize
            ? product.sizes.some((productSize) => productSize.size === parsedSize)
            : true;
      const matchesRating = !filters.rating || product.rating >= filters.rating;
      const matchesMaterials = filters.materials.length === 0 || (product.material && filters.materials.includes(product.material));

      return (
        matchesSearch &&
        matchesCategory &&
        matchesPrice &&
        matchesColor &&
        matchesSize &&
        matchesRating &&
        matchesMaterials
      );
    });

    if (sortBy === 'price-low') {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-high') {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'recommended') {
      // Randomize default listing order so products are not shown alphabetically.
      for (let index = result.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
      }
    }

    return result;
  }, [searchQuery, filters, sortBy, catalogProducts, aiResultProducts]);

  const listedProducts = filteredProducts;

  if (isLoading) {
    return <div className="app">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <AuthGate />;
  }

  return (
    <div className="app">
      {!isBottomwearApp && !isDupattaApp ? (
        <>
          <TopBanner />
          <Header
            onCartClick={() => setShowCart(true)}
            onWishlistClick={() => setShowWishlist(true)}
            onSearchChange={handleSearchChange}
            onAISearch={handleAISearch}
            showSearch={!isHomePage}
            wishlistCount={wishlistIds.length}
            userName={user?.name ?? 'Account'}
            onProfileClick={() => navigate('/profile')}
            themeMode={themeMode}
            onThemeToggle={() => setThemeMode((previous) => (previous === 'light' ? 'dark' : 'light'))}
          />
        </>
      ) : null}

      {isHomePage ? (
        <>
          <Hero onShopCollection={handleShopCollection} />
          <ExploreVarieties />
          <ShopByValue onSelectValue={handleShopByValue} />
          <NewStoreSection
            onExploreBottomWear={() => navigate('/bottomwear')}
            onExploreDupatta={() => navigate('/dupatta')}
          />
          <HomeCurations products={catalogProducts} personalizedProducts={personalizedProducts} />
        </>
      ) : isPaymentPage ? (
        <PaymentPage />
      ) : isProductDetailPage ? (
        <ProductDetailPage productId={productIdFromPath ?? -1} />
      ) : isBottomWearPage ? (
        <BottomWearPage
          themeMode={themeMode}
          onThemeToggle={() => setThemeMode((previous) => (previous === 'light' ? 'dark' : 'light'))}
          wishlistCount={wishlistIds.length}
          cartCount={cartItemCount}
          onWishlistClick={() => setShowWishlist(true)}
          onCartClick={() => setShowCart(true)}
          onFooterNavigate={handleFooterNavigate}
        />
      ) : isBottomwearListingPage ? (
        <BottomwearListingPage
          themeMode={themeMode}
          onThemeToggle={() => setThemeMode((previous) => (previous === 'light' ? 'dark' : 'light'))}
          wishlistCount={wishlistIds.length}
          cartCount={cartItemCount}
          onWishlistClick={() => setShowWishlist(true)}
          onCartClick={() => setShowCart(true)}
          onFooterNavigate={handleFooterNavigate}
        />
      ) : isBottomwearProductPage ? (
        <BottomwearProductPage
          themeMode={themeMode}
          onThemeToggle={() => setThemeMode((previous) => (previous === 'light' ? 'dark' : 'light'))}
          wishlistCount={wishlistIds.length}
          cartCount={cartItemCount}
          onWishlistClick={() => setShowWishlist(true)}
          onCartClick={() => setShowCart(true)}
          onFooterNavigate={handleFooterNavigate}
        />
      ) : isBottomwearCategoryPage ? (
        <BottomwearCategoryPage
          themeMode={themeMode}
          onThemeToggle={() => setThemeMode((previous) => (previous === 'light' ? 'dark' : 'light'))}
          wishlistCount={wishlistIds.length}
          cartCount={cartItemCount}
          onWishlistClick={() => setShowWishlist(true)}
          onCartClick={() => setShowCart(true)}
          onFooterNavigate={handleFooterNavigate}
        />
      ) : isDupattaPage ? (
        <DupattaPage
          themeMode={themeMode}
          onThemeToggle={() => setThemeMode((previous) => (previous === 'light' ? 'dark' : 'light'))}
          wishlistCount={wishlistIds.length}
          cartCount={cartItemCount}
          onWishlistClick={() => setShowWishlist(true)}
          onCartClick={() => setShowCart(true)}
          onFooterNavigate={handleFooterNavigate}
        />
      ) : isDupattaListingPage ? (
        <DupattaListingPage
          themeMode={themeMode}
          onThemeToggle={() => setThemeMode((previous) => (previous === 'light' ? 'dark' : 'light'))}
          wishlistCount={wishlistIds.length}
          cartCount={cartItemCount}
          onWishlistClick={() => setShowWishlist(true)}
          onCartClick={() => setShowCart(true)}
          onFooterNavigate={handleFooterNavigate}
        />
      ) : isDupattaProductPage ? (
        <DupattaProductPage
          themeMode={themeMode}
          onThemeToggle={() => setThemeMode((previous) => (previous === 'light' ? 'dark' : 'light'))}
          wishlistCount={wishlistIds.length}
          cartCount={cartItemCount}
          onWishlistClick={() => setShowWishlist(true)}
          onCartClick={() => setShowCart(true)}
          onFooterNavigate={handleFooterNavigate}
        />
      ) : isNewStorePage ? (
        <NewStorePage />
      ) : isProfilePage ? (
        <ProfileDashboardPage user={user} onLogout={logout} />
      ) : isAdminPage ? (
        <AdminProductsPage isAdmin={Boolean(user?.is_admin)} />
      ) : (
        <div id="products-section" className="main-container">
          <div className="container">
            <div className="content-wrapper">
                <Sidebar filters={filters} onFilterChange={setFilters} products={catalogProducts} />

              <main className="main-content">
                <h1 className="listing-title">{listingTitle}</h1>
                <div className="products-header">
                  <p className="products-count">
                    {isCatalogLoading
                      ? 'Loading products...'
                      : `Showing ${filteredProducts.length} Products`}
                  </p>
                  <div className="sort-dropdown">
                    <label htmlFor="sort">Sort by:</label>
                    <select
                      id="sort"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="sort-select"
                    >
                      <option value="recommended">Recommended</option>
                      <option value="price-low">Price: Low to High</option>
                      <option value="price-high">Price: High to Low</option>
                      <option value="rating">Highest Rated</option>
                    </select>
                  </div>
                </div>
                {aiSearchLoading && (
                  <div className="search-status loading" role="status" aria-live="polite">
                    Analyzing your search and fetching results...
                  </div>
                )}
                {aiSearchError && (
                  <div className="search-status error" role="alert">
                    {aiSearchError}
                  </div>
                )}

                <div className="products-grid">
                  {listedProducts.map((product, idx) => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isNew={idx % 4 === 0}
                      highlightTerms={searchHighlightTerms}
                    />
                  ))}
                </div>

                {listedProducts.length === 0 && (
                  <div className="no-products">
                    <p>No products found. Try adjusting your filters.</p>
                  </div>
                )}
              </main>
            </div>
          </div>
        </div>
      )}

      {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}

      {showCart && <Cart onClose={() => setShowCart(false)} />}
      {showWishlist && <Wishlist onClose={() => setShowWishlist(false)} />}

      {activePage === 'contact' && <ContactPage onClose={() => setActivePage(null)} />}
      {activePage === 'faq' && <FAQPage onClose={() => setActivePage(null)} />}
      {activePage === 'about' && <AboutPage onClose={() => setActivePage(null)} />}
      {activePage === 'story' && <StoryPage onClose={() => setActivePage(null)} />}
      {activePage === 'blog' && <BlogPage onClose={() => setActivePage(null)} />}
      {activePage && servicePageContent[activePage] && (
        <ServiceInfoPage
          onClose={() => setActivePage(null)}
          title={servicePageContent[activePage].title}
          content={servicePageContent[activePage].content}
        />
      )}

      {!isBottomwearApp && !isDupattaApp ? (
        <Footer onNavigate={(page: string) => setActivePage(page)} />
      ) : null}
      <ChatWidget />
    </div>
  );
}

export default App;
