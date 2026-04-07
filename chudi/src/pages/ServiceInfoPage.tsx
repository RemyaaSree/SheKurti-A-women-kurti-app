import React from 'react';
import '../styles/Pages.css';

interface ServiceInfoPageProps {
  onClose: () => void;
  title: string;
  content: string[];
}

export const ServiceInfoPage: React.FC<ServiceInfoPageProps> = ({ onClose, title, content }) => {
  return (
    <div className="page-modal">
      <div className="page-container">
        <button className="close-btn" onClick={onClose}>
          x
        </button>
        <div className="page-content">
          <h1>{title}</h1>
          <div className="about-section">
            {content.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

