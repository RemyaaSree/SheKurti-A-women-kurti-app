import React from 'react';
import '../styles/Pages.css';

export const StoryPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="page-modal">
      <div className="page-container">
        <button className="close-btn" onClick={onClose}>✕</button>
        
        <div className="page-content">
          <h1>Our Story</h1>
          <p className="page-subtitle">How SheKurti began as a dream and became a movement</p>

          <div className="story-timeline">
            <div className="timeline-item">
              <div className="timeline-marker">2015</div>
              <div className="timeline-content">
                <h3>The Beginning</h3>
                <p>
                  SheKurti started as a small passion project by our founder, Priya Sharma, who was inspired 
                  by her grandmother's collection of traditional kurtis. She noticed that finding stylish, 
                  quality kurtis online was challenging. That's when the idea of SheKurti was born.
                </p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker">2016</div>
              <div className="timeline-content">
                <h3>First Collection Launch</h3>
                <p>
                  We launched our first collection with just 50 handcrafted designs, working with local 
                  artisans from Mumbai. The response was overwhelming, with customers loving the blend of 
                  tradition and contemporary style.
                </p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker">2017</div>
              <div className="timeline-content">
                <h3>Expanding Our Reach</h3>
                <p>
                  As demand grew, we expanded to partner with artisans across India, from Rajasthan's 
                  bandhani experts to West Bengal's embroidery masters. We crossed 10,000 happy customers!
                </p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker">2019</div>
              <div className="timeline-content">
                <h3>Sustainability Initiative</h3>
                <p>
                  We launched eco-friendly packaging and committed to sustainable sourcing. Every kurti 
                  sold supports artisan communities and environmental conservation.
                </p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker">2021</div>
              <div className="timeline-content">
                <h3>Milestone: 50,000+ Customers</h3>
                <p>
                  With 50,000 happy customers and 200+ supported artisans, SheKurti became a household name 
                  for quality traditional wear. We opened our flagship store in Mumbai.
                </p>
              </div>
            </div>

            <div className="timeline-item">
              <div className="timeline-marker">2024</div>
              <div className="timeline-content">
                <h3>Today & Tomorrow</h3>
                <p>
                  Today, SheKurti stands as a movement celebrating Indian womanhood and traditional craftsmanship. 
                  We're working towards global expansion while maintaining our commitment to quality, sustainability, 
                  and community support.
                </p>
              </div>
            </div>
          </div>

          <section className="story-section">
            <h2>Our Founder's Message</h2>
            <div className="founder-message">
              <img 
                src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop" 
                alt="Priya Sharma"
                className="founder-image"
              />
              <div>
                <h4>Priya Sharma</h4>
                <p className="founder-title">Founder & CEO, SheKurti</p>
                <p>
                  "SheKurti is more than just an e-commerce platform. It's a celebration of our heritage, 
                  our craftspeople, and the modern Indian woman. Every kurti tells a story of tradition, 
                  dedication, and love. When you wear SheKurti, you're not just wearing a beautiful piece—
                  you're supporting artisans, preserving traditions, and empowering communities."
                </p>
              </div>
            </div>
          </section>

          <section className="story-section">
            <h2>What Drives Us</h2>
            <div className="values-highlight">
              <p>
                We believe that traditional Indian wear shouldn't be confined to festivals and special occasions. 
                Every woman deserves to feel confident and beautiful in her everyday wear. That's why we've made 
                it our mission to bring quality, style, and sustainability together in every kurti we offer.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
