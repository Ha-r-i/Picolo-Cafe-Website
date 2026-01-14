import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './FunSection.css';

const FunSection = () => {
  const [quizResult, setQuizResult] = useState(null);
  const [email, setEmail] = useState('');

  // Interactive Quiz - Find Your Perfect Drink
  const handleQuizSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const answers = {
      time: formData.get('time'),
      mood: formData.get('mood'),
      weather: formData.get('weather'),
    };

    let result = '';
    if (answers.time === 'morning' && answers.mood === 'energetic') {
      result = 'Hot Coffee ☕ - Start your day with our signature hot coffee!';
    } else if (answers.weather === 'hot' || answers.mood === 'relaxed') {
      result = 'Cold Coffee 🥤 - Cool down with our refreshing cold coffee!';
    } else if (answers.mood === 'adventurous') {
      result = 'Signature Kaapi 🍵 - Try our unique signature kaapi blend!';
    } else {
      result = 'Any Coffee ☕ - You\'ll love anything from our menu!';
    }
    
    setQuizResult(result);
  };

  const handleNewsletterSubmit = (e) => {
    e.preventDefault();
    alert('Thank you for subscribing! You\'ll receive our latest updates and offers.');
    setEmail('');
  };

  return (
    <div className="fun-section">
      <div className="container">
        <div className="section-header">
          <h2>Interactive Features</h2>
          <p>Have fun exploring what makes Piccolo Cafe special</p>
        </div>

        <div className="fun-grid">
          {/* Interactive Quiz */}
          <div className="fun-card quiz-card">
            <div className="fun-card-icon">🎯</div>
            <h3>Find Your Perfect Drink</h3>
            <p>Take our quick quiz to discover your ideal coffee match!</p>
            {!quizResult ? (
              <form onSubmit={handleQuizSubmit} className="quiz-form">
                <div className="quiz-question">
                  <label>What time of day is it?</label>
                  <select name="time" required>
                    <option value="">Select...</option>
                    <option value="morning">Morning</option>
                    <option value="afternoon">Afternoon</option>
                    <option value="evening">Evening</option>
                  </select>
                </div>
                <div className="quiz-question">
                  <label>How are you feeling?</label>
                  <select name="mood" required>
                    <option value="">Select...</option>
                    <option value="energetic">Energetic</option>
                    <option value="relaxed">Relaxed</option>
                    <option value="adventurous">Adventurous</option>
                  </select>
                </div>
                <div className="quiz-question">
                  <label>What's the weather like?</label>
                  <select name="weather" required>
                    <option value="">Select...</option>
                    <option value="hot">Hot</option>
                    <option value="cold">Cold</option>
                    <option value="pleasant">Pleasant</option>
                  </select>
                </div>
                <button type="submit" className="btn-quiz">Discover My Drink!</button>
              </form>
            ) : (
              <div className="quiz-result">
                <p className="result-text">{quizResult}</p>
                <button onClick={() => setQuizResult(null)} className="btn-quiz">Try Again</button>
              </div>
            )}
          </div>

          {/* Fun Facts */}
          <div className="fun-card facts-card">
            <div className="fun-card-icon">✨</div>
            <h3>Cafe Fun Facts</h3>
            <div className="facts-list">
              <div className="fact-item">
                <span className="fact-number">100+</span>
                <span className="fact-text">Coffee Varieties</span>
              </div>
              <div className="fact-item">
                <span className="fact-number">5000+</span>
                <span className="fact-text">Happy Customers</span>
              </div>
              <div className="fact-item">
                <span className="fact-number">50+</span>
                <span className="fact-text">Menu Items</span>
              </div>
              <div className="fact-item">
                <span className="fact-number">5</span>
                <span className="fact-text">Years of Excellence</span>
              </div>
            </div>
          </div>

          {/* Newsletter */}
          <div className="fun-card newsletter-card">
            <div className="fun-card-icon">📧</div>
            <h3>Stay Updated</h3>
            <p>Subscribe to our newsletter for exclusive offers, new menu items, and special events!</p>
            <form onSubmit={handleNewsletterSubmit} className="newsletter-form">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="newsletter-input"
              />
              <button type="submit" className="btn-newsletter">Subscribe</button>
            </form>
          </div>

          {/* Customer Testimonials */}
          <div className="fun-card testimonials-card">
            <div className="fun-card-icon">💬</div>
            <h3>What Our Customers Say</h3>
            <div className="testimonials">
              <div className="testimonial-item">
                <p>"Best coffee in Indore! The Signature Kaapi is simply amazing."</p>
                <span className="testimonial-author">- Priya S.</span>
              </div>
              <div className="testimonial-item">
                <p>"Great ambiance and even better food. Highly recommended!"</p>
                <span className="testimonial-author">- Rahul M.</span>
              </div>
              <div className="testimonial-item">
                <p>"My kids love the kids menu. Perfect for family outings!"</p>
                <span className="testimonial-author">- Anjali K.</span>
              </div>
            </div>
          </div>

          {/* Social Media */}
          <div className="fun-card social-card">
            <div className="fun-card-icon">📱</div>
            <h3>Follow Us</h3>
            <p>Stay connected with us on social media for daily updates and behind-the-scenes content!</p>
            <div className="social-links">
              <a href="#" className="social-link" target="_blank" rel="noopener noreferrer">
                <span>📘</span> Facebook
              </a>
              <a href="#" className="social-link" target="_blank" rel="noopener noreferrer">
                <span>📷</span> Instagram
              </a>
              <a href="#" className="social-link" target="_blank" rel="noopener noreferrer">
                <span>🐦</span> Twitter
              </a>
            </div>
          </div>

          {/* Daily Special */}
          <div className="fun-card special-card">
            <div className="fun-card-icon">🎉</div>
            <h3>Today's Special</h3>
            <div className="daily-special">
              <p className="special-name">Chef's Recommendation</p>
              <p className="special-desc">Ask about our daily special when you visit!</p>
              <Link to="/menu" className="btn-special">View Menu</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FunSection;
