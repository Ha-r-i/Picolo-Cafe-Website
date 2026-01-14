# Firebase Setup Guide for Piccolo Cafe Website

This guide will help you set up Firebase for your menu management system.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Creating a Firebase Project](#creating-a-firebase-project)
3. [Setting up Firestore Database](#setting-up-firestore-database)
4. [Configuring Firebase in Your Project](#configuring-firebase-in-your-project)
5. [Adding Menu Data to Firestore](#adding-menu-data-to-firestore)
6. [Firebase Data Structure](#firebase-data-structure)
7. [Testing the Integration](#testing-the-integration)
8. [Security Rules](#security-rules)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- A Google account
- Node.js installed (v14 or higher)
- Firebase CLI installed (optional, for advanced usage)

---

## Step 1: Creating a Firebase Project

1. **Go to Firebase Console**
   - Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Sign in with your Google account

2. **Create a New Project**
   - Click "Add project" or "Create a project"
   - Enter project name: `Piccolo Cafe` (or any name you prefer)
   - Click "Continue"

3. **Configure Google Analytics (Optional)**
   - You can enable or disable Google Analytics
   - Click "Continue"

4. **Accept Terms and Create Project**
   - Review the terms and click "Create project"
   - Wait for the project to be created (takes a few seconds)
   - Click "Continue"

---

## Step 2: Setting up Firestore Database

1. **Navigate to Firestore Database**
   - In your Firebase project dashboard, click on "Firestore Database" in the left sidebar
   - If you don't see it, click "Build" > "Firestore Database"

2. **Create Database**
   - Click "Create database"
   - Choose "Start in test mode" (we'll set up security rules later)
   - Click "Next"

3. **Select Location**
   - Choose a location closest to your users (e.g., `us-central` or `asia-south1` for India)
   - Click "Enable"
   - Wait for the database to be initialized

---

## Step 3: Configuring Firebase in Your Project

1. **Get Your Firebase Configuration**
   - In Firebase Console, click the gear icon (⚙️) next to "Project Overview"
   - Select "Project settings"
   - Scroll down to "Your apps" section
   - Click the `</>` (web) icon to add a web app
   - Register your app with a nickname (e.g., "Piccolo Cafe Website")
   - **Don't check "Also set up Firebase Hosting"** (unless you want to use it)
   - Click "Register app"

2. **Copy Your Config**
   - You'll see your Firebase configuration object:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```

3. **Update Your Config File**
   - Open `src/firebase/config.js` in your project
   - Replace the placeholder values with your actual Firebase config:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_ACTUAL_API_KEY",
     authDomain: "YOUR_ACTUAL_AUTH_DOMAIN",
     projectId: "YOUR_ACTUAL_PROJECT_ID",
     storageBucket: "YOUR_ACTUAL_STORAGE_BUCKET",
     messagingSenderId: "YOUR_ACTUAL_MESSAGING_SENDER_ID",
     appId: "YOUR_ACTUAL_APP_ID"
   };
   ```

---

## Step 4: Adding Menu Data to Firestore

### Option A: Using Firebase Console (Manual Entry)

1. **Create Collection**
   - In Firestore Database, click "Start collection"
   - Collection ID: `menuItems`
   - Click "Next"

2. **Add First Document**
   - Document ID: Leave empty (auto-generated) or use a custom ID like `item-1`
   - Add fields:
   
   | Field | Type | Value |
   |-------|------|-------|
   | `name` | string | "South Indian Filter Kaapi" |
   | `description` | string | "Bass Naam Hi Kaapi Hai" |
   | `price` | string | "₹120" |
   | `category` | string | "signatureKaapi" |
   | `image` | string | "https://firebasestorage.googleapis.com/..." |
   | `isBestSeller` | boolean | true (or false) |
   | `badge` | string | "Best Seller" (optional) |

   - Click "Save"

3. **Add More Documents**
   - Click "Add document" to add more menu items
   - Repeat the process for all menu items

### Option B: Using Firebase CLI (Bulk Import)

1. **Install Firebase CLI** (if not installed)
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**
   ```bash
   firebase login
   ```

3. **Initialize Firebase in Your Project**
   ```bash
   firebase init firestore
   ```

4. **Create JSON File**
   - Create a file `menu-data.json`:
   ```json
   {
     "menuItems": {
       "item-1": {
         "name": "South Indian Filter Kaapi",
         "description": "Bass Naam Hi Kaapi Hai",
         "price": "₹120",
         "category": "signatureKaapi",
         "image": "https://firebasestorage.googleapis.com/...",
         "isBestSeller": true
       },
       "item-2": {
         "name": "Espresso",
         "description": "The 30ml 'Wake Me Up' Coffee Shot",
         "price": "₹150",
         "category": "hotCoffee",
         "image": "https://firebasestorage.googleapis.com/...",
         "isBestSeller": false
       }
     }
   }
   ```

5. **Import Data** (using a script or Firebase Admin SDK)

---

## Step 5: Firebase Data Structure

### Collection: `menuItems`

Each document should have the following structure:

```javascript
{
  name: string,              // Menu item name
  description: string,       // Item description
  price: string,            // Price (e.g., "₹120")
  category: string,         // Category ID (e.g., "signatureKaapi", "hotCoffee", "coldCoffee", "piccoKidsFavourites")
  image: string,            // Image URL (Firebase Storage URL or external URL)
  isBestSeller: boolean,    // true if best seller, false otherwise
  badge: string (optional)  // Badge text (e.g., "Best Seller", "Popular")
}
```

### Category Values

Use these exact category IDs:
- `signatureKaapi` - For Signature Kaapi items
- `hotCoffee` - For Hot Coffee items
- `coldCoffee` - For Cold Coffee items
- `piccoKidsFavourites` - For Kids Favourites items
- Add more as needed (e.g., `breakfast`, `lunch`, `snacks`, `desserts`)

### Example Documents

**Best Seller Item:**
```javascript
{
  name: "South Indian Filter Kaapi",
  description: "Bass Naam Hi Kaapi Hai",
  price: "₹120",
  category: "signatureKaapi",
  image: "https://firebasestorage.googleapis.com/v0/b/piccolo-cafe.appspot.com/o/filterkaapi%20Large.jpeg?alt=media&token=...",
  isBestSeller: true,
  badge: "Best Seller"
}
```

**Regular Item:**
```javascript
{
  name: "Espresso",
  description: "The 30ml 'Wake Me Up' Coffee Shot",
  price: "₹150",
  category: "hotCoffee",
  image: "https://firebasestorage.googleapis.com/v0/b/piccolo-cafe.appspot.com/o/espresso%20Large.jpeg?alt=media&token=...",
  isBestSeller: false
}
```

---

## Step 6: Setting Up Indexes

Firestore requires indexes for certain queries. If you get an error about missing indexes:

1. Click the error link in the browser console (it will take you to Firebase Console)
2. Click "Create Index"
3. Wait for the index to be created (takes a few minutes)

Alternatively, you can create indexes manually:

1. Go to Firestore Database > Indexes
2. Click "Create Index"
3. Collection: `menuItems`
4. Fields:
   - `category` (Ascending)
   - `name` (Ascending)
5. Query scope: Collection
6. Click "Create"

---

## Step 7: Security Rules

Update your Firestore security rules to allow read access:

1. Go to Firestore Database > Rules
2. Update the rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read access to menuItems for everyone
    match /menuItems/{document=**} {
      allow read: if true;
      allow write: if false; // Only allow writes from admin (you can change this later)
    }
  }
}
```

3. Click "Publish"

**Important:** For production, you should restrict write access and use Firebase Admin SDK or Cloud Functions for updates.

---

## Step 8: Testing the Integration

1. **Start Your Development Server**
   ```bash
   npm start
   ```

2. **Check Browser Console**
   - Open browser DevTools (F12)
   - Check for any Firebase errors
   - You should see menu items loading

3. **Verify Data**
   - Navigate to the Menu page
   - Check if menu items appear
   - Test category filtering
   - Test quantity selector
   - Test cart functionality

---

## Step 9: Using Firebase Storage for Images

If you want to store images in Firebase Storage:

1. **Enable Storage**
   - Go to Firebase Console > Storage
   - Click "Get started"
   - Choose "Start in test mode"
   - Select location
   - Click "Done"

2. **Upload Images**
   - Click "Upload file"
   - Select your images
   - Create folders: `menu-items/`, `best-sellers/`, etc.

3. **Get Image URLs**
   - Click on an uploaded image
   - Copy the URL from the "File location" section
   - Use this URL in your Firestore documents

4. **Update Security Rules** (Storage)
   - Go to Storage > Rules
   - Update rules:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read: if true;
         allow write: if false; // Change this for admin access
       }
     }
   }
   ```

---

## Troubleshooting

### Error: "Missing or insufficient permissions"

**Solution:** Update your Firestore security rules to allow read access (see Step 7).

### Error: "The query requires an index"

**Solution:** Click the error link in the console to create the index, or create it manually in Firestore > Indexes.

### Menu items not loading

**Checklist:**
1. ✅ Firebase config is correct in `src/firebase/config.js`
2. ✅ Firestore collection is named `menuItems`
3. ✅ Documents have required fields (`name`, `description`, `price`, `category`)
4. ✅ Security rules allow read access
5. ✅ Check browser console for errors

### Images not displaying

**Solutions:**
- Verify image URLs are correct
- Check if images are accessible (CORS issues)
- Use Firebase Storage URLs for better reliability

### Cart not working

**Solutions:**
- Cart is stored in browser state (localStorage can be added for persistence)
- Check browser console for JavaScript errors
- Ensure all required fields are present

---

## Next Steps

1. **Add More Categories** - Update `categories` array in `Menu.js`
2. **Implement Checkout** - Connect cart to payment/order system
3. **Add User Authentication** - Enable user accounts for saved orders
4. **Add Admin Panel** - Create an interface to manage menu items
5. **Analytics** - Track popular items and user behavior
6. **Offline Support** - Enable offline reading with Firestore cache

---

## Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Documentation](https://firebase.google.com/docs/firestore)
- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Storage Documentation](https://firebase.google.com/docs/storage)

---

## Support

If you encounter issues:
1. Check the Firebase Console for errors
2. Review browser console logs
3. Verify your Firebase configuration
4. Ensure Firestore indexes are created
5. Check security rules

---

**Happy coding! 🚀☕**
