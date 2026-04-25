import { authStorage } from './auth';

const BASE_URL = process.env.REACT_APP_API_URL || '/api';

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = authStorage.getAccess();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 401) authStorage.clear();
    throw Object.assign(new Error(err.error || 'API error'), { data: err, status: res.status });
  }
  if (res.status === 204) return null;
  return res.json();
}

function jsonRequest(path, method, body) {
  return request(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
}

function formRequest(path, method, formData) {
  return request(path, { method, body: formData });
}

// ── Auth ───────────────────────────────────────────────────────────────────────
export const auth = {
  signup: (data) => jsonRequest('/auth/signup', 'POST', data),
  login:  (data) => jsonRequest('/auth/login',  'POST', data),
  logout: ()     => jsonRequest('/auth/logout', 'POST', {}),
};

// ── Profile ────────────────────────────────────────────────────────────────────
export const profile = {
  get:    ()     => request('/profile'),
  update: (data) => jsonRequest('/profile', 'PATCH', data),
};

// ── Notes ──────────────────────────────────────────────────────────────────────
export const notes = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/notes${qs ? '?' + qs : ''}`);
  },
  upload: (formData) => formRequest('/notes/upload', 'POST', formData),
  update: (id, formData) => formRequest(`/notes/${id}`, 'PUT', formData),
  delete: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
};

export async function openProtectedFile(fileUrl, suggestedName = 'document.pdf') {
  const token = authStorage.getAccess();
  const response = await fetch(fileUrl, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(errText || 'Failed to load file.');
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const win = window.open(blobUrl, '_blank');
  if (!win) {
    window.URL.revokeObjectURL(blobUrl);
    throw new Error('Popup was blocked. Please allow popups and try again.');
  }
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
}

export async function downloadProtectedFile(fileUrl, suggestedName = 'document.pdf') {
  const token = authStorage.getAccess();
  const response = await fetch(fileUrl, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(errText || 'Failed to download file.');
  }

  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => window.URL.revokeObjectURL(blobUrl), 30000);
}

// ── Past Papers ────────────────────────────────────────────────────────────────
export const pastPapers = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/past-papers${qs ? '?' + qs : ''}`);
  },
  upload: (formData) => formRequest('/past-papers/upload', 'POST', formData),
  update: (id, formData) => formRequest(`/past-papers/${id}`, 'PUT', formData),
  delete: (id) => request(`/past-papers/${id}`, { method: 'DELETE' }),
};

// ── Chatbot ────────────────────────────────────────────────────────────────────
export const chatbot = {
  send: (data) => jsonRequest('/chatbot', 'POST', data),
};

// ── Paper Generation ───────────────────────────────────────────────────────────
export const paperGen = {
  generate: (data) => jsonRequest('/generate-paper', 'POST', data),
  downloadPdf: async (data) => {
    const token = authStorage.getAccess();
    const res = await fetch(`${BASE_URL}/generate-paper/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'PDF download failed' }));
      throw new Error(err.error || 'PDF download failed');
    }
    return res.blob();
  },
};

export const videos = {
  search: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/videos${qs ? '?' + qs : ''}`);
  },
};

// ── Chat Sessions ─────────────────────────────────────────────────────────────
export const chatSessions = {
  list:   ()         => request('/chat/sessions'),
  create: (data)     => jsonRequest('/chat/sessions', 'POST', data),
  get:    (id)       => request(`/chat/sessions/${id}`),
  delete: (id)       => request(`/chat/sessions/${id}`, { method: 'DELETE' }),
};

export const queries = {
  submit: (data) => jsonRequest('/queries/submit', 'POST', data),
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/queries${qs ? '?' + qs : ''}`);
  },
  resolve: (id, data) => jsonRequest(`/queries/${id}/resolve`, 'PATCH', data),
  crawl: (id) => jsonRequest(`/queries/${id}/crawl`, 'POST', {}),
};