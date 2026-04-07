export type Size = 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL';

export interface ProductSize {
  size: Size;
  stock: number;
}

export interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice: number;
  image: string;
  description: string;
  color: string;
  category: string;
  material: string;
  rating: number;
  reviews: number;
  sizes: ProductSize[];
}

export interface CartItem extends Product {
  quantity: number;
  selectedSize: string;
}

export interface FilterOptions {
  categories: string[];
  priceRange: [number, number];
  color: string;
  size: string;
  rating: number;
  materials: string[];
}
