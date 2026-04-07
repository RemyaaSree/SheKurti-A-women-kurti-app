import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from 'lucide-react';
import {
  createAdminProduct,
  deleteAdminProduct,
  getAdminContacts,
  getAdminOrders,
  getAdminProducts,
  getAdminUsers,
  updateAdminProduct,
  uploadAdminProductImage,
  type AdminProductPayload,
  type AdminOrder,
  type AdminUser,
  type BackendProduct,
  type ContactMessage,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/AdminProductsPage.css';

const EMPTY_FORM: AdminProductPayload = {
  name: '',
  price: 0,
  original_price: 0,
  image_url: '',
  category: '',
  color: '',
  material: '',
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  rating: 4.2,
  reviews: 0,
  description: '',
};

const parseSizes = (value: string): string[] =>
  value
    .split(',')
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean);

interface AdminProductsPageProps {
  isAdmin?: boolean;
}

export const AdminProductsPage: React.FC<AdminProductsPageProps> = ({ isAdmin }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<'manager' | 'contacts' | 'users' | 'orders'>('manager');
  const [rows, setRows] = useState<BackendProduct[]>([]);
  const [contacts, setContacts] = useState<ContactMessage[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<AdminProductPayload>(EMPTY_FORM);
  const [sizesText, setSizesText] = useState('XS,S,M,L,XL,XXL');

  const canAccess = useMemo(() => Boolean(isAdmin), [isAdmin]);
  const navItems: Array<{ label: string; tab: 'manager' | 'contacts' | 'users' | 'orders' }> = [
    { label: 'Admin Manager', tab: 'manager' },
    { label: 'Contacts', tab: 'contacts' },
    { label: 'Users', tab: 'users' },
    { label: 'Orders', tab: 'orders' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/', { replace: true });
  };

  const loadRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminProducts();
      setRows(data);
    } catch {
      setError('Failed to load admin products.');
    } finally {
      setLoading(false);
    }
  };

  const loadContacts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminContacts();
      setContacts(data);
    } catch {
      setError('Failed to load contact messages.');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch {
      setError('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminOrders();
      setOrders(data);
    } catch {
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) {
      if (activeTab === 'manager') {
        void loadRows();
      } else if (activeTab === 'contacts') {
        void loadContacts();
      } else if (activeTab === 'users') {
        void loadUsers();
      } else if (activeTab === 'orders') {
        void loadOrders();
      }
    }
  }, [canAccess, activeTab]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSizesText('XS,S,M,L,XL,XXL');
  };

  const handleEdit = (row: BackendProduct) => {
    setEditingId(row.id);
    setForm({
      id: row.id,
      name: row.name ?? '',
      price: Number(row.price ?? 0),
      original_price: Number(row.original_price ?? row.price ?? 0),
      image_url: row.image_url ?? '',
      category: row.category ?? '',
      color: row.color ?? '',
      material: row.material ?? '',
      sizes: row.sizes ?? ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      rating: Number(row.rating ?? 4.2),
      reviews: Number(row.reviews ?? 0),
      description: row.description ?? '',
    });
    setSizesText((row.sizes ?? ['XS', 'S', 'M', 'L', 'XL', 'XXL']).join(','));
  };

  const handleDelete = async (productId: number) => {
    const confirmed = window.confirm(`Delete product #${productId}?`);
    if (!confirmed) return;
    try {
      await deleteAdminProduct(productId);
      setRows((previous) => previous.filter((row) => row.id !== productId));
      if (editingId === productId) {
        resetForm();
      }
    } catch {
      alert('Delete failed.');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const sizes = parseSizes(sizesText);
    const payload: AdminProductPayload = {
      name: form.name.trim(),
      price: Number(form.price),
      original_price: Number(form.original_price),
      image_url: form.image_url.trim(),
      category: form.category.trim(),
      color: form.color.trim(),
      material: form.material.trim(),
      sizes: sizes.length > 0 ? sizes : ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      rating: Number(form.rating),
      reviews: Number(form.reviews),
      description: form.description.trim(),
    };
    if (form.id && form.id > 0) {
      payload.id = form.id;
    }

    try {
      if (editingId === null) {
        const created = await createAdminProduct(payload);
        setRows((previous) => [created.data, ...previous]);
      } else {
        const updated = await updateAdminProduct(editingId, payload);
        setRows((previous) => previous.map((row) => (row.id === editingId ? updated.data : row)));
      }
      resetForm();
    } catch (submitError: unknown) {
      const fallback = 'Save failed. Check values and try again.';
      if (submitError && typeof submitError === 'object' && 'response' in submitError) {
        const err = submitError as { response?: { data?: { detail?: string } } };
        setError(err.response?.data?.detail ?? fallback);
      } else if (submitError && typeof submitError === 'object' && 'message' in submitError) {
        const err = submitError as { message?: string };
        setError(err.message ?? fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setUploadingImage(true);
    setError(null);
    try {
      const uploaded = await uploadAdminProductImage(file);
      setForm((previous) => ({ ...previous, image_url: uploaded.image_url }));
    } catch (uploadError: unknown) {
      const fallback = 'Image upload failed.';
      if (uploadError && typeof uploadError === 'object' && 'response' in uploadError) {
        const err = uploadError as { response?: { data?: { detail?: string } } };
        setError(err.response?.data?.detail ?? fallback);
      } else if (uploadError && typeof uploadError === 'object' && 'message' in uploadError) {
        const err = uploadError as { message?: string };
        setError(err.message ?? fallback);
      } else {
        setError(fallback);
      }
    } finally {
      setUploadingImage(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  if (!canAccess) {
    return (
      <div className="admin-products-page">
        <div className="admin-shell">
        <div className="container">
          <div className="admin-access-card">
            <h1>Admin Access Required</h1>
            <p>Log in with an admin account to access product management.</p>
            <button type="button" onClick={() => navigate('/profile')} className="admin-btn secondary">
              Back to Profile
            </button>
          </div>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-products-page">
      <div className="admin-shell">
        <header className="header admin-topbar">
          <div className="container">
            <div className="header-content">
              <div className="logo">
                <button type="button" className="logo-btn" onClick={() => setActiveTab('manager')}>
                  <h1>SHEKURTI</h1>
                </button>
              </div>

              <nav className="main-nav">
                <ul>
                  {navItems.map((item) => (
                    <li key={item.tab}>
                      <button
                        className={`nav-link ${activeTab === item.tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(item.tab)}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="header-actions">
                <button className="action-btn user-btn" aria-label="Logout" onClick={handleLogout} title="Logout">
                  <User size={20} />
                  <span className="user-label">Logout</span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="container">
        <div className="admin-header">
          <div>
            <h1>{activeTab === 'manager' ? 'Admin Manager' : activeTab === 'contacts' ? 'Contacts' : activeTab === 'users' ? 'Users' : 'Orders'}</h1>
            <p>
              {activeTab === 'manager'
                ? 'Manage products in your catalog.'
                : activeTab === 'contacts'
                  ? 'Review contact messages from users.'
                  : activeTab === 'users'
                    ? 'See who has registered in the store.'
                    : 'View orders placed by users.'}
            </p>
          </div>
        </div>

        <div className="admin-layout">
          {activeTab === 'manager' && (
            <form className="admin-form" onSubmit={handleSubmit}>
              <h2>{editingId === null ? 'Create Product' : `Edit Product #${editingId}`}</h2>
              {error && <p className="admin-error">{error}</p>}

              <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Name" required />
              <input value={form.image_url} onChange={(e) => setForm((p) => ({ ...p, image_url: e.target.value }))} placeholder="Image URL (/assets/...)" required />
              <div className="admin-upload-row">
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  onChange={(event) => void handleImagePick(event)}
                  title="Upload product image"
                />
                <span>{uploadingImage ? 'Uploading image...' : 'Upload local image'}</span>
              </div>
              <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Category" required />
              <input value={form.color} onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))} placeholder="Color" required />
              <input value={form.material} onChange={(e) => setForm((p) => ({ ...p, material: e.target.value }))} placeholder="Material" required />
              <input value={sizesText} onChange={(e) => setSizesText(e.target.value)} placeholder="Sizes comma separated: XS,S,M,L,XL" required />
              <input type="number" min="1" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: Number(e.target.value) }))} placeholder="Price" required />
              <input type="number" min="1" value={form.original_price} onChange={(e) => setForm((p) => ({ ...p, original_price: Number(e.target.value) }))} placeholder="Original Price" required />
              <input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => setForm((p) => ({ ...p, rating: Number(e.target.value) }))} placeholder="Rating" required />
              <input type="number" min="0" value={form.reviews} onChange={(e) => setForm((p) => ({ ...p, reviews: Number(e.target.value) }))} placeholder="Reviews" required />
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description"
                rows={5}
                required
              />
              {form.image_url && (
                <div className="admin-preview">
                  <img src={form.image_url} alt="Preview" />
                </div>
              )}

              <div className="admin-form-actions">
                <button type="submit" className="admin-btn" disabled={saving}>
                  {saving ? 'Saving...' : editingId === null ? 'Create Product' : 'Update Product'}
                </button>
                {editingId !== null && (
                  <button type="button" className="admin-btn secondary" onClick={resetForm} disabled={saving}>
                    Cancel Edit
                  </button>
                )}
              </div>
            </form>
          )}

          <div className="admin-table-wrap">
            {activeTab === 'manager' && (
              <>
                <div className="admin-table-header">
                  <h2>Products ({rows.length})</h2>
                  <button type="button" className="admin-btn secondary" onClick={() => void loadRows()} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Price</th>
                        <th>Image URL</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.id}</td>
                          <td>{row.name}</td>
                          <td>{row.category}</td>
                          <td>Rs {row.price}</td>
                          <td className="url-cell">{row.image_url}</td>
                          <td className="actions-cell">
                            <button type="button" className="table-btn" onClick={() => handleEdit(row)}>
                              Edit
                            </button>
                            <button type="button" className="table-btn danger" onClick={() => void handleDelete(row.id)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'contacts' && (
              <>
                <div className="admin-table-header">
                  <h2>Contact Messages ({contacts.length})</h2>
                  <button type="button" className="admin-btn secondary" onClick={() => void loadContacts()} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Subject</th>
                        <th>Message</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {contacts.map((contact) => (
                        <tr key={contact.id}>
                          <td>{contact.id}</td>
                          <td>{contact.name}</td>
                          <td>{contact.email}</td>
                          <td>{contact.phone || '-'}</td>
                          <td>{contact.subject}</td>
                          <td className="message-cell">{contact.message}</td>
                          <td>{new Date(contact.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'users' && (
              <>
                <div className="admin-table-header">
                  <h2>Users ({users.length})</h2>
                  <button type="button" className="admin-btn secondary" onClick={() => void loadUsers()} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id}>
                          <td>{user.id}</td>
                          <td>{user.name}</td>
                          <td>{user.email}</td>
                          <td>
                            {typeof user.created_at === 'number'
                              ? new Date(user.created_at * 1000).toLocaleDateString()
                              : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'orders' && (
              <>
                <div className="admin-table-header">
                  <h2>Orders ({orders.length})</h2>
                  <button type="button" className="admin-btn secondary" onClick={() => void loadOrders()} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>User</th>
                        <th>Items</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th>Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((order) => (
                        <tr key={order.id}>
                          <td>{order.id}</td>
                          <td>
                            <div>{order.user_name || 'User'}</div>
                            <div className="muted">{order.user_email || order.user_id}</div>
                          </td>
                          <td className="message-cell">
                            {order.items
                              .map((item) => `${item.product_name || 'Item'} x${item.quantity}`)
                              .join(', ')}
                          </td>
                          <td>Rs {order.total_amount}</td>
                          <td>{order.status}</td>
                          <td>{new Date(order.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
