import React from 'react';
import { useNavigate } from 'react-router-dom';
import { products as fallbackProducts } from '../data/products';
import { useWishlist } from '../context/WishlistContext';
import { getBottomwearProducts, getProducts } from '../services/api';
import { mapBackendProductToProduct } from '../utils/productMapper';
import type { Product } from '../types';
import '../styles/Cart.css';

interface WishlistProps {
  onClose: () => void;
}

type CatalogItem = Product & { source: 'kurti' | 'bottomwear' };

export const Wishlist: React.FC<WishlistProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { wishlistIds, toggleWishlist, clearWishlist } = useWishlist();
  const [catalogProducts, setCatalogProducts] = React.useState<CatalogItem[]>(
    fallbackProducts.map((item) => ({ ...item, source: 'kurti' }))
  );

  React.useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      try {
        const [kurtiData, bottomwearData] = await Promise.all([getProducts(), getBottomwearProducts()]);
        if (mounted && Array.isArray(kurtiData) && kurtiData.length > 0) {
          const kurtiCatalog = kurtiData.map(mapBackendProductToProduct).map((item) => ({
            ...item,
            source: 'kurti' as const,
          }));
          const bottomwearCatalog = Array.isArray(bottomwearData)
            ? bottomwearData.map(mapBackendProductToProduct).map((item) => ({
                ...item,
                source: 'bottomwear' as const,
              }))
            : [];
          setCatalogProducts([...kurtiCatalog, ...bottomwearCatalog]);
        } else if (mounted) {
          setCatalogProducts(
            fallbackProducts.map((item) => ({
              ...item,
              source: 'kurti',
            }))
          );
        }
      } catch {
        if (mounted) {
          setCatalogProducts(fallbackProducts.map((item) => ({ ...item, source: 'kurti' })));
        }
      }
    };

    loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  const wishlistProducts = catalogProducts.filter((product) => wishlistIds.includes(product.id));

  const handleViewProduct = (productId: number, source: CatalogItem['source']) => {
    onClose();
    if (source === 'bottomwear') {
      navigate(`/bottomwear/product/${productId}`);
      return;
    }
    navigate(`/product/${productId}`);
  };

  return (
    <div className="cart-overlay" onClick={onClose}>
      <div className="cart-panel" onClick={(event) => event.stopPropagation()}>
        <div className="cart-header">
          <h2>Wishlist</h2>
          <button className="cart-close" onClick={onClose}>
            x
          </button>
        </div>

        {wishlistProducts.length === 0 ? (
          <div className="empty-cart">
            <p>Your wishlist is empty</p>
            <p>Save your favorite products here.</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {wishlistProducts.map((item) => (
                <div key={item.id} className="cart-item">
                  <img src={item.image} alt={item.name} className="cart-item-image" />
                  <div className="cart-item-info">
                    <h4>{item.name}</h4>
                    <p className="cart-item-color">Color: {item.color}</p>
                    <p className="cart-item-price">Rs {item.price}</p>
                  </div>
                  <button className="btn-continue" onClick={() => handleViewProduct(item.id, item.source)}>
                    View
                  </button>
                  <button
                    className="cart-item-remove"
                    onClick={() => toggleWishlist(item.id)}
                    aria-label={`Remove ${item.name} from wishlist`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="cart-actions">
              <button className="btn-clear" onClick={clearWishlist}>
                Clear Wishlist
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
