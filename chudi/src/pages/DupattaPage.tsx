import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { HomeCurations } from '../components/HomeCurations';
import { SubAppHeader } from '../components/SubAppHeader';
import { dupattaProducts } from '../data/dupattaProducts';
import { getDupattaProducts, type BackendProduct } from '../services/api';
import type { Product } from '../types';
import { mapBackendProductToProduct } from '../utils/productMapper';
import heroDupatta from '../assets/hero_dupatta.png';
import bannerFestiveDupatta from '../assets/dupatta/festivewear dupatta.png';
import bannerMulticolourDupatta from '../assets/dupatta/multicolour dupatta.png';
import bannerRegularDupatta from '../assets/dupatta/regular wear dupatta.png';
import bannerUnder299 from '../assets/dupatta/dupatta under 299.png';
import bannerUnder399 from '../assets/dupatta/dupatta under 399.png';
import bannerUnder599 from '../assets/dupatta/dupatta under 599.png';
import '../styles/DupattaPage.css';

interface DupattaPageProps {
  themeMode: 'light' | 'dark';
  onThemeToggle: () => void;
  wishlistCount: number;
  cartCount: number;
  onWishlistClick: () => void;
  onCartClick: () => void;
  onFooterNavigate: (page: string) => void;
}

export const DupattaPage: React.FC<DupattaPageProps> = ({
  themeMode,
  onThemeToggle,
  wishlistCount,
  cartCount,
  onWishlistClick,
  onCartClick,
  onFooterNavigate,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [curationProducts, setCurationProducts] = useState<Product[]>([]);

  React.useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      try {
        const data = await getDupattaProducts();
        if (mounted) {
          const mapped = data.map((item: BackendProduct) => mapBackendProductToProduct(item));
          setCurationProducts(mapped.length > 0 ? mapped : dupattaProducts);
        }
      } catch {
        if (mounted) {
          setCurationProducts(dupattaProducts);
        }
      }
    };
    loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

  const dupattaImages = import.meta.glob<string>('../assets/dupatta/**/*.{png,jpg,jpeg,webp}', {
    eager: true,
    import: 'default',
  });

  const getDupattaImage = (folder: string) => {
    const match = Object.entries(dupattaImages).find(([path]) => path.includes(`/dupatta/${folder}/`));
    return match ? match[1] : '';
  };

  const navigateToListing = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      navigate('/dupatta/shop');
      return;
    }
    navigate(`/dupatta/shop?query=${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="dupatta-page">
      <SubAppHeader
        brandLabel="SHEKURTI DUPATTA"
        brandPath="/dupatta"
        navItems={[
          { label: 'New Arrivals', path: '/dupatta' },
          { label: 'Festive', path: '/dupatta' },
          { label: 'Everyday', path: '/dupatta' },
          { label: 'Bridal', path: '/dupatta' },
          { label: 'Shop All', path: '/dupatta/shop' },
        ]}
        showSearch
        searchValue={searchQuery}
        searchPlaceholder="Search dupatta"
        onSearchChange={(value) => {
          setSearchQuery(value);
        }}
        onSearchSubmit={(value) => {
          navigateToListing(value);
        }}
        themeMode={themeMode}
        onThemeToggle={onThemeToggle}
        wishlistCount={wishlistCount}
        cartCount={cartCount}
        onWishlistClick={onWishlistClick}
        onCartClick={onCartClick}
      />
      <div className="container">
        <section className="dupatta-hero">
          <div className="dupatta-hero-content">
            <p className="dupatta-hero-tag">SheKurti Dupatta</p>
            <h1>Graceful dupattas for every look.</h1>
            <p>Discover everyday essentials, festive favorites, and vibrant multicolour picks curated for you.</p>
            <div className="dupatta-hero-actions">
              <button type="button" className="dupatta-cta" onClick={() => navigate('/dupatta')}>
                Shop Dupatta
              </button>
              <button type="button" className="dupatta-cta secondary" onClick={() => navigate('/')}>
                Explore SheKurti
              </button>
            </div>
          </div>
          <div className="dupatta-hero-art">
            <div className="dupatta-hero-image">
              <img src={heroDupatta} alt="SheKurti dupatta collection" />
            </div>
          </div>
        </section>

        <section className="dupatta-section">
          <div className="dupatta-section-header">
            <h2>Explore Varieties</h2>
            <p>Pick a category to match your mood.</p>
          </div>
          <div className="dupatta-card-grid">
            <button
              type="button"
              className="dupatta-card dupatta-card-banner"
              onClick={() => navigateToListing('Regular wear dupatta')}
              aria-label="Regular wear dupatta"
            >
              <img src={bannerRegularDupatta} alt="Regular wear dupatta" />
            </button>
            <button
              type="button"
              className="dupatta-card dupatta-card-banner"
              onClick={() => navigateToListing('Multi colour dupatta')}
              aria-label="Multi colour dupatta"
            >
              <img src={bannerMulticolourDupatta} alt="Multi colour dupatta" />
            </button>
            <button
              type="button"
              className="dupatta-card dupatta-card-banner"
              onClick={() => navigateToListing('Festive wear dupatta')}
              aria-label="Festive wear dupatta"
            >
              <img src={bannerFestiveDupatta} alt="Festive wear dupatta" />
            </button>
          </div>
        </section>

        <section className="dupatta-section">
          <div className="dupatta-section-header">
            <h2>Shop by Price</h2>
            <p>Quick picks at the perfect price.</p>
          </div>
          <div className="dupatta-card-grid price">
            <button
              type="button"
              className="dupatta-card dupatta-card-banner dupatta-card-banner-price"
              onClick={() => navigateToListing('under 299 dupatta')}
              aria-label="Dupatta under Rs 299"
            >
              <img src={bannerUnder299} alt="Dupatta under Rs 299" />
            </button>
            <button
              type="button"
              className="dupatta-card dupatta-card-banner dupatta-card-banner-price"
              onClick={() => navigateToListing('under 399 dupatta')}
              aria-label="Dupatta under Rs 399"
            >
              <img src={bannerUnder399} alt="Dupatta under Rs 399" />
            </button>
            <button
              type="button"
              className="dupatta-card dupatta-card-banner dupatta-card-banner-price"
              onClick={() => navigateToListing('under 599 dupatta')}
              aria-label="Dupatta under Rs 599"
            >
              <img src={bannerUnder599} alt="Dupatta under Rs 599" />
            </button>
          </div>
        </section>

        <HomeCurations products={curationProducts} detailPathPrefix="/dupatta/product/" />

        <div className="dupatta-home-cta">
          <button type="button" className="dupatta-cta" onClick={() => navigate('/dupatta/shop')}>
            Shop All Dupattas
          </button>
        </div>
      </div>
      <Footer onNavigate={onFooterNavigate} />
    </div>
  );
};
