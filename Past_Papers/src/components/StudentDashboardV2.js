import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth as authApi, profile as profileApi } from '../services/api';
import { authStorage } from '../services/auth';
import ChatbotPage from './ChatbotPage';
import PastPapersPage from './PastPapersPage';
import VideosPage from './VideosPage';
import './student.css';

const StudentDashboardV2 = () => {
  const navigate = useNavigate();
  const storedUser = authStorage.getUser() || {};

  const [activeTab, setActiveTab] = useState('overview');
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  const [user, setUser] = useState({
    name: `${storedUser.firstName || ''} ${storedUser.lastName || ''}`.trim() || 'Student',
    email: storedUser.email || '',
    classLevel: storedUser.class_name || '9th',
  });

  const [profileForm, setProfileForm] = useState({
    firstName: storedUser.firstName || '',
    lastName: storedUser.lastName || '',
    class_name: storedUser.class_name || '',
    password: '',
  });

  const tabItems = [
    { id: 'overview', label: 'Overview', icon: '' },
    { id: 'chatbot', label: 'Chatbot', icon: '' },
    { id: 'papers', label: 'Past Papers', icon: '' },
    { id: 'videos', label: 'Videos', icon: '' },
    { id: 'progress', label: 'Progress', icon: '' },
    { id: 'profile', label: 'Profile', icon: '' },
  ];

  const handleLogout = async () => {
    try { await authApi.logout(); } catch (_) {}
    authStorage.clear();
    navigate('/login');
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileMsg('');
    try {
      const updateData = {};
      if (profileForm.firstName) updateData.firstName = profileForm.firstName;
      if (profileForm.lastName) updateData.lastName = profileForm.lastName;
      if (profileForm.class_name) updateData.class_name = profileForm.class_name;
      if (profileForm.password) updateData.password = profileForm.password;

      const data = await profileApi.update(updateData);
      authStorage.save(data);
      setUser({
        name: `${data.user.firstName} ${data.user.lastName}`,
        email: data.user.email,
        classLevel: data.user.class_name,
      });
      setProfileMsg('Profile updated successfully!');
      setProfileForm((prev) => ({ ...prev, password: '' }));
    } catch (err) {
      setProfileMsg(err.data?.error || 'Update failed.');
    } finally {
      setProfileLoading(false);
    }
  };

  return (
    <div className="std-shell">
      <aside className="std-sidebar">
        <div className="std-brand">
          <span className="std-brand-icon">◉</span>
          <div>
            <strong>StudySphere</strong>
            <small>Student Panel</small>
          </div>
        </div>

        <nav className="std-nav">
          {tabItems.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`std-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>

      <section className="std-main">
        <header className="std-topbar">
          <div className="std-topbar-left">
            <span className="std-dot" />
            <strong>{user.name}</strong>
          </div>
          <div className="std-topbar-actions">
            <button type="button" className="std-top-btn" onClick={() => setIsResetOpen(true)}>Change password</button>
            <button type="button" className="std-top-btn" onClick={handleLogout}>Logout</button>
          </div>
        </header>

        {activeTab === 'overview' && (
          <main className="std-content">
            <div className="std-content-head">
              <h1>Overview</h1>
              <p>Platform statistics at a glance</p>
            </div>
            <section className="std-stats">
              <article className="std-stat"><small>Class</small><strong>{user.classLevel}</strong></article>
              <article className="std-stat"><small>Questions</small><strong>124</strong></article>
              <article className="std-stat"><small>Papers</small><strong>14</strong></article>
              <article className="std-stat"><small>Videos</small><strong>46</strong></article>
              <article className="std-stat"><small>Progress</small><strong>87%</strong></article>
              <article className="std-stat"><small>Response</small><strong>2.1s</strong></article>
            </section>
            <section className="std-quick">
              <button type="button" className="std-quick-btn" onClick={() => setActiveTab('chatbot')}>Open Chatbot</button>
              <button type="button" className="std-quick-btn" onClick={() => setActiveTab('papers')}>View Past Papers</button>
              <button type="button" className="std-quick-btn" onClick={() => setActiveTab('videos')}>Browse Videos</button>
            </section>
          </main>
        )}

        {activeTab === 'chatbot' && <div className="std-embedded"><ChatbotPage /></div>}
        {activeTab === 'papers' && <div className="std-embedded"><PastPapersPage /></div>}
        {activeTab === 'videos' && <div className="std-embedded"><VideosPage /></div>}
        {activeTab === 'progress' && <div className="std-panel"><h2>Progress</h2><p>Your weekly activity is improving steadily. Keep consistency.</p></div>}
        {activeTab === 'profile' && <div className="std-panel"><h2>Profile</h2><p>{user.name} • {user.email} • Class {user.classLevel}</p><button type="button" className="std-quick-btn" onClick={() => setIsResetOpen(true)}>Edit Profile</button></div>}
      </section>

      {isResetOpen && (
        <div className="std-modal-backdrop" onClick={() => { setIsResetOpen(false); setProfileMsg(''); }}>
          <div className="std-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit Profile</h3>
            <form onSubmit={handleProfileSave} className="std-form">
              <label>First Name</label>
              <input type="text" value={profileForm.firstName} onChange={(e) => setProfileForm((prev) => ({ ...prev, firstName: e.target.value }))} />
              <label>Last Name</label>
              <input type="text" value={profileForm.lastName} onChange={(e) => setProfileForm((prev) => ({ ...prev, lastName: e.target.value }))} />
              <label>Class</label>
              <select value={profileForm.class_name} onChange={(e) => setProfileForm((prev) => ({ ...prev, class_name: e.target.value }))}>
                <option value="9th">9th</option>
                <option value="10th">10th</option>
              </select>
              <label>New Password <small>(optional)</small></label>
              <input type="password" value={profileForm.password} onChange={(e) => setProfileForm((prev) => ({ ...prev, password: e.target.value }))} minLength={6} />
              {profileMsg && <p className={`std-msg ${profileMsg.includes('success') ? 'ok' : 'error'}`}>{profileMsg}</p>}
              <div className="std-form-actions">
                <button type="button" className="std-btn-ghost" onClick={() => { setIsResetOpen(false); setProfileMsg(''); }}>Cancel</button>
                <button type="submit" className="std-btn-solid" disabled={profileLoading}>{profileLoading ? 'Saving...' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboardV2;
