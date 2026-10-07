import React from 'react';
import AdminLayout from './AdminLayout';
import DashboardStats from './DashboardStats';
import './AdminDashboard.css';

/**
 * Admin Dashboard Component
 * Main dashboard page with statistics
 */
const AdminDashboard = () => {
  return (
    <AdminLayout>
      <div className="admin-dashboard">
        <DashboardStats />
        
        <div className="dashboard-welcome">
          <h2>Welcome to Admin Dashboard</h2>
          <p>Manage your cafe's menu and reservations from here.</p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
