// src/components/ProtectedRoute.js  ── NEW FILE
import React from 'react';
import { Navigate } from 'react-router-dom';
import { authStorage } from '../services/auth';

/**
 * Wraps any route that requires login.
 * Optionally restricts to a specific role: <ProtectedRoute role="Admin" />
 */
const ProtectedRoute = ({ children, role }) => {
  if (!authStorage.isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  if (role) {
    const user = authStorage.getUser();
    if (!user || user.role !== role) {
      // Logged in but wrong role — redirect to their own dashboard
      const correctPath = user?.role === 'Admin' ? '/admin-dashboard' : '/student-dashboard';
      return <Navigate to={correctPath} replace />;
    }
  }

  return children;
};

export default ProtectedRoute;