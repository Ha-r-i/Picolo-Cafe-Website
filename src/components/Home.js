import React from 'react';
import { Link } from 'react-router-dom';
import FunSection from './FunSection';
import './Home.css';

const Home = () => {
  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-overlay"></div>
        <div className="hero-content">
          <h1 className="hero-title">Welcome to Piccolo Cafe</h1>
          <p className="hero-subtitle">Indore's Finest Coffee & Dining Experience</p>
          <p className="hero-description">
            Experience the perfect blend of aromatic coffee, delicious food, and warm hospitality
            in the heart of Indore.
          </p>
          <div className="hero-buttons">
            <Link to="/menu" className="btn btn-primary">
              View Menu
            </Link>
            <Link to="/booking" className="btn btn-secondary">
              Reserve a Table
            </Link>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="about-section">
        <div className="container">
          <div className="about-content">
            <div className="about-text">
              <h2>About Piccolo Cafe</h2>
              <p>
                Nestled in the vibrant city of Indore, Piccolo Cafe is your go-to destination
                for exceptional coffee, freshly prepared meals, and a cozy atmosphere that
                makes you feel at home.
              </p>
              <p>
                We source the finest ingredients and craft each cup of coffee with passion
                and precision. Whether you're looking for a quick breakfast, a leisurely lunch,
                or a perfect dinner setting, we've got you covered.
              </p>
              <div className="features">
                <div className="feature-item">
                  <div className="feature-icon">☕</div>
                  <h3>Premium Coffee</h3>
                  <p>Handcrafted with love</p>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">🍽️</div>
                  <h3>Fresh Food</h3>
                  <p>Daily prepared meals</p>
                </div>
                <div className="feature-item">
                  <div className="feature-icon">🌿</div>
                  <h3>Cozy Ambiance</h3>
                  <p>Perfect for every occasion</p>
                </div>
              </div>
            </div>
            <div className="about-image">
              <div className="image-placeholder">
                <p>Your Image Here</p>
                <small>Replace with cafe interior image</small>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <h2>Ready to Experience Piccolo?</h2>
          <p>Book your table now and enjoy a delightful dining experience</p>
          <Link to="/booking" className="btn btn-cta">
            Book a Table
          </Link>
        </div>
      </section>

      {/* Interactive Features Section */}
      <FunSection />
    </div>
  );
};

export default Home;

