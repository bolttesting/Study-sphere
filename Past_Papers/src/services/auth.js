// src/services/auth.js
// ─────────────────────────────────────────────────────────────────
// Central auth helpers — token storage, retrieval, and user data
// ─────────────────────────────────────────────────────────────────

const ACCESS_KEY  = 'pp_access';
const REFRESH_KEY = 'pp_refresh';
const USER_KEY    = 'pp_user';

export const authStorage = {
  /** Save tokens + user profile after login/signup */
  save(data) {
    localStorage.setItem(ACCESS_KEY,  data.access);
    localStorage.setItem(REFRESH_KEY, data.refresh);
    localStorage.setItem(USER_KEY,    JSON.stringify(data.user));
  },

  /** Get the access token string */
  getAccess() {
    return localStorage.getItem(ACCESS_KEY);
  },

  /** Get the refresh token string */
  getRefresh() {
    return localStorage.getItem(REFRESH_KEY);
  },

  /** Get the user profile object */
  getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch {
      return null;
    }
  },

  /** Update only the user profile object (after profile edit) */
  updateUser(updatedUser) {
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  },

  /** Clear everything on logout */
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /** Is there a stored access token? (quick check — doesn't validate expiry) */
  isLoggedIn() {
    return !!localStorage.getItem(ACCESS_KEY);
  },
};