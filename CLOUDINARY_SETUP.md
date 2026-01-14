# Cloudinary Setup Guide

Cloudinary is a cloud-based image and video management service with a generous **free tier**:
- ✅ **25GB storage** (vs Firebase's 5GB free)
- ✅ **25GB bandwidth/month** (vs Firebase's 1GB/day)
- ✅ **No credit card required**
- ✅ **Automatic image optimization**
- ✅ **CDN delivery** (fast loading worldwide)

## Step 1: Create Cloudinary Account

1. Go to [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Sign up with your email (no credit card required)
3. Verify your email address

## Step 2: Get Your Credentials

1. After logging in, you'll see your **Dashboard**
2. Copy your **Cloud Name** (shown at the top of the dashboard)
3. Go to **Settings** → **Upload** tab
4. Scroll down to **Upload presets**
5. Click **"Add upload preset"** or use the default one
6. Configure the preset:
   - **Preset name**: `menu-items` (or any name you prefer)
   - **Signing mode**: **Unsigned** (for client-side uploads)
   - **Folder**: `menu-items` (optional, for organization)
   - **Upload manipulation**: Enable **Auto format** and **Auto quality**
   - Click **"Save"**
7. Copy the **Preset name** you created

## Step 3: Add Environment Variables

1. Create a `.env` file in your project root (if it doesn't exist)
2. Add these variables:

```env
REACT_APP_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
REACT_APP_CLOUDINARY_UPLOAD_PRESET=your_preset_name_here
```

**Example:**
```env
REACT_APP_CLOUDINARY_CLOUD_NAME=dxample123
REACT_APP_CLOUDINARY_UPLOAD_PRESET=menu-items
```

## Step 4: Restart Your Development Server

After adding the `.env` file:

```bash
# Stop your current server (Ctrl+C)
# Then restart:
npm start
```

## Step 5: Test Image Upload

1. Go to your admin panel
2. Try adding a menu item with an image
3. The image should upload to Cloudinary instead of Firebase Storage

## Benefits of Cloudinary

### vs Firebase Storage:
- ✅ **5x more free storage** (25GB vs 5GB)
- ✅ **Better bandwidth limits** (25GB/month vs 1GB/day)
- ✅ **Automatic image optimization** (smaller file sizes)
- ✅ **CDN delivery** (faster loading)
- ✅ **No CORS issues**
- ✅ **Image transformations** (resize, crop, etc. on the fly)

### Image Optimization:
Cloudinary automatically:
- Converts images to WebP format (smaller file sizes)
- Optimizes quality based on device
- Delivers via CDN (fast worldwide)
- Generates responsive images

## Troubleshooting

### "Cloudinary is not configured" Error
- Make sure `.env` file exists in project root
- Check variable names start with `REACT_APP_`
- Restart your development server after adding `.env`

### Upload Fails
- Check your internet connection
- Verify Cloud Name and Upload Preset are correct
- Make sure upload preset is set to **"Unsigned"**
- Check Cloudinary dashboard for any errors

### Images Not Showing
- Check browser console for errors
- Verify the URL returned from Cloudinary
- Make sure image URLs start with `https://res.cloudinary.com/`

## Security Note

⚠️ **Important**: The upload preset should be set to **"Unsigned"** for client-side uploads. This means anyone with your preset name can upload images. For production:

1. Consider using **Signed uploads** with a backend API
2. Or restrict uploads by file type/size in Cloudinary settings
3. Set up rate limiting in Cloudinary dashboard

## Free Tier Limits

- **Storage**: 25GB
- **Bandwidth**: 25GB/month
- **Transformations**: 25,000/month
- **Uploads**: Unlimited

For most small to medium cafes, this is more than enough!

## Need More?

If you exceed the free tier:
- **Plus Plan**: $89/month - 100GB storage, 100GB bandwidth
- Or consider other alternatives like ImgBB, Imgur API, or AWS S3

---

**That's it!** Your images will now upload to Cloudinary instead of Firebase Storage, giving you more free space and better performance.
