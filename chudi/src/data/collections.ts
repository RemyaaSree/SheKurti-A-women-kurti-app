import type { FilterOptions } from '../types';

export interface CollectionConfig {
  name: string;
  slug: string;
  aliases?: string[];
  categories?: string[];
  materials?: string[];
  backendSection?: string;
}

const BASE_PRICE_RANGE: [number, number] = [0, 5000];

export const collectionConfigs: CollectionConfig[] = [
  {
    name: 'Office Wear',
    slug: 'office-wear',
    categories: ['Formal','Short'],
  },
  {
    name: 'Festive Specials',
    slug: 'festive-specials',
    categories: ['Anarkali', 'Silk'],
  },
  {
    name: 'Anarkali Collection',
    slug: 'anarkali-collection',
    categories: ['Anarkali'],
    backendSection: 'anarkali',
  },
  {
    name: 'Chikankari Grace',
    slug: 'chikankari-collections',
    aliases: ['chikankari', 'chikankari-collection'],
    categories: ['Chikankari'],
    backendSection: 'chikankari',
  },
  {
    name: 'Straight Cut',
    slug: 'straight-cut',
    categories: ['Formal'],
  },
  {
    name: 'Cotton Classics',
    slug: 'cotton-classics',
    materials: ['Cotton'],
  },
  {
    name: 'Silk Elegance',
    slug: 'silk-elegance',
    aliases: ['silk-elegnace', 'silk-elegence'],
    materials: ['Silk', 'Pure Silk'],
    backendSection: 'silk',
  },
  {
    name: 'New Arrivals',
    slug: 'new-arrivals',
    aliases: ['new-arivals'],
    backendSection: 'new-arrivals',
  },
  {
    name: 'Kurtis',
    slug: 'kurtis',
    backendSection: 'kurtis',
  },
  {
    name: 'Sets',
    slug: 'sets',
    backendSection: 'sets',
  },
  {
    name: 'Budget',
    slug: 'budget',
    aliases: ['budgets'],
    backendSection: 'budget',
  },
];

export const getCollectionBySlug = (slug: string): CollectionConfig | undefined => {
  const normalizedSlug = slug.trim().toLowerCase();
  return collectionConfigs.find(
    (config) =>
      config.slug === normalizedSlug || config.aliases?.includes(normalizedSlug)
  );
};

export const getCollectionByName = (name: string): CollectionConfig | undefined => {
  const normalizedName = name.trim().toLowerCase();
  return collectionConfigs.find(
    (config) => config.name.trim().toLowerCase() === normalizedName
  );
};

export const getFiltersForCollection = (config?: CollectionConfig): FilterOptions => ({
  categories: config?.categories ?? [],
  priceRange: BASE_PRICE_RANGE,
  color: '',
  size: '',
  rating: 0,
  materials: config?.materials ?? [],
});
