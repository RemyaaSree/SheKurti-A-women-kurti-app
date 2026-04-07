export interface ParsedSearchFilters {
  color?: string;
  category?: string;
  size?: string;
  min_price?: number;
  max_price?: number;
}

export interface ParsedSearchQuery {
  filters: ParsedSearchFilters;
  highlightTerms: string[];
}

const COLOR_WORDS = [
  'red',
  'maroon',
  'burgundy',
  'wine',
  'pink',
  'magenta',
  'purple',
  'violet',
  'lavender',
  'blue',
  'navy',
  'sky blue',
  'aqua',
  'turquoise',
  'teal',
  'green',
  'olive',
  'mint',
  'yellow',
  'mustard',
  'gold',
  'orange',
  'peach',
  'brown',
  'beige',
  'cream',
  'off white',
  'offwhite',
  'white',
  'grey',
  'gray',
  'black',
];
const CATEGORY_PHRASES = [
  'party wear',
  'office wear',
  'new arrivals',
  'new arivals',
  'kurti',
  'kurtis',
  'bottomwear',
  'bottom wear',
  'legging',
  'leggings',
  'palazzo',
  'palazzos',
  'pants',
  'trousers',
  'straight pants',
  'wide leg',
  'bell bottom',
  'bell bottom pants',
  'dupatta',
  'dupattas',
  'sets',
  'set',
  'kurti set',
  'kurti sets',
  'casual',
  'casual wear',
  'formal',
  'formal wear',
  'silk',
  'anarkali',
  'anarkali kurti',
  'chikankari',
  'chikan',
  'straight cut',
  'a line',
  'a-line',
  'short',
  'long',
  'festive',
  'party',
];
const SIZE_WORDS: Record<string, string> = {
  xs: 'XS',
  'extra small': 'XS',
  s: 'S',
  small: 'S',
  m: 'M',
  medium: 'M',
  l: 'L',
  large: 'L',
  xl: 'XL',
  'extra large': 'XL',
  xxl: 'XXL',
  'double xl': 'XXL',
};

export const parseNaturalLanguageSearch = (query: string): ParsedSearchQuery => {
  const normalized = query.trim().toLowerCase();
  const filters: ParsedSearchFilters = {};
  const highlight = new Set<string>();

  for (const color of COLOR_WORDS) {
    if (new RegExp(`\\b${color.replace(/\\s+/g, '\\\\s+')}\\b`, 'i').test(normalized)) {
      const normalizedColor = color.replace(/\s+/g, ' ');
      filters.color = normalizedColor.charAt(0).toUpperCase() + normalizedColor.slice(1);
      highlight.add(color);
      break;
    }
  }

  for (const phrase of CATEGORY_PHRASES) {
    if (new RegExp(`\\b${phrase.replace(/\\s+/g, '\\\\s+')}\\b`, 'i').test(normalized)) {
      filters.category = phrase;
      highlight.add(phrase);
      break;
    }
  }

  for (const [token, normalizedSize] of Object.entries(SIZE_WORDS)) {
    if (new RegExp(`\\b${token.replace(/\s+/g, '\\s+')}\\b`, 'i').test(normalized)) {
      filters.size = normalizedSize;
      highlight.add(token);
      break;
    }
  }

  const underMatch = normalized.match(/\bunder\s+(\d{2,6})\b/);
  if (underMatch) {
    filters.max_price = Number(underMatch[1]);
    highlight.add(`under ${underMatch[1]}`);
  }

  const aboveMatch = normalized.match(/\b(?:above|over)\s+(\d{2,6})\b/);
  if (aboveMatch) {
    filters.min_price = Number(aboveMatch[1]);
    highlight.add(`above ${aboveMatch[1]}`);
  }

  const looseTokens = normalized
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !/^\d+$/.test(token));
  for (const token of looseTokens) {
    highlight.add(token);
  }

  return { filters, highlightTerms: Array.from(highlight) };
};
