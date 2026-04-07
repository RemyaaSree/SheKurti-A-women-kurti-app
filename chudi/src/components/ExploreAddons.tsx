import React from 'react';
import '../styles/ExploreAddons.css';

interface ExploreAddonsProps {
  onExploreBottomWear: () => void;
  onExploreDupatta: () => void;
}

export const ExploreAddons: React.FC<ExploreAddonsProps> = ({ onExploreBottomWear, onExploreDupatta }) => {
  return (
    <section className="explore-addons">
      <div className="container">
        <h2 className="explore-addons-title">Explore More</h2>
        <div className="explore-addons-grid">
          <button type="button" className="explore-addon-card bottom-wear" onClick={onExploreBottomWear}>
            <div className="explore-addon-content">
              <p className="explore-addon-tag">New App</p>
              <h3>Explore Bottom Wear</h3>
              <span className="explore-addon-cta">Open</span>
            </div>
          </button>
          <button type="button" className="explore-addon-card dupatta" onClick={onExploreDupatta}>
            <div className="explore-addon-content">
              <p className="explore-addon-tag">New App</p>
              <h3>Explore Dupatta</h3>
              <span className="explore-addon-cta">Open</span>
            </div>
          </button>
        </div>
      </div>
    </section>
  );
};
