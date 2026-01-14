import React, { useState, useEffect } from 'react';
import './Menu.css';
import { fetchMenuItems, fetchBestSellers, fetchCategories } from '../firebase/menuService';

const Menu = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [showSpecial, setShowSpecial] = useState(true);
  const [menuItems, setMenuItems] = useState({});
  const [bestSellers, setBestSellers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch menu data from Firebase on component mount
  useEffect(() => {
    const loadMenuData = async () => {
      setLoading(true);
      try {
        const items = await fetchMenuItems();
        const bests = await fetchBestSellers();
        const cats = await fetchCategories();
        
        setMenuItems(items);
        setBestSellers(bests);
        
        // Transform categories for display
        const displayCategories = [
          { id: 'all', name: 'All Items' },
          ...cats.map(cat => ({
            id: cat.value,
            name: cat.label
          }))
        ];
        setCategories(displayCategories);
      } catch (error) {
        console.error('Error loading menu data:', error);
        // Fallback to empty structure
        setMenuItems({});
        setBestSellers([]);
        // Fallback categories
        setCategories([
          { id: 'all', name: 'All Items' },
          { id: 'signatureKaapi', name: 'Signature Kaapi' },
          { id: 'hotCoffee', name: 'Hot Coffee' },
          { id: 'coldCoffee', name: 'Cold Coffee' },
          { id: 'piccoKidsFavourites', name: 'Kids Favourites' },
        ]);
      } finally {
        setLoading(false);
      }
    };

    loadMenuData();
  }, []);

  const getFilteredItems = () => {
    if (activeCategory === 'all') {
      return Object.values(menuItems).flat();
    }
    return menuItems[activeCategory] || [];
  };

  // Get size/quantity from item data (or default)
  const getItemSize = (item) => {
    return item.size || item.quantity || item.volume || 'Available';
  };

  if (loading) {
    return (
      <div className="menu-page">
        <div className="menu-hero">
          <div className="container">
            <h1>Our Menu</h1>
            <p>Loading menu items...</p>
          </div>
        </div>
        <div className="menu-content">
          <div className="container">
            <div className="loading-spinner">
              <div className="spinner"></div>
              <p>Loading delicious menu items...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="menu-page">
      <div className="menu-hero">
        <div className="container">
          <h1>Our Menu</h1>
          <p>Discover our carefully crafted selection of beverages, meals, and desserts</p>
        </div>
      </div>

      <div className="menu-content">
        <div className="container">
          {/* Best Sellers Section */}
          {showSpecial && bestSellers.length > 0 && (
            <section className="special-menus-section">
              <div className="section-header">
                <h2>Best Sellers</h2>
                <p>Our most popular items loved by customers</p>
              </div>
              <div className="special-menus-grid">
                {bestSellers.map((special) => (
                  <div key={special.id} className="special-menu-item">
                    {special.image && (
                      <div className="menu-item-image">
                        <img 
                          src={special.image} 
                          alt={special.name}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                        <div className="image-placeholder" style={{ display: 'none' }}>
                          <span>📷</span>
                        </div>
                        {special.badge && <span className="special-badge">{special.badge}</span>}
                      </div>
                    )}
                    <div className="special-menu-content">
                      <div className="special-menu-header">
                        <h3>{special.name}</h3>
                        <span className="menu-price">{special.price}</span>
                      </div>
                      <p className="menu-description">{special.description}</p>
                      {/* Size/Quantity Display */}
                      {getItemSize(special) && (
                        <div className="size-display">
                          <span className="size-label">Quantity:</span>
                          <span className="size-value">{getItemSize(special)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Category Filter */}
          <div className="menu-section-header">
            <h2>Regular Menu</h2>
          </div>
          <div className="menu-categories">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`category-btn ${activeCategory === category.id ? 'active' : ''}`}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Menu Items Grid */}
          <div className="menu-grid">
            {getFilteredItems().map((item) => (
              <div key={item.id} className="menu-item">
                {item.image && (
                  <div className="menu-item-image">
                    <img 
                      src={item.image} 
                      alt={item.name}
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="image-placeholder" style={{ display: 'none' }}>
                      <span>🍽️</span>
                    </div>
                  </div>
                )}
                <div className="menu-item-content">
                  <div className="menu-item-header">
                    <h3>{item.name}</h3>
                    <span className="menu-price">{item.price}</span>
                  </div>
                  <p className="menu-description">{item.description}</p>
                  {/* Size/Quantity Display */}
                  {getItemSize(item) && (
                    <div className="size-display">
                      <span className="size-label">Quantity:</span>
                      <span className="size-value">{getItemSize(item)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {getFilteredItems().length === 0 && (
            <div className="no-items">
              <p>No items found in this category. Add items to Firebase to see them here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Menu;