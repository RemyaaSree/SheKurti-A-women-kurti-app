import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Footer } from '../components/Footer';
import { HomeCurations } from '../components/HomeCurations';
import { SubAppHeader } from '../components/SubAppHeader';
import { bottomwearProducts } from '../data/bottomwearProducts';
import { getBottomwearProducts, type BackendProduct } from '../services/api';
import { mapBackendProductToProduct } from '../utils/productMapper';
import type { Product } from '../types';
import heroBottom from '../assets/hero_bottom.png';
import '../styles/BottomWearPage.css';

const VARIETIES = [
  { id: 1, title: 'Leggins', folder: 'leggins', slug: 'leggins' },
  { id: 2, title: 'Bell Bottom Pants', folder: 'bellbottomflair', slug: 'bellbottom' },
  { id: 3, title: 'Palazzo Pants', folder: 'palazzo', slug: 'palazzo' },
  { id: 4, title: 'Straight Pants', folder: 'straightpants', slug: 'straightpant' },
  { id: 5, title: 'Wide Leg Pants', folder: 'widelegPant', slug: 'wideleg' },
  { id: 6, title: 'Printed Palazzo Pants', folder: 'printerPalazzo', slug: 'printedpalazzo' },
];

const SPOTLIGHT = [
  {
    id: 1,
    title: 'Ethnic',
    subtitle: 'Ethnic starting from Rs. 599',
    map: 'Straight pant + Leggins',
    folders: ['straightpants', 'leggins'],
  },
  {
    id: 2,
    title: 'Casual',
    subtitle: 'Casual starting from Rs. 699',
    map: 'Printed palazzo + Bell bottom pants',
    folders: ['printerPalazzo', 'bellbottomflair'],
  },
  {
    id: 3,
    title: 'Office wear',
    subtitle: 'Office starting from Rs. 999',
    map: 'Wide leg pant + Palazzo pant',
    folders: ['widelegPant', 'palazzo'],
  },
];

const CATEGORY_DISPLAY_IMAGES: Record<string, string> = {
  leggins: 'Womens Leggins.png',
  bellbottom: 'Womens Bell Bottom.png',
  palazzo: 'Womens Palazzo.png',
  straightpant: 'Womens Straight Pants.png',
  wideleg: 'Womens Wide Leg Pants.png',
  printedpalazzo: 'Womens Printed Palazzo.png',
};

const SPOTLIGHT_DISPLAY_IMAGES: Record<string, string> = {
  Ethnic: 'Spotlight Zone Ethnic.png',
  Casual: 'Spotlight zone Casual.png',
  'Office wear': 'Spotlight Zone Office.png',
};

interface BottomWearPageProps {
  themeMode: 'light' | 'dark';
  onThemeToggle: () => void;
  wishlistCount: number;
  cartCount: number;
  onWishlistClick: () => void;
  onCartClick: () => void;
  onFooterNavigate: (page: string) => void;
}

export const BottomWearPage: React.FC<BottomWearPageProps> = ({
  themeMode,
  onThemeToggle,
  wishlistCount,
  cartCount,
  onWishlistClick,
  onCartClick,
  onFooterNavigate,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [curationProducts, setCurationProducts] = React.useState<Product[]>([]);

  React.useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      try {
        const data = await getBottomwearProducts();
        if (mounted) {
          const mapped = data.map((item: BackendProduct) => mapBackendProductToProduct(item));
          setCurationProducts(mapped.length > 0 ? mapped : bottomwearProducts);
        }
      } catch {
        if (mounted) {
          setCurationProducts(bottomwearProducts);
        }
      }
    };
    loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

  const imageModules = import.meta.glob<string>('../assets/bottomWear/**/*.{png,jpg,jpeg,webp}', {
    eager: true,
    import: 'default',
  });
  const topLevelImages = import.meta.glob<string>('../assets/bottomWear/*.{png,jpg,jpeg,webp}', {
    eager: true,
    import: 'default',
  });

  const getImagesForFolder = (folder: string) =>
    Object.entries(imageModules)
      .filter(([path]) => path.includes(`/bottomWear/${folder}/`))
      .map(([, src]) => src);

  const getPrimaryImage = (folder: string) => getImagesForFolder(folder)[0] ?? '';

  const getSpotlightImage = (folders: string[]) => {
    for (const folder of folders) {
      const candidate = getPrimaryImage(folder);
      if (candidate) return candidate;
    }
    return '';
  };

  const getCategoryDisplayImage = (slug: string, folder: string) => {
    const filename = CATEGORY_DISPLAY_IMAGES[slug];
    if (filename) {
      const entry = Object.entries(topLevelImages).find(([path]) => path.endsWith(`/${filename}`));
      if (entry) return entry[1];
    }
    return getPrimaryImage(folder);
  };

  const getSpotlightDisplayImage = (title: string, folders: string[]) => {
    const filename = SPOTLIGHT_DISPLAY_IMAGES[title];
    if (filename) {
      const entry = Object.entries(topLevelImages).find(([path]) => path.endsWith(`/${filename}`));
      if (entry) return entry[1];
    }
    return getSpotlightImage(folders);
  };

  return (
    <div className="bottomwear-page">
      <SubAppHeader
        brandLabel="SHEKURTI BOTTOMWEAR"
        brandPath="/bottomwear"
        navItems={[
          { label: 'New Arrivals', path: '/bottomwear' },
          { label: 'Leggins', path: '/bottomwear/leggins' },
          { label: 'Palazzo', path: '/bottomwear/palazzo' },
          { label: 'Straight Pants', path: '/bottomwear/straightpant' },
          { label: 'Shop All', path: '/bottomwear/shop' },
        ]}
        showSearch
        searchValue={searchQuery}
        searchPlaceholder="Search bottomwear"
        onSearchChange={setSearchQuery}
        onSearchSubmit={(query) => navigate(`/bottomwear/shop?query=${encodeURIComponent(query)}`)}
        themeMode={themeMode}
        onThemeToggle={onThemeToggle}
        wishlistCount={wishlistCount}
        cartCount={cartCount}
        onWishlistClick={onWishlistClick}
        onCartClick={onCartClick}
      />
      <div className="container">

        <section className="bottomwear-hero" id="bottomwear-new">
          <div>
            <p className="bottomwear-tag">Bottomwear Store</p>
            <h1>Find Your Perfect Bottomwear</h1>
            <p className="bottomwear-subtitle">
              Curated bottomwear that complements every kurti look. Shop fresh arrivals and timeless staples.
            </p>
            <button type="button" className="bottomwear-cta" onClick={() => navigate('/bottomwear/shop')}>
              Shop Now
            </button>
            <button
              type="button"
              className="bottomwear-cta secondary"
              onClick={() => navigate('/')}
            >
              SheKurti Home
            </button>
          </div>
          <div className="bottomwear-hero-image">
            <img src={heroBottom} alt="SheKurti bottomwear collection" />
          </div>
        </section>

        <section className="bottomwear-section" id="bottomwear-budget">
          <div className="bottomwear-section-header">
            <h2>Explore Varieties</h2>
            <p>Pick your favorite silhouettes. Add thumbnails for each category.</p>
          </div>
          <div className="bottomwear-varieties-grid">
            {VARIETIES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="bottomwear-variety-card"
                onClick={() => navigate(`/bottomwear/${item.slug}`)}
              >
                <div className="bottomwear-image-slot">
                  {getCategoryDisplayImage(item.slug, item.folder) ? (
                    <img src={getCategoryDisplayImage(item.slug, item.folder)} alt={item.title} />
                  ) : (
                    <span>Add Image</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="bottomwear-section" id="bottomwear-sale">
          <div className="bottomwear-section-header">
            <h2>Spotlight Zone</h2>
            <p>Curated edits with starter price points.</p>
          </div>
          <div className="bottomwear-spotlight-grid">
            {SPOTLIGHT.map((item) => (
              <button
                key={item.id}
                type="button"
                className="bottomwear-spotlight-card"
                onClick={() => navigate('/bottomwear/shop')}
              >
                <div className="bottomwear-spotlight-image">
                  {getSpotlightDisplayImage(item.title, item.folders) ? (
                    <img src={getSpotlightDisplayImage(item.title, item.folders)} alt={item.title} />
                  ) : (
                    <span>Add Image</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        <HomeCurations products={curationProducts} detailPathPrefix="/bottomwear/product/" />

      </div>
      <Footer onNavigate={onFooterNavigate} />
    </div>
  );
};
