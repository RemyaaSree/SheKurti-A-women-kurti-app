import React, { useMemo, useState } from 'react';
import type { FilterOptions } from '../types';
import type { Product } from '../types';
import '../styles/Sidebar.css';

interface SidebarProps {
  filters: FilterOptions;
  onFilterChange: (filters: FilterOptions) => void;
  products: Product[];
}

const COLOR_SWATCH_MAP: Record<string, string> = {
  blue: '#3b82f6',
  green: '#22c55e',
  maroon: '#7f1d1d',
  peach: '#fdba74',
  pink: '#ec4899',
  teal: '#14b8a6',
  white: '#ffffff',
  yellow: '#facc15',
  black: '#111827',
  grey: '#6b7280',
  gray: '#6b7280',
  lavender: '#c4b5fd',
  magenta: '#d946ef',
  megentha: '#d946ef',
  purple: '#8b5cf6',
  violet: '#7c3aed',
  orange: '#f97316',
  brown: '#92400e',
  red: '#ef4444',
  beige: '#d6c5a0',
  aqua: '#06b6d4',
  mustard: '#ca8a04',
};

const hashToColor = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 65% 58%)`;
};

const resolveColorSwatch = (color: string): string => {
  const normalized = color.trim().toLowerCase();
  if (COLOR_SWATCH_MAP[normalized]) {
    return COLOR_SWATCH_MAP[normalized];
  }

  const tokens = normalized.split(/[\s/-]+/).filter(Boolean);
  for (const token of tokens) {
    if (COLOR_SWATCH_MAP[token]) {
      return COLOR_SWATCH_MAP[token];
    }
  }

  // Fallback keeps every unseen color name visible with stable color.
  return hashToColor(normalized);
};

export const Sidebar: React.FC<SidebarProps> = ({ filters, onFilterChange, products }) => {
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(true);
  const [isPriceOpen, setIsPriceOpen] = useState(true);
  const [isColorsOpen, setIsColorsOpen] = useState(true);
  const [isMaterialsOpen, setIsMaterialsOpen] = useState(false);

  const categoriesWithCounts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((product) => {
      map[product.category] = (map[product.category] || 0) + 1;
    });
    return Object.keys(map).map((key) => ({ name: key, count: map[key] }));
  }, [products]);

  const colorsWithCounts = useMemo(() => {
    const map: Record<string, number> = {};
    products.forEach((product) => {
      if (product.color) {
        map[product.color] = (map[product.color] || 0) + 1;
      }
    });

    return Object.keys(map)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({ name, count: map[name] }));
  }, [products]);

  const materials = useMemo(
    () => Array.from(new Set(products.map((product) => product.material))).filter(Boolean) as string[],
    [products]
  );

  const applyFilters = (nextFilters: FilterOptions) => {
    onFilterChange(nextFilters);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleCategory = (category: string) => {
    const exists = filters.categories.includes(category);
    applyFilters({
      ...filters,
      categories: exists
        ? filters.categories.filter((candidate) => candidate !== category)
        : [...filters.categories, category],
    });
  };

  const toggleMaterial = (material: string) => {
    const exists = filters.materials.includes(material);
    applyFilters({
      ...filters,
      materials: exists
        ? filters.materials.filter((candidate) => candidate !== material)
        : [...filters.materials, material],
    });
  };

  const setColor = (color: string) => applyFilters({ ...filters, color: filters.color === color ? '' : color });

  const setPriceMin = (min: number) =>
    applyFilters({
      ...filters,
      priceRange: [min, Math.max(min, filters.priceRange[1])],
    });

  const setPriceMax = (max: number) =>
    applyFilters({
      ...filters,
      priceRange: [Math.min(filters.priceRange[0], max), max],
    });

  const clearAll = () => {
    applyFilters({
      categories: [],
      priceRange: [0, 5000],
      color: '',
      size: '',
      rating: 0,
      materials: [],
    });
  };

  return (
    <aside className="sidebar" aria-label="Product filters">
      <div className="sidebar-header">
        <h3>Filter</h3>
        <button className="clear-all-btn" onClick={clearAll}>
          Clear All
        </button>
      </div>

      <div className="filter-section">
        <button
          type="button"
          className="filter-collapse-btn"
          onClick={() => setIsCategoriesOpen((previous) => !previous)}
          aria-expanded={isCategoriesOpen}
          aria-controls="sidebar-categories-list"
        >
          <h4 className="filter-title">Categories</h4>
          <span className={`filter-arrow ${isCategoriesOpen ? 'open' : ''}`}>▾</span>
        </button>
        {isCategoriesOpen && (
          <div className="category-list" id="sidebar-categories-list">
            {categoriesWithCounts.map((category) => {
              const id = `cat-${category.name}`;
              return (
                <div key={category.name} className="filter-item">
                  <input
                    id={id}
                    type="checkbox"
                    checked={filters.categories.includes(category.name)}
                    onChange={() => toggleCategory(category.name)}
                    className="filter-checkbox"
                  />
                  <label htmlFor={id} className="filter-text">
                    {category.name} <span className="filter-count">({category.count})</span>
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="filter-section">
        <button
          type="button"
          className="filter-collapse-btn"
          onClick={() => setIsPriceOpen((previous) => !previous)}
          aria-expanded={isPriceOpen}
          aria-controls="sidebar-price-range"
        >
          <h4 className="filter-title">Price</h4>
          <span className={`filter-arrow ${isPriceOpen ? 'open' : ''}`}>▾</span>
        </button>

        {isPriceOpen && (
          <div id="sidebar-price-range">
            <div className="price-inputs">
              <div className="price-input-group">
                <label htmlFor="price-min">Min</label>
                <input
                  id="price-min"
                  type="number"
                  className="price-input"
                  min={0}
                  max={filters.priceRange[1]}
                  value={filters.priceRange[0]}
                  onChange={(event) => setPriceMin(Number(event.target.value))}
                />
              </div>

              <span className="price-separator">–</span>

              <div className="price-input-group">
                <label htmlFor="price-max">Max</label>
                <input
                  id="price-max"
                  type="number"
                  className="price-input"
                  min={filters.priceRange[0]}
                  max={5000}
                  value={filters.priceRange[1]}
                  onChange={(event) => setPriceMax(Number(event.target.value))}
                />
              </div>
            </div>

            <label htmlFor="price-slider" className="visually-hidden">
              Price range slider
            </label>
            <input
              id="price-slider"
              type="range"
              className="price-slider"
              min={0}
              max={5000}
              value={filters.priceRange[1]}
              onChange={(event) => setPriceMax(Number(event.target.value))}
            />

            <div className="price-range-display">
              Rs {filters.priceRange[0]} - Rs {filters.priceRange[1]}
            </div>
          </div>
        )}
      </div>

      <div className="filter-section">
        <button
          type="button"
          className="filter-collapse-btn"
          onClick={() => setIsColorsOpen((previous) => !previous)}
          aria-expanded={isColorsOpen}
          aria-controls="sidebar-color-list"
        >
          <h4 className="filter-title">Colors</h4>
          <span className={`filter-arrow ${isColorsOpen ? 'open' : ''}`}>▾</span>
        </button>
        {isColorsOpen && (
          <div className="color-list" id="sidebar-color-list">
            <label className="filter-item color-option">
              <input
                type="checkbox"
                className="filter-checkbox color-checkbox"
                checked={filters.color === ''}
                onChange={() => setColor('')}
              />
              <span className="color-dot color-dot-all" />
              <span className="filter-text">
                All <span className="filter-count">({products.length})</span>
              </span>
            </label>

            {colorsWithCounts.map((color) => {
              const id = `color-${color.name}`;
              return (
                <label key={color.name} htmlFor={id} className="filter-item color-option">
                  <input
                    id={id}
                    type="checkbox"
                    className="filter-checkbox color-checkbox"
                    checked={filters.color === color.name}
                    onChange={() => setColor(color.name)}
                  />
                  <span
                    className="color-dot"
                    style={{
                      backgroundColor: resolveColorSwatch(color.name),
                      ['--swatch-color' as string]: resolveColorSwatch(color.name),
                    }}
                  />
                  <span className="filter-text">
                    {color.name} <span className="filter-count">({color.count})</span>
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="filter-section">
        <button
          type="button"
          className="filter-collapse-btn"
          onClick={() => setIsMaterialsOpen((previous) => !previous)}
          aria-expanded={isMaterialsOpen}
          aria-controls="sidebar-material-list"
        >
          <h4 className="filter-title">Fabric</h4>
          <span className={`filter-arrow ${isMaterialsOpen ? 'open' : ''}`}>▾</span>
        </button>
        {isMaterialsOpen && (
          <div className="material-list" id="sidebar-material-list">
            {materials.map((material) => {
              const id = `mat-${material}`;
              return (
                <div key={material} className="filter-item">
                  <input
                    id={id}
                    type="checkbox"
                    checked={filters.materials.includes(material)}
                    onChange={() => toggleMaterial(material)}
                    className="filter-checkbox"
                  />
                  <label htmlFor={id} className="filter-text">
                    {material}
                  </label>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
