import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Menu from './components/Menu';
import Booking from './components/Booking';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import MenuManagement from './components/admin/MenuManagement';
import ReservationManagement from './components/admin/ReservationManagement';
import ProtectedRoute from './components/admin/ProtectedRoute';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            {/* Admin Login - Public */}
            <Route path="/admin/login" element={<AdminLogin />} />
            
            {/* Protected Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/menu"
              element={
                <ProtectedRoute>
                  <MenuManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/reservations"
              element={
                <ProtectedRoute>
                  <ReservationManagement />
                </ProtectedRoute>
              }
            />

            {/* Public Website Routes */}
            <Route path="/" element={<><Navbar /><Home /></>} />
            <Route path="/menu" element={<><Navbar /><Menu /></>} />
            <Route path="/booking" element={<><Navbar /><Booking /></>} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;

