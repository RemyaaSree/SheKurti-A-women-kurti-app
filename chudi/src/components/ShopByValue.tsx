import React from 'react';
import under399Image from '../assets/shopByValue/Kurti Under Rs.399.png';
import under599Image from '../assets/shopByValue/Kurti Under Rs.599.png';
import under999Image from '../assets/shopByValue/Kurti Under Rs.999.png';
import under1699Image from '../assets/shopByValue/Kurti Under Rs.1699.png';
import '../styles/ShopByValue.css';

interface ShopByValueProps {
  onSelectValue: (maxPrice: number) => void;
}

const valueCards: Array<{ id: number; maxPrice: number; image: string; alt: string }> = [
  {
    id: 1,
    maxPrice: 399,
    image: under399Image,
    alt: 'Products under Rs 399',
  },
  {
    id: 2,
    maxPrice: 599,
    image: under599Image,
    alt: 'Products under Rs 599',
  },
  {
    id: 3,
    maxPrice: 999,
    image: under999Image,
    alt: 'Products under Rs 999',
  },
  {
    id: 4,
    maxPrice: 1699,
    image: under1699Image,
    alt: 'Products under Rs 1699',
  },
];

export const ShopByValue: React.FC<ShopByValueProps> = ({ onSelectValue }) => {
  return (
    <section className="shop-by-value">
      <div className="container">
        <h2 className="shop-by-value-title">Shop By Value</h2>
        <div className="shop-by-value-grid">
          {valueCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="shop-by-value-card"
              onClick={() => onSelectValue(card.maxPrice)}
              aria-label={card.alt}
            >
              <img src={card.image} alt={card.alt} className="shop-by-value-image" />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
