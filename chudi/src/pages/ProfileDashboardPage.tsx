import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { products as fallbackProducts } from '../data/products';
import {
  createAddress,
  deleteAddressRecord,
  getAddresses,
  getOrders,
  getProducts,
  updateAddressRecord,
  type AddressPayload,
  type AuthUser,
  type OrderResponse,
  type TrackingEvent,
} from '../services/api';
import { mapBackendProductToProduct } from '../utils/productMapper';
import type { Product } from '../types';
import '../styles/ProfileDashboardPage.css';

type Address = {
  id: number;
  fullName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

type AddressFormState = Omit<Address, 'id'>;

const profileStats = [{ label: 'Loyalty Tier', value: 'Gold Member' }];

const createEmptyAddressForm = (): AddressFormState => ({
  fullName: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: '',
});

const getStatusClass = (status: string) => {
  if (status === 'Delivered') return 'status-delivered';
  if (status === 'Shipped') return 'status-shipped';
  return 'status-processing';
};

const formatPaymentMethod = (method: string) =>
  method
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const buildFallbackTracking = (createdAt: string): TrackingEvent[] => {
  const stages = ['Order Placed', 'Confirmed', 'Shipped', 'Out for Delivery', 'Delivered'];
  return stages.map((stage, index) => ({
    stage,
    status: index <= 1 ? 'completed' : 'pending',
    timestamp: index <= 1 ? new Date(new Date(createdAt).getTime() + index * 60 * 60 * 1000).toISOString() : null,
  }));
};

const mapAddressFromApi = (address: {
  id: number;
  full_name: string;
  phone: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}): Address => ({
  id: address.id,
  fullName: address.full_name,
  phone: address.phone,
  line1: address.line1,
  line2: address.line2 ?? '',
  city: address.city,
  state: address.state,
  postalCode: address.postal_code,
  country: address.country,
});

const mapAddressToApi = (address: AddressFormState): AddressPayload => ({
  full_name: address.fullName,
  phone: address.phone,
  line1: address.line1,
  line2: address.line2 || null,
  city: address.city,
  state: address.state,
  postal_code: address.postalCode,
  country: address.country,
});

interface ProfileDashboardPageProps {
  user: AuthUser | null;
  onLogout: () => void;
}

export const ProfileDashboardPage: React.FC<ProfileDashboardPageProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { wishlistIds } = useWishlist();

  const [catalogProducts, setCatalogProducts] = useState<Product[]>(fallbackProducts);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState<AddressFormState>(createEmptyAddressForm());

  useEffect(() => {
    let mounted = true;
    const loadCatalog = async () => {
      try {
        const data = await getProducts();
        if (mounted && Array.isArray(data) && data.length > 0) {
          setCatalogProducts(data.map(mapBackendProductToProduct));
        }
      } catch {
        if (mounted) {
          setCatalogProducts(fallbackProducts);
        }
      }
    };
    loadCatalog();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadOrdersAndAddresses = async () => {
      setOrdersLoading(true);
      setAddressesLoading(true);

      try {
        const [orderData, addressData] = await Promise.all([getOrders(), getAddresses()]);
        if (mounted) {
          setOrders(orderData);
          setAddresses(addressData.map(mapAddressFromApi));
        }
      } catch (error) {
        console.error('Failed to fetch profile data', error);
        if (mounted) {
          setOrders([]);
          setAddresses([]);
        }
      } finally {
        if (mounted) {
          setOrdersLoading(false);
          setAddressesLoading(false);
        }
      }
    };

    loadOrdersAndAddresses();
    return () => {
      mounted = false;
    };
  }, [user]);

  const section = useMemo(() => {
    const normalizedPath = location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (normalizedPath === 'profile/orders') return 'orders';
    if (normalizedPath === 'profile/addresses') return 'addresses';
    if (normalizedPath === 'profile/wishlist') return 'wishlist';
    if (normalizedPath === 'admin') return 'admin';
    return 'profile';
  }, [location.pathname]);
  const isAdminUser = Boolean(user?.is_admin);

  const wishlistPreview = useMemo(
    () => catalogProducts.filter((product) => wishlistIds.includes(product.id)).slice(0, 4),
    [wishlistIds, catalogProducts]
  );

  const openAddAddressModal = () => {
    setEditingAddressId(null);
    setAddressForm(createEmptyAddressForm());
    setIsAddressModalOpen(true);
  };

  const openEditAddressModal = (address: Address) => {
    setEditingAddressId(address.id);
    const { id, ...rest } = address;
    void id;
    setAddressForm(rest);
    setIsAddressModalOpen(true);
  };

  const handleAddressFieldChange = (key: keyof AddressFormState, value: string) => {
    setAddressForm((previous) => ({ ...previous, [key]: value }));
  };

  const handleAddressSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    try {
      if (editingAddressId === null) {
        const created = await createAddress(mapAddressToApi(addressForm));
        setAddresses((previous) => [mapAddressFromApi(created), ...previous]);
      } else {
        const updated = await updateAddressRecord(editingAddressId, mapAddressToApi(addressForm));
        setAddresses((previous) =>
          previous.map((address) => (address.id === editingAddressId ? mapAddressFromApi(updated) : address))
        );
      }

      setIsAddressModalOpen(false);
      setEditingAddressId(null);
      setAddressForm(createEmptyAddressForm());
    } catch (error) {
      console.error('Failed to save address', error);
      alert('Failed to save address. Please try again.');
    }
  };

  const handleDeleteAddress = async (addressId: number) => {
    try {
      await deleteAddressRecord(addressId);
      setAddresses((previous) => previous.filter((address) => address.id !== addressId));
    } catch (error) {
      console.error('Failed to delete address', error);
      alert('Failed to delete address. Please try again.');
    }
  };

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <div className="profile-dashboard-page">
      <div className="container">
        <div className="profile-dashboard-layout">
          <aside className="profile-sidebar">
            <h2>My Account</h2>
            <button
              className={`profile-nav-item ${section === 'profile' ? 'active' : ''}`}
              onClick={() => navigate('/profile')}
            >
              My Profile
            </button>
            <button
              className={`profile-nav-item ${section === 'orders' ? 'active' : ''}`}
              onClick={() => navigate('/profile/orders')}
            >
              Order History
            </button>
            <button
              className={`profile-nav-item ${section === 'addresses' ? 'active' : ''}`}
              onClick={() => navigate('/profile/addresses')}
            >
              Saved Addresses
            </button>
            <button
              className={`profile-nav-item ${section === 'wishlist' ? 'active' : ''}`}
              onClick={() => navigate('/profile/wishlist')}
            >
              Wishlist
            </button>
            {isAdminUser && (
              <button
                className={`profile-nav-item ${section === 'admin' ? 'active' : ''}`}
                onClick={() => navigate('/admin')}
              >
                Admin Products
              </button>
            )}
            <button className="profile-nav-item profile-nav-logout" onClick={handleLogout}>
              Logout
            </button>
          </aside>

          <section className="profile-main-panel">
            {section === 'profile' && (
              <>
                <div className="profile-panel-header">
                  <h1>My Profile</h1>
                  <p>Manage your account preferences and shopping profile.</p>
                </div>

                <div className="profile-user-card">
                  <h3>{user?.name ?? 'Customer Name'}</h3>
                  <p>{user?.email ?? 'customer@shekurti.com'}</p>
                </div>

                <div className="profile-stats-grid">
                  {[{ label: 'Total Orders', value: String(orders.length) }, ...profileStats, { label: 'Saved Addresses', value: String(addresses.length) }].map((stat) => (
                    <article key={stat.label} className="profile-stat-card">
                      <span>{stat.label}</span>
                      <h3>{stat.value}</h3>
                    </article>
                  ))}
                </div>
              </>
            )}

            {section === 'orders' && (
              <>
                <div className="profile-panel-header">
                  <h1>Order History</h1>
                  <p>Your previous purchases and fulfillment status.</p>
                </div>

                {ordersLoading ? <p>Loading orders...</p> : null}
                {!ordersLoading && orders.length === 0 ? (
                  <div className="empty-state-card">
                    <p>No orders found yet.</p>
                  </div>
                ) : (
                  <div className="orders-grid">
                    {orders.map((order) => (
                      <article
                        key={order.id}
                        className="order-card order-clickable"
                        onClick={() => setSelectedOrder(order)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedOrder(order);
                          }
                        }}
                      >
                        <div className="order-card-header">
                          <h3>Order {order.id}</h3>
                          <span className={`order-status-badge ${getStatusClass(order.status)}`}>{order.status}</span>
                        </div>
                        <p>
                          <span>Date:</span>{' '}
                          {new Date(order.created_at).toLocaleDateString('en-IN', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                        <p>
                          <span>Total Amount:</span> Rs {order.total_amount}
                        </p>
                        <p className="order-view-hint">Click to view tracking timeline</p>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}

            {section === 'addresses' && (
              <>
                <div className="profile-panel-header addresses-header">
                  <div>
                    <h1>Saved Addresses</h1>
                    <p>Add, update, or remove your delivery locations.</p>
                  </div>
                  <button className="btn-primary" onClick={openAddAddressModal}>
                    Add New Address
                  </button>
                </div>

                {addressesLoading ? <p>Loading addresses...</p> : null}
                {!addressesLoading && addresses.length === 0 ? (
                  <div className="empty-state-card">
                    <p>No saved addresses yet.</p>
                  </div>
                ) : (
                  <div className="addresses-grid">
                    {addresses.map((address) => (
                      <article key={address.id} className="address-card">
                        <h3>{address.fullName}</h3>
                        <p>{address.phone}</p>
                        <p>{address.line1}</p>
                        {address.line2 && <p>{address.line2}</p>}
                        <p>
                          {address.city}, {address.state} {address.postalCode}
                        </p>
                        <p>{address.country}</p>
                        <div className="address-actions">
                          <button className="btn-secondary" onClick={() => openEditAddressModal(address)}>
                            Edit
                          </button>
                          <button className="btn-danger" onClick={() => handleDeleteAddress(address.id)}>
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}

            {section === 'wishlist' && (
              <>
                <div className="profile-panel-header">
                  <h1>Wishlist</h1>
                  <p>Quick view of products saved for later.</p>
                </div>

                {wishlistPreview.length === 0 ? (
                  <div className="empty-state-card">
                    <p>Your wishlist is currently empty.</p>
                  </div>
                ) : (
                  <div className="wishlist-grid">
                    {wishlistPreview.map((item) => (
                      <article key={item.id} className="wishlist-card">
                        <img src={item.image} alt={item.name} />
                        <div>
                          <h3>{item.name}</h3>
                          <p>{item.color}</p>
                          <strong>Rs {item.price}</strong>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {isAddressModalOpen && (
        <div className="address-modal-overlay" onClick={() => setIsAddressModalOpen(false)}>
          <div className="address-modal" onClick={(event) => event.stopPropagation()}>
            <div className="address-modal-header">
              <h2>{editingAddressId === null ? 'Add New Address' : 'Edit Address'}</h2>
              <button className="modal-close" onClick={() => setIsAddressModalOpen(false)}>
                x
              </button>
            </div>

            <form className="address-form" onSubmit={handleAddressSubmit}>
              <input
                type="text"
                placeholder="Full Name"
                value={addressForm.fullName}
                onChange={(event) => handleAddressFieldChange('fullName', event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Phone"
                value={addressForm.phone}
                onChange={(event) => handleAddressFieldChange('phone', event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Address Line 1"
                value={addressForm.line1}
                onChange={(event) => handleAddressFieldChange('line1', event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Address Line 2"
                value={addressForm.line2}
                onChange={(event) => handleAddressFieldChange('line2', event.target.value)}
              />
              <input
                type="text"
                placeholder="City"
                value={addressForm.city}
                onChange={(event) => handleAddressFieldChange('city', event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="State"
                value={addressForm.state}
                onChange={(event) => handleAddressFieldChange('state', event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Postal Code"
                value={addressForm.postalCode}
                onChange={(event) => handleAddressFieldChange('postalCode', event.target.value)}
                required
              />
              <input
                type="text"
                placeholder="Country"
                value={addressForm.country}
                onChange={(event) => handleAddressFieldChange('country', event.target.value)}
                required
              />

              <div className="address-form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsAddressModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {editingAddressId === null ? 'Save Address' : 'Update Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedOrder && (
        <div className="address-modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="address-modal order-detail-modal" onClick={(event) => event.stopPropagation()}>
            <div className="address-modal-header">
              <h2>Order {selectedOrder.id}</h2>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>
                x
              </button>
            </div>

            <div className="order-detail-grid">
              <div>
                <h3>Status</h3>
                <p>{selectedOrder.status}</p>
              </div>
              <div>
                <h3>Payment</h3>
                <p>{formatPaymentMethod(selectedOrder.payment_method)}</p>
              </div>
              <div>
                <h3>Expected Delivery</h3>
                <p>
                  {selectedOrder.expected_delivery_at
                    ? new Date(selectedOrder.expected_delivery_at).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : 'Not available'}
                </p>
              </div>
              <div>
                <h3>Total</h3>
                <p>Rs {selectedOrder.total_amount}</p>
              </div>
            </div>

            {selectedOrder.shipping_address ? (
              <div className="order-detail-address">
                <h3>Delivery Address</h3>
                <p>
                  {selectedOrder.shipping_address.full_name}, {selectedOrder.shipping_address.line1}
                  {selectedOrder.shipping_address.line2 ? `, ${selectedOrder.shipping_address.line2}` : ''},{' '}
                  {selectedOrder.shipping_address.city}, {selectedOrder.shipping_address.state}{' '}
                  {selectedOrder.shipping_address.postal_code}, {selectedOrder.shipping_address.country}
                </p>
                <p>Phone: {selectedOrder.shipping_address.phone}</p>
              </div>
            ) : null}

            <div className="order-detail-timeline">
              <h3>Tracking Timeline</h3>
              <div className="timeline-list">
                {(selectedOrder.tracking_events && selectedOrder.tracking_events.length > 0
                  ? selectedOrder.tracking_events
                  : buildFallbackTracking(selectedOrder.created_at)
                ).map((event) => (
                  <div key={event.stage} className={`timeline-item ${event.status}`}>
                    <div className="timeline-dot" />
                    <div className="timeline-content">
                      <strong>{event.stage}</strong>
                      <p>{event.status === 'completed' ? 'Completed' : 'Pending'}</p>
                      {event.timestamp ? (
                        <span>
                          {new Date(event.timestamp).toLocaleString('en-IN', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="order-items-list">
              <h3>Items</h3>
              {selectedOrder.items.map((item) => (
                <div key={`${selectedOrder.id}-${item.product_id}`} className="order-item-row">
                  <span>
                    {item.product_name} x {item.quantity}
                  </span>
                  <span>Rs {item.line_total}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
