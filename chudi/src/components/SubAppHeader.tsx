import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Moon, Search, ShoppingBag, Sun } from 'lucide-react';
import '../styles/Header.css';
import '../styles/SubAppHeader.css';

interface SubAppNavItem {
  label: string;
  path: string;
}

interface SubAppHeaderProps {
  brandLabel: string;
  brandPath: string;
  navItems: SubAppNavItem[];
  backLabel?: string;
  backPath?: string;
  showSearch?: boolean;
  searchValue?: string;
  searchPlaceholder?: string;
  onSearchChange?: (query: string) => void;
  onSearchSubmit?: (query: string) => void;
  themeMode?: 'light' | 'dark';
  onThemeToggle?: () => void;
  wishlistCount?: number;
  cartCount?: number;
  onWishlistClick?: () => void;
  onCartClick?: () => void;
}

export const SubAppHeader: React.FC<SubAppHeaderProps> = ({
  brandLabel,
  brandPath,
  navItems,
  backLabel,
  backPath,
  showSearch = false,
  searchValue,
  searchPlaceholder = 'Search in this collection',
  onSearchChange,
  onSearchSubmit,
  themeMode,
  onThemeToggle,
  wishlistCount = 0,
  cartCount = 0,
  onWishlistClick,
  onCartClick,
}) => {
  const navigate = useNavigate();
  const [localQuery, setLocalQuery] = React.useState(searchValue ?? '');
  const queryValue = searchValue ?? localQuery;

  React.useEffect(() => {
    if (searchValue !== undefined) {
      setLocalQuery(searchValue);
    }
  }, [searchValue]);

  const navigateTo = (path: string) => {
    navigate(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value;
    if (searchValue === undefined) {
      setLocalQuery(nextValue);
    }
    onSearchChange?.(nextValue);
  };

  const handleSearchSubmit = () => {
    const query = queryValue.trim();
    if (!query) return;
    onSearchSubmit?.(query);
  };

  return (
    <header className="header subapp-header">
      <div className="container">
        <div className="header-content">
          <div className="logo">
            <button type="button" className="logo-btn" onClick={() => navigateTo(brandPath)}>
              <h1>{brandLabel}</h1>
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
            {showSearch ? (
              <div className="subapp-search">
                <Search size={16} />
                <input
                  type="text"
                  value={queryValue}
                  onChange={handleSearchChange}
                  placeholder={searchPlaceholder}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleSearchSubmit();
                    }
                  }}
                />
              </div>
            ) : null}
            {themeMode && onThemeToggle ? (
              <button
                className="action-btn theme-toggle-btn"
                aria-label={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={onThemeToggle}
                title={themeMode === 'dark' ? 'Light mode' : 'Dark mode'}
              >
                {themeMode === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            ) : null}
            {onWishlistClick ? (
              <button className="action-btn" aria-label="Wishlist" onClick={onWishlistClick}>
                <Heart size={20} />
                {wishlistCount > 0 && <span className="badge">{wishlistCount}</span>}
              </button>
            ) : null}
            {onCartClick ? (
              <button className="action-btn cart-btn" onClick={onCartClick} aria-label="Shopping Cart">
                <ShoppingBag size={20} />
                {cartCount > 0 && <span className="badge">{cartCount}</span>}
              </button>
            ) : null}
            {backLabel && backPath ? (
              <button type="button" className="subapp-back-btn" onClick={() => navigateTo(backPath)}>
                {backLabel}
              </button>
            ) : null}
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
            {backLabel && backPath ? (
              <li>
                <button className="nav-link subapp-back-link" onClick={() => navigateTo(backPath)}>
                  {backLabel}
                </button>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </header>
  );
};
