// Supabase Service for Reservations
import { supabase } from './config';

/**
 * Create a new reservation
 * @param {Object} reservationData - Reservation data
 * @returns {Promise<string>} Reservation ID
 */
export const createReservation = async (reservationData) => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .insert({
        name: reservationData.name,
        email: reservationData.email,
        phone: reservationData.phone,
        date: reservationData.date,
        time: reservationData.time,
        guests: parseInt(reservationData.guests) || 2,
        special_requests: reservationData.specialRequests || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error creating reservation:', error);
    throw error;
  }
};

/**
 * Fetch all reservations
 * @returns {Promise<Array>} Array of reservations
 */
export const fetchReservations = async () => {
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map(res => ({
      id: res.id,
      name: res.name,
      email: res.email,
      phone: res.phone,
      date: res.date,
      time: res.time,
      guests: res.guests,
      specialRequests: res.special_requests,
      status: res.status,
      createdAt: res.created_at,
    }));
  } catch (error) {
    console.error('Error fetching reservations:', error);
    return [];
  }
};

/**
 * Update reservation status
 * @param {string} reservationId - Reservation ID
 * @param {string} status - New status
 * @returns {Promise<void>}
 */
export const updateReservationStatus = async (reservationId, status) => {
  try {
    const { error } = await supabase
      .from('reservations')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reservationId);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating reservation status:', error);
    throw error;
  }
};

/**
 * Delete a reservation
 * @param {string} reservationId - Reservation ID
 * @returns {Promise<void>}
 */
export const deleteReservation = async (reservationId) => {
  try {
    const { error } = await supabase
      .from('reservations')
      .delete()
      .eq('id', reservationId);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting reservation:', error);
    throw error;
  }
};
