/**
 * Upload image to Cloudinary (Legacy function - use uploadImage from storageService.js instead)
 * @deprecated Use uploadImage from '../firebase/storageService.js' instead
 */
export const uploadToCloudinary = async (file) => {
  const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary is not configured. Please add REACT_APP_CLOUDINARY_CLOUD_NAME and REACT_APP_CLOUDINARY_UPLOAD_PRESET to your .env file.');
  }

  const data = new FormData();
  data.append("file", file);
  data.append("upload_preset", uploadPreset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: data
    }
  );

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Upload failed with status ${res.status}`);
  }

  const result = await res.json();
  return result.secure_url;
};
  