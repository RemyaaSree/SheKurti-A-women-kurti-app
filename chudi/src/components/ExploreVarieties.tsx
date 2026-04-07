import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getCollectionByName } from '../data/collections';
import officeWearImage from '../assets/office_wear.png';
import silkeleganceImage from '../assets/silk_elegance.png';
import chikankariImage from '../assets/Chikankari_Elegance.png';
import festiveImage from '../assets/Festive_special.png';
import anarkaliImage from '../assets/Anarkali_collections.png';
import '../styles/ExploreVarieties.css';

const categories = [
  {
    id: 1,
    name: 'Office Wear',
    styles: '50+ styles',
    image: officeWearImage,
  },
  {
    id: 2,
    name: 'Anarkali Collection',
    styles: '40+ styles',
    image: anarkaliImage,
  },
  {
    id: 3,
    name: 'Chikankari Grace',
    styles: '30+ styles',
    image: chikankariImage,
  },
  {
    id: 4,
    name: 'Festive Specials',
    styles: '40+ styles',
    image: festiveImage,
  },
  {
    id: 5,
    name: 'Cotton Classics',
    styles: '85+ styles',
    image: 'https://i.pinimg.com/1200x/af/63/dc/af63dc7ad1b17548504fcf8f49a8002b.jpg',
  },
  {
    id: 6,
    name: 'Silk Elegance',
    styles: '50+ styles',
    image: silkeleganceImage,
  },
];

export const ExploreVarieties: React.FC = () => {
  const navigate = useNavigate();

  return (
    <section className="explore-varieties">
      <div className="container">
        <h2 className="explore-title">Explore Varieties</h2>
        <div className="varieties-grid">
          {categories.map((category) => {
            const collection = getCollectionByName(category.name);
            const to = collection ? `/${collection.slug}` : '/';

            return (
              <button
                key={category.id}
                type="button"
                className="variety-card"
                onClick={() => navigate(to)}
              >
                <div className="variety-image">
                  <img src={category.image} alt={category.name} />
                </div>
                <div className="variety-info">
                  <h3 className="variety-name">{category.name}</h3>
                  <p className="variety-styles">{category.styles}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
