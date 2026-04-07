import type { Product } from '../types';
import { getImage } from '../utils/imageResolver';

const defaultSizes: Product['sizes'] = [
  { size: 'XS', stock: 5 },
  { size: 'S', stock: 10 },
  { size: 'M', stock: 18 },
  { size: 'L', stock: 14 },
  { size: 'XL', stock: 8 },
  { size: 'XXL', stock: 4 },
];

const colors = [
  'Blue',
  'Green',
  'Maroon',
  'Peach',
  'Pink',
  'Teal',
  'White',
  'Yellow',
];

const categories = [
  { name: 'Anarkali', material: 'Silk', price: 2499 },
  { name: 'Casual', material: 'Cotton', price: 1299 },
  { name: 'Chikankari', material: 'Cotton', price: 1899 },
  { name: 'Formal', material: 'Rayon', price: 1999 },
  { name: 'Short', material: 'Georgette', price: 999 },
  { name: 'Silk', material: 'Pure Silk', price: 2999 },
];

let id = 1;

export const products: Product[] = categories.flatMap(category =>
  colors.map(color => ({
    id: id++,
    name: `${category.name} ${color} Kurti`,
    price: category.price,
    originalPrice: category.price * 2,
    image: getImage(category.name, color),
    description: `Premium ${color.toLowerCase()} ${category.name.toLowerCase()} kurti crafted for modern ethnic wear.`,
    color,
    category: category.name,
    material: category.material,
    rating: 4.6,
    reviews: Math.floor(150 + Math.random() * 400),
    sizes: defaultSizes,
  }))
);
