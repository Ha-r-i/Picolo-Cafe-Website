# Troubleshooting: Environment Variables Not Loading

## 🔍 Quick Diagnosis

The error "Cloudinary is not configured" means your `.env` file isn't being read. Follow these steps:

## ✅ Step-by-Step Fix

### 1. Verify .env File Location

The `.env` file **MUST** be in the **project root** (same folder as `package.json`):

```
Picolo Cafe Websitr/
├── package.json          ← Same folder
├── .env                  ← Must be here!
├── src/
├── public/
└── ...
```

**Check:**
- Open your project folder
- Look for `.env` file in the root (where `package.json` is)
- If it's not there, create it

### 2. Check .env File Format

Your `.env` file should look **exactly** like this (no quotes, no spaces):

```env
REACT_APP_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
REACT_APP_CLOUDINARY_UPLOAD_PRESET=Piccolo_Cafe
```

**Common Mistakes:**
- ❌ `REACT_APP_CLOUDINARY_CLOUD_NAME = value` (spaces around =)
- ❌ `REACT_APP_CLOUDINARY_CLOUD_NAME="value"` (quotes)
- ❌ `CLOUDINARY_CLOUD_NAME=value` (missing REACT_APP_ prefix)
- ✅ `REACT_APP_CLOUDINARY_CLOUD_NAME=value` (correct)

### 3. Get Your Cloudinary Values

1. **Cloud Name:**
   - Go to Cloudinary Dashboard
   - Look at the top of the page
   - Copy the cloud name (e.g., `dfwukvykh`)

2. **Upload Preset:**
   - Go to Settings → Upload → Upload Presets
   - Find "Piccolo_Cafe" preset
   - Copy the exact name (case-sensitive!)

### 4. Create/Update .env File

Create a file named `.env` (with the dot at the start) in your project root:

```env
REACT_APP_CLOUDINARY_CLOUD_NAME=dfwukvykh
REACT_APP_CLOUDINARY_UPLOAD_PRESET=Piccolo_Cafe
```

**Replace:**
- `dfwukvykh` with your actual cloud name
- `Piccolo_Cafe` with your actual preset name (if different)

### 5. Restart Your Server

**This is critical!** Environment variables are only loaded when the server starts.

1. **Stop your server:**
   - Press `Ctrl+C` in the terminal where `npm start` is running
   - Wait for it to fully stop

2. **Start it again:**
   ```bash
   npm start
   ```

3. **Wait for it to compile** (you'll see "Compiled successfully!")

### 6. Test Again

1. Go to `/admin/menu`
2. Try uploading an image
3. Check browser console (F12) - you should see:
   ```
   Cloudinary Config Check: { cloudName: '✓ Found', uploadPreset: '✓ Found', ... }
   ```

## 🔧 Still Not Working?

### Check 1: Verify File Name

Make sure the file is named `.env` (with the dot):
- ✅ `.env` (correct)
- ❌ `env` (wrong)
- ❌ `.env.txt` (wrong)
- ❌ `env.txt` (wrong)

### Check 2: File Encoding

Make sure the file is saved as plain text (UTF-8):
- Open in a text editor (VS Code, Notepad++)
- Don't use Word or rich text editors

### Check 3: Check Console Output

After restarting, open browser console (F12) and look for:
```
Cloudinary Config Check: { cloudName: '✗ Missing', uploadPreset: '✗ Missing', ... }
```

This will tell you which variable is missing.

### Check 4: Verify in Code

Temporarily add this to see what's being read:

1. Open `src/firebase/storageService.js`
2. Look at line 10-11
3. The console.log will show what's found

### Check 5: Windows-Specific Issues

If you're on Windows:
- Make sure file isn't hidden
- Try creating the file from command line:
  ```bash
  echo REACT_APP_CLOUDINARY_CLOUD_NAME=your_value > .env
  echo REACT_APP_CLOUDINARY_UPLOAD_PRESET=Piccolo_Cafe >> .env
  ```

## 📝 Example .env File

Here's a complete example (replace with your values):

```env
# Cloudinary Configuration
REACT_APP_CLOUDINARY_CLOUD_NAME=dfwukvykh
REACT_APP_CLOUDINARY_UPLOAD_PRESET=Piccolo_Cafe

# Firebase Configuration (if you have it)
REACT_APP_FIREBASE_API_KEY=your_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

## ✅ Success Checklist

- [ ] `.env` file exists in project root
- [ ] File is named exactly `.env` (with dot)
- [ ] Variables start with `REACT_APP_`
- [ ] No spaces around `=` sign
- [ ] No quotes around values
- [ ] Server was restarted after creating/editing `.env`
- [ ] Console shows "✓ Found" for both variables

## 🆘 Still Having Issues?

1. **Share your .env file format** (without actual values):
   ```
   REACT_APP_CLOUDINARY_CLOUD_NAME=xxx
   REACT_APP_CLOUDINARY_UPLOAD_PRESET=xxx
   ```

2. **Check console output** - what does the debug log show?

3. **Verify file location** - take a screenshot of your project folder showing where `.env` is

---

**Remember:** After ANY change to `.env`, you MUST restart your server!
