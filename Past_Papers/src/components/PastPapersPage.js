// src/components/PastPapersPage.js  ── STEP 2: Class-scoped papers
import React, { useState, useEffect } from 'react';
import './pastpapers.css';
import { pastPapers as papersApi, paperGen, openProtectedFile } from '../services/api';
import { authStorage } from '../services/auth';

const SUBJECTS = [
  'Chemistry', 'Biology', 'Computer', 'Maths', 'English',
  'Urdu', 'Islamiat', 'Pakistan Studies', 'Physics',
];

const DIFFICULTY_OPTIONS = [
  { value: 'easy',   label: 'Easy'   },
  { value: 'medium', label: 'Medium' },
  { value: 'hard',   label: 'Hard'   },
];

const PastPapersPage = () => {
  // ── Pull user info from JWT ──────────────────────────────────────────────────
  const currentUser = authStorage.getUser() || {};
  const isAdmin     = currentUser.role === 'Admin';
  const userClass   = currentUser.class_name || '9th';   // student's fixed class

  // Admin can switch which class they're viewing; students are locked to their own
  const [viewingClass, setViewingClass] = useState(isAdmin ? '9th' : userClass);

  const [allPapers, setAllPapers]         = useState([]);
  const [loading, setLoading]             = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [selectedPaper, setSelectedPaper]     = useState(null);

  // Paper generation state
  const [difficulty, setDifficulty]       = useState('medium');
  const [numQuestions, setNumQuestions]   = useState(10);
  const [generating, setGenerating]       = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [generatedPaper, setGeneratedPaper] = useState(null);
  const [genError, setGenError]           = useState(null);

  // ── Fetch papers whenever viewingClass changes ───────────────────────────────
  useEffect(() => {
    fetchPapers();
    // reset selection when class changes
    setSelectedSubject(null);
    setSelectedPaper(null);
    setGeneratedPaper(null);
  }, [viewingClass]);  // eslint-disable-line react-hooks/exhaustive-deps

  const fetchPapers = async () => {
    setLoading(true);
    try {
      // Students: backend already filters by their class automatically (JWT-based)
      // Admins: we pass class_name as a query param for the selected class view
      const params = isAdmin ? { class_name: viewingClass } : {};
      const data = await papersApi.list(params);
      setAllPapers(data);
    } catch (e) {
      console.error('Failed to fetch papers:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubjectClick = (subject) => {
    setSelectedSubject(subject);
    setSelectedPaper(null);
    setGeneratedPaper(null);
    setGenError(null);
  };

  const handlePaperSelect = (paper) => {
    setSelectedPaper(paper);
    setGeneratedPaper(null);
    setGenError(null);
  };

  const handleGenerate = async () => {
    if (!selectedPaper) return;
    setGenerating(true);
    setGeneratedPaper(null);
    setGenError(null);
    try {
      const result = await paperGen.generate({
        past_paper_id: selectedPaper.id,
        difficulty,
        num_questions: numQuestions,
      });
      setGeneratedPaper(result);
    } catch (e) {
      setGenError(e.message || 'Paper generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  // Papers for the selected subject (already class-filtered from API)
  const subjectPapers = selectedSubject
    ? allPapers.filter((p) => p.subject === selectedSubject)
    : [];

  // Subject counts for the badge (from already-filtered list)
  const subjectCount = (subject) => allPapers.filter((p) => p.subject === subject).length;

  return (
    <div className="pastpapers-page">
      <div className="pastpapers-container">

        {/* ── Header ── */}
        <header className="pastpapers-header">
          <div>
            <h1>Past Papers</h1>
            <p>
              {isAdmin
                ? `Admin view — browsing ${viewingClass} Class papers`
                : `Showing papers for Class ${userClass}`}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>

            {/* Class switcher — Admin only */}
            {isAdmin && (
              <div className="class-switcher">
                <button
                  className={`class-tab ${viewingClass === '9th' ? 'active' : ''}`}
                  onClick={() => setViewingClass('9th')}
                >
                  9th Class
                </button>
                <button
                  className={`class-tab ${viewingClass === '10th' ? 'active' : ''}`}
                  onClick={() => setViewingClass('10th')}
                >
                  10th Class
                </button>
              </div>
            )}

            {/* Student class badge */}
            {!isAdmin && (
              <span className="class-badge">
                Class {userClass}
              </span>
            )}

            <div className="pastpapers-header-icon">
              <span className="book-icon">DOC</span>
            </div>
          </div>
        </header>

        {loading && <p className="pp-loading">Loading papers…</p>}

        <div className="pastpapers-layout">

          {/* ── Subject list ─────────────────────────────────────────────────── */}
          <section className="subjects-section">
            <h2 className="section-title">Subjects</h2>
            <div className="subjects-grid">
              {SUBJECTS.map((subject) => {
                const count = subjectCount(subject);
                return (
                  <button
                    key={subject}
                    className={`subject-card ${selectedSubject === subject ? 'active' : ''}`}
                    onClick={() => handleSubjectClick(subject)}
                  >
                    <div className="subject-icon">S</div>
                    <span className="subject-name">{subject}</span>
                    {count > 0 && <span className="subject-count">{count}</span>}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Papers list ──────────────────────────────────────────────────── */}
          <section className="papers-section">
            <h2 className="section-title">
              {selectedSubject ? `${selectedSubject} · Papers` : 'Papers'}
            </h2>

            {!selectedSubject && (
              <p className="placeholder-text">Select a subject to view its past papers.</p>
            )}

            {selectedSubject && subjectPapers.length === 0 && !loading && (
              <p className="placeholder-text">
                No papers uploaded for {selectedSubject} ({viewingClass}) yet.
              </p>
            )}

            {selectedSubject && (
              <div className="papers-list">
                {subjectPapers.map((paper, i) => (
                  <div
                    key={paper.id}
                    className={`paper-card ${selectedPaper?.id === paper.id ? 'selected' : ''}`}
                    style={{ animationDelay: `${i * 60}ms` }}
                    onClick={() => handlePaperSelect(paper)}
                  >
                    <div className="paper-info">
                      <div className="paper-year">
                        <span className="paper-year-text">{paper.year}</span>
                        <span className="paper-exam-type">{paper.exam_type}</span>
                        <span className="paper-class-tag">{paper.class_name}</span>
                      </div>
                      <p className="paper-subject">{paper.subject} · {paper.title}</p>
                    </div>
                    <div className="paper-actions">
                      {paper.file && (
                        <button
                          type="button"
                          className="btn-outline"
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await openProtectedFile(paper.file, `${paper.title || 'paper'}.pdf`);
                            } catch (err) {
                              console.error('Failed to open protected PDF:', err);
                            }
                          }}
                        >
                          View PDF
                        </button>
                      )}
                      <button
                        className="btn-primary"
                        onClick={(e) => { e.stopPropagation(); handlePaperSelect(paper); }}
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Preview + Generate ────────────────────────────────────────────── */}
          <section className="preview-section">
            <h2 className="section-title">Paper Preview &amp; Generate</h2>

            {!selectedPaper && (
              <div className="preview-placeholder">
                <p>Select a paper to preview and generate practice questions.</p>
              </div>
            )}

            {selectedPaper && (
              <>
                {/* AI Paper Generator */}
                <div className="gen-panel" style={{ marginTop: '0.75rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: '#e5e7eb' }}>
                    Generate Practice Paper
                  </h4>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <button
                        key={d.value}
                        className={difficulty === d.value ? 'btn-primary' : 'btn-outline'}
                        onClick={() => setDifficulty(d.value)}
                        style={{ fontSize: '0.75rem' }}
                      >
                        {d.label}
                      </button>
                    ))}
                    <select
                      className="pp-select"
                      value={numQuestions}
                      onChange={(e) => setNumQuestions(Number(e.target.value))}
                    >
                      {[5, 10, 15, 20, 25, 30].map((n) => (
                        <option key={n} value={n}>{n} Questions</option>
                      ))}
                    </select>
                  </div>

                  <button
                    className="btn-primary"
                    onClick={handleGenerate}
                    disabled={generating}
                    style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem' }}
                  >
                    {generating ? <span className="generating-spinner">Generating…</span> : 'Generate Paper'}
                  </button>
                </div>

                {genError && (
                  <div className="gen-error" style={{ marginTop: '0.5rem' }}>
                    <p>{genError}</p>
                  </div>
                )}

                {generatedPaper && (
                  <div className="gen-result" style={{ marginTop: '0.75rem' }}>
                    <div className="gen-result-header">
                      <h4>
                        Generated {generatedPaper.difficulty?.charAt(0).toUpperCase() + generatedPaper.difficulty?.slice(1)} Paper
                        – {generatedPaper.subject} ({generatedPaper.class_name})
                      </h4>
                      <button
                        className="copy-btn"
                        onClick={() => navigator.clipboard.writeText(generatedPaper.generated_paper)}
                      >
                        Copy
                      </button>
                      <button
                        className="copy-btn"
                        onClick={async () => {
                          try {
                            setDownloadingPdf(true);
                            const blob = await paperGen.downloadPdf({
                              past_paper_id: selectedPaper.id,
                              difficulty,
                              num_questions: numQuestions,
                            });
                            const url = window.URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `guess_paper_${selectedPaper.subject}_${selectedPaper.class_name}.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                          } catch (err) {
                            setGenError(err.message || 'Failed to download PDF.');
                          } finally {
                            setDownloadingPdf(false);
                          }
                        }}
                      >
                        {downloadingPdf ? 'Downloading PDF...' : 'Download PDF'}
                      </button>
                    </div>
                    <pre className="gen-result-text">{generatedPaper.generated_paper}</pre>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default PastPapersPage;