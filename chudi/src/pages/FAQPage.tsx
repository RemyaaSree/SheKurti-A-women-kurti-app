import React, { useEffect, useState } from 'react';
import { getFaqs } from '../services/api';
import '../styles/Pages.css';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const fallbackFaqs: FAQItem[] = [
  {
    id: 1,
    question: 'What is the delivery timeframe?',
    answer: 'We offer standard delivery (5-7 business days) and express delivery (2-3 business days).',
  },
  {
    id: 2,
    question: 'Can I return or exchange a product?',
    answer: 'Yes. We offer 30-day returns and exchanges for unworn items in original packaging.',
  },
  {
    id: 3,
    question: 'What payment methods do you accept?',
    answer: 'We accept major cards, net banking, digital wallets, and UPI payments.',
  },
];

export const FAQPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [openId, setOpenId] = useState<number | null>(null);
  const [faqs, setFaqs] = useState<FAQItem[]>(fallbackFaqs);

  useEffect(() => {
    let mounted = true;

    const loadFaqs = async () => {
      try {
        const data = await getFaqs();
        if (mounted && Array.isArray(data) && data.length > 0) {
          setFaqs(data as FAQItem[]);
        }
      } catch (error) {
        console.error('Failed to fetch FAQs', error);
      }
    };

    loadFaqs();

    return () => {
      mounted = false;
    };
  }, []);

  const toggleFAQ = (id: number) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="page-modal">
      <div className="page-container">
        <button className="close-btn" onClick={onClose}>x</button>

        <div className="page-content">
          <h1>Frequently Asked Questions</h1>
          <p className="page-subtitle">Find answers to common questions about our products and services.</p>

          <div className="faq-list">
            {faqs.map((faq) => (
              <div key={faq.id} className={`faq-item ${openId === faq.id ? 'open' : ''}`}>
                <button className="faq-question" onClick={() => toggleFAQ(faq.id)}>
                  <span>{faq.question}</span>
                  <span className="faq-toggle">{openId === faq.id ? '-' : '+'}</span>
                </button>
                {openId === faq.id && (
                  <div className="faq-answer">
                    <p>{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="faq-cta">
            <p>Did not find what you were looking for?</p>
            <button className="contact-link-btn" onClick={onClose}>Contact Us</button>
          </div>
        </div>
      </div>
    </div>
  );
};
