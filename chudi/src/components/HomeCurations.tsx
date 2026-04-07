import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import type { Product } from '../types';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import '../styles/HomeCurations.css';

type CurationTab = 'bestsellers' | 'recommended';

interface HomeCurationsProps {
  products: Product[];
  personalizedProducts?: Product[];
  detailPathPrefix?: string;
}

const selectUniqueProducts = (candidates: Product[], count: number): Product[] => {
  const result: Product[] = [];
  const seen = new Set<number>();
  for (const item of candidates) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    result.push(item);
    if (result.length === count) {
      break;
    }
  }
  return result;
};

export const HomeCurations: React.FC<HomeCurationsProps> = ({
  products,
  personalizedProducts = [],
  detailPathPrefix = '/product/',
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<CurationTab>('bestsellers');
  const { isInWishlist, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();

  const bestsellers = useMemo(() => {
    const byRating = [...products].sort((a, b) => {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return b.reviews - a.reviews;
    });
    return selectUniqueProducts(byRating, 4);
  }, [products]);

  const recommended = useMemo(() => {
    if (personalizedProducts.length > 0) {
      return selectUniqueProducts(personalizedProducts, 4);
    }
    const byValue = [...products].sort((a, b) => {
      const scoreA = a.rating * 10 + a.reviews / 20;
      const scoreB = b.rating * 10 + b.reviews / 20;
      return scoreB - scoreA;
    });
    return selectUniqueProducts(byValue, 8).slice(4, 8);
  }, [products, personalizedProducts]);

  const visibleItems = activeTab === 'bestsellers' ? bestsellers : recommended;

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <section className="home-curations">
      <div className="container">
        <div className="curation-tabs" role="tablist" aria-label="Product Curations">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'bestsellers'}
            className={`curation-tab ${activeTab === 'bestsellers' ? 'active' : ''}`}
            onClick={() => setActiveTab('bestsellers')}
          >
            Bestsellers
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recommended'}
            className={`curation-tab ${activeTab === 'recommended' ? 'active' : ''}`}
            onClick={() => setActiveTab('recommended')}
          >
            Recommended For You
          </button>
        </div>

        <div className="curation-grid">
          {visibleItems.map((product) => (
            <article key={product.id} className="curation-card">
              <div className="curation-image-wrap">
                <button
                  type="button"
                  className="curation-image-btn"
                  onClick={() => navigate(`${detailPathPrefix}${product.id}`)}
                  aria-label={`View details for ${product.name}`}
                >
                  <img src={product.image} alt={product.name} className="curation-image" />
                </button>
                <button
                  type="button"
                  className={`curation-wishlist ${isInWishlist(product.id) ? 'active' : ''}`}
                  onClick={() => toggleWishlist(product.id)}
                  aria-label={`Toggle wishlist for ${product.name}`}
                >
                  <Heart size={18} fill={isInWishlist(product.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="curation-info">
                <h3>{product.name}</h3>
                <p>Rs {product.price}</p>
                <button type="button" className="curation-add-btn" onClick={() => addToCart(product, 1)}>
                  Add To Cart
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
