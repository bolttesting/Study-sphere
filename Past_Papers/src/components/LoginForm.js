import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { auth as authApi } from '../services/api';
import { authStorage } from '../services/auth';
import './AuthForm.css';

const EyeIcon = ({ closed = false }) => (
  <svg viewBox="0 0 24 24" className="eye-icon" aria-hidden="true">
    {closed ? (
      <>
        <path d="M3 3l18 18" />
        <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
        <path d="M9.88 5.09A10.94 10.94 0 0112 5c5.05 0 9.27 3.11 10 7-0.3 1.6-1.26 3.06-2.67 4.2" />
        <path d="M6.61 6.61C4.78 7.76 3.43 9.56 3 12c0.73 3.89 4.95 7 10 7 1.47 0 2.87-0.26 4.12-0.73" />
      </>
    ) : (
      <>
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="google-icon" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z" />
  </svg>
);

const testimonials = [
  {
    avatarSrc: 'https://randomuser.me/api/portraits/women/57.jpg',
    name: 'Sarah Khan',
    handle: '@matrictopper',
    text: 'The AI explanations and paper practice saved me hours every week.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/men/64.jpg',
    name: 'Ali Raza',
    handle: '@smartstudy',
    text: 'Everything is in one place now. No more jumping between apps.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/women/33.jpg',
    name: 'Maham Tariq',
    handle: '@futuremedic',
    text: 'I improved my preparation consistency with daily guided workflow.',
  },
];

const LoginForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setServerError('');
  };

  const validate = () => {
    const e = {};
    if (!formData.email.trim())    e.email    = 'Email is required';
    if (!formData.password.trim()) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      const data = await authApi.login({ email: formData.email, password: formData.password });
      authStorage.save(data);
      data.user.role === 'Admin' ? navigate('/admin-dashboard') : navigate('/student-dashboard');
    } catch (error) {
      setServerError(error.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-form-panel">
        <div className="auth-form-inner">
          <h1 className="auth-title">Welcome back</h1>
          <p className="auth-description">Access your account and continue your Matric journey with StudySphere.</p>

          <form onSubmit={handleSubmit} className="auth-modern-form">
            <div className="field-wrap">
              <label>Email Address</label>
              <div className="glass-field">
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email address"
                />
              </div>
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            <div className="field-wrap">
              <label>Password</label>
              <div className="glass-field has-icon">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                />
                <button type="button" className="icon-btn" onClick={() => setShowPassword((p) => !p)}>
                  <EyeIcon closed={showPassword} />
                </button>
              </div>
              {errors.password && <span className="error-message">{errors.password}</span>}
            </div>

            <div className="auth-row">
              <label className="remember-wrap">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                <span>Keep me signed in</span>
              </label>
              <button type="button" className="link-btn">Reset password</button>
            </div>

            {serverError && <p className="server-error">{serverError}</p>}

            <button type="submit" className="primary-submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="divider"><span>Or continue with</span></div>

          <button type="button" className="social-btn">
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="switch-copy">
            New to our platform? <Link to="/signup">Create Account</Link>
          </p>
        </div>
      </section>

      <section className="auth-visual-panel">
        <div
          className="auth-visual-bg"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1642615835477-d303d7dc9ee9?w=2160&q=80)' }}
        />
        <div className="auth-visual-overlay">
          <div className="visual-top-link">
            <Link to="/">Back to website →</Link>
          </div>
          <div className="testimonial-row">
            {testimonials.map((t) => (
              <article className="testimonial-card" key={t.handle}>
                <img src={t.avatarSrc} alt={t.name} />
                <div>
                  <p className="testimonial-name">{t.name}</p>
                  <p className="testimonial-handle">{t.handle}</p>
                  <p className="testimonial-text">{t.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default LoginForm;