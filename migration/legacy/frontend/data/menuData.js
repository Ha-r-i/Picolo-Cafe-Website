// Menu data structure for Piccolo Cafe
// Update this file with items from https://piccolo.menuqrate.com/

export const specialMenus = [
  // Add your special menus from the website here
  // Format:
  // {
  //   id: 'special1',
  //   name: 'Menu Name',
  //   description: 'Description of the special menu',
  //   price: '₹XXX',
  //   image: '/images/special-menus/menu-name.jpg',
  //   badge: 'Popular' // Optional: 'Popular', 'Weekend Only', 'Family Favorite', etc.
  // }
];

export const menuItems = {
  // Hot Beverages
  hotBeverages: [
    // Add items like:
    // { id: 1, name: 'Item Name', description: 'Description', price: '₹XXX', image: '/images/hot-beverages/item-name.jpg' }
  ],

  // Cold Beverages
  coldBeverages: [
    // Add items here
  ],

  // Breakfast
  breakfast: [
    // Add breakfast items here
  ],

  // Starters/Appetizers
  starters: [
    // Add starter items here
  ],

  // Main Course
  mainCourse: [
    // Add main course items here
  ],

  // Pasta & Pizza
  pastaPizza: [
    // Add pasta and pizza items here
  ],

  // Desserts
  desserts: [
    // Add dessert items here
  ],

  // Snacks
  snacks: [
    // Add snack items here
  ],
};

// Helper function to flatten all menu items
export const getAllMenuItems = () => {
  return Object.values(menuItems).flat();
};

