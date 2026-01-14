// Supabase Service for Menu Data
import { supabase } from './config';

/**
 * Fetch all menu items from Supabase
 * @returns {Promise<Object>} Object with menu items organized by category
 */
export const fetchMenuItems = async () => {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) throw error;

    // Organize by category
    const menuItems = {};
    data.forEach((item) => {
      const category = item.category || 'other';
      if (!menuItems[category]) {
        menuItems[category] = [];
      }
      menuItems[category].push({
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        image: item.image,
        isBestSeller: item.is_best_seller,
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
 * @param {string} category - Category value
 * @returns {Promise<Array>} Array of menu items in the category
 */
export const fetchMenuItemsByCategory = async (category) => {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('category', category)
      .order('name', { ascending: true });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      image: item.image,
      isBestSeller: item.is_best_seller,
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
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('is_best_seller', true)
      .order('name', { ascending: true });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      category: item.category,
      image: item.image,
      isBestSeller: item.is_best_seller,
    }));
  } catch (error) {
    console.error('Error fetching best sellers:', error);
    return [];
  }
};

/**
 * Fetch a single menu item by ID
 * @param {string} itemId - Item ID
 * @returns {Promise<Object|null>} Menu item object or null
 */
export const fetchMenuItemById = async (itemId) => {
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      description: data.description,
      price: data.price,
      category: data.category,
      image: data.image,
      isBestSeller: data.is_best_seller,
    };
  } catch (error) {
    console.error(`Error fetching menu item ${itemId}:`, error);
    return null;
  }
};

/**
 * Fetch all categories from Supabase
 * @returns {Promise<Array>} Array of category objects
 */
export const fetchCategories = async () => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('order', { ascending: true });

    if (error) throw error;

    return data.map(cat => ({
      id: cat.id,
      value: cat.value,
      label: cat.label,
      order: cat.order,
    }));
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
};

/**
 * Add a new category
 * @param {Object} categoryData - Category data
 * @returns {Promise<string>} Category ID
 */
export const addCategory = async (categoryData) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        value: categoryData.value,
        label: categoryData.label,
        order: categoryData.order || 999,
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error adding category:', error);
    throw error;
  }
};

/**
 * Update an existing category
 * @param {string} categoryId - Category ID
 * @param {Object} categoryData - Updated category data
 * @returns {Promise<void>}
 */
export const updateCategory = async (categoryId, categoryData) => {
  try {
    const { error } = await supabase
      .from('categories')
      .update({
        ...categoryData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', categoryId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating category:', error);
    throw error;
  }
};

/**
 * Delete a category
 * @param {string} categoryId - Category ID
 * @returns {Promise<void>}
 */
export const deleteCategory = async (categoryId) => {
  try {
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting category:', error);
    throw error;
  }
};

/**
 * Initialize default categories if table is empty
 * @returns {Promise<void>}
 */
export const initializeDefaultCategories = async () => {
  try {
    const { count } = await supabase
      .from('categories')
      .select('*', { count: 'exact', head: true });

    if (count === 0) {
      const defaultCategories = [
        { value: 'signatureKaapi', label: 'Signature Kaapi', order: 0 },
        { value: 'hotCoffee', label: 'Hot Coffee', order: 1 },
        { value: 'coldCoffee', label: 'Cold Coffee', order: 2 },
        { value: 'piccoKidsFavourites', label: 'Kids Favourites', order: 3 },
      ];

      const { error } = await supabase
        .from('categories')
        .insert(defaultCategories);

      if (error) throw error;
      console.log('Default categories initialized');
    }
  } catch (error) {
    console.warn('Error initializing default categories:', error.message);
  }
};
