# Supabase Setup Guide

## Step 1: Create Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" → "Sign up"
3. Sign up with GitHub, Google, or email
4. Verify your email

## Step 2: Create a New Project

1. Click "New Project"
2. Fill in:
   - **Name**: `Piccolo Cafe` (or any name)
   - **Database Password**: Create a strong password (save it!)
   - **Region**: Choose closest to you
   - **Pricing Plan**: Free tier
3. Click "Create new project"
4. Wait 2-3 minutes for setup

## Step 3: Get Your API Keys

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon public** key (under "Project API keys")

## Step 4: Set Up Database Tables

1. Go to **SQL Editor** in Supabase dashboard
2. Click "New query"
3. Copy and paste the contents of `supabase/schema.sql`
4. Click "Run" (or press Ctrl+Enter)
5. You should see "Success. No rows returned"

## Step 5: Set Up Authentication

1. Go to **Authentication** → **Providers**
2. Enable **Email** provider
3. (Optional) Disable "Confirm email" for easier testing
4. Click "Save"

## Step 6: Create Admin User

1. Go to **Authentication** → **Users**
2. Click "Add user" → "Create new user"
3. Enter:
   - **Email**: your admin email
   - **Password**: create a strong password
4. Click "Create user"
5. **Save these credentials!**

## Step 7: Add Environment Variables

Add to your `.env` file:

```env
# Supabase Configuration
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key-here

# Cloudinary (already configured)
REACT_APP_CLOUDINARY_CLOWD_NAME=dfwukvykh
REACT_APP_CLOUDINARY_UPLOAD_PRESET=Piccolo_Cafe
```

## Step 8: Restart Your Server

```bash
# Stop server (Ctrl+C)
npm start
```

## Step 9: Test

1. Go to `/admin/login`
2. Login with your admin credentials
3. Try adding a menu item
4. Check Supabase dashboard → Table Editor → menu_items

## Migration Checklist

- [ ] Supabase project created
- [ ] Database tables created (ran schema.sql)
- [ ] Admin user created
- [ ] Environment variables added to .env
- [ ] Server restarted
- [ ] Can login to admin panel
- [ ] Can add menu items
- [ ] Can view reservations

## Troubleshooting

### "Missing Supabase environment variables"
- Check `.env` file exists in project root
- Verify variable names start with `REACT_APP_`
- Restart server after adding variables

### "Invalid API key"
- Check you copied the **anon public** key (not the service_role key)
- Verify the URL is correct

### "Table doesn't exist"
- Make sure you ran the `schema.sql` file
- Check Table Editor to see if tables exist

### "Authentication failed"
- Check email/password is correct
- Verify Email provider is enabled
- Check if email confirmation is required

## Next Steps

After setup:
1. Update `src/App.js` to use `AuthContextSupabase` instead of `AuthContext`
2. Update components to use Supabase services
3. Remove Firebase dependencies (optional)

---

**Need help?** Check Supabase docs: https://supabase.com/docs
