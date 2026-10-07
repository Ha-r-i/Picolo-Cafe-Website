import React, { useState, useEffect } from 'react';
import { sendReservationEmail } from "../../Utils/email";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import AdminLayout from './AdminLayout';
import './ReservationManagement.css';

/**
 * Reservation Management Component
 * View and manage table reservations
 */
const ReservationManagement = () => {
  const [reservations, setReservations] = useState([]);
  const [filteredReservations, setFilteredReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [statusFilter, setStatusFilter] = useState('all');

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  // Fetch reservations
  useEffect(() => {
    fetchReservations();
  }, []);

  // Filter and sort reservations
  useEffect(() => {
    let filtered = [...reservations];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(res => 
        res.name?.toLowerCase().includes(term) ||
        res.phone?.includes(term) ||
        res.email?.toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(res => res.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      if (sortBy === 'date') {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return dateB - dateA; // Newest first
      }
      return 0;
    });

    setFilteredReservations(filtered);
  }, [reservations, searchTerm, statusFilter, sortBy]);

  const fetchReservations = async () => {
    try {
      setLoading(true);
      const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReservations(data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      alert('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reservation, newStatus) => {
    try {
      await updateDoc(doc(db,"reservations",reservation.id), {
        status: newStatus
      });
  
      // SEND EMAIL
      await sendReservationEmail({
        name: reservation.name,
        email: reservation.email,
        date: reservation.date,
        time: reservation.time,
        guests: reservation.guests,
        status: newStatus
      });
  
      alert("Status updated & email sent!");
  
    } catch (err) {
      console.log(err);
      alert("Error sending email");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'confirmed':
        return 'status-confirmed';
      case 'completed':
        return 'status-completed';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="loading-container">
          <p>Loading reservations...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="reservation-management">
        {/* Filters and Search */}
        <div className="reservation-filters">
          <div className="filter-group">
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          <div className="filter-group">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              {statusOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="filter-select"
            >
              <option value="date">Sort by Date</option>
            </select>
          </div>
        </div>

        {/* Reservations Table */}
        <div className="reservations-table-container">
          <table className="reservations-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Contact</th>
                <th>Date</th>
                <th>Time</th>
                <th>Guests</th>
                <th>Special Requests</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReservations.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-row">
                    No reservations found
                  </td>
                </tr>
              ) : (
                filteredReservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td>{reservation.name}</td>
                    <td>
                      <div className="contact-info">
                        <div>{reservation.phone}</div>
                        <div className="email">{reservation.email}</div>
                      </div>
                    </td>
                    <td>{formatDate(reservation.date)}</td>
                    <td>{reservation.time}</td>
                    <td>{reservation.guests}</td>
                    <td>
                      <div className="special-requests">
                        {reservation.specialRequests || '-'}
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(reservation.status)}`}>
                        {reservation.status || 'pending'}
                      </span>
                    </td>
                    <td>
                      <select
                        value={reservation.status || 'pending'}
                        onChange={(e) => handleStatusChange(reservation, e.target.value)}
                        className="status-select"
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="reservation-summary">
          <p>
            Showing <strong>{filteredReservations.length}</strong> of{' '}
            <strong>{reservations.length}</strong> reservations
          </p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ReservationManagement;
