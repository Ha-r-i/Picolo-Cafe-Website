// Firebase Service for Menu Data
import { collection, getDocs, query, orderBy, where, doc, getDoc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from './config';

/**
 * Fetch all menu items from Firestore
 * @returns {Promise<Array>} Array of menu items organized by category
 */
export const fetchMenuItems = async () => {
  try {
    const menuRef = collection(db, 'menuItems');
    const q = query(menuRef, orderBy('category'), orderBy('name'));
    const querySnapshot = await getDocs(q);
    
    const menuItems = {};
    
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const category = data.category || 'other';
      
      if (!menuItems[category]) {
        menuItems[category] = [];
      }
      
      menuItems[category].push({
        id: doc.id,
        ...data,
      });
    });
    
    return menuItems;
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return {};
  }
};

/**
 * Fetch menu items by category
 * @param {string} category - Category name (e.g., 'signatureKaapi', 'hotCoffee')
 * @returns {Promise<Array>} Array of menu items in the category
 */
export const fetchMenuItemsByCategory = async (category) => {
  try {
    const menuRef = collection(db, 'menuItems');
    const q = query(menuRef, where('category', '==', category), orderBy('name'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error(`Error fetching menu items for category ${category}:`, error);
    return [];
  }
};

/**
 * Fetch best seller items
 * @returns {Promise<Array>} Array of best seller menu items
 */
export const fetchBestSellers = async () => {
  try {
    const menuRef = collection(db, 'menuItems');
    const q = query(menuRef, where('isBestSeller', '==', true), orderBy('name'));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error('Error fetching best sellers:', error);
    return [];
  }
};

/**
 * Fetch a single menu item by ID
 * @param {string} itemId - Document ID
 * @returns {Promise<Object|null>} Menu item object or null
 */
export const fetchMenuItemById = async (itemId) => {
  try {
    const docRef = doc(db, 'menuItems', itemId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      };
    }
    return null;
  } catch (error) {
    console.error(`Error fetching menu item ${itemId}:`, error);
    return null;
  }
};

/**
 * Fetch all categories from Firestore
 * @returns {Promise<Array>} Array of category objects with id, value, and label
 */
export const fetchCategories = async () => {
  try {
    const categoriesRef = collection(db, 'categories');
    let querySnapshot;
    
    try {
      // Try with orderBy first
      const q = query(categoriesRef, orderBy('order', 'asc'));
      querySnapshot = await getDocs(q);
    } catch (orderError) {
      // If orderBy fails (no index), try without ordering
      console.warn('OrderBy failed, fetching without order:', orderError);
      querySnapshot = await getDocs(categoriesRef);
    }
    
    const categories = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    // Sort manually if orderBy failed
    if (categories.length > 0 && categories[0].order !== undefined) {
      categories.sort((a, b) => (a.order || 999) - (b.order || 999));
    }
    
    return categories;
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

/**
 * Add a new category
 * @param {Object} categoryData - Category data with value, label, and optional order
 * @returns {Promise<string>} Document ID of the new category
 */
export const addCategory = async (categoryData) => {
  try {
    const categoriesRef = collection(db, 'categories');
    const docRef = await addDoc(categoriesRef, {
      value: categoryData.value,
      label: categoryData.label,
      order: categoryData.order || 999,
      createdAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding category:', error);
    throw error;
  }
};

/**
 * Update an existing category
 * @param {string} categoryId - Document ID
 * @param {Object} categoryData - Updated category data
 * @returns {Promise<void>}
 */
export const updateCategory = async (categoryId, categoryData) => {
  try {
    const categoryRef = doc(db, 'categories', categoryId);
    await updateDoc(categoryRef, {
      ...categoryData,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

/**
 * Delete a category
 * @param {string} categoryId - Document ID
 * @returns {Promise<void>}
 */
export const deleteCategory = async (categoryId) => {
  try {
    const categoryRef = doc(db, 'categories', categoryId);
    await deleteDoc(categoryRef);
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

/**
 * Initialize default categories if collection is empty
 * @returns {Promise<void>}
 */
export const initializeDefaultCategories = async () => {
  try {
    const categoriesRef = collection(db, 'categories');
    const querySnapshot = await getDocs(categoriesRef);
    
    // Only initialize if collection is empty
    if (querySnapshot.empty) {
      const defaultCategories = [
        { value: 'signatureKaapi', label: 'Signature Kaapi', order: 0 },
        { value: 'hotCoffee', label: 'Hot Coffee', order: 1 },
        { value: 'coldCoffee', label: 'Cold Coffee', order: 2 },
        { value: 'piccoKidsFavourites', label: 'Kids Favourites', order: 3 },
      ];
      
      // Add all default categories
      for (const cat of defaultCategories) {
        try {
          await addCategory(cat);
        } catch (addError) {
          // Silently fail if we don't have permissions - fallback categories will be used
          if (addError.code !== 'permission-denied') {
            console.warn('Failed to add default category:', cat.label, addError);
          }
        }
      }
      
      console.log('Default categories initialization attempted');
    }
  } catch (error) {
    // Silently fail - this is optional initialization, fallback categories will be used
    if (error.code !== 'permission-denied') {
      console.warn('Error initializing default categories:', error.message);
    }
  }
};
