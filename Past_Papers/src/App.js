// src/App.js  ── FULL REPLACEMENT
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';

import ProtectedRoute from './components/ProtectedRoute';
import LoginForm from './components/LoginForm';
import SignupForm from './components/SignupForm';
import LandingPage from './components/LandingPage';
import StudentDashboard from './components/StudentDashboardV2';
import AdminDashboard from './components/AdminDashboard';
import ChatbotPage from './components/ChatbotPage';
import PastPapersPage from './components/PastPapersPage';
import VideosPage from './components/VideosPage';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginForm />} />
          <Route path="/signup" element={<SignupForm />} />

          {/* Protected — any logged-in user */}
          <Route path="/chatbot" element={
            <ProtectedRoute><ChatbotPage /></ProtectedRoute>
          } />
          <Route path="/past-papers" element={
            <ProtectedRoute><PastPapersPage /></ProtectedRoute>
          } />
          <Route path="/videos" element={
            <ProtectedRoute><VideosPage /></ProtectedRoute>
          } />

          {/* Protected — Student only */}
          <Route path="/student-dashboard" element={
            <ProtectedRoute role="Student"><StudentDashboard /></ProtectedRoute>
          } />

          {/* Protected — Admin only */}
          <Route path="/admin-dashboard" element={
            <ProtectedRoute role="Admin"><AdminDashboard /></ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
}

export default App;