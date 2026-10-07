import React, { useState, useEffect } from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase/config';
import './DashboardStats.css';

/**
 * Dashboard Stats Component
 * Displays analytics and statistics
 */
const DashboardStats = () => {
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    totalMenuItems: 0,
    loading: true
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch reservations
        const reservationsRef = collection(db, 'reservations');
        const reservationsSnapshot = await getDocs(reservationsRef);
        const reservations = reservationsSnapshot.docs.map(doc => doc.data());
        
        // Fetch menu items
        const menuItemsRef = collection(db, 'menuItems');
        const menuItemsSnapshot = await getDocs(menuItemsRef);

        setStats({
          totalBookings: reservations.length,
          pendingBookings: reservations.filter(r => r.status === 'pending').length,
          totalMenuItems: menuItemsSnapshot.size,
          loading: false
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };

    fetchStats();
  }, []);

  if (stats.loading) {
    return (
      <div className="stats-loading">
        <p>Loading statistics...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-stats">
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-content">
            <h3>Total Bookings</h3>
            <p className="stat-value">{stats.totalBookings}</p>
          </div>
        </div>

        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <h3>Pending Bookings</h3>
            <p className="stat-value">{stats.pendingBookings}</p>
          </div>
        </div>

        <div className="stat-card menu">
          <div className="stat-icon">🍽️</div>
          <div className="stat-content">
            <h3>Menu Items</h3>
            <p className="stat-value">{stats.totalMenuItems}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
