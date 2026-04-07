import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import '../styles/Cart.css';

interface CartProps {
  onClose: () => void;
}

export const Cart: React.FC<CartProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const { cartItems, removeFromCart, updateQuantity, updateItemSize, clearCart, cartTotal } = useCart();

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      alert('Your cart is empty!');
      return;
    }

    onClose();
    navigate('/payment');
  };

  return (
    <div className="cart-overlay" onClick={onClose}>
      <div className="cart-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cart-header">
          <h2>Shopping Cart</h2>
          <button className="cart-close" onClick={onClose}>x</button>
        </div>

        {cartItems.length === 0 ? (
          <div className="empty-cart">
            <p>Your cart is empty</p>
            <p>Add some beautiful kurtis to get started!</p>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {cartItems.map((item) => (
                <div key={item.id} className="cart-item">
                  <img src={item.image} alt={item.name} className="cart-item-image" />
                  <div className="cart-item-info">
                    <h4>{item.name}</h4>
                    <p className="cart-item-color">Color: {item.color}</p>
                    <div className="cart-item-size-row">
                      <label htmlFor={`cart-size-${item.id}`}>Size:</label>
                      <select
                        id={`cart-size-${item.id}`}
                        className="cart-item-size-select"
                        value={item.selectedSize}
                        onChange={(event) => updateItemSize(item.id, event.target.value)}
                      >
                        {item.sizes.map((sizeOption) => (
                          <option key={sizeOption.size} value={sizeOption.size}>
                            {sizeOption.size}
                          </option>
                        ))}
                      </select>
                    </div>
                    <p className="cart-item-price">Rs {item.price}</p>
                  </div>
                  <div className="cart-item-quantity">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(event) => updateQuantity(item.id, Math.max(1, Number(event.target.value) || 1))}
                      aria-label={`Quantity for ${item.name}`}
                    />
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                  </div>
                  <div className="cart-item-total">Rs {item.price * item.quantity}</div>
                  <button
                    className="cart-item-remove"
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Remove ${item.name} from cart`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            <div className="cart-summary">
              <div className="summary-row">
                <span>Subtotal:</span>
                <span>Rs {cartTotal}</span>
              </div>
              <div className="summary-row">
                <span>Shipping:</span>
                <span className="free">Free</span>
              </div>
              <div className="summary-row">
                <span>Discount:</span>
                <span className="discount">-Rs 0</span>
              </div>
              <div className="summary-total">
                <span>Total:</span>
                <span>Rs {cartTotal}</span>
              </div>
            </div>

            <div className="cart-actions">
              <button className="btn-checkout" onClick={handleCheckout}>
                Proceed to Payment
              </button>
              <button className="btn-continue" onClick={onClose}>
                Continue Shopping
              </button>
              <button className="btn-clear" onClick={clearCart}>
                Clear Cart
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
