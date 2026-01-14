/**
 * Upload image to Cloudinary (Free tier: 25GB storage, 25GB bandwidth/month)
 * @param {File} file - Image file to upload
 * @param {string} folder - Folder path in storage (e.g., 'menu-items')
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30000 = 30 seconds)
 * @returns {Promise<string>} Download URL of uploaded image
 */
export const uploadImage = async (file, folder = 'menu-items', timeoutMs = 30000) => {
  // Check if Cloudinary is configured
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

  // Debug logging (remove in production)
  console.log('Cloudinary Config Check:', {
    cloudName: cloudName ? '✓ Found' : '✗ Missing',
    uploadPreset: uploadPreset ? '✓ Found' : '✗ Missing',
    allEnvKeys: Object.keys(process.env).filter(key => key.includes('CLOUDINARY'))
  });

  if (!cloudName || !uploadPreset) {
    const errorMsg = `Cloudinary is not configured.\n\n` +
      `Found: cloudName=${cloudName ? 'YES' : 'NO'}, uploadPreset=${uploadPreset ? 'YES' : 'NO'}\n\n` +
      `Please check:\n` +
      `1. .env file exists in project root (same folder as package.json)\n` +
      `2. Variables are named: REACT_APP_CLOUDINARY_CLOUD_NAME and REACT_APP_CLOUDINARY_UPLOAD_PRESET\n` +
      `3. No spaces around the = sign\n` +
      `4. Server was restarted after adding .env\n\n` +
      `See CLOUDINARY_SETUP.md for instructions.`;
    throw new Error(errorMsg);
  }

  // Create a timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error('Image upload timed out. Please check your internet connection and try again.'));
    }, timeoutMs);
  });

  // Create upload promise
  const uploadPromise = (async () => {
    try {
      console.log('📤 Starting Cloudinary upload...', {
        cloudName,
        uploadPreset,
        folder,
        fileName: file.name,
        fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      });

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', folder); // Organize images in folders
      
      // Optional: Add transformation parameters for optimization
      // formData.append('transformation', 'f_auto,q_auto'); // REMOVED: Transformation not allowed for unsigned uploads

      const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;
      console.log('🌐 Upload URL:', uploadUrl);

      // Upload to Cloudinary
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Upload failed:', errorData);
        
        // Provide detailed error message
        let errorMessage = `Upload failed with status ${response.status}`;
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        } else if (response.status === 400) {
          errorMessage = 'Invalid request. Check your upload preset name and cloud name.';
        } else if (response.status === 401) {
          errorMessage = 'Unauthorized. Check your upload preset is set to "Unsigned".';
        } else if (response.status === 404) {
          errorMessage = 'Cloud name not found. Check your REACT_APP_CLOUDINARY_CLOUD_NAME.';
        }
        
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Upload successful!', {
        url: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes
      });
      
      // Return secure URL
      return result.secure_url;
    } catch (error) {
      console.error('❌ Error uploading image to Cloudinary:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('network') || error.message?.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      } else if (error.message?.includes('timeout')) {
        throw new Error('Upload timed out. Please try again with a smaller image.');
      } else {
        throw new Error('Failed to upload image: ' + (error.message || 'Unknown error'));
      }
    }
  })();

  // Race between upload and timeout
  return Promise.race([uploadPromise, timeoutPromise]);
};

/**
 * Create image preview from file
 * @param {File} file - Image file
 * @returns {Promise<string>} Data URL for preview
 */
export const createImagePreview = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
