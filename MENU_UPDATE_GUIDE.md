# Menu Update Guide - Adding Items from Piccolo.menuqrate.com

This guide will help you add menu items and images from https://piccolo.menuqrate.com/ to your website.

## Step 1: Create Images Folder Structure

Create the following folder structure in your `public` directory:

```
public/
  └── images/
      ├── special-menus/
      ├── beverages/
      │   ├── hot/
      │   └── cold/
      ├── breakfast/
      ├── starters/
      ├── main-course/
      ├── pasta-pizza/
      ├── desserts/
      └── snacks/
```

## Step 2: Add Images

1. Visit https://piccolo.menuqrate.com/
2. Download images for each menu item
3. Save them in the appropriate folders above
4. Use descriptive filenames (e.g., `cappuccino.jpg`, `chicken-biryani.jpg`)

**Image Tips:**
- Use high-quality images (at least 800x600px)
- Optimize images for web (use tools like TinyPNG or ImageOptim)
- Use JPG format for photos, PNG for graphics
- Keep file names lowercase with hyphens (e.g., `chicken-biryani.jpg`)

## Step 3: Update Menu Items

Edit `src/components/Menu.js` and update the `menuItems` object with items from the Piccolo website.

### Example Format:

```javascript
const menuItems = {
  beverages: [
    {
      id: 1,
      name: 'Cappuccino',
      description: 'Rich espresso with steamed milk and foam',
      price: '₹120',
      image: '/images/beverages/hot/cappuccino.jpg'
    },
    // Add more items...
  ],
  // Add other categories...
};
```

### Special Menus Format:

```javascript
const specialMenus = [
  {
    id: 'special1',
    name: 'Chef\'s Special Combo',
    description: 'Signature dish of the day with soup and dessert',
    price: '₹450',
    image: '/images/special-menus/chef-special.jpg',
    badge: 'Popular' // Optional badge: 'Popular', 'Weekend Only', 'Family Favorite', etc.
  },
  // Add more special menus...
];
```

## Step 4: Update Categories (if needed)

If the Piccolo website has different categories, update the `categories` array:

```javascript
const categories = [
  { id: 'all', name: 'All Items' },
  { id: 'beverages', name: 'Beverages' },
  { id: 'breakfast', name: 'Breakfast' },
  { id: 'starters', name: 'Starters' },
  { id: 'mainCourse', name: 'Main Course' },
  { id: 'pastaPizza', name: 'Pasta & Pizza' },
  { id: 'desserts', name: 'Desserts' },
  { id: 'snacks', name: 'Snacks' },
];
```

## Step 5: Testing

1. Run `npm start` to test locally
2. Check that all images load correctly
3. Verify menu items display properly
4. Test category filtering
5. Check responsive design on mobile devices

## Quick Copy Template

For each menu item, copy this template:

```javascript
{
  id: UNIQUE_NUMBER,
  name: 'Item Name',
  description: 'Item description here',
  price: '₹XXX',
  image: '/images/category/subcategory/item-name.jpg'
}
```

## Notes

- If an image doesn't exist, the website will show a placeholder icon
- Images are lazy-loaded for better performance
- All images should be in the `public/images` folder (they will be served from the root `/images/`)
- Make sure image paths match the actual file names exactly

