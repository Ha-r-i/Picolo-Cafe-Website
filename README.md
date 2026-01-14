# Piccolo Cafe Website

A modern, responsive website for Piccolo Cafe in Indore, built with React.

## Features

- ✨ Beautiful, modern UI design
- 📱 Fully responsive for all devices (mobile, tablet, desktop)
- 🍽️ Interactive menu with category filtering
- 📅 Table booking/reservation system with date and time selection
- 🧭 Smooth navigation with React Router
- 🎨 Consistent color scheme and styling

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Project Structure

```
src/
  ├── components/
  │   ├── Navbar.js          # Navigation bar component
  │   ├── Navbar.css
  │   ├── Home.js            # Home/Landing page
  │   ├── Home.css
  │   ├── Menu.js            # Menu page with filtering
  │   ├── Menu.css
  │   ├── Booking.js         # Reservation/Booking page
  │   └── Booking.css
  ├── App.js                 # Main app component with routing
  ├── App.css
  ├── index.js               # Entry point
  └── index.css              # Global styles
```

## Adding Your Images

To add your cafe images:

1. Create an `images` folder in the `src` or `public` directory
2. Add your images there
3. Update the image paths in the components:
   - `Home.js` - Replace the image placeholder in the about section
   - `Home.css` - Update the hero background if needed

Example:
```jsx
// In Home.js
<img src="/images/cafe-interior.jpg" alt="Piccolo Cafe Interior" />
```

## Deployment

### Option 1: Deploy to Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Build the project:
```bash
npm run build
```

3. Deploy:
```bash
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

### Option 2: Deploy to Netlify

1. Install Netlify CLI:
```bash
npm i -g netlify-cli
```

2. Build the project:
```bash
npm run build
```

3. Deploy:
```bash
netlify deploy --prod --dir=build
```

### Option 3: Deploy to GitHub Pages

1. Install gh-pages:
```bash
npm install --save-dev gh-pages
```

2. Add to `package.json`:
```json
"homepage": "https://yourusername.github.io/piccolo-cafe-website",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d build"
}
```

3. Deploy:
```bash
npm run deploy
```

## Customization

### Colors

The main color scheme is defined in the CSS files:
- Primary: `#8B4513` (Brown)
- Secondary: `#d4a574` (Light Brown/Tan)

You can update these colors throughout the CSS files to match your brand.

### Menu Items

Edit the `menuItems` object in `src/components/Menu.js` to update menu items.

### Booking System

The booking form currently logs to console. To make it functional:
1. Set up a backend API
2. Update the `handleSubmit` function in `src/components/Booking.js`
3. Add API endpoint calls

## Technologies Used

- React 18.2.0
- React Router DOM 6.20.0
- CSS3 (Responsive Design)
- Google Fonts (Poppins)

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## License

This project is created for Piccolo Cafe, Indore.

---

Made with ❤️ for Piccolo Cafe

