import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { postContact } from '../services/api';
import '../styles/Pages.css';

export const ContactPage: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    setFormData((previous) => ({
      ...previous,
      name: user?.name ?? previous.name,
      email: user?.email ?? previous.email,
    }));
  }, [user]);

  const isFormValid = formData.name.trim() && formData.email.trim() && formData.subject.trim() && formData.message.trim();

  const handleChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!isFormValid) {
      alert('Please fill in all required fields.');
      return;
    }
    
    setSubmitting(true);

    try {
      await postContact(formData);
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        onClose();
      }, 2000);
    } catch (error) {
      console.error('Failed to submit contact form', error);
      alert('Failed to submit contact form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-modal">
      <div className="page-container">
        <button className="close-btn" onClick={onClose}>x</button>

        <div className="page-content">
          <h1>Contact Us</h1>
          <p className="page-subtitle">We would love to hear from you. Reach out anytime.</p>

          <div className="contact-wrapper">
            <div className="contact-info">
              <div className="info-item">
                <h3>Address</h3>
                <p>SheKurti Headquarters<br />Chennai, Tamil Nadu, India</p>
              </div>
              <div className="info-item">
                <h3>Phone</h3>
                <p>+91 8610395422<br />Monday - Friday, 8AM - 8PM IST</p>
              </div>
              <div className="info-item">
                <h3>Email</h3>
                <p>support@shekurti.com<br />hello@shekurti.com</p>
              </div>
              <div className="info-item">
                <h3>Follow Us</h3>
                <p>Facebook | Instagram | X</p>
              </div>
            </div>

            <form className="contact-form" onSubmit={handleSubmit}>
              {submitted ? (
                <div className="success-message">
                  <p>Thank you. We will get back to you soon.</p>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your@email.com"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 XXXXX XXXXX"
                    />
                  </div>

                  <div className="form-group">
                    <label>Subject *</label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      placeholder="How can we help?"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Message *</label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      placeholder="Your message here..."
                      rows={5}
                      required
                    />
                  </div>

                  <button type="submit" className="submit-btn" disabled={!isFormValid || submitting}>
                    {submitting ? 'Submitting...' : 'Submit Query'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
