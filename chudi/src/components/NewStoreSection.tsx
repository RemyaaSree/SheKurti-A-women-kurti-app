import React from 'react';
import '../styles/NewStoreSection.css';
import bottomwearimg from '../assets/bottomwearimg.png';
import dupattaimg from '../assets/dupattaimg.png';

interface NewStoreSectionProps {
  onExploreBottomWear: () => void;
  onExploreDupatta: () => void;
}

export const NewStoreSection: React.FC<NewStoreSectionProps> = ({ onExploreBottomWear, onExploreDupatta }) => {
  return (
    <section className="new-store-section">
      <div className="container">
        <div className="new-store-header">
          <h2>Try Our New Store</h2>
          <p>Two new destinations curated for complete kurti looks!</p>
        </div>
        <div className="new-store-grid">
          <button type="button" className="new-store-card" onClick={onExploreBottomWear}>
            <div className="new-store-image-slot">
              <img src={bottomwearimg} alt="Bottomwear Collection" />
            </div>
          </button>
          <button type="button" className="new-store-card" onClick={onExploreDupatta}>
            <div className="new-store-image-slot">
              <img src={dupattaimg} alt="Dupatta Collection" />
            </div>
          </button>
        </div>
      </div>
    </section>
  );
};
