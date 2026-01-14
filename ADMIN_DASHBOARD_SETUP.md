# Admin Dashboard Setup Guide

Complete guide for setting up and using the Piccolo Cafe Admin Dashboard.

## 📁 Folder Structure

```
src/
├── contexts/
│   └── AuthContext.js          # Firebase Auth context provider
├── components/
│   ├── admin/
│   │   ├── AdminLogin.js        # Admin login page
│   │   ├── AdminLogin.css
│   │   ├── AdminLayout.js       # Dashboard layout with sidebar
│   │   ├── AdminLayout.css
│   │   ├── AdminDashboard.js    # Main dashboard page
│   │   ├── AdminDashboard.css
│   │   ├── DashboardStats.js    # Statistics component
│   │   ├── DashboardStats.css
│   │   ├── MenuManagement.js    # Menu CRUD operations
│   │   ├── MenuManagement.css
│   │   ├── ReservationManagement.js  # Reservation management
│   │   ├── ReservationManagement.css
│   │   └── ProtectedRoute.js    # Route protection
│   └── ... (existing components)
├── firebase/
│   ├── config.js                # Firebase configuration
│   ├── menuService.js           # Menu service functions
│   └── storageService.js        # Image upload service
└── App.js                       # Updated with admin routes
```

## 🔐 Step 1: Enable Firebase Authentication

1. **Go to Firebase Console**
   - Visit [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `piccolo-cafe-b9b2a`

2. **Enable Email/Password Authentication**
   - Click "Authentication" in the left sidebar
   - Click "Get started" (if not already enabled)
   - Go to "Sign-in method" tab
   - Click on "Email/Password"
   - Enable "Email/Password" provider
   - Click "Save"

3. **Create Admin User**
   - Go to "Users" tab in Authentication
   - Click "Add user"
   - Enter admin email and password
   - Click "Add user"
   - **Save these credentials securely!**

## 🗄️ Step 2: Configure Firestore Security Rules

Update your Firestore security rules to allow admin access:

1. **Go to Firestore Database > Rules**
2. **Update rules**:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public read access for menu items
    match /menuItems/{document=**} {
      allow read: if true;
      allow write: if request.auth != null; // Only authenticated users can write
    }
    
    // Reservations: public write, authenticated read
    match /reservations/{document=**} {
      allow create: if true; // Anyone can create reservations
      allow read, update, delete: if request.auth != null; // Only authenticated users
    }
  }
}
```

3. **Click "Publish"**

## 📦 Step 3: Configure Firebase Storage

1. **Enable Storage** (if not already enabled)
   - Go to Firebase Console > Storage
   - Click "Get started"
   - Choose "Start in test mode"
   - Select location
   - Click "Done"

2. **Update Storage Rules**
   - Go to Storage > Rules
   - Update rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /menu-items/{allPaths=**} {
      allow read: if true; // Public read
      allow write: if request.auth != null; // Authenticated write
    }
  }
}
```

3. **Click "Publish"**

## 🚀 Step 4: Access Admin Dashboard

1. **Start your development server**:
   ```bash
   npm start
   ```

2. **Navigate to Admin Login**:
   - Go to: `http://localhost:3000/admin/login`
   - Or add a link in your website navigation

3. **Login**:
   - Use the admin email and password you created
   - You'll be redirected to `/admin/dashboard`

## 📋 Features Overview

### 1. Dashboard (`/admin/dashboard`)
- **Statistics Cards**:
  - Total Bookings
  - Pending Bookings
  - Total Menu Items
- Real-time data from Firestore

### 2. Menu Management (`/admin/menu`)
- **View all menu items** in card grid layout
- **Add new items**:
  - Name, description, price
  - Category selection
  - Image upload (Firebase Storage)
  - Best seller toggle
- **Edit items**: Click "Edit" on any item
- **Delete items**: Click "Delete" (with confirmation)
- **Image preview** before upload

### 3. Reservation Management (`/admin/reservations`)
- **View all reservations** in table format
- **Search**: By name, phone, or email
- **Filter**: By status (pending, confirmed, completed, cancelled)
- **Sort**: By date (newest first)
- **Update status**: Dropdown to change reservation status
- **View details**: Name, contact, date, time, guests, special requests

## 🔧 Usage Instructions

### Adding Menu Items

1. Go to **Menu Management** (`/admin/menu`)
2. Click **"+ Add New Item"**
3. Fill in the form:
   - **Name**: Item name (e.g., "Cappuccino")
   - **Description**: Item description
   - **Price**: Price without ₹ symbol (e.g., "120")
   - **Category**: Select from dropdown
   - **Best Seller**: Check if it's a best seller
   - **Image**: Upload image file
4. Click **"Add Item"**
5. Image will be uploaded to Firebase Storage automatically

### Editing Menu Items

1. Find the item in the grid
2. Click **"✏️ Edit"**
3. Modify fields as needed
4. Upload new image if needed (or keep existing)
5. Click **"Update"**

### Managing Reservations

1. Go to **Reservations** (`/admin/reservations`)
2. **Search**: Type in search box to filter by name/phone/email
3. **Filter by status**: Use dropdown to show specific statuses
4. **Change status**: Use the status dropdown in the Actions column
5. Status options:
   - **Pending**: New bookings (default)
   - **Confirmed**: Bookings confirmed by admin
   - **Completed**: Completed visits
   - **Cancelled**: Cancelled bookings

## 🎨 Customization

### Adding More Categories

Edit `MenuManagement.js`:

```javascript
const categories = [
  { value: 'signatureKaapi', label: 'Signature Kaapi' },
  { value: 'hotCoffee', label: 'Hot Coffee' },
  { value: 'coldCoffee', label: 'Cold Coffee' },
  { value: 'piccoKidsFavourites', label: 'Kids Favourites' },
  // Add more categories here
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
];
```

Don't forget to update `Menu.js` categories array as well!

### Changing Colors

All admin components use the same color scheme:
- Primary: `#8B4513` (Brown)
- Secondary: `#d4a574` (Light Brown)
- Background: `#f5f5f5` (Light Gray)

Update these in the CSS files to match your brand.

## 🔒 Security Best Practices

1. **Firebase Security Rules**: Always restrict write access to authenticated users
2. **Admin Email**: Use a strong, unique email for admin account
3. **Password**: Use a strong password (12+ characters, mixed case, numbers, symbols)
4. **HTTPS**: Always use HTTPS in production
5. **Environment Variables**: Consider moving Firebase config to environment variables

## 🐛 Troubleshooting

### "Missing or insufficient permissions"
- **Solution**: Update Firestore security rules (see Step 2)
- Make sure `request.auth != null` for write operations

### "Failed to upload image"
- **Solution**: Check Firebase Storage rules (see Step 3)
- Verify Storage is enabled in Firebase Console

### "User not authenticated"
- **Solution**: Make sure you're logged in
- Check browser console for auth errors
- Verify admin user exists in Firebase Authentication

### Images not displaying
- **Solution**: Check Firebase Storage rules allow public read
- Verify image URLs in Firestore documents
- Check browser console for CORS errors

### Can't access admin routes
- **Solution**: Make sure you're logged in
- Check `ProtectedRoute` component is working
- Verify routes in `App.js`

## 📱 Responsive Design

The admin dashboard is fully responsive:
- **Desktop**: Full sidebar and layout
- **Tablet**: Collapsible sidebar
- **Mobile**: Sidebar collapses to icon-only mode

## 🚀 Production Deployment

Before deploying to production:

1. **Update Security Rules**:
   - Restrict Firestore writes to admin only
   - Add email-based restrictions if needed

2. **Environment Variables**:
   - Move Firebase config to `.env` file
   - Never commit `.env` to version control

3. **HTTPS**: Ensure your hosting uses HTTPS

4. **Admin Access**: Limit admin account creation
   - Only create admin accounts manually
   - Don't allow public registration

## 📝 API Reference

### Auth Context

```javascript
import { useAuth } from '../contexts/AuthContext';

const { currentUser, login, logout, loading } = useAuth();
```

### Storage Service

```javascript
import { uploadImage, createImagePreview } from '../firebase/storageService';

// Upload image
const url = await uploadImage(file, 'menu-items');

// Create preview
const preview = await createImagePreview(file);
```

## 🎯 Next Steps

1. **Add More Analytics**: 
   - Revenue tracking
   - Popular items
   - Peak hours

2. **Email Notifications**:
   - Send confirmation emails
   - Booking reminders

3. **Export Features**:
   - Export reservations to CSV
   - Print reports

4. **Advanced Filtering**:
   - Date range filters
   - Guest count filters

5. **Bulk Operations**:
   - Bulk status updates
   - Bulk menu item operations

---

**Need Help?** Check Firebase Console logs and browser console for detailed error messages.

**Happy Admin-ing! 🎉**
