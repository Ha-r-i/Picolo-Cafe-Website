import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Home } from './Home';
import { Menu } from './Menu';
import { Booking, ManageBooking } from './Booking';
import { Account } from './Account';
import { Staff } from './Staff';
export default function App() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container nav-row">
          <Link className="wordmark" to="/" aria-label="Piccolo Cafe home">
            Piccolo<span>CAFE · INDORE</span>
          </Link>
          <button
            className="nav-toggle secondary"
            aria-expanded={open}
            aria-controls="navigation"
            onClick={() => setOpen(!open)}
          >
            Menu {open ? '−' : '+'}
          </button>
          <nav id="navigation" aria-label="Main navigation" className={open ? 'open' : ''}>
            <NavLink to="/" end>
              Our space
            </NavLink>
            <NavLink to="/menu">The menu</NavLink>
            <NavLink to="/account">My reservations</NavLink>
            <NavLink to="/booking" className="button small">
              Reserve a table <span aria-hidden="true">↗</span>
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/booking" element={<Booking />} />
          <Route path="/reservation/:id" element={<ManageBooking />} />
          <Route path="/account" element={<Account />} />
          <Route path="/admin/login" element={<Account staff />} />
          <Route path="/admin/*" element={<Staff />} />
          <Route
            path="*"
            element={
              <div className="container page">
                <h1>Page not found</h1>
                <Link to="/">Return to the cafe</Link>
              </div>
            }
          />
        </Routes>
      </main>
      <footer className="site-footer">
        <div className="container footer-row">
          <div className="wordmark">
            Piccolo<span>A LITTLE PAUSE IN YOUR DAY.</span>
          </div>
          <p>
            Indore, Madhya Pradesh
            <br />
            Coffee. Conversation. Good company.
          </p>
          <Link to="/admin/dashboard">Staff sign in ↗</Link>
        </div>
        <div className="container footer-note">© {new Date().getFullYear()} Piccolo Cafe</div>
      </footer>
    </>
  );
}
