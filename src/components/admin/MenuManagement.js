import React, { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { uploadImage, createImagePreview } from '../../firebase/storageService';
import AdminLayout from './AdminLayout';
import './MenuManagement.css';

// Fixed list of categories for menu items
// Admin can only assign items to these categories (no category management UI)
const FIXED_CATEGORIES = [
  { value: 'signatureKaapi', label: 'Signature Kaapi' },
  { value: 'hotCoffee', label: 'Hot Coffee' },
  { value: 'coldCoffee', label: 'Cold Coffee' },
  { value: 'manualBrews', label: 'Manual Brews' },
  { value: 'notCoffee', label: 'Not Coffee' },
  { value: 'coffeeCoolers', label: 'Coffee Coolers' },
  { value: 'matcha', label: 'Matcha' },
  { value: 'summerCoolers', label: 'Summer Coolers' },
  { value: 'soup', label: 'Soup' },
  { value: 'smallBites', label: 'Small Bites' },
  { value: 'salad', label: 'Salad' },
  { value: 'betweenTheBreads', label: 'Between The Breads' },
  { value: 'largePlates', label: 'Large Plates' },
  { value: 'pizza', label: 'Pizza' },
  { value: 'riceBowl', label: 'Rice Bowl' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'jainMenu', label: 'Jain Menu' },
  { value: 'piccoKidsFavourites', label: "Picco Kids' Favourites" },
];

/**
 * Menu Management Component
 * CRUD operations for menu items
 */
const MenuManagement = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: FIXED_CATEGORIES[0]?.value || '',
    image: '',
    isBestSeller: false
  });
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadAborted, setUploadAborted] = useState(false);

  // Fetch menu items
  useEffect(() => {
    fetchMenuItems();
  }, []);

  const fetchMenuItems = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'menuItems'), orderBy('name'));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMenuItems(items);
    } catch (error) {
      console.error('Error fetching menu items:', error);
      alert('Failed to load menu items');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      try {
        const preview = await createImagePreview(file);
        setImagePreview(preview);
      } catch (error) {
        console.error('Error creating preview:', error);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUploading(true);
    setUploadProgress('Preparing to save...');
    setUploadAborted(false);

    try {
      let imageUrl = formData.image;

      // Upload image if new file selected (make it optional - don't fail if upload fails)
      if (imageFile && !uploadAborted) {
        try {
          // Show upload progress
          setUploadProgress('Uploading image...');
          console.log('Starting image upload...');
          
          imageUrl = await uploadImage(imageFile, 'menu-items', 30000); // 30 second timeout
          
          setUploadProgress('Image uploaded successfully!');
          console.log('Image upload successful:', imageUrl);
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          
          // Extract error message
          const errorMsg = uploadError.message || 'Unknown error occurred';
          setUploadProgress('Image upload failed');
          
          // Ask user if they want to continue without image
          const continueWithoutImage = window.confirm(
            `Image upload failed: ${errorMsg}\n\nWould you like to save the menu item without the image? You can add an image later by editing the item.\n\nNote: Make sure Cloudinary is configured in your .env file and you've restarted your server.`
          );
          
          if (!continueWithoutImage) {
            setUploading(false);
            setUploadProgress('');
            return;
          }
          
          // Keep existing image URL or leave empty
          imageUrl = formData.image || '';
          console.log('Continuing without image...');
          setUploadProgress('Saving without image...');
        }
      }

      setUploadProgress('Saving menu item...');

      const itemData = {
        ...formData,
        image: imageUrl,
        price: formData.price.startsWith('₹') ? formData.price : `₹${formData.price}`
      };

      if (editingItem) {
        // Update existing item
        const itemRef = doc(db, 'menuItems', editingItem.id);
        await updateDoc(itemRef, itemData);
        alert('Menu item updated successfully!');
      } else {
        // Add new item
        await addDoc(collection(db, 'menuItems'), itemData);
        alert('Menu item added successfully!');
      }

      // Reset form
      setUploadProgress('');
      resetForm();
      fetchMenuItems();
    } catch (error) {
      console.error('Error saving menu item:', error);
      setUploadProgress('');
      let errorMessage = 'Failed to save menu item. ';
      
      if (error.code === 'permission-denied') {
        errorMessage += 'Permission denied. Please check your Firebase security rules and make sure you are logged in.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Please try again.';
      }
      
      alert(errorMessage);
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      description: item.description || '',
      price: item.price?.replace('₹', '') || '',
      category: item.category || (FIXED_CATEGORIES[0]?.value || ''),
      image: item.image || '',
      isBestSeller: item.isBestSeller || false
    });
    setImagePreview(item.image || null);
    setImageFile(null);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'menuItems', id));
      alert('Menu item deleted successfully!');
      fetchMenuItems();
    } catch (error) {
      console.error('Error deleting menu item:', error);
      alert('Failed to delete menu item');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: FIXED_CATEGORIES[0]?.value || '',
      image: '',
      isBestSeller: false
    });
    setImagePreview(null);
    setImageFile(null);
    setEditingItem(null);
    setShowModal(false);
    setUploadProgress('');
    setUploadAborted(false);
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="loading-container">
          <p>Loading menu items...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="menu-management">
        <div className="menu-header">
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Add New Item
          </button>
        </div>

        <div className="menu-items-grid">
          {menuItems.map((item) => (
            <div key={item.id} className="menu-item-card">
              <div className="menu-item-image">
                {item.image ? (
                  <img src={item.image} alt={item.name} />
                ) : (
                  <div className="no-image">No Image</div>
                )}
                {item.isBestSeller && (
                  <span className="best-seller-badge">Best Seller</span>
                )}
              </div>
              <div className="menu-item-content">
                <h3>{item.name}</h3>
                <p className="menu-item-description">{item.description}</p>
                <div className="menu-item-details">
                  <span className="menu-item-price">{item.price}</span>
                  <span className="menu-item-category">
                    {FIXED_CATEGORIES.find(c => c.value === item.category)?.label || item.category}
                  </span>
                </div>
                <div className="menu-item-actions">
                  <button className="btn-edit" onClick={() => handleEdit(item)}>
                    ✏️ Edit
                  </button>
                  <button className="btn-delete" onClick={() => handleDelete(item.id)}>
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {menuItems.length === 0 && (
          <div className="empty-state">
            <p>No menu items found. Add your first item!</p>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={resetForm}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h2>
                <button className="modal-close" onClick={resetForm}>×</button>
              </div>

              <form onSubmit={handleSubmit} className="menu-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Name *</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Price *</label>
                    <input
                      type="text"
                      name="price"
                      value={formData.price}
                      onChange={handleInputChange}
                      placeholder="120"
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows="3"
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      name="category"
                      value={formData.category || ''}
                      onChange={handleInputChange}
                      required
                    >
                      {FIXED_CATEGORIES.map(cat => (
                        <option key={cat.value} value={cat.value}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>
                      <input
                        type="checkbox"
                        name="isBestSeller"
                        checked={formData.isBestSeller}
                        onChange={handleInputChange}
                      />
                      Best Seller
                    </label>
                  </div>
                </div>

                <div className="form-group">
                  <label>Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                  />
                  {imagePreview && (
                    <div className="image-preview">
                      <img src={imagePreview} alt="Preview" />
                    </div>
                  )}
                  {!imagePreview && formData.image && (
                    <div className="image-preview">
                      <img src={formData.image} alt="Current" />
                    </div>
                  )}
                </div>

                {uploadProgress && (
                  <div className="upload-progress" style={{ 
                    padding: '1rem', 
                    marginBottom: '1rem', 
                    background: '#e3f2fd', 
                    borderRadius: '8px',
                    color: '#1976d2',
                    fontSize: '0.9rem'
                  }}>
                    {uploadProgress}
                  </div>
                )}
                <div className="form-actions">
                  <button type="button" className="btn-cancel" onClick={resetForm} disabled={uploading}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-submit" disabled={uploading}>
                    {uploading ? (uploadProgress || 'Saving...') : editingItem ? 'Update' : 'Add Item'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};

export default MenuManagement;
