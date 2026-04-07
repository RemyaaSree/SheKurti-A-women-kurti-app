import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';
import type { Product } from '../types/index';
import { useWishlist } from '../context/WishlistContext';
import '../styles/ProductCard.css';

interface ProductCardProps {
  product: Product;
  isNew?: boolean;
  highlightTerms?: string[];
  onViewDetails?: (product: Product) => void;
}

const renderHighlightedText = (text: string, terms: string[]) => {
  const cleanTerms = Array.from(
    new Set(
      terms
        .map((term) => term.trim())
        .filter((term) => term.length >= 3)
        .sort((a, b) => b.length - a.length)
    )
  );
  if (cleanTerms.length === 0) {
    return text;
  }

  const escaped = cleanTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(${escaped.join('|')})`, 'ig');
  const parts = text.split(pattern);
  return parts.map((part, index) =>
    cleanTerms.some((term) => term.toLowerCase() === part.toLowerCase()) ? (
      <mark key={`${part}-${index}`} className="product-highlight">
        {part}
      </mark>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  );
};

export const ProductCard: React.FC<ProductCardProps> = ({ product, isNew, highlightTerms = [], onViewDetails }) => {
  const navigate = useNavigate();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const liked = isInWishlist(product.id);
  const discount = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(product);
      return;
    }
    navigate(`/product/${product.id}`);
  };

  return (
    <div className="product-card">
      <div
        className="product-image-container product-link-btn"
        onClick={handleViewDetails}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleViewDetails();
          }
        }}
        role="button"
        tabIndex={0}
      >
        <img src={product.image} alt={product.name} className="product-image" />
        <button
          type="button"
          className={`product-wishlist-btn ${liked ? 'active' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            toggleWishlist(product.id);
          }}
          aria-label={`Toggle wishlist for ${product.name}`}
        >
          <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
        </button>
        {isNew && <div className="badge-new">NEW</div>}
      </div>

      <div className="product-details">
        <button className="product-title product-link-btn" onClick={handleViewDetails}>
          {renderHighlightedText(product.name, highlightTerms)}
        </button>

        <div className="product-rating">
          <div className="stars">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                size={14}
                fill={i < Math.floor(product.rating) ? '#fbbf24' : 'none'}
                stroke={i < Math.floor(product.rating) ? '#fbbf24' : '#d1d5db'}
                strokeWidth={1.5}
              />
            ))}
          </div>
          <span className="rating-count">({product.reviews})</span>
        </div>

        <div className="product-pricing">
          <span className="current-price">Rs {product.price.toFixed(2)}</span>
          {product.originalPrice && (
            <>
              <span className="original-price">Rs {product.originalPrice.toFixed(2)}</span>
              <span className="discount-text">{discount}% OFF</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
