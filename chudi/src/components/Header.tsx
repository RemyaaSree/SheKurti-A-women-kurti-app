import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Heart, ShoppingBag, User, Mic, Image as ImageIcon, Moon, Sun } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { getProducts, type BackendProduct } from '../services/api';
import '../styles/Header.css';

type SearchSource = 'text' | 'voice' | 'image';

interface AISearchPayload {
  query?: string;
  source: SearchSource;
  dominantColor?: string;
  visualTags?: string[];
  candidateProductIds?: number[];
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<SpeechRecognitionAlternativeLike>>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
}

type SpeechRecognitionFactory = new () => SpeechRecognitionLike;

interface ImageFeatures {
  avgR: number;
  avgG: number;
  avgB: number;
  bins: number[];
}

interface ProductVisualMeta {
  id: number;
  name: string;
  category: string;
  material: string;
  color: string;
  imageUrl: string;
}
interface PopularProductCard {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  category?: string;
}

interface HeaderProps {
  onCartClick: () => void;
  onWishlistClick: () => void;
  onSearchChange: (query: string) => void;
  onAISearch?: (payload: AISearchPayload) => Promise<void> | void;
  showSearch?: boolean;
  wishlistCount: number;
  userName: string;
  onProfileClick: () => void;
  themeMode: 'light' | 'dark';
  onThemeToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onCartClick,
  onWishlistClick,
  onSearchChange,
  onAISearch,
  showSearch = true,
  wishlistCount,
  userName,
  onProfileClick,
  themeMode,
  onThemeToggle,
}) => {
  const navigate = useNavigate();
  const { cartItemCount } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isImageProcessing, setIsImageProcessing] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [popularProducts, setPopularProducts] = useState<PopularProductCard[]>([]);
  const [trendingSearches, setTrendingSearches] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const featureCacheRef = useRef<Map<string, ImageFeatures>>(new Map());
  const catalogCacheRef = useRef<ProductVisualMeta[] | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearchChange(query);
  };

  const runAiSearch = async (payload: AISearchPayload) => {
    if (!onAISearch) {
      return;
    }
    await onAISearch(payload);
  };

  const handleTextSubmit = async () => {
    const query = searchQuery.trim();
    if (!query) {
      return;
    }
    await runAiSearch({ query, source: 'text' });
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!searchRef.current) {
        return;
      }
      if (event.target instanceof Node && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadPopular = async () => {
      try {
        const data = await getProducts();
        if (!mounted) {
          return;
        }
        const mapped = data
          .filter((item: BackendProduct) => item.id && item.image_url)
          .map((item: BackendProduct) => ({
            id: item.id,
            name: item.name ?? 'Kurti',
            price: item.price ?? 0,
            originalPrice: item.original_price,
            imageUrl: item.image_url ?? '',
            category: item.category ?? '',
          }));
        setPopularProducts(mapped.slice(0, 6));

        const categories = Array.from(
          new Set(data.map((item: BackendProduct) => item.category ?? '').filter((value) => value.length > 0))
        );
        const colors = Array.from(
          new Set(data.map((item: BackendProduct) => item.color ?? '').filter((value) => value.length > 0))
        );
        const materials = Array.from(
          new Set(data.map((item: BackendProduct) => item.material ?? '').filter((value) => value.length > 0))
        );
        const curated = [
          ...categories.map((category) => `${category} Kurtis`),
          ...materials.map((material) => `${material} Kurtis`),
          ...colors.map((color) => `${color} Kurti`),
        ];
        const unique = Array.from(new Set(curated.map((item) => item.trim()).filter(Boolean)));
        setTrendingSearches(unique.slice(0, 10));
      } catch {
        if (mounted) {
          setPopularProducts([]);
          setTrendingSearches([]);
        }
      }
    };
    loadPopular();
    return () => {
      mounted = false;
    };
  }, []);

  const fallbackTrendingSearches = useMemo(
    () => [
      'Anarkali Kurtis',
      'Chikankari Kurtis',
      'Office Wear Kurtis',
      'Casual Kurtis',
      'Festive Kurtis',
      'Silk Kurtis',
      'Straight Cut Kurtis',
      'Cotton Kurtis',
      'Embroidered Kurtis',
      'A-line Kurti',
    ],
    []
  );

  const handleTrendingClick = async (term: string) => {
    setSearchQuery(term);
    onSearchChange(term);
    setIsSearchOpen(false);
    await runAiSearch({ query: term, source: 'text' });
  };

  const normalizeText = (value: string) => value.trim().toLowerCase();
  const toTokens = (value: string) =>
    normalizeText(value)
      .split(/[\s/-]+/)
      .filter(Boolean);
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

  const resolveDominantColor = (r: number, g: number, b: number): string => {
    const candidates = [
      { name: 'Red', rgb: [220, 38, 38] },
      { name: 'Maroon', rgb: [128, 0, 0] },
      { name: 'Burgundy', rgb: [127, 29, 29] },
      { name: 'Pink', rgb: [236, 72, 153] },
      { name: 'Magenta', rgb: [217, 70, 239] },
      { name: 'Purple', rgb: [109, 40, 217] },
      { name: 'Lavender', rgb: [196, 181, 253] },
      { name: 'Blue', rgb: [59, 130, 246] },
      { name: 'Navy', rgb: [30, 58, 138] },
      { name: 'Teal', rgb: [13, 148, 136] },
      { name: 'Aqua', rgb: [6, 182, 212] },
      { name: 'Green', rgb: [34, 197, 94] },
      { name: 'Olive', rgb: [77, 124, 15] },
      { name: 'Yellow', rgb: [234, 179, 8] },
      { name: 'Mustard', rgb: [202, 138, 4] },
      { name: 'Orange', rgb: [249, 115, 22] },
      { name: 'Peach', rgb: [253, 186, 116] },
      { name: 'Brown', rgb: [120, 53, 15] },
      { name: 'Beige', rgb: [214, 197, 160] },
      { name: 'Cream', rgb: [245, 238, 213] },
      { name: 'White', rgb: [245, 245, 245] },
      { name: 'Grey', rgb: [107, 114, 128] },
      { name: 'Black', rgb: [17, 24, 39] },
    ];

    let bestMatch = candidates[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const candidate of candidates) {
      const [cr, cg, cb] = candidate.rgb;
      const distance = Math.sqrt((r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = candidate;
      }
    }

    return bestMatch.name;
  };

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Unable to load image: ${src}`));
      img.src = src;
    });

  const extractImageFeatures = (image: HTMLImageElement): ImageFeatures => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Image processing is not supported in this browser.');
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let red = 0;
    let green = 0;
    let blue = 0;
    let count = 0;
    let fgRed = 0;
    let fgGreen = 0;
    let fgBlue = 0;
    let fgCount = 0;
    const bins = Array.from({ length: 8 }, () => 0);

    for (let index = 0; index < data.length; index += 4) {
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const brightness = (r + g + b) / 3;
      const saturation = max === 0 ? 0 : (max - min) / max;
      red += r;
      green += g;
      blue += b;
      count += 1;

      const brightnessBin = Math.floor(brightness / 32);
      bins[Math.min(7, Math.max(0, brightnessBin))] += 1;

      if (brightness > 24 && brightness < 235 && saturation > 0.08) {
        fgRed += r;
        fgGreen += g;
        fgBlue += b;
        fgCount += 1;
      }
    }

    const normalizedBins = bins.map((value) => value / Math.max(1, count));
    const avgCount = fgCount > 0 ? fgCount : count;
    const avgRed = (fgCount > 0 ? fgRed : red) / Math.max(1, avgCount);
    const avgGreen = (fgCount > 0 ? fgGreen : green) / Math.max(1, avgCount);
    const avgBlue = (fgCount > 0 ? fgBlue : blue) / Math.max(1, avgCount);
    return {
      avgR: Math.round(avgRed),
      avgG: Math.round(avgGreen),
      avgB: Math.round(avgBlue),
      bins: normalizedBins,
    };
  };

  const getFeaturesForUrl = async (url: string): Promise<ImageFeatures | null> => {
    if (featureCacheRef.current.has(url)) {
      return featureCacheRef.current.get(url) ?? null;
    }
    try {
      const image = await loadImage(url);
      const features = extractImageFeatures(image);
      featureCacheRef.current.set(url, features);
      return features;
    } catch {
      return null;
    }
  };

  const cosineSimilarity = (a: number[], b: number[]): number => {
    if (a.length !== b.length || a.length === 0) {
      return 0;
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let index = 0; index < a.length; index += 1) {
      dot += a[index] * b[index];
      normA += a[index] * a[index];
      normB += b[index] * b[index];
    }
    if (normA === 0 || normB === 0) {
      return 0;
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  const getCatalogMeta = async (): Promise<ProductVisualMeta[]> => {
    if (catalogCacheRef.current) {
      return catalogCacheRef.current;
    }
    const products = await getProducts();
    const mapped = products
      .filter((item: BackendProduct) => typeof item.id === 'number' && typeof item.image_url === 'string')
      .map((item: BackendProduct) => ({
        id: item.id,
        name: item.name ?? '',
        category: item.category ?? '',
        material: item.material ?? '',
        color: item.color ?? '',
        imageUrl: item.image_url ?? '',
      }));
    catalogCacheRef.current = mapped;
    return mapped;
  };

  const analyzeImage = async (
    file: File
  ): Promise<{ query: string; dominantColor: string; visualTags: string[]; candidateProductIds: number[] }> => {
    const objectUrl = URL.createObjectURL(file);
    try {
      const uploadedImage = await loadImage(objectUrl);
      const uploadedFeatures = extractImageFeatures(uploadedImage);
      const dominantColor = resolveDominantColor(uploadedFeatures.avgR, uploadedFeatures.avgG, uploadedFeatures.avgB);

      const catalog = await getCatalogMeta();
      const scored: Array<{ product: ProductVisualMeta; score: number }> = [];

      for (const item of catalog) {
        const productFeatures = await getFeaturesForUrl(item.imageUrl);
        if (!productFeatures) {
          continue;
        }
        const colorDistance =
          Math.sqrt(
            (uploadedFeatures.avgR - productFeatures.avgR) ** 2 +
            (uploadedFeatures.avgG - productFeatures.avgG) ** 2 +
            (uploadedFeatures.avgB - productFeatures.avgB) ** 2
          ) / 441.67;
        const histogramSimilarity = cosineSimilarity(uploadedFeatures.bins, productFeatures.bins);
        const score = histogramSimilarity * 0.7 + (1 - colorDistance) * 0.3;
        scored.push({ product: item, score });
      }

      scored.sort((a, b) => b.score - a.score);
      let topMatches = scored.slice(0, 4);
      if (topMatches.length === 0) {
        const byColor = catalog.filter((item) => item.color && colorMatches(item.color, dominantColor));
        topMatches = byColor.slice(0, 4).map((product) => ({ product, score: 0 }));
      }
      const candidateProductIds = topMatches.map((entry) => entry.product.id);
      const strongMatch = topMatches[0]?.product;

      const visualTags = [
        dominantColor.toLowerCase(),
        strongMatch?.category.toLowerCase() ?? '',
        strongMatch?.material.toLowerCase() ?? '',
      ].filter(Boolean);

      const query = [
        dominantColor,
        strongMatch?.category ?? '',
        strongMatch?.material ?? '',
        'kurti',
      ]
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      return { query, dominantColor, visualTags, candidateProductIds };
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsImageProcessing(true);
    try {
      const analysis = await analyzeImage(file);
      setSearchQuery(analysis.query);
      onSearchChange(analysis.query);
      await runAiSearch({
        query: analysis.query,
        source: 'image',
        dominantColor: analysis.dominantColor,
        visualTags: analysis.visualTags,
        candidateProductIds: analysis.candidateProductIds,
      });
    } catch (error) {
      console.error(error);
      alert('Unable to process this image. Please try another image.');
    } finally {
      setIsImageProcessing(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleVoiceSearch = async () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionFactory;
      webkitSpeechRecognition?: SpeechRecognitionFactory;
    };
    const speechApi = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!speechApi) {
      alert('Voice search is not supported in this browser.');
      return;
    }

    const recognition = new speechApi();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);

    recognition.onresult = async (event: SpeechRecognitionEventLike) => {
      const transcript = String(event.results?.[0]?.[0]?.transcript ?? '').trim();
      if (!transcript) {
        return;
      }
      setSearchQuery(transcript);
      onSearchChange(transcript);
      await runAiSearch({ query: transcript, source: 'voice' });
    };
    recognition.onerror = () => {
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const navigateTo = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems: Array<{ label: string; path: string }> = [
    { label: 'New Arrivals', path: '/new-arrivals' },
    { label: 'Kurtis', path: '/kurtis' },
    { label: 'Sets', path: '/sets' },
    { label: 'Budget', path: '/budget' },
    { label: 'Sale', path: '/shop' },
  ];

  return (
    <header className="header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <button type="button" className="logo-btn" onClick={() => navigateTo('/')}>
              <h1>SHEKURTI</h1>
            </button>
          </div>

          <nav className="main-nav">
            <ul>
              {navItems.map((item) => (
                <li key={item.path}>
                  <button className="nav-link" onClick={() => navigateTo(item.path)}>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="header-actions">
            <button
              className="action-btn theme-toggle-btn"
              aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={onThemeToggle}
              title={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {themeMode === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {showSearch && (
              <div className="search-bar" ref={searchRef}>
                <Search className="search-icon" size={18} />
                <input
                  type="text"
                  placeholder='Search kurtis, bottomwear, dupattas...'
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={() => setIsSearchOpen(true)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      void handleTextSubmit();
                    }
                  }}
                  className="search-input"
                />
                <div className="search-tools">
                  <button
                    type="button"
                    className={`search-tool-btn ${isListening ? 'active' : ''}`}
                    onClick={() => void handleVoiceSearch()}
                    aria-label="Voice search"
                    title={isListening ? 'Listening...' : 'Voice search'}
                  >
                    <Mic size={16} />
                  </button>
                  {isListening ? <span className="search-listening">Listening...</span> : null}
                  <button
                    type="button"
                    className={`search-tool-btn ${isImageProcessing ? 'active' : ''}`}
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Image search"
                    title="Image search"
                  >
                    <ImageIcon size={16} />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="search-image-input"
                  onChange={(event) => void handleImageUpload(event)}
                  title="Upload image for search"
                />
                <div className={`search-panel ${isSearchOpen ? 'open' : ''}`}>
                  <div className="search-section">
                    <p className="search-section-title">Trending Searches</p>
                    <div className="search-tags">
                      {(trendingSearches.length > 0 ? trendingSearches : fallbackTrendingSearches).map((term) => (
                        <button
                          key={term}
                          type="button"
                          className="search-tag"
                          onClick={() => void handleTrendingClick(term)}
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="search-section">
                    <div className="search-section-row">
                      <p className="search-section-title">Most Popular</p>
                      <div className="search-carousel-controls">
                        <span className="search-carousel-dot" />
                        <span className="search-carousel-dot" />
                      </div>
                    </div>
                    <div className="search-popular-grid">
                      {popularProducts.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="search-popular-card"
                          onClick={() => navigate(`/product/${item.id}`)}
                        >
                          <img src={item.imageUrl} alt={item.name} />
                          <div className="search-popular-body">
                            <p>{item.category || 'Kurti'}</p>
                            <h4>{item.name}</h4>
                            <div className="search-popular-price">
                              <strong>Rs {item.price}</strong>
                              {item.originalPrice && item.originalPrice > item.price ? (
                                <span>Rs {item.originalPrice}</span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <button className="action-btn" aria-label="Wishlist" onClick={onWishlistClick}>
              <Heart size={20} />
              {wishlistCount > 0 && <span className="badge">{wishlistCount}</span>}
            </button>
            
            <button className="action-btn cart-btn" onClick={onCartClick} aria-label="Shopping Cart">
              <ShoppingBag size={20} />
              {cartItemCount > 0 && <span className="badge">{cartItemCount}</span>}
            </button>
            
            <button className="action-btn user-btn" aria-label="User Account" onClick={onProfileClick} title="Profile">
              <User size={20} />
              <span className="user-label">{userName}</span>
            </button>
          </div>
        </div>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          <ul>
            {navItems.map((item) => (
              <li key={`mobile-${item.path}`}>
                <button className="nav-link" onClick={() => navigateTo(item.path)}>
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
};
