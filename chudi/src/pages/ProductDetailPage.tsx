import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, RotateCcw, ShieldCheck, Star, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { bottomwearProducts } from '../data/bottomwearProducts';
import { dupattaProducts } from '../data/dupattaProducts';
import { products as fallbackProducts } from '../data/products';
import {
  createProductReview,
  getBottomwearProducts,
  getDupattaProducts,
  getOrders,
  getProduct,
  getProductReviews,
  getProducts,
} from '../services/api';
import { mapBackendProductToProduct } from '../utils/productMapper';
import { useAuth } from '../context/AuthContext';
import type { Product } from '../types';
import '../styles/ProductDetailPage.css';

interface ProductDetailPageProps {
  productId: number;
  sideNav?: React.ReactNode;
  productContext?: 'kurti' | 'bottomwear' | 'dupatta';
}

interface ProductReview {
  id: string;
  author: string;
  location: string;
  rating: number;
  title: string;
  comment: string;
  date: string;
  verified: boolean;
  helpfulCount: number;
}

const reviewTemplates: Array<Pick<ProductReview, 'title' | 'comment'>> = [
  {
    title: 'Excellent fit and premium finish',
    comment: 'Fabric quality is excellent and the stitching is consistent across seams. The fit matched the size chart accurately.',
  },
  {
    title: 'Good choice for office wear',
    comment: 'Looks polished and feels comfortable for long work days. The color and texture are exactly as displayed.',
  },
  {
    title: 'Reliable quality for the price',
    comment: 'Well packaged and delivered on time. Material and finishing are better than expected at this price point.',
  },
  {
    title: 'Elegant silhouette and drape',
    comment: 'The silhouette sits well and the fall of the fabric is clean. Works great with both flats and heels.',
  },
  {
    title: 'Comfortable and breathable',
    comment: 'Suitable for all-day use. No irritation and easy to maintain after wash.',
  },
  {
    title: 'Color stayed intact after wash',
    comment: 'Washed twice and there was no noticeable fade. Overall a dependable purchase.',
  },
];

const reviewerNames = ['A. Sharma', 'N. Reddy', 'P. Iyer', 'S. Khan', 'K. Mehta', 'R. Nair'];
const reviewerLocations = ['Bengaluru', 'Chennai', 'Hyderabad', 'Mumbai', 'Pune', 'Delhi'];
const reviewDateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const currencyFormatter = new Intl.NumberFormat('en-IN');

const colorPalette: Record<string, string> = {
  blue: '#244a84',
  navy: '#1e3a8a',
  sky: '#38bdf8',
  turquoise: '#14b8a6',
  aqua: '#06b6d4',
  green: '#2e7d5c',
  olive: '#4d7c0f',
  mint: '#10b981',
  maroon: '#7b1f33',
  burgundy: '#7f1d1d',
  wine: '#8b1e3f',
  peach: '#f2b6a0',
  beige: '#d6c5a0',
  cream: '#f5eed5',
  pink: '#d95b8c',
  magenta: '#d946ef',
  lavender: '#c4b5fd',
  teal: '#0f7f84',
  white: '#f8f8f8',
  offwhite: '#f8f5ef',
  yellow: '#d9a81c',
  mustard: '#ca8a04',
  gold: '#d4af37',
  black: '#111827',
  grey: '#6b7280',
  gray: '#6b7280',
  purple: '#6b4db8',
  violet: '#7c3aed',
  brown: '#7a4e2d',
  orange: '#d46a2e',
  red: '#dc2626',
};

const colorMatchers: Array<{ regex: RegExp; label: string }> = [
  { regex: /\boff[\s-]?white\b/i, label: 'Off White' },
  { regex: /\bcream\b/i, label: 'Cream' },
  { regex: /\bbeige\b/i, label: 'Beige' },
  { regex: /\bnavy\b/i, label: 'Navy' },
  { regex: /\bsky\b/i, label: 'Sky' },
  { regex: /\bturquoise\b/i, label: 'Turquoise' },
  { regex: /\baqua\b/i, label: 'Aqua' },
  { regex: /\bteal\b/i, label: 'Teal' },
  { regex: /\bmaroon\b|\bmarron\b/i, label: 'Maroon' },
  { regex: /\bburgundy\b/i, label: 'Burgundy' },
  { regex: /\bwine\b/i, label: 'Wine' },
  { regex: /\bmagenta\b|\bmegenta\b/i, label: 'Magenta' },
  { regex: /\blavender\b/i, label: 'Lavender' },
  { regex: /\bviolet\b/i, label: 'Violet' },
  { regex: /\bpurple\b/i, label: 'Purple' },
  { regex: /\bmustard\b/i, label: 'Mustard' },
  { regex: /\bgold\b|\bgolden\b/i, label: 'Gold' },
  { regex: /\bgrey\b|\bgray\b/i, label: 'Grey' },
  { regex: /\bblack\b/i, label: 'Black' },
  { regex: /\bwhite\b/i, label: 'White' },
  { regex: /\bblue\b/i, label: 'Blue' },
  { regex: /\bgreen\b/i, label: 'Green' },
  { regex: /\bpink\b/i, label: 'Pink' },
  { regex: /\bpeach\b/i, label: 'Peach' },
  { regex: /\byellow\b/i, label: 'Yellow' },
  { regex: /\borange\b/i, label: 'Orange' },
  { regex: /\bred\b/i, label: 'Red' },
  { regex: /\bbrown\b/i, label: 'Brown' },
];

const genericColorLabels = new Set(['assorted', 'mixed', 'multi', 'multicolor', 'multi-color', 'combo', 'varied']);

const hashToColor = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 65% 55%)`;
};

const extractColorLabel = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) return null;
  for (const matcher of colorMatchers) {
    if (matcher.regex.test(normalized)) {
      return matcher.label;
    }
  }
  return null;
};

const normalizeColorLabel = (value: string): string => {
  const extracted = extractColorLabel(value);
  if (extracted) return extracted;
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const deriveDisplayColor = (product: Product): string => {
  const rawColor = normalizeColorLabel(product.color ?? '');
  const normalizedKey = rawColor.toLowerCase().replace(/\s+/g, '');
  const isGeneric =
    !rawColor ||
    genericColorLabels.has(rawColor.toLowerCase()) ||
    genericColorLabels.has(normalizedKey);

  if (!isGeneric) {
    return rawColor;
  }

  const description = product.description ?? '';
  const name = product.name ?? '';
  const imagePath = product.image ?? '';
  let decodedImage = imagePath;
  try {
    decodedImage = decodeURIComponent(imagePath);
  } catch {
    decodedImage = imagePath;
  }

  const extractedFromDescription = extractColorLabel(description);
  if (extractedFromDescription) return extractedFromDescription;
  const extractedFromName = extractColorLabel(name);
  if (extractedFromName) return extractedFromName;
  const extractedFromImage = extractColorLabel(decodedImage);
  if (extractedFromImage) return extractedFromImage;

  return rawColor || 'Assorted';
};

const resolveProductColor = (color: string): string => {
  const normalized = color.trim().toLowerCase();
  if (colorPalette[normalized]) {
    return colorPalette[normalized];
  }

  const compact = normalized.replace(/\s+/g, '');
  if (colorPalette[compact]) {
    return colorPalette[compact];
  }

  const tokens = normalized.split(/[\s/-]+/).filter(Boolean);
  for (const token of tokens) {
    if (colorPalette[token]) {
      return colorPalette[token];
    }
  }

  return hashToColor(normalized);
};

const genericTokens = new Set([
  'kurti',
  'kurti',
  'women',
  'womens',
  'premium',
  'collection',
  'classic',
  'elegant',
  'modern',
  'style',
  'wear',
]);

const toTokens = (value: string): string[] =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !genericTokens.has(token));

const normalizeName = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ');

const scoreSimilarity = (current: Product, candidate: Product): number => {
  let score = 0;

  const currentColor = (current.color ?? '').toLowerCase();
  const candidateColor = (candidate.color ?? '').toLowerCase();
  if (candidateColor && candidateColor === currentColor) {
    score += 7;
  }
  if (candidate.category === current.category) {
    score += 5;
  }
  if (candidate.material === current.material) {
    score += 3;
  }

  const currentTokens = new Set(toTokens(`${current.name ?? ''} ${current.description ?? ''}`));
  const candidateTokens = new Set(toTokens(`${candidate.name ?? ''} ${candidate.description ?? ''}`));
  let tokenMatches = 0;
  for (const token of currentTokens) {
    if (candidateTokens.has(token)) {
      tokenMatches += 1;
    }
  }

  score += tokenMatches * 2;
  return score;
};

const clampNumber = (value: unknown, min: number, max: number, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
};

const buildProductReviews = (product: Product): ProductReview[] => {
  const baseRating = clampNumber(product.rating, 0, 5, 4.2);
  const targetCount = Math.max(4, Math.min(8, Math.ceil(clampNumber(product.reviews, 0, 5000, 0) / 60)));
  return Array.from({ length: targetCount }).map((_, index) => {
    const template = reviewTemplates[index % reviewTemplates.length];
    const rawMonth = ((product.id + index * 2) % 12) + 1;
    const rawDay = ((product.id * 3 + index * 7) % 28) + 1;
    const year = rawMonth > 8 ? 2025 : 2026;
    const rating = clampNumber(Math.round(baseRating - (index % 3 === 0 ? 0 : 0.5)), 3, 5, 4);
    const date = new Date(year, rawMonth - 1, rawDay);

    return {
      id: `${product.id}-${index}`,
      author: reviewerNames[(product.id + index) % reviewerNames.length],
      location: reviewerLocations[(product.id + index * 2) % reviewerLocations.length],
      rating,
      title: template.title,
      comment: template.comment,
      date: date.toISOString(),
      verified: index % 5 !== 3,
      helpfulCount: 6 + ((product.id + index * 4) % 38),
    };
  });
};

export const ProductDetailPage: React.FC<ProductDetailPageProps> = ({ productId, sideNav, productContext }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { isAuthenticated } = useAuth();
  const effectiveContext = productContext ?? (sideNav ? 'bottomwear' : 'kurti');
  const isBottomwearContext = effectiveContext === 'bottomwear';
  const isDupattaContext = effectiveContext === 'dupatta';
  const [product, setProduct] = React.useState<Product | null>(null);
  const [catalogPool, setCatalogPool] = React.useState<Product[]>([]);
  const [pairingPool, setPairingPool] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedSize, setSelectedSize] = React.useState<string>('');
  const [pincode, setPincode] = React.useState('');
  const [deliveryNote, setDeliveryNote] = React.useState('');
  const [deliveryDate, setDeliveryDate] = React.useState('');
  const [reviewDraft, setReviewDraft] = React.useState({ rating: 5, title: '', comment: '' });
  const [reviewStatus, setReviewStatus] = React.useState<string>('');
  const [reviewsFromDb, setReviewsFromDb] = React.useState<ProductReview[]>([]);
  const [canReview, setCanReview] = React.useState(false);
  const ratingValue = product ? clampNumber(product.rating, 0, 5, 0) : 0;
  const reviewCount = product ? Math.max(0, Math.floor(clampNumber(product.reviews, 0, 500000, 0))) : 0;
  const productReviews = React.useMemo(() => (product ? buildProductReviews(product) : []), [product]);
  const mergedReviews = React.useMemo(() => {
    if (!reviewsFromDb.length) return productReviews;
    const dbReviews = reviewsFromDb.map((review) => ({
      ...review,
      id: `db-${review.id}`,
      location: 'Verified Buyer',
      verified: true,
      helpfulCount: 0,
    }));
    return [...dbReviews, ...productReviews];
  }, [productReviews, reviewsFromDb]);
  const orderedReviews = React.useMemo(() => {
    const copy = [...mergedReviews];
    copy.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return copy;
  }, [mergedReviews]);
  const [reviewIndex, setReviewIndex] = React.useState(0);
  const buyTogetherBottomwear = React.useMemo(() => {
    try {
      if (!product || pairingPool.length === 0) return [];
      const normalizedColor = (product.color ?? '').toLowerCase();
      const hasSpecificColor = normalizedColor !== 'assorted' && normalizedColor !== 'mixed';
      return pairingPool
        .map((item) => {
          let score = 0;
          if (item.material && item.material === product.material) score += 4;
          if (hasSpecificColor && (item.color ?? '').toLowerCase() === normalizedColor) score += 3;
          const productTokens = new Set(toTokens(`${product.name ?? ''} ${product.description ?? ''}`));
          const itemTokens = new Set(toTokens(`${item.name ?? ''} ${item.description ?? ''}`));
          let tokenMatches = 0;
          for (const token of productTokens) {
            if (itemTokens.has(token)) tokenMatches += 1;
          }
          score += tokenMatches * 2;
          return { item, score };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((entry) => entry.item);
    } catch {
      return [];
    }
  }, [product, pairingPool]);
  const activeReview = orderedReviews.length > 0 ? orderedReviews[reviewIndex] : null;

  React.useEffect(() => {
    let mounted = true;
    const loadProduct = async () => {
      setLoading(true);
      const fallbackCatalog = isBottomwearContext
        ? bottomwearProducts
        : isDupattaContext
          ? dupattaProducts
          : fallbackProducts;
      try {
        const data = await getProduct(productId);
        if (mounted) {
          setProduct(mapBackendProductToProduct(data));
        }
      } catch {
        const localProduct = fallbackCatalog.find((item) => item.id === productId) ?? null;
        if (mounted) {
          setProduct(localProduct);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadProduct();
    return () => {
      mounted = false;
    };
  }, [productId, isBottomwearContext, isDupattaContext]);

  React.useEffect(() => {
    let mounted = true;
    const loadCatalog = async () => {
      const fallbackCatalog = isBottomwearContext
        ? bottomwearProducts
        : isDupattaContext
          ? dupattaProducts
          : fallbackProducts;
      try {
        const data = isBottomwearContext
          ? await getBottomwearProducts()
          : isDupattaContext
            ? await getDupattaProducts()
            : await getProducts();
        if (mounted && Array.isArray(data) && data.length > 0) {
          setCatalogPool(data.map(mapBackendProductToProduct).filter((item) => item.id > 0));
          return;
        }
      } catch {
        // Keep fallback catalog if backend list call fails.
      }
      if (mounted) {
        setCatalogPool(fallbackCatalog);
      }
    };

    loadCatalog();
    return () => {
      mounted = false;
    };
  }, [isBottomwearContext, isDupattaContext]);

  React.useEffect(() => {
    let mounted = true;
    const loadPairingPool = async () => {
      const fallbackCatalog = isBottomwearContext
        ? bottomwearProducts
        : isDupattaContext
          ? dupattaProducts
          : bottomwearProducts;
      try {
        const data = isBottomwearContext
          ? await getBottomwearProducts()
          : isDupattaContext
            ? await getDupattaProducts()
            : await getBottomwearProducts();
        if (mounted && Array.isArray(data) && data.length > 0) {
          setPairingPool(data.map(mapBackendProductToProduct).filter((item) => item.id > 0));
          return;
        }
      } catch {
        // keep empty pool
      }
      if (mounted) {
        setPairingPool(fallbackCatalog);
      }
    };
    loadPairingPool();
    return () => {
      mounted = false;
    };
  }, [isBottomwearContext, isDupattaContext]);


  React.useEffect(() => {
    setSelectedSize('');
    setReviewIndex(0);
  }, [productId]);

  React.useEffect(() => {
    if (reviewIndex >= orderedReviews.length) {
      setReviewIndex(0);
    }
  }, [orderedReviews.length, reviewIndex]);

  React.useEffect(() => {
    let mounted = true;
    const loadReviews = async () => {
      if (!product) return;
      try {
        const data = await getProductReviews(product.id);
        if (mounted) {
          setReviewsFromDb(data);
        }
      } catch {
        if (mounted) {
          setReviewsFromDb([]);
        }
      }
    };
    loadReviews();
    return () => {
      mounted = false;
    };
  }, [product]);

  React.useEffect(() => {
    let mounted = true;
    const checkEligibility = async () => {
      if (!product || !isAuthenticated) {
        if (mounted) setCanReview(false);
        return;
      }
      try {
        const orders = await getOrders();
        const purchased = orders.some((order) =>
          order.items.some((item) => Number(item.product_id) === Number(product.id))
        );
        if (mounted) setCanReview(purchased);
      } catch {
        if (mounted) setCanReview(false);
      }
    };
    checkEligibility();
    return () => {
      mounted = false;
    };
  }, [product, isAuthenticated]);

  if (loading) {
    return (
      <div className={`product-detail-page${sideNav ? ' has-sidenav' : ''}`}>
        <div className="container product-detail-container">
          {sideNav ? <aside className="product-detail-sidenav">{sideNav}</aside> : null}
          <div className="product-detail-main product-detail-state">
            <h1>Loading product...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className={`product-detail-page${sideNav ? ' has-sidenav' : ''}`}>
        <div className="container product-detail-container">
          {sideNav ? <aside className="product-detail-sidenav">{sideNav}</aside> : null}
          <div className="product-detail-main product-detail-state">
            <h1>Product Not Found</h1>
            <button className="product-back-btn" onClick={() => navigate('/shop')}>
              Back to Products
            </button>
          </div>
        </div>
      </div>
    );
  }

  const sizes = Array.isArray(product.sizes) ? product.sizes : [];
  const inStock = sizes.some((sizeOption) => sizeOption.stock > 0);
  const availableSizes = sizes.filter((sizeOption) => sizeOption.stock > 0);
  const liked = isInWishlist(product.id);
  const discountPercent =
    product.originalPrice > product.price
      ? Math.max(0, Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100))
      : 0;
  const displayColor = deriveDisplayColor(product);
  const colorHex = resolveProductColor(displayColor);
  const browseLabel = isBottomwearContext ? 'Bottomwear' : isDupattaContext ? 'Dupatta' : 'Women';
  const browsePath = isBottomwearContext ? '/bottomwear/shop' : isDupattaContext ? '/dupatta' : '/shop';
  const similarTitle = isBottomwearContext
    ? 'Similar Bottomwear For You'
    : isDupattaContext
      ? 'Similar Dupatta For You'
      : 'Similar Kurtis For You';
  const similarPathPrefix = isBottomwearContext
    ? '/bottomwear/product/'
    : isDupattaContext
      ? '/dupatta/product/'
      : '/product/';

  const fallbackCatalog = isBottomwearContext
    ? bottomwearProducts
    : isDupattaContext
      ? dupattaProducts
      : fallbackProducts;
  const pool = catalogPool.length > 0 ? catalogPool : fallbackCatalog;
  const similarProducts: Product[] = pool
    .filter((item) => {
      if (item.id === product.id) return false;
      if (normalizeName(item.name) === normalizeName(product.name)) return false;
      return true;
    })
    .map((item) => ({ item, score: scoreSimilarity(product, item) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.item);


  const handleAddToCart = () => {
    if (!selectedSize) {
      alert('Please select a size first.');
      return;
    }

    addToCart(product, 1, selectedSize);
    alert(`${product.name} (Size: ${selectedSize}) added to cart.`);
  };

  const handleBuyNow = () => {
    if (!selectedSize) {
      alert('Please select a size first.');
      return;
    }
    addToCart(product, 1, selectedSize);
    navigate('/payment');
  };

  const handleCheckPincode = () => {
    const normalized = pincode.trim();
    if (!/^\d{6}$/.test(normalized)) {
      setDeliveryNote('Please enter a valid 6-digit pincode.');
      setDeliveryDate('');
      return;
    }
    const firstDigit = Number(normalized[0]);
    const days = firstDigit <= 2 ? 2 : firstDigit <= 4 ? 3 : firstDigit <= 6 ? 4 : 5;
    const eta = new Date();
    eta.setDate(eta.getDate() + days);
    setDeliveryNote('Available for delivery to this pincode.');
    setDeliveryDate(`Estimated delivery by ${eta.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`);
  };

  const handleSubmitReview = async () => {
    if (!product) return;
    if (!reviewDraft.title.trim() || !reviewDraft.comment.trim()) {
      setReviewStatus('Please add a title and comment.');
      return;
    }
    setReviewStatus('Submitting review...');
    try {
      const res = await createProductReview(product.id, {
        rating: Number(reviewDraft.rating),
        title: reviewDraft.title.trim(),
        comment: reviewDraft.comment.trim(),
      });
      if (res.data) {
        setReviewsFromDb((prev) => [res.data, ...prev]);
      }
      setReviewDraft({ rating: 5, title: '', comment: '' });
      setReviewStatus('Review submitted. Thank you!');
    } catch (error) {
      setReviewStatus('Unable to submit review. Please check login and try again.');
    }
  };

  return (
    <div className={`product-detail-page${sideNav ? ' has-sidenav' : ''}`}>
      <div className="container product-detail-container">
        {sideNav ? <aside className="product-detail-sidenav">{sideNav}</aside> : null}
        <div className="product-detail-main">
          <div className="product-breadcrumb">
            <button className="crumb-btn" onClick={() => navigate('/')}>
              Home
            </button>
            <span>/</span>
            <button className="crumb-btn" onClick={() => navigate(browsePath)}>
              {browseLabel}
            </button>
            <span>/</span>
            <span>{product.category}</span>
            <span>/</span>
            <strong>{product.name}</strong>
          </div>

          <div className="product-detail-grid">
            <div className="product-detail-image-wrap">
            <div
              className="product-detail-image-zoom"
              onMouseMove={(event) => {
                const target = event.currentTarget;
                const rect = target.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width) * 100;
                const y = ((event.clientY - rect.top) / rect.height) * 100;
                target.style.setProperty('--zoom-x', `${x}%`);
                target.style.setProperty('--zoom-y', `${y}%`);
              }}
              onMouseLeave={(event) => {
                event.currentTarget.style.setProperty('--zoom-x', '50%');
                event.currentTarget.style.setProperty('--zoom-y', '20%');
              }}
            >
              <img src={product.image} alt={product.name} className="product-detail-image" />
            </div>
            <p className="zoom-hint">Move your cursor on image to zoom</p>
          </div>

            <div className="product-detail-content">
              <p className="collection-tag">Premium {product.category} Collection</p>
              <h1>{product.name}</h1>
              <div className="rating-line">
                <div
                  className="product-reviews-stars"
                  aria-label={`Average rating ${ratingValue.toFixed(1)} out of 5`}
                >
                  {Array.from({ length: 5 }, (_, index) => {
                    const filled = index < Math.round(ratingValue);
                    return (
                      <Star
                        key={index}
                        size={15}
                        strokeWidth={1.8}
                        fill={filled ? '#f59e0b' : 'none'}
                        stroke={filled ? '#f59e0b' : '#94a3b8'}
                      />
                    );
                  })}
                </div>
                <strong>{ratingValue.toFixed(1)}</strong>
                <span>{reviewCount.toLocaleString('en-IN')} verified reviews</span>
              </div>
              <div className="price-line">
                <strong className="product-detail-price">Rs {currencyFormatter.format(product.price)}</strong>
                {product.originalPrice > product.price ? (
                  <span className="product-original-price">Rs {currencyFormatter.format(product.originalPrice)}</span>
                ) : null}
                {discountPercent > 0 ? <span className="off-pill">{discountPercent}% Off</span> : null}
              </div>
              <p className="price-note">Inclusive of all taxes. Free shipping on this item.</p>

              <div className="promise-grid">
                <div>
                  <p>Delivery</p>
                  <span>Ships in 24 hrs</span>
                </div>
                <div>
                  <p>Returns</p>
                  <span>7 day easy returns</span>
                </div>
                <div>
                  <p>Fabric</p>
                  <span>{product.material}</span>
                </div>
              </div>

              <div className="color-row">
                <p>Color</p>
                <span>{displayColor}</span>
              </div>
              <div className="swatch-row">
                <span className="color-swatch-dot active" style={{ backgroundColor: colorHex }} />
              </div>

              <div className="size-head-row">
                <p>Select Size</p>
                <button className="size-guide-btn" type="button">
                  Size Guide
                </button>
              </div>

              <div className="product-detail-sizes">
                {availableSizes.map((sizeOption) => (
                  <button
                    key={sizeOption.size}
                    type="button"
                    className={`size-chip ${selectedSize === sizeOption.size ? 'selected' : ''}`}
                    onClick={() => setSelectedSize(sizeOption.size)}
                  >
                    {sizeOption.size}
                  </button>
                ))}
              </div>
              <p className="selected-size-text">
                {selectedSize ? `Selected size: ${selectedSize}` : 'Select your size'}
              </p>

              <div className="action-row">
                <button className="product-detail-cart-btn primary" onClick={handleAddToCart} disabled={!inStock}>
                  {inStock ? 'Add to Cart' : 'Out of Stock'}
                </button>
                <button className="product-detail-cart-btn secondary" onClick={handleBuyNow} disabled={!inStock}>
                  Buy Now
                </button>
                <button
                  className="icon-action-btn"
                  aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
                  onClick={() => toggleWishlist(product.id)}
                >
                  <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
                </button>
              </div>

              <div className="delivery-box">
                <h3>Delivery & Services</h3>
                <div className="delivery-pin-row">
                  <input
                    placeholder="Enter Pincode - 560001"
                    value={pincode}
                    onChange={(event) => setPincode(event.target.value)}
                  />
                  <button type="button" onClick={handleCheckPincode}>
                    Check
                  </button>
                </div>
                {deliveryNote ? <p className="delivery-note">{deliveryNote}</p> : null}
                {deliveryDate ? <p className="delivery-note">{deliveryDate}</p> : null}
                <ul>
                  <li>
                    <Truck size={15} />
                    <span>Delivery by tomorrow, 10 PM</span>
                  </li>
                  <li>
                    <ShieldCheck size={15} />
                    <span>Cash on delivery available</span>
                  </li>
                  <li>
                    <RotateCcw size={15} />
                    <span>7 day easy return & exchange</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

        <section className="detail-panels" aria-label="Product information">
          <div className="detail-column">
            <div className="detail-panel">
              <h2>Wash & Care</h2>
              <ul className="bullet-list">
                <li>Machine wash cold on gentle cycle with similar colors for best fabric longevity.</li>
                <li>Use mild detergent only. Do not bleach, wring aggressively, or soak for extended periods.</li>
                <li>Dry in shade and iron on reverse at low to medium heat for a crisp premium finish.</li>
              </ul>
            {buyTogetherBottomwear.length > 0 ? (
              <div className="buy-together-block">
                <h3>SheKurti Recommends</h3>
                <p>
                  {isBottomwearContext || isDupattaContext
                    ? 'Kurti picks curated for this set.'
                    : 'Bottomwear picks curated for this kurti.'}
                </p>
                <div className="buy-together-grid">
                  {buyTogetherBottomwear.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="buy-together-card"
                      onClick={() =>
                        navigate(
                          isBottomwearContext || isDupattaContext ? `/product/${item.id}` : `/bottomwear/product/${item.id}`
                        )
                      }
                    >
                        <img
                          src={item.image}
                          alt={item.name}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = product.image;
                          }}
                        />
                        <div>
                          <span>{item.category}</span>
                          <strong>{item.name}</strong>
                          <em>Rs {currencyFormatter.format(item.price)}</em>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="detail-column">
            <div className="detail-panel">
              <h2>Product Details</h2>
              <p className="product-detail-desc">{product.description}</p>
              <div className="spec-grid">
                <span>Fit</span>
                <strong>Straight, Regular Fit</strong>
                <span>Fabric</span>
                <strong>{product.material}</strong>
                <span>Occasion</span>
                <strong>{product.category}, Office Wear, Smart Casual</strong>
              </div>
            </div>

            <div className="detail-panel reviews-panel">
              <div className="product-reviews-title-row">
                <h2>Reviews</h2>
                <div className="review-nav">
                  <button
                    type="button"
                    className="review-nav-btn"
                    aria-label="Previous review"
                    onClick={() => {
                      if (orderedReviews.length === 0) return;
                      setReviewIndex((prev) => (prev - 1 + orderedReviews.length) % orderedReviews.length);
                    }}
                    disabled={orderedReviews.length <= 1}
                  >
                    {'<'}
                  </button>
                  <span className="review-nav-count">
                    {orderedReviews.length > 0 ? `${reviewIndex + 1} / ${orderedReviews.length}` : '0 / 0'}
                  </span>
                  <button
                    type="button"
                    className="review-nav-btn"
                    aria-label="Next review"
                    onClick={() => {
                      if (orderedReviews.length === 0) return;
                      setReviewIndex((prev) => (prev + 1) % orderedReviews.length);
                    }}
                    disabled={orderedReviews.length <= 1}
                  >
                    {'>'}
                  </button>
                </div>
              </div>

              <div className="review-inline-summary">
                <span>{ratingValue.toFixed(1)} / 5</span>
                <span>{reviewCount.toLocaleString('en-IN')} verified ratings</span>
              </div>

              {activeReview ? (
                <article className="product-review-card">
                  <div className="product-review-head">
                    <div className="reviewer-avatar" aria-hidden="true">
                      {activeReview.author.slice(0, 1)}
                    </div>
                    <div className="reviewer-profile">
                      <p>{activeReview.author}</p>
                      <span>{activeReview.location}</span>
                    </div>
                    <time dateTime={activeReview.date}>
                      {reviewDateFormatter.format(new Date(activeReview.date))}
                    </time>
                  </div>

                  <div className="product-review-top">
                    <span className="product-review-rating">{activeReview.rating.toFixed(1)} / 5</span>
                    {activeReview.verified ? <span className="verified-pill">Verified Purchase</span> : null}
                  </div>

                  <h3>{activeReview.title}</h3>
                  <p className="product-review-comment">{activeReview.comment}</p>

                  <div className="product-review-meta">
                    <span>{activeReview.helpfulCount} people found this helpful</span>
                  </div>
                </article>
              ) : (
                <p className="review-empty">No reviews yet for this product.</p>
              )}

              {isAuthenticated ? (
                canReview ? (
                  <div className="review-form">
                    <h3>Write a review</h3>
                    <div className="review-form-row">
                      <label htmlFor="review-rating">Rating</label>
                      <select
                        id="review-rating"
                        value={reviewDraft.rating}
                        onChange={(event) =>
                          setReviewDraft((prev) => ({ ...prev, rating: Number(event.target.value) }))
                        }
                      >
                        {[5, 4, 3, 2, 1].map((value) => (
                          <option key={value} value={value}>
                            {value} Star{value > 1 ? 's' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="review-form-row">
                      <label htmlFor="review-title">Title</label>
                      <input
                        id="review-title"
                        value={reviewDraft.title}
                        onChange={(event) => setReviewDraft((prev) => ({ ...prev, title: event.target.value }))}
                        placeholder="Share a quick summary"
                      />
                    </div>
                    <div className="review-form-row">
                      <label htmlFor="review-comment">Comment</label>
                      <textarea
                        id="review-comment"
                        rows={3}
                        value={reviewDraft.comment}
                        onChange={(event) => setReviewDraft((prev) => ({ ...prev, comment: event.target.value }))}
                        placeholder="Tell us about the fit, fabric, and comfort"
                      />
                    </div>
                    <button type="button" className="review-submit-btn" onClick={handleSubmitReview}>
                      Submit Review
                    </button>
                    {reviewStatus ? <p className="review-status">{reviewStatus}</p> : null}
                  </div>
                ) : (
                  <p className="review-empty">Place an order for this product to leave a review.</p>
                )
              ) : (
                <p className="review-empty">Login to submit a review after purchase.</p>
              )}
            </div>
          </div>
        </section>

        {similarProducts.length > 0 ? (
          <section className="similar-products-section" aria-label="Similar products">
            <h2>{similarTitle}</h2>
            <div className="similar-products-grid">
              {similarProducts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="similar-product-card"
                  onClick={() => navigate(`${similarPathPrefix}${item.id}`)}
                >
                  <img
                    src={item.image || product.image}
                    alt={item.name}
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = product.image;
                    }}
                  />
                  <p>{item.category}</p>
                  <h3>{item.name}</h3>
                  <strong>Rs {currencyFormatter.format(item.price)}</strong>
                </button>
              ))}
            </div>
          </section>
        ) : null}
        </div>
      </div>
    </div>
  );
};
