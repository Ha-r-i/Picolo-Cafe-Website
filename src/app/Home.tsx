import { useState } from 'react';
import { Link } from 'react-router-dom';
export function Home() {
  const [drink, setDrink] = useState('');
  return (
    <>
      <section className="container hero">
        <div className="hero-copy">
          <p className="eyebrow">YOUR COFFEE CORNER IN INDORE</p>
          <h1>
            A little coffee.
            <br />A little <em>joy.</em>
          </h1>
          <p className="hero-description">
            Pull up a chair. Settle into a warm corner, find your favourite cup, and make a little
            time for yourself.
          </p>
          <div className="actions">
            <Link to="/menu" className="button">
              Explore the menu <span aria-hidden="true">↗</span>
            </Link>
            <Link to="/booking" className="text-link">
              Save your seat →
            </Link>
          </div>
          <div className="hero-note">
            <span aria-hidden="true">✳</span> A place to slow down, together.
          </div>
        </div>
        <div className="hero-photo">
          <img
            src="/images/cafe-1200.webp"
            srcSet="/images/cafe-640.webp 640w, /images/cafe-1200.webp 1200w"
            sizes="(max-width: 760px) 100vw, 55vw"
            width="1200"
            height="800"
            alt="Floral chairs and warmly lit tables inside Piccolo Cafe"
            fetchPriority="high"
          />
          <span className="photo-caption">COME FOR THE COFFEE. STAY FOR THE MOMENT.</span>
        </div>
      </section>
      <div className="values-strip">
        <div className="container">
          <span>YOUR EVERYDAY COFFEE RITUAL</span>
          <span aria-hidden="true">✳</span>
          <span>A WARM PLACE TO GATHER</span>
          <span aria-hidden="true">✳</span>
          <span>A MOMENT TO YOURSELF</span>
        </div>
      </div>
      <section className="container story">
        <p className="eyebrow">WELCOME TO PICCOLO</p>
        <div className="story-grid">
          <h2>
            Your day deserves
            <br />a softer <em>landing.</em>
          </h2>
          <div>
            <p>
              Piccolo is a small pause in the middle of Indore. A table for two, a catch-up with
              friends, or a quiet cup with your own thoughts.
            </p>
            <p>
              Browse our current menu or book a visit in just a few steps. We’ll keep a seat ready
              for you.
            </p>
            <Link to="/booking" className="text-link">
              Plan your visit →
            </Link>
          </div>
        </div>
      </section>
      <section className="container drink-card">
        <div>
          <p className="eyebrow">FIND YOUR CUP</p>
          <h2>What’s your coffee mood?</h2>
          <p>Choose a mood for a little inspiration, then explore the menu.</p>
        </div>
        <div>
          <div className="actions">
            <button
              className="button secondary"
              onClick={() =>
                setDrink('A warm coffee might be just the thing. Explore our hot coffee category.')
              }
            >
              Something cosy
            </button>
            <button
              className="button secondary"
              onClick={() => setDrink('Try something chilled. Explore our cold coffee category.')}
            >
              Something refreshing
            </button>
          </div>
          {drink && (
            <p role="status">
              {drink} <Link to="/menu">See the menu →</Link>
            </p>
          )}
        </div>
      </section>
      <section className="visit-banner">
        <div className="container">
          <p className="eyebrow">MAKE SOME TIME FOR GOOD COMPANY</p>
          <h2>There’s a seat for you.</h2>
          <Link to="/booking" className="button light">
            Reserve your table ↗
          </Link>
        </div>
      </section>
    </>
  );
}
