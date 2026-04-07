import React, { useState } from 'react';
import type { Product } from '../types/index';
import { useCart } from '../context/CartContext';
import '../styles/ProductModal.css';

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({ product, onClose }) => {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  if (!product) return null;

  const inStock = product.sizes.some((sizeOption) => sizeOption.stock > 0);
  const availableSizes = product.sizes
    .filter((sizeOption) => sizeOption.stock > 0)
    .map((sizeOption) => sizeOption.size)
    .join(', ');

  const handleAddToCart = () => {
    addToCart(product, quantity);
    alert(`${product.name} (Qty: ${quantity}) added to cart!`);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          x
        </button>

        <div className="modal-body">
          <div className="modal-image">
            <img src={product.image} alt={product.name} />
          </div>

          <div className="modal-info">
            <h2 className="modal-title">{product.name}</h2>

            <div className="modal-rating">
              <span className="stars">* {product.rating}</span>
              <span className="reviews">({product.reviews} reviews)</span>
            </div>

            <p className="modal-description">{product.description}</p>

            <div className="modal-specs">
              <div className="spec">
                <strong>Color:</strong> {product.color}
              </div>
              <div className="spec">
                <strong>Sizes:</strong> {availableSizes || 'N/A'}
              </div>
              <div className="spec">
                <strong>Category:</strong> {product.category}
              </div>
              <div className="spec">
                <strong>Stock:</strong> {inStock ? 'In Stock' : 'Out of Stock'}
              </div>
            </div>

            <div className="modal-price">
              <span className="current-price">Rs {product.price}</span>
              {product.originalPrice && (
                <span className="original-price">Rs {product.originalPrice}</span>
              )}
            </div>

            <div className="modal-quantity">
              <label>Quantity:</label>
              <div className="quantity-control">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
                <input
                  type="number"
                  min="1"
                  placeholder="Enter quantity"
                  value={quantity}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!Number.isNaN(val) && val > 0) setQuantity(val);
                  }}
                />
                <button onClick={() => setQuantity(quantity + 1)}>+</button>
              </div>
            </div>

            <button className="modal-add-cart" onClick={handleAddToCart} disabled={!inStock}>
              Add to Cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
