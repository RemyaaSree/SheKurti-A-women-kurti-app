import type { Product } from '../types';

const defaultSizes: Product['sizes'] = [
  { size: 'XS', stock: 6 },
  { size: 'S', stock: 12 },
  { size: 'M', stock: 18 },
  { size: 'L', stock: 14 },
  { size: 'XL', stock: 10 },
  { size: 'XXL', stock: 6 },
];

type CategoryConfig = {
  label: string;
  material: string;
  price: number;
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  'Casual Dupatta': {
    label: 'Casual Dupatta',
    material: 'Cotton',
    price: 399,
  },
  'Festive Dupatta': {
    label: 'Festive Dupatta',
    material: 'Silk Blend',
    price: 699,
  },
  'Multi Colour Dupatta': {
    label: 'Multi Colour Dupatta',
    material: 'Georgette',
    price: 599,
  },
};

const cleanName = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,+/g, ',')
    .trim();

const extractColor = (name: string, category: string): string => {
  const lowered = name.toLowerCase();
  const target = category.toLowerCase();
  if (lowered.endsWith(target)) {
    return cleanName(name.slice(0, -category.length)) || name;
  }
  return name;
};

const imageModules = import.meta.glob<string>('../assets/dupatta/*/*.png', {
  eager: true,
  import: 'default',
});

const entries = Object.entries(imageModules).sort(([a], [b]) => a.localeCompare(b));

const startId = 20001;

export const dupattaProducts: Product[] = entries.map(([path, src], index) => {
  const segments = path.split('/');
  const folder = segments[segments.length - 2] ?? '';
  const filename = segments[segments.length - 1] ?? '';
  const baseName = cleanName(filename.replace(/\.[^.]+$/, ''));
  const config = CATEGORY_CONFIG[folder] ?? {
    label: folder || 'Dupatta',
    material: 'Cotton',
    price: 499,
  };
  const color = extractColor(baseName, config.label) || 'Assorted';
  const rating = Number((4.2 + (index % 5) * 0.1).toFixed(1));
  const reviews = 80 + (index % 25) * 5;
  const price = config.price;
  const originalPrice = Math.round(price * 1.6);

  return {
    id: startId + index,
    name: baseName,
    price,
    originalPrice,
    image: src,
    description: `Soft ${config.material.toLowerCase()} dupatta in ${color.toLowerCase()} palette for ${config.label.toLowerCase()}.`,
    color,
    category: config.label,
    material: config.material,
    rating,
    reviews,
    sizes: defaultSizes,
  };
});
