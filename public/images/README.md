# Images Directory

This directory contains all images for the Piccolo Cafe website.

## Folder Structure

- `special-menus/` - Images for special menu items
- `beverages/hot/` - Hot beverage images
- `beverages/cold/` - Cold beverage images
- `breakfast/` - Breakfast item images
- `starters/` - Starter/appetizer images
- `main-course/` - Main course images
- `pasta-pizza/` - Pasta and pizza images
- `desserts/` - Dessert images
- `snacks/` - Snack images

## Adding Images

1. Download images from https://piccolo.menuqrate.com/
2. Optimize images (recommend using TinyPNG or similar tools)
3. Save with descriptive filenames (lowercase with hyphens)
4. Place in the appropriate category folder
5. Update menu items in `src/components/Menu.js` with the correct image path

## Image Guidelines

- **Format**: JPG for photos, PNG for graphics
- **Size**: Recommended 800x600px minimum
- **File Size**: Keep under 500KB per image when possible
- **Naming**: Use lowercase with hyphens (e.g., `chicken-biryani.jpg`)

## Example

If you have an image called `cappuccino.jpg` in `beverages/hot/`, the image path in the code should be:
```javascript
image: '/images/beverages/hot/cappuccino.jpg'
```

