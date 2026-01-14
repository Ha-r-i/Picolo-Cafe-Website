# Migration from Firebase to Supabase

## Why Supabase?

✅ **PostgreSQL Database** - More powerful than Firestore  
✅ **Built-in Authentication** - Similar to Firebase Auth  
✅ **Real-time Subscriptions** - Live data updates  
✅ **Generous Free Tier** - 500MB database, 2GB bandwidth  
✅ **No Vendor Lock-in** - Open source, can self-host  
✅ **Better SQL Queries** - More flexible than Firestore  

## Migration Steps

### 1. Create Supabase Account
- Go to https://supabase.com
- Sign up (free)
- Create a new project

### 2. Set Up Database Tables
We'll create tables for:
- `menu_items` (replaces Firestore `menuItems`)
- `categories` (replaces Firestore `categories`)
- `reservations` (replaces Firestore `reservations`)

### 3. Set Up Authentication
- Configure email/password auth
- Create admin user

### 4. Update Code
- Replace Firebase imports with Supabase
- Update all database operations
- Update authentication

## Benefits

- ✅ No more permission errors
- ✅ Better query performance
- ✅ SQL queries (more flexible)
- ✅ Real-time updates
- ✅ Free tier is generous
