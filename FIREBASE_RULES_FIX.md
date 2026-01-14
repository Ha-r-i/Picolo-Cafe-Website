# Firebase Rules Fix Guide

## 🔴 Current Issues

1. **Firestore Permissions Error**: "Missing or insufficient permissions" for `categories` collection
2. **Storage CORS Error**: Image uploads failing due to storage permissions

## ✅ Solutions

### Step 1: Update Firestore Security Rules

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `piccolo-cafe-b9b2a`
3. Go to **Firestore Database** > **Rules**
4. Replace the rules with:

```javascript
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Menu Items: Public read, authenticated write
    match /menuItems/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Categories: Public read, authenticated write
    match /categories/{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Reservations: Public create, authenticated read/update/delete
    match /reservations/{document=**} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
    
    // Fallback: Allow authenticated users for other collections
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

5. Click **"Publish"**

### Step 2: Update Firebase Storage Rules

1. In Firebase Console, go to **Storage** > **Rules**
2. Replace the rules with:

```javascript
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    // Menu items folder: Public read, authenticated write
    match /menu-items/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Allow other paths for authenticated users
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

3. Click **"Publish"**

### Step 3: Verify Authentication

Make sure you are **logged in** as an admin user:
- Check if you see your email in the admin panel
- If not logged in, go to `/admin/login` and sign in

### Step 4: Test

1. Refresh your browser
2. Try adding a menu item again
3. If image upload still fails, you can:
   - Save the item without image (the form will ask you)
   - Add the image URL manually later by editing the item

## 🔍 Troubleshooting

### Still Getting Permission Errors?

1. **Check Authentication**:
   - Make sure you're logged in
   - Check browser console for auth errors
   - Try logging out and back in

2. **Check Rules Deployment**:
   - Rules may take a few seconds to deploy
   - Wait 30 seconds after publishing and refresh

3. **Check User Permissions**:
   - Go to Firebase Console > Authentication > Users
   - Verify your user exists and is active

### Image Upload Still Failing?

The code now handles this gracefully:
- If image upload fails, you'll be asked if you want to continue without the image
- You can save the menu item and add the image later
- Or manually add the image URL in the Firebase Console

### Categories Not Showing?

- The system uses fallback categories if Firebase fails
- Categories will appear in the dropdown even if Firebase has permission issues
- Once you fix the rules, categories will sync from Firebase

## 📝 Notes

- **Security**: These rules allow authenticated users to write. For production, consider restricting to specific admin emails
- **Storage**: Image uploads require authentication. Make sure you're logged in before uploading
- **Fallback**: The app will work with fallback categories even if Firebase has issues
