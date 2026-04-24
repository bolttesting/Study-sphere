import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import './landing.css';

const NAV_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'subjects', label: 'Subjects' },
  { id: 'resources', label: 'Resources' },
  { id: 'contact', label: 'Contact' },
];

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);
    setMatches(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export default function LandingPage() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');

  const handleAnchorClick = (event, id, closeMenu = false) => {
    event.preventDefault();
    const section = document.getElementById(id);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    }
    if (closeMenu) setMenuOpen(false);
  };

  useEffect(() => {
    const sectionIds = NAV_ITEMS.map((item) => item.id);
    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visibleEntries.length) {
          setActiveSection(visibleEntries[0].target.id);
        }
      },
      { root: null, rootMargin: '-25% 0px -55% 0px', threshold: [0.2, 0.4, 0.65] }
    );

    sectionIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <section className="hero-financial" id="home">
      <div className="hero-bg-image" />
      <div className="hero-soft-gradient" />

      <svg
        width="358"
        height="483"
        viewBox="0 0 358 483"
        className="hero-left-svg"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g filter="url(#filter0_f_0_1)">
          <rect
            x="-86.9961"
            y="-33.114"
            width="72"
            height="541"
            rx="36"
            transform="rotate(-30.8182 -86.9961 -33.114)"
            fill="url(#paint0_linear_0_1)"
          />
        </g>
        <g filter="url(#filter1_f_0_1)">
          <rect
            x="-17"
            y="-135.113"
            width="50.0937"
            height="541"
            rx="25.0469"
            transform="rotate(-30.8182 -17 -135.113)"
            fill="url(#paint1_linear_0_1)"
          />
        </g>
        <defs>
          <filter
            id="filter0_f_0_1"
            x="-137.641"
            y="-120.646"
            width="440.285"
            height="602.787"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feGaussianBlur stdDeviation="32" result="effect1_foregroundBlur_0_1" />
          </filter>
          <filter
            id="filter1_f_0_1"
            x="-71.707"
            y="-215.486"
            width="429.598"
            height="599.69"
            filterUnits="userSpaceOnUse"
            colorInterpolationFilters="sRGB"
          >
            <feFlood floodOpacity="0" result="BackgroundImageFix" />
            <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
            <feGaussianBlur stdDeviation="32" result="effect1_foregroundBlur_0_1" />
          </filter>
          <linearGradient id="paint0_linear_0_1" x1="-50.9961" y1="-33.114" x2="-50.9961" y2="507.886" gradientUnits="userSpaceOnUse">
            <stop stopColor="#91bbfb" />
            <stop offset="1" stopColor="#E6F1FF" />
          </linearGradient>
          <linearGradient id="paint1_linear_0_1" x1="8.04686" y1="-135.113" x2="8.04686" y2="405.887" gradientUnits="userSpaceOnUse">
            <stop stopColor="#8dbafd" />
            <stop offset="1" stopColor="#c1d9f8" />
          </linearGradient>
        </defs>
      </svg>

      {isMobile ? (
        <div className="hero-mobile-topbar">
          <button className="mobile-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu">
            ☰
          </button>
          <Link to="/signup" className="hero-cta-dark">Get Started →</Link>
        </div>
      ) : (
        <header className="hero-header">
          <div className="hero-brand">
            <span className="hero-brand-logo">▦</span>
            <span>StudySphere</span>
          </div>
          <nav className="hero-nav">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={activeSection === item.id ? 'active' : ''}
                onClick={(event) => handleAnchorClick(event, item.id)}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <Link to="/signup" className="hero-cta-dark">Get Started →</Link>
        </header>
      )}

      {menuOpen && (
        <div className="mobile-overlay" onClick={() => setMenuOpen(false)}>
          <aside className="mobile-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close menu">✕</button>
            <div className="hero-brand mobile-brand">
              <span className="hero-brand-logo">▦</span>
              <span>StudySphere</span>
            </div>
            {NAV_ITEMS.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={activeSection === item.id ? 'active' : ''}
                onClick={(event) => handleAnchorClick(event, item.id, true)}
              >
                {item.label}
              </a>
            ))}
          </aside>
        </div>
      )}

      <div className="hero-content">
        <div className="hero-pill">
          <span className="hero-pill-new">New</span>
          <span>Now supporting smarter Matric exam preparation</span>
        </div>

        <h1>
          Make your Matric
          <br />
          preparation seamless.
        </h1>

        <p>
          StudySphere combines an AI chatbot, past papers, guess paper generation, and curated videos
          in one focused platform to help students learn faster and score better.
        </p>

        <div className="hero-content-actions">
          <Link to="/signup" className="hero-btn-primary">Start Free</Link>
          <Link to="/login" className="hero-btn-secondary">Student Login</Link>
        </div>
      </div>

      <div className="hero-dashboard-wrap">
        <div className="hero-dashboard">
          <div className="dashboard-top">
            <div className="dash-brand">StudySphere Dashboard</div>
            <div className="dash-search">Search chapters, papers, videos...</div>
            <div className="dash-user">Ayesha • Student</div>
          </div>
          <div className="dashboard-grid">
            <div className="tile t1">
              <span className="tile-title">AI Chatbot Guidance</span>
              <div className="tile-meta-row">
                <strong>124</strong>
                <small>questions answered today</small>
              </div>
              <div className="tile-progress">
                <div style={{ width: '88%' }} />
              </div>
            </div>
            <div className="tile t2">
              <span className="tile-title">Past Papers</span>
              <div className="tile-meta-row">
                <strong>320</strong>
                <small>papers available</small>
              </div>
              <p className="tile-note">Latest: Physics 2024 solved paper</p>
            </div>
            <div className="tile t3">
              <span className="tile-title">Guess Papers</span>
              <div className="tile-meta-row">
                <strong>18</strong>
                <small>generated this week</small>
              </div>
              <p className="tile-note">High trend: Chemistry Ch-6</p>
            </div>
            <div className="tile t4">
              <span className="tile-title">Video Library</span>
              <div className="tile-meta-row">
                <strong>92h</strong>
                <small>curated learning content</small>
              </div>
              <p className="tile-note">Top watched: Trigonometry Masterclass</p>
            </div>
            <div className="tile t5">
              <span className="tile-title">Query Escalation</span>
              <div className="tile-meta-row">
                <strong>7</strong>
                <small>pending admin reviews</small>
              </div>
              <p className="tile-note">Avg resolution time: 3.4h</p>
            </div>
            <div className="tile t6">
              <span className="tile-title">Admin + Student Dashboards</span>
              <div className="tile-dual">
                <div>
                  <strong>1,248</strong>
                  <small>active students</small>
                </div>
                <div>
                  <strong>14</strong>
                  <small>active admins</small>
                </div>
              </div>
            </div>
          </div>
          <div className="dash-bottom">
            <div className="dash-list">
              <h4>Today&apos;s Focus</h4>
              <ul>
                <li>Physics Chapter 4 revision</li>
                <li>Math algebra quiz (18/20)</li>
                <li>English grammar video notes</li>
              </ul>
              <div className="mini-line-chart" aria-label="weekly progress chart">
                <span style={{ height: '35%' }} />
                <span style={{ height: '48%' }} />
                <span style={{ height: '42%' }} />
                <span style={{ height: '60%' }} />
                <span style={{ height: '56%' }} />
                <span style={{ height: '72%' }} />
                <span style={{ height: '84%' }} />
              </div>
            </div>
            <div className="dash-stats">
              <div><strong>87%</strong><span>Weekly Progress</span></div>
              <div><strong>14</strong><span>Papers Practiced</span></div>
              <div><strong>2.1s</strong><span>Avg AI Response</span></div>
              <div className="mini-donut-wrap">
                <div className="mini-donut">
                  <span>87%</span>
                </div>
                <small>Completion Rate</small>
              </div>
            </div>
            <div className="dash-feed">
              <h4>Recent Activity</h4>
              <p>Generated Chemistry Guess Paper • 10:24 AM</p>
              <p>Asked AI: “Explain trigonometric identities” • 9:48 AM</p>
              <p>Watched Biology Cell Division lecture • 8:32 AM</p>
              <div className="mini-bars" aria-label="subject performance bars">
                <div><label>Math</label><span style={{ width: '82%' }} /></div>
                <div><label>Physics</label><span style={{ width: '74%' }} /></div>
                <div><label>Chem</label><span style={{ width: '69%' }} /></div>
                <div><label>Bio</label><span style={{ width: '88%' }} /></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="bento-section" id="features">
        <div className="bento-head">
          <h2>Product Features</h2>
          <p>
            Organize, prioritize and control your Matric preparation with one unified academic platform.
          </p>
        </div>

        <div className="bento-grid">
          <article className="bento-card bento-integration">
            <div className="bento-icon">✳️</div>
            <h3>AI Tutor Integration</h3>
            <p>
              Ask syllabus-specific questions, get context-aware answers, and continue your learning flow
              without switching apps.
            </p>
            <div className="bento-row">
              <button type="button">Configure</button>
              <span className="bento-toggle">Active</span>
            </div>
          </article>

          <article className="bento-card">
            <h3>Trackers Connected</h3>
            <p>03 active modules</p>
            <div className="bento-avatars">
              <img src="https://images.unsplash.com/photo-1491528323818-fdd1faba62cc?w=100&q=80" alt="Student 1" />
              <img src="https://images.unsplash.com/photo-1550525811-e5869dd03032?w=100&q=80" alt="Student 2" />
              <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&q=80" alt="Student 3" />
            </div>
          </article>

          <article className="bento-card bento-stat">
            <span>10X</span>
            <small>Faster prep workflow</small>
          </article>

          <article className="bento-card">
            <div className="bento-badge">Range Ratio</div>
            <h3>Focus Analytics</h3>
            <strong>42%</strong>
            <p>Maximum focus this month</p>
          </article>

          <article className="bento-card">
            <h3>Team Productivity</h3>
            <p>
              Improve student consistency with structured assignments, AI-guided revision and targeted paper
              practice.
            </p>
          </article>

          <article className="bento-card bento-shortcuts">
            <div>
              <h3>Shortcut Keys</h3>
              <p>Faster access to key actions</p>
            </div>
            <div className="bento-keys">
              <kbd>Ctrl</kbd>
              <span>+</span>
              <kbd>M</kbd>
            </div>
          </article>
        </div>
      </section>

      <section className="nature-section" id="resources">
        <div className="nature-head">
          <p className="nature-kicker">Why StudySphere Works</p>
          <h2>Learning flow designed to grow confidence naturally</h2>
          <p>
            A calm, structured experience that guides students from confusion to exam readiness using
            AI support, guided resources, and measurable progress.
          </p>
        </div>

        <div className="nature-grid">
          <article className="nature-card nature-card-main">
            <span className="nature-chip">Personalized Growth Path</span>
            <h3>Adaptive academic roadmap for every student</h3>
            <p>
              StudySphere recommends what to learn next based on weak topics, practice patterns, and
              recent performance.
            </p>
            <div className="nature-steps">
              <div>
                <strong>Diagnose</strong>
                <small>Identify weak chapters instantly</small>
              </div>
              <div>
                <strong>Practice</strong>
                <small>Generate target-based papers</small>
              </div>
              <div>
                <strong>Improve</strong>
                <small>Track results week by week</small>
              </div>
            </div>
          </article>

          <article className="nature-card">
            <h3>Focused AI Guidance</h3>
            <p>Ask any Matric question and get clear, context-aware support in seconds.</p>
            <div className="nature-mini-meter">
              <span style={{ width: '92%' }} />
            </div>
            <small>Answer relevance score: 92%</small>
          </article>

          <article className="nature-card">
            <h3>Smart Resource Mix</h3>
            <p>Past papers, guess papers, and video lessons work together in one workflow.</p>
            <ul>
              <li>Paper-first revision mode</li>
              <li>Video explainers by topic</li>
              <li>Admin verified escalations</li>
            </ul>
          </article>

          <article className="nature-card nature-card-highlight">
            <h3>Built For Matric Outcomes</h3>
            <p>From daily practice to final preparation, each feature supports exam performance.</p>
            <div className="nature-pill-row">
              <span>Class 9</span>
              <span>Class 10</span>
              <span>Board Prep</span>
            </div>
          </article>
        </div>
      </section>

      <section className="subjects-section" id="subjects">
        <div className="subjects-head">
          <h2>Core Matric Subjects</h2>
          <p>Everything organized by subject so students can revise with clarity and confidence.</p>
        </div>
        <div className="subjects-grid">
          <article className="subject-card">
            <h3>Mathematics</h3>
            <p>Concept breakdowns, solved examples, and targeted practice sets.</p>
            <span>120+ resources</span>
          </article>
          <article className="subject-card">
            <h3>Physics</h3>
            <p>Numerical practice, chapter summaries, and exam-style questions.</p>
            <span>95+ resources</span>
          </article>
          <article className="subject-card">
            <h3>Chemistry</h3>
            <p>Reaction concepts, MCQ drills, and quick revision notes.</p>
            <span>100+ resources</span>
          </article>
          <article className="subject-card">
            <h3>Biology</h3>
            <p>Diagram-friendly learning flow with topic-wise past paper practice.</p>
            <span>88+ resources</span>
          </article>
        </div>
      </section>

      <section className="contact-section" id="contact">
        <div className="contact-card">
          <h2>Let&apos;s build better exam outcomes</h2>
          <p>
            Need help onboarding your school or coaching center? Reach out and we&apos;ll help you set up
            StudySphere quickly.
          </p>
          <div className="contact-actions">
            <a href="mailto:hello@studysphere.edu">hello@studysphere.edu</a>
            <a href="tel:+920001234567">+92 000 1234567</a>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="footer-brand">
          <span className="hero-brand-logo">▦</span>
          <div>
            <strong>StudySphere</strong>
            <small>AI-powered Matric learning platform</small>
          </div>
        </div>
        <nav className="footer-links">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={activeSection === item.id ? 'active' : ''}
              onClick={(event) => handleAnchorClick(event, item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <p className="footer-copy">© {new Date().getFullYear()} StudySphere. All rights reserved.</p>
      </footer>
    </section>
  );
}
