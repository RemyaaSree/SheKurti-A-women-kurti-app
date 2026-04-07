import React from 'react';
import '../styles/Pages.css';

export const AboutPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="page-modal">
      <div className="page-container">
        <button className="close-btn" onClick={onClose}>✕</button>
        
        <div className="page-content">
          <h1>About SheKurti</h1>
          
          <div className="about-hero">
            <img 
              src="https://encrypted-tbn1.gstatic.com/shopping?q=tbn:ANd9GcSim8C8-AUdEb3x3sx3DIXjRcPS4fEgYLo8yFxwHS1VUa0d-ciFDzWXpRJZ-UhKcEjKptPPTUDFK7CLz7-dDnXePvbzvD2toX04obekpzc" 
              alt="SheKurti Team"
            />
          </div>

          <section className="about-section">
            <h2>Who We Are</h2>
            <p>
              SheKurti is a premium online destination for traditional Indian kurtis with a modern twist. 
              We celebrate the rich heritage of Indian fashion while embracing contemporary styling, making 
              traditional wear accessible and fashionable for the modern Indian woman.
            </p>
          </section>

          <section className="about-section">
            <h2>Our Mission</h2>
            <p>
              To empower women by providing high-quality, beautifully designed kurtis that blend tradition 
              with modernity. We believe every woman deserves to feel confident, comfortable, and stylish in 
              her everyday wear.
            </p>
          </section>

          <section className="about-section">
            <h2>Our Values</h2>
            <div className="values-grid">
              <div className="value-card">
                <h3>🎨 Quality</h3>
                <p>We use only premium fabrics and ensure meticulous craftsmanship in every piece.</p>
              </div>
              <div className="value-card">
                <h3>💚 Sustainability</h3>
                <p>We're committed to eco-friendly practices and ethical sourcing of materials.</p>
              </div>
              <div className="value-card">
                <h3>👥 Community</h3>
                <p>We support local artisans and craftspeople, preserving traditional skills.</p>
              </div>
              <div className="value-card">
                <h3>💡 Innovation</h3>
                <p>We blend traditional designs with contemporary trends to create unique styles.</p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Why Choose SheKurti?</h2>
            <ul className="about-list">
              <li>✓ Handpicked selection of premium kurtis</li>
              <li>✓ Exclusive designs you won't find elsewhere</li>
              <li>✓ Affordable luxury without compromising quality</li>
              <li>✓ Easy returns & exchanges (30-day policy)</li>
              <li>✓ Fast, reliable shipping across India</li>
              <li>✓ Support for local artisans and communities</li>
              <li>✓ Responsive customer service 24/7</li>
            </ul>
          </section>

          <section className="about-section">
            <h2>Our Impact</h2>
            <div className="impact-stats">
              <div className="stat">
                <h3>50,000+</h3>
                <p>Happy Customers</p>
              </div>
              <div className="stat">
                <h3>200+</h3>
                <p>Artisans Supported</p>
              </div>
              <div className="stat">
                <h3>500+</h3>
                <p>Unique Designs</p>
              </div>
              <div className="stat">
                <h3>99%</h3>
                <p>Customer Satisfaction</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
