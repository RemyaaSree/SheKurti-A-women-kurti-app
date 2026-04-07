import React from 'react';
import '../styles/Hero.css';

interface HeroProps {
  onShopCollection?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onShopCollection }) => {
  return (
    <section className="hero">
      <div className="container">
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">The Modern Kurti Era</h1>
            <p className="hero-description">
              Handcrafted Kurtis designed for the contemporary professional. 
              Blend tradition with modern workwear aesthetics.
            </p>
            <button className="hero-cta" onClick={onShopCollection}>
              Shop Now
            </button>
          </div>
          <div className="hero-image">
            <img 
              src="https://www.onlinekurtisindia.com/uploaded-files/banner-image/-mobilebanner-120743.jpg" 
              alt="Women kurti style" 
            />
          </div>
        </div>
      </div>
    </section>
  );
};
