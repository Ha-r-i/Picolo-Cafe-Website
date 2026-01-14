# Firebase to Supabase Migration Checklist

## ✅ Completed

- [x] Installed Supabase client (`@supabase/supabase-js`)
- [x] Created Supabase config (`src/supabase/config.js`)
- [x] Created menu service (`src/supabase/menuService.js`)
- [x] Created reservation service (`src/supabase/reservationService.js`)
- [x] Created Supabase auth context (`src/contexts/AuthContextSupabase.js`)
- [x] Created database schema (`supabase/schema.sql`)
- [x] Created setup guide (`SUPABASE_SETUP.md`)

## 🔄 Files to Update

### 1. Update App.js
**File**: `src/App.js`
**Change**: Replace `AuthContext` import with `AuthContextSupabase`

```javascript
// OLD:
import { AuthProvider } from './contexts/AuthContext';

// NEW:
import { AuthProvider } from './contexts/AuthContextSupabase';
```

### 2. Update Menu.js
**File**: `src/components/Menu.js`
**Change**: Replace Firebase imports with Supabase

```javascript
// OLD:
import { fetchMenuItems, fetchBestSellers, fetchCategories } from '../firebase/menuService';

// NEW:
import { fetchMenuItems, fetchBestSellers, fetchCategories } from '../supabase/menuService';
```

### 3. Update MenuManagement.js
**File**: `src/components/admin/MenuManagement.js`
**Changes**:
- Replace Firebase imports with Supabase
- Update database operations to use Supabase

```javascript
// OLD:
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { fetchCategories, addCategory, updateCategory, deleteCategory, initializeDefaultCategories } from '../../firebase/menuService';

// NEW:
import { fetchCategories, addCategory, updateCategory, deleteCategory, initializeDefaultCategories } from '../../supabase/menuService';
import { supabase } from '../../supabase/config';
```

Then update CRUD operations:
- `addDoc(collection(db, 'menuItems'), data)` → `supabase.from('menu_items').insert(data)`
- `updateDoc(doc(db, 'menuItems', id), data)` → `supabase.from('menu_items').update(data).eq('id', id)`
- `deleteDoc(doc(db, 'menuItems', id))` → `supabase.from('menu_items').delete().eq('id', id)`

### 4. Update Booking.js
**File**: `src/components/Booking.js`
**Change**: Replace Firebase with Supabase reservation service

```javascript
// OLD:
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

// NEW:
import { createReservation } from "../supabase/reservationService";
```

Update the submit handler:
```javascript
// OLD:
await addDoc(collection(db, "reservations"), {
  ...
  createdAt: serverTimestamp()
});

// NEW:
await createReservation({
  name: formData.name,
  email: formData.email,
  phone: formData.phone,
  date: formData.date,
  time: formData.time,
  guests: formData.guests,
  specialRequests: formData.specialRequests,
});
```

### 5. Update ReservationManagement.js
**File**: `src/components/admin/ReservationManagement.js`
**Change**: Replace Firebase with Supabase

```javascript
// OLD:
import { collection, getDocs, updateDoc, doc, query, orderBy, where } from 'firebase/firestore';
import { db } from '../../firebase/config';

// NEW:
import { fetchReservations, updateReservationStatus } from '../../supabase/reservationService';
```

### 6. Update DashboardStats.js (if exists)
**File**: `src/components/admin/DashboardStats.js`
**Change**: Replace Firebase queries with Supabase

### 7. Update AdminLogin.js
**File**: `src/components/admin/AdminLogin.js`
**Change**: Already uses `useAuth()` hook, should work with new AuthContext

## 🗑️ Files to Remove (Optional)

After migration is complete and tested:

- `src/firebase/config.js` (replaced by `src/supabase/config.js`)
- `src/firebase/menuService.js` (replaced by `src/supabase/menuService.js`)
- `src/contexts/AuthContext.js` (replaced by `src/contexts/AuthContextSupabase.js`)
- `firestore.rules` (no longer needed)
- `storage.rules` (no longer needed)
- `firebase.json` (no longer needed)

## 📦 Remove Firebase Dependencies (Optional)

After migration:

```bash
npm uninstall firebase
```

## 🧪 Testing Checklist

After migration:

- [ ] Can login to admin panel
- [ ] Can view menu items
- [ ] Can add menu item
- [ ] Can edit menu item
- [ ] Can delete menu item
- [ ] Can upload images (Cloudinary)
- [ ] Can view categories
- [ ] Can add category
- [ ] Can edit category
- [ ] Can delete category
- [ ] Can create reservation (public)
- [ ] Can view reservations (admin)
- [ ] Can update reservation status
- [ ] Menu page displays items correctly
- [ ] Categories filter works

## 🚀 Quick Start

1. **Set up Supabase** (follow `SUPABASE_SETUP.md`)
2. **Update App.js** (change AuthProvider import)
3. **Update components** (change imports)
4. **Test everything**
5. **Remove Firebase** (optional)

---

**Note**: Keep Firebase code until Supabase migration is fully tested!
