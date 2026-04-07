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
  aliases: string[];
};

const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  bellbottomflair: {
    label: 'Bell Bottom Pants',
    material: 'Denim Blend',
    price: 1099,
    aliases: ['Bell Bottom', 'Bell Botton', 'Bell Bottom Pants'],
  },
  leggins: {
    label: 'Leggins',
    material: 'Cotton Lycra',
    price: 699,
    aliases: ['Leggins'],
  },
  palazzo: {
    label: 'Palazzo Pants',
    material: 'Rayon',
    price: 999,
    aliases: ['Palazzo', 'Palazzo Pants'],
  },
  printerPalazzo: {
    label: 'Printed Palazzo Pants',
    material: 'Rayon',
    price: 1099,
    aliases: ['Printed Palazzo', 'Printed Palazzo Pants', 'Printed'],
  },
  straightpants: {
    label: 'Straight Pants',
    material: 'Cotton Blend',
    price: 1099,
    aliases: ['Straight Pants', 'Straight Pant'],
  },
  widelegPant: {
    label: 'Wide Leg Pants',
    material: 'Denim Blend',
    price: 1199,
    aliases: ['Wide Leg Pants', 'Wide Leg Pant'],
  },
};

const titleCase = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const cleanName = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/,+/g, ',')
    .trim();

const extractColor = (name: string, aliases: string[]): string => {
  const lowered = name.toLowerCase();
  for (const alias of aliases) {
    const aliasLower = alias.toLowerCase();
    if (lowered.endsWith(aliasLower)) {
      return cleanName(name.slice(0, -alias.length)) || name;
    }
  }
  return name;
};

const imageModules = import.meta.glob<string>('../assets/bottomWear/*/*.png', {
  eager: true,
  import: 'default',
});

const entries = Object.entries(imageModules).sort(([a], [b]) => a.localeCompare(b));

const startId = 10001;

export const bottomwearProducts: Product[] = entries.map(([path, src], index) => {
  const segments = path.split('/');
  const folder = segments[segments.length - 2] ?? '';
  const filename = segments[segments.length - 1] ?? '';
  const baseName = cleanName(filename.replace(/\.[^.]+$/, ''));
  const config = CATEGORY_CONFIG[folder] ?? {
    label: titleCase(folder || 'Bottomwear'),
    material: 'Cotton',
    price: 999,
    aliases: [titleCase(folder)],
  };
  const color = extractColor(baseName, config.aliases) || 'Assorted';
  const rating = Number((4.1 + (index % 5) * 0.1).toFixed(1));
  const reviews = 120 + (index % 30) * 6;
  const price = config.price;
  const originalPrice = Math.round(price * 1.45);

  return {
    id: startId + index,
    name: baseName,
    price,
    originalPrice,
    image: src,
    description: `Comfort-fit ${config.label.toLowerCase()} in ${color.toLowerCase()} tone for everyday styling.`,
    color,
    category: config.label,
    material: config.material,
    rating,
    reviews,
    sizes: defaultSizes,
  };
});
