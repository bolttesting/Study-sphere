// src/components/AdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notes as notesApi, pastPapers as papersApi, queries as queriesApi, openProtectedFile } from '../services/api';
import './admin.css';
import { authStorage } from '../services/auth';
import { auth as authApi } from '../services/api';

const CLASSES = ['9th', '10th'];
const SUBJECTS = [
  'Physics', 'Chemistry', 'Biology', 'Maths',
  'Computer', 'English', 'Urdu', 'Islamiat', 'Pakistan Studies',
];
const EXAM_TYPES = ['Board', 'Midterm', 'Final'];

// ── tiny helpers ───────────────────────────────────────────────────────────────
const emptyNoteForm = () => ({ class_name: '9th', subject: 'Physics', title: '', file: null });
const emptyPaperForm = () => ({
  class_name: '9th', subject: 'Physics', title: '', year: '', exam_type: 'Board', file: null,
});

const AdminDashboard = () => {
  const navigate = useNavigate();

  // profile / ui state
  const [profileOpen, setProfileOpen] = useState(false);
  const currentUser = authStorage.getUser() || {};
  const [adminPreferredClass, setAdminPreferredClass] = useState(currentUser.class_name || '9th');
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [activeModule, setActiveModule] = useState('overview');
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [selectedModuleForClass, setSelectedModuleForClass] = useState(null);
  const [toast, setToast] = useState(null);

  // data state
  const [notesList, setNotesList] = useState([]);
  const [papersList, setPapersList] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [papersLoading, setPapersLoading] = useState(false);
  const [queriesList, setQueriesList] = useState([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [queryCrawlLoading, setQueryCrawlLoading] = useState({});
  const [resolveAnswer, setResolveAnswer] = useState({});

  // filters
  const [notesFilter, setNotesFilter] = useState({ class_name: '9th', subject: '', title: '' });
  const [papersFilter, setPapersFilter] = useState({ class_name: '9th', subject: '', year: '' });

  // forms
  const [noteForm, setNoteForm] = useState(emptyNoteForm());
  const [paperForm, setPaperForm] = useState(emptyPaperForm());
  const [noteUploading, setNoteUploading] = useState(false);
  const [paperUploading, setPaperUploading] = useState(false);

  // edit state
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteForm, setEditNoteForm] = useState({});
  const [editingPaperId, setEditingPaperId] = useState(null);
  const [editPaperForm, setEditPaperForm] = useState({});
  const adminTabs = [
    { id: 'overview', label: 'Overview', icon: '' },
    { id: 'notes', label: 'Manage Notes', icon: '' },
    { id: 'papers', label: 'Past Papers', icon: '' },
    { id: 'queries', label: 'Queries', icon: '' },
  ];

  // ── toast helper ────────────────────────────────────────────────────────────
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── fetch notes ─────────────────────────────────────────────────────────────
  const fetchNotes = useCallback(async () => {
    setNotesLoading(true);
    try {
      const params = {};
      if (notesFilter.class_name) params.class_name = notesFilter.class_name;
      if (notesFilter.subject) params.subject = notesFilter.subject;
      const data = await notesApi.list(params);
      setNotesList(data);
    } catch (e) {
      showToast('Failed to load notes', 'error');
    } finally {
      setNotesLoading(false);
    }
  }, [notesFilter.class_name, notesFilter.subject]);

  // ── fetch papers ─────────────────────────────────────────────────────────────
  const fetchPapers = useCallback(async () => {
    setPapersLoading(true);
    try {
      const params = {};
      if (papersFilter.class_name) params.class_name = papersFilter.class_name;
      if (papersFilter.subject) params.subject = papersFilter.subject;
      if (papersFilter.year) params.year = papersFilter.year;
      const data = await papersApi.list(params);
      setPapersList(data);
    } catch (e) {
      showToast('Failed to load papers', 'error');
    } finally {
      setPapersLoading(false);
    }
  }, [papersFilter.class_name, papersFilter.subject, papersFilter.year]);

  useEffect(() => { if (activeModule === 'notes') fetchNotes(); }, [activeModule, fetchNotes]);
  useEffect(() => { if (activeModule === 'papers') fetchPapers(); }, [activeModule, fetchPapers]);
  const fetchQueries = useCallback(async () => {
    setQueriesLoading(true);
    try {
      const data = await queriesApi.list({ status: 'pending' });
      setQueriesList(data);
    } catch (e) {
      showToast('Failed to load queries', 'error');
    } finally {
      setQueriesLoading(false);
    }
  }, []);
  useEffect(() => { if (activeModule === 'queries') fetchQueries(); }, [activeModule, fetchQueries]);

  const handleResolveQuery = async (id) => {
    const answer = (resolveAnswer[id] || '').trim();
    if (!answer) return showToast('Please enter an answer first', 'error');
    try {
      await queriesApi.resolve(id, { admin_answer: answer });
      showToast('Query resolved and email notification sent');
      setResolveAnswer((p) => ({ ...p, [id]: '' }));
      fetchQueries();
    } catch (e) {
      showToast('Resolve failed', 'error');
    }
  };

  const handleRunCrawler = async (id) => {
    setQueryCrawlLoading((prev) => ({ ...prev, [id]: true }));
    try {
      const updated = await queriesApi.crawl(id);
      setQueriesList((prev) => prev.map((q) => (q.id === id ? { ...q, spider_result: updated.spider_result } : q)));
      showToast('Crawler finished. You can now review/update the answer.');
    } catch (e) {
      showToast(e.message || 'Crawler failed', 'error');
    } finally {
      setQueryCrawlLoading((prev) => ({ ...prev, [id]: false }));
    }
  };

  // ── Note upload ──────────────────────────────────────────────────────────────
  const handleNoteSubmit = async (e) => {
    e.preventDefault();
    if (!noteForm.title || !noteForm.file) return showToast('Title and PDF file are required', 'error');

    const fd = new FormData();
    fd.append('title', noteForm.title);
    fd.append('subject', noteForm.subject);
    fd.append('class_name', noteForm.class_name);
    fd.append('file', noteForm.file);

    setNoteUploading(true);
    try {
      await notesApi.upload(fd);
      showToast('Note uploaded and embedded in Pinecone successfully.');
      setNoteForm(emptyNoteForm());
      fetchNotes();
    } catch (e) {
      showToast(e.message || 'Upload failed', 'error');
    } finally {
      setNoteUploading(false);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!window.confirm('Delete this note and its Pinecone vectors?')) return;
    try {
      await notesApi.delete(id);
      showToast('Note deleted');
      fetchNotes();
    } catch (e) {
      showToast('Delete failed', 'error');
    }
  };

  const handleEditNoteSave = async () => {
    const fd = new FormData();
    fd.append('title', editNoteForm.title);
    fd.append('subject', editNoteForm.subject);
    fd.append('class_name', editNoteForm.class_name);
    if (editNoteForm.file) fd.append('file', editNoteForm.file);

    try {
      await notesApi.update(editingNoteId, fd);
      showToast('Note updated successfully.');
      setEditingNoteId(null);
      fetchNotes();
    } catch (e) {
      showToast('Update failed', 'error');
    }
  };

  // ── Paper upload ─────────────────────────────────────────────────────────────
  const handlePaperSubmit = async (e) => {
    e.preventDefault();
    if (!paperForm.title || !paperForm.year || !paperForm.file)
      return showToast('Title, year, and PDF are required', 'error');

    const fd = new FormData();
    fd.append('title', paperForm.title);
    fd.append('subject', paperForm.subject);
    fd.append('class_name', paperForm.class_name);
    fd.append('year', paperForm.year);
    fd.append('exam_type', paperForm.exam_type);
    fd.append('file', paperForm.file);

    setPaperUploading(true);
    try {
      await papersApi.upload(fd);
      showToast('Past paper uploaded and embedded in Pinecone successfully.');
      setPaperForm(emptyPaperForm());
      fetchPapers();
    } catch (e) {
      showToast(e.message || 'Upload failed', 'error');
    } finally {
      setPaperUploading(false);
    }
  };

  const handleDeletePaper = async (id) => {
    if (!window.confirm('Delete this paper and its Pinecone vectors?')) return;
    try {
      await papersApi.delete(id);
      showToast('Paper deleted');
      fetchPapers();
    } catch (e) {
      showToast('Delete failed', 'error');
    }
  };

  const handleEditPaperSave = async () => {
    const fd = new FormData();
    fd.append('title', editPaperForm.title);
    fd.append('subject', editPaperForm.subject);
    fd.append('class_name', editPaperForm.class_name);
    fd.append('year', editPaperForm.year);
    fd.append('exam_type', editPaperForm.exam_type);
    if (editPaperForm.file) fd.append('file', editPaperForm.file);

    try {
      await papersApi.update(editingPaperId, fd);
      showToast('Paper updated successfully.');
      setEditingPaperId(null);
      fetchPapers();
    } catch (e) {
      showToast('Update failed', 'error');
    }
  };

  // ── Card / module navigation ──────────────────────────────────────────────────
  const handleCardClick = (mod) => {
    setSelectedModuleForClass(mod);
    setClassModalOpen(true);
  };
  const handleClassSelect = (cls) => {
    setClassModalOpen(false);
    if (selectedModuleForClass === 'notes') setNotesFilter((p) => ({ ...p, class_name: cls }));
    else setPapersFilter((p) => ({ ...p, class_name: cls }));
    setActiveModule(selectedModuleForClass);
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch (_) { }
    authStorage.clear();
    navigate('/login');
  };

  // ── filtered lists (client-side title search) ─────────────────────────────────
  const filteredNotes = notesList.filter(
    (n) => !notesFilter.title || n.title.toLowerCase().includes(notesFilter.title.toLowerCase())
  );
  const filteredPapers = papersList.filter(
    (p) => !papersFilter.year || p.year.includes(papersFilter.year)
  );

  // ── render ────────────────────────────────────────────────────────────────────
  return (
    <div className="admin-dashboard-root">
      {/* Toast */}
      {toast && (
        <div className={`admin-toast admin-toast--${toast.type}`}>{toast.msg}</div>
      )}

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <div className="admin-brand">
            <span className="admin-brand-icon">◉</span>
            <div>
              <strong>StudySphere</strong>
              <small>Admin Panel</small>
            </div>
          </div>
          <nav className="admin-nav">
            {adminTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`admin-nav-item ${activeModule === tab.id ? 'active' : ''}`}
                onClick={() => setActiveModule(tab.id)}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="admin-main">
      <div className="dashboard-container">
        {/* Header */}
        <div className="dashboard-header">
          <h1>Admin Dashboard</h1>

          <div className="profile-wrapper">
            <button className="profile-button" onClick={() => setProfileOpen((o) => !o)}>
              <div className="profile-avatar">A</div>
              <div className="profile-info">
                <span className="profile-name">Admin User</span>
                <span className="profile-role">
                  Administrator · {adminPreferredClass === '-' ? 'All Classes' : `${adminPreferredClass} Class`}
                </span>
              </div>
              <span className={`profile-chevron ${profileOpen ? 'open' : ''}`}>▾</span>
            </button>

            {profileOpen && (
              <div className="profile-dropdown">
                <div className="profile-details">
                  <div className="profile-details-name">
                    {currentUser.firstName} {currentUser.lastName}
                  </div>
                  <div className="profile-details-email">{currentUser.email}</div>
                </div>
                <div className="profile-section-title">Class Preference</div>
                <div className="profile-class-options">
                  {CLASSES.map((c) => (
                    <button key={c} className="profile-class-btn"
                      onClick={() => setAdminPreferredClass(c)}>{c}</button>
                  ))}
                </div>
                <div className="profile-section-title">Account</div>
                <button className="profile-dropdown-item"
                  onClick={() => { setPasswordModalOpen(true); setProfileOpen(false); }}>
                  Reset Password
                </button>
                <button className="profile-dropdown-item logout" onClick={handleLogout}>
                  Log Out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Cards */}
        <div className="dashboard-content">
          {activeModule === 'overview' && <div className="dashboard-grid">
            <div className="dashboard-card" onClick={() => handleCardClick('notes')}>
              <div className="dashboard-card-icon">N</div>
              <h3>Manage Notes</h3>
              <p>Upload PDFs — auto-chunked &amp; stored in Pinecone for RAG.</p>
            </div>
            <div className="dashboard-card" onClick={() => handleCardClick('papers')}>
              <div className="dashboard-card-icon">P</div>
              <h3>Manage Past Papers</h3>
              <p>Upload past papers for student practice &amp; AI paper generation.</p>
            </div>
            <div className="dashboard-card" onClick={() => { setActiveModule('queries'); }}>
              <div className="dashboard-card-icon">Q</div>
              <h3>Manage Queries</h3>
              <p>Review unanswered student queries and send validated responses.</p>
            </div>
          </div>}

          {/* ── NOTES MODULE ────────────────────────────────────────────────── */}
          {activeModule === 'notes' && (
            <section className="module-section">
              <h2 className="module-title">Manage Notes</h2>

              {/* Filters */}
              <div className="module-filters">
                <select className="filter-input" value={notesFilter.class_name}
                  onChange={(e) => setNotesFilter((p) => ({ ...p, class_name: e.target.value }))}>
                  {CLASSES.map((c) => <option key={c} value={c}>{c} Class</option>)}
                </select>
                <select className="filter-input" value={notesFilter.subject}
                  onChange={(e) => setNotesFilter((p) => ({ ...p, subject: e.target.value }))}>
                  <option value="">All Subjects</option>
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="filter-input" type="text" placeholder="Filter by title…"
                  value={notesFilter.title}
                  onChange={(e) => setNotesFilter((p) => ({ ...p, title: e.target.value }))} />
                <button className="primary-btn" onClick={fetchNotes}>Refresh</button>
              </div>

              {/* Upload form */}
              <form className="module-form" onSubmit={handleNoteSubmit}>
                <div className="form-row">
                  <select className="form-input" value={noteForm.class_name}
                    onChange={(e) => setNoteForm((p) => ({ ...p, class_name: e.target.value }))}>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="form-input" value={noteForm.subject}
                    onChange={(e) => setNoteForm((p) => ({ ...p, subject: e.target.value }))}>
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input className="form-input" type="text" placeholder="Title"
                    value={noteForm.title}
                    onChange={(e) => setNoteForm((p) => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="form-row">
                  <label className="file-label">
                    {noteForm.file ? noteForm.file.name : 'Choose PDF…'}
                    <input type="file" accept=".pdf" hidden
                      onChange={(e) => setNoteForm((p) => ({ ...p, file: e.target.files[0] || null }))} />
                  </label>
                  <button type="submit" className="primary-btn" disabled={noteUploading}>
                    {noteUploading ? 'Uploading…' : 'Upload Note'}
                  </button>
                </div>
                {noteUploading && (
                  <p className="upload-hint">Chunking PDF and embedding into Pinecone…</p>
                )}
              </form>

              {/* Table */}
              <div className="module-table-wrapper">
                {notesLoading ? <p className="loading-text">Loading…</p> : (
                  <table className="module-table">
                    <thead>
                      <tr><th>Class</th><th>Subject</th><th>Title</th><th>File</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {filteredNotes.map((note) => (
                        <tr key={note.id}>
                          {editingNoteId === note.id ? (
                            <>
                              <td>
                                <select className="form-input" value={editNoteForm.class_name}
                                  onChange={(e) => setEditNoteForm((p) => ({ ...p, class_name: e.target.value }))}>
                                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </td>
                              <td>
                                <select className="form-input" value={editNoteForm.subject}
                                  onChange={(e) => setEditNoteForm((p) => ({ ...p, subject: e.target.value }))}>
                                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td>
                                <input className="form-input" value={editNoteForm.title}
                                  onChange={(e) => setEditNoteForm((p) => ({ ...p, title: e.target.value }))} />
                              </td>
                              <td>
                                <label className="file-label small">
                                  {editNoteForm.file ? editNoteForm.file.name : 'Replace PDF (optional)'}
                                  <input type="file" accept=".pdf" hidden
                                    onChange={(e) => setEditNoteForm((p) => ({ ...p, file: e.target.files[0] || null }))} />
                                </label>
                              </td>
                              <td className="table-actions">
                                <button className="table-btn edit" onClick={handleEditNoteSave}>Save</button>
                                <button className="table-btn delete" onClick={() => setEditingNoteId(null)}>Cancel</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{note.class_name}</td>
                              <td>{note.subject}</td>
                              <td>{note.title}</td>
                              <td>
                                {note.file ? (
                                  <button
                                    type="button"
                                    className="table-btn view"
                                    onClick={async () => {
                                      try {
                                        await openProtectedFile(note.file, `${note.title || 'note'}.pdf`);
                                      } catch (e) {
                                        showToast(e.message || 'Unable to open PDF', 'error');
                                      }
                                    }}
                                  >
                                    View PDF
                                  </button>
                                ) : '—'}
                              </td>
                              <td className="table-actions">
                                <button className="table-btn edit"
                                  onClick={() => { setEditingNoteId(note.id); setEditNoteForm({ ...note, file: null }); }}>
                                  Edit
                                </button>
                                <button className="table-btn delete" onClick={() => handleDeleteNote(note.id)}>
                                  Delete
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      {filteredNotes.length === 0 && (
                        <tr><td colSpan="5" className="empty-row">No notes found.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}

          {/* ── PAPERS MODULE ────────────────────────────────────────────────── */}
          {activeModule === 'papers' && (
            <section className="module-section">
              <h2 className="module-title">Manage Past Papers</h2>

              {/* Filters */}
              <div className="module-filters">
                <select className="filter-input" value={papersFilter.class_name}
                  onChange={(e) => setPapersFilter((p) => ({ ...p, class_name: e.target.value }))}>
                  {CLASSES.map((c) => <option key={c} value={c}>{c} Class</option>)}
                </select>
                <select className="filter-input" value={papersFilter.subject}
                  onChange={(e) => setPapersFilter((p) => ({ ...p, subject: e.target.value }))}>
                  <option value="">All Subjects</option>
                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <input className="filter-input" type="text" placeholder="Filter by year…"
                  value={papersFilter.year}
                  onChange={(e) => setPapersFilter((p) => ({ ...p, year: e.target.value }))} />
                <button className="primary-btn" onClick={fetchPapers}>Refresh</button>
              </div>

              {/* Upload form */}
              <form className="module-form" onSubmit={handlePaperSubmit}>
                <div className="form-row">
                  <select className="form-input" value={paperForm.class_name}
                    onChange={(e) => setPaperForm((p) => ({ ...p, class_name: e.target.value }))}>
                    {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select className="form-input" value={paperForm.subject}
                    onChange={(e) => setPaperForm((p) => ({ ...p, subject: e.target.value }))}>
                    {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <input className="form-input" type="text" placeholder="Title"
                    value={paperForm.title}
                    onChange={(e) => setPaperForm((p) => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="form-row">
                  <input className="form-input" type="text" placeholder="Year (e.g. 2023)"
                    value={paperForm.year}
                    onChange={(e) => setPaperForm((p) => ({ ...p, year: e.target.value }))} />
                  <select className="form-input" value={paperForm.exam_type}
                    onChange={(e) => setPaperForm((p) => ({ ...p, exam_type: e.target.value }))}>
                    {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className="file-label">
                    {paperForm.file ? paperForm.file.name : 'Choose PDF…'}
                    <input type="file" accept=".pdf" hidden
                      onChange={(e) => setPaperForm((p) => ({ ...p, file: e.target.files[0] || null }))} />
                  </label>
                  <button type="submit" className="primary-btn" disabled={paperUploading}>
                    {paperUploading ? 'Uploading…' : 'Upload Paper'}
                  </button>
                </div>
                {paperUploading && (
                  <p className="upload-hint">Chunking PDF and embedding into Pinecone…</p>
                )}
              </form>

              {/* Table */}
              <div className="module-table-wrapper">
                {papersLoading ? <p className="loading-text">Loading…</p> : (
                  <table className="module-table">
                    <thead>
                      <tr><th>Class</th><th>Subject</th><th>Title</th><th>Year</th><th>Type</th><th>File</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                      {filteredPapers.map((paper) => (
                        <tr key={paper.id}>
                          {editingPaperId === paper.id ? (
                            <>
                              <td>
                                <select className="form-input" value={editPaperForm.class_name}
                                  onChange={(e) => setEditPaperForm((p) => ({ ...p, class_name: e.target.value }))}>
                                  {CLASSES.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </td>
                              <td>
                                <select className="form-input" value={editPaperForm.subject}
                                  onChange={(e) => setEditPaperForm((p) => ({ ...p, subject: e.target.value }))}>
                                  {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                              </td>
                              <td>
                                <input className="form-input" value={editPaperForm.title}
                                  onChange={(e) => setEditPaperForm((p) => ({ ...p, title: e.target.value }))} />
                              </td>
                              <td>
                                <input className="form-input" value={editPaperForm.year}
                                  onChange={(e) => setEditPaperForm((p) => ({ ...p, year: e.target.value }))} />
                              </td>
                              <td>
                                <select className="form-input" value={editPaperForm.exam_type}
                                  onChange={(e) => setEditPaperForm((p) => ({ ...p, exam_type: e.target.value }))}>
                                  {EXAM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                                </select>
                              </td>
                              <td>
                                <label className="file-label small">
                                  {editPaperForm.file ? editPaperForm.file.name : 'Replace PDF (optional)'}
                                  <input type="file" accept=".pdf" hidden
                                    onChange={(e) => setEditPaperForm((p) => ({ ...p, file: e.target.files[0] || null }))} />
                                </label>
                              </td>
                              <td className="table-actions">
                                <button className="table-btn edit" onClick={handleEditPaperSave}>Save</button>
                                <button className="table-btn delete" onClick={() => setEditingPaperId(null)}>Cancel</button>
                              </td>
                            </>
                          ) : (
                            <>
                              <td>{paper.class_name}</td>
                              <td>{paper.subject}</td>
                              <td>{paper.title}</td>
                              <td>{paper.year}</td>
                              <td>{paper.exam_type}</td>
                              <td>
                                {paper.file ? (
                                  <button
                                    type="button"
                                    className="table-btn view"
                                    onClick={async () => {
                                      try {
                                        await openProtectedFile(paper.file, `${paper.title || 'paper'}.pdf`);
                                      } catch (e) {
                                        showToast(e.message || 'Unable to open PDF', 'error');
                                      }
                                    }}
                                  >
                                    View PDF
                                  </button>
                                ) : '—'}
                              </td>
                              <td className="table-actions">
                                <button className="table-btn edit"
                                  onClick={() => { setEditingPaperId(paper.id); setEditPaperForm({ ...paper, file: null }); }}>
                                  Edit
                                </button>
                                <button className="table-btn delete" onClick={() => handleDeletePaper(paper.id)}>
                                  Delete
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                      {filteredPapers.length === 0 && (
                        <tr><td colSpan="7" className="empty-row">No papers found.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}

          {activeModule === 'queries' && (
            <section className="module-section">
              <h2 className="module-title">Pending Student Queries</h2>
              <div className="module-filters">
                <button className="primary-btn" onClick={fetchQueries}>Refresh</button>
              </div>
              <div className="module-table-wrapper">
                {queriesLoading ? <p className="loading-text">Loading…</p> : (
                  <table className="module-table">
                    <thead>
                      <tr><th>Student</th><th>Class</th><th>Question</th><th>Crawler Result</th><th>Response</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                      {queriesList.map((q) => (
                        <tr key={q.id}>
                          <td>{q.student_name}<br /><small>{q.student_email}</small></td>
                          <td>{q.class_name || '—'}</td>
                          <td>{q.question}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                              <div style={{ fontSize: '0.8rem', color: '#475569', whiteSpace: 'pre-wrap' }}>
                                {q.spider_result || 'No crawler result yet.'}
                              </div>
                              <button
                                type="button"
                                className="table-btn view"
                                onClick={() => handleRunCrawler(q.id)}
                                disabled={!!queryCrawlLoading[q.id]}
                              >
                                {queryCrawlLoading[q.id] ? 'Running...' : 'Run Crawler'}
                              </button>
                            </div>
                          </td>
                          <td>
                            <textarea
                              className="form-input"
                              rows={3}
                              value={resolveAnswer[q.id] || ''}
                              onChange={(e) => setResolveAnswer((p) => ({ ...p, [q.id]: e.target.value }))}
                              placeholder="Write verified answer..."
                            />
                          </td>
                          <td className="table-actions">
                            <button className="table-btn edit" onClick={() => handleResolveQuery(q.id)}>
                              Resolve
                            </button>
                          </td>
                        </tr>
                      ))}
                      {queriesList.length === 0 && (
                        <tr><td colSpan="6" className="empty-row">No pending queries.</td></tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
      </div>
      </div>

      {/* Class Modal */}
      {classModalOpen && (
        <div className="modal-overlay" onClick={() => setClassModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Select Class</h3>
            <p>Choose which class to manage for <strong>
              {selectedModuleForClass === 'notes' ? 'Notes' : 'Past Papers'}
            </strong>.</p>
            <div className="modal-buttons">
              {CLASSES.map((c) => (
                <button key={c} className="secondary-btn" onClick={() => handleClassSelect(c)}>
                  {c} Class
                </button>
              ))}
            </div>
            <button className="modal-close" onClick={() => setClassModalOpen(false)}>✕</button>
          </div>
        </div>
      )}

      {/* Password Modal */}
      {passwordModalOpen && (
        <div className="modal-overlay" onClick={() => setPasswordModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Reset Password</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              if (passwordForm.newPassword !== passwordForm.confirmPassword)
                return alert('Passwords do not match.');
              alert('Password reset is handled by the backend — integrate your API here.');
              setPasswordModalOpen(false);
            }}>
              <div className="form-row" style={{ marginBottom: '0.6rem' }}>
                <input type="password" className="form-input" placeholder="New password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))} />
              </div>
              <div className="form-row" style={{ marginBottom: '0.8rem' }}>
                <input type="password" className="form-input" placeholder="Confirm new password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))} />
              </div>
              <div className="modal-buttons">
                <button type="submit" className="primary-btn">Update Password</button>
                <button type="button" className="secondary-btn" onClick={() => setPasswordModalOpen(false)}>Cancel</button>
              </div>
            </form>
            <button className="modal-close" onClick={() => setPasswordModalOpen(false)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;