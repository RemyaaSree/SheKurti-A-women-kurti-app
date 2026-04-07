import type { Product, ProductSize } from '../types';
import type { BackendProduct } from '../services/api';

const defaultSizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];

const toSizes = (sizes?: string[]): ProductSize[] => {
  const source = sizes && sizes.length > 0 ? sizes : defaultSizeOrder;
  return source.map((size) => ({ size: size as ProductSize['size'], stock: 999 }));
};

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const mapBackendProductToProduct = (product: BackendProduct): Product => ({
  id: toNumber(product.id, -1),
  name: product.name,
  price: toNumber(product.price, 0),
  originalPrice: toNumber(product.original_price, toNumber(product.price, 0)),
  image: product.image_url ?? '',
  description: product.description ?? '',
  color: product.color ?? 'Unknown',
  category: product.category ?? 'General',
  material: product.material ?? 'Cotton',
  rating: toNumber(product.rating, 4.2),
  reviews: Math.max(0, Math.floor(toNumber(product.reviews, 0))),
  sizes: toSizes(product.sizes),
});
