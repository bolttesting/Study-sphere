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
    avatarSrc: 'https://randomuser.me/api/portraits/women/45.jpg',
    name: 'Hira Malik',
    handle: '@boardprep',
    text: 'Signing up was quick and the guided dashboard made planning easier.',
  },
  {
    avatarSrc: 'https://randomuser.me/api/portraits/men/22.jpg',
    name: 'Usman Javed',
    handle: '@dailyrevision',
    text: 'I instantly got subject-wise material and AI guidance in one place.',
  },
];

const SignupForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', role: '', class: '',
    email: '', password: '', confirmPassword: '',
  });
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [errors, setErrors]               = useState({});
  const [loading, setLoading]             = useState(false);
  const [serverError, setServerError]     = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({
      ...p,
      [name]: value,
      ...(name === 'role' && value === 'Admin' ? { class: '' } : {}),
    }));
    if (errors[name]) setErrors((p) => ({ ...p, [name]: '' }));
    setServerError('');
  };

  // require lowercase, uppercase, digit and at least one special character; no spaces
  const validatePassword = (pwd) =>
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d\s])(?!.*\s)[^\s]{6,}$/.test(pwd);
  const validate = () => {
    const e = {};
    if (!formData.firstName.trim()) e.firstName = 'First name is required';
    if (!formData.lastName.trim())  e.lastName  = 'Last name is required';
    if (!formData.role)             e.role      = 'Role must be selected';
    if (formData.role === 'Student' && !formData.class) e.class = 'Class is required for students';
    if (!formData.email.trim())           e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) e.email = 'Invalid email format';
    if (!formData.password)               e.password = 'Password is required';
    else if (!validatePassword(formData.password))
      e.password = 'Min 6 chars with upper/lowercase, number & special character';
    if (!formData.confirmPassword)        e.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword)
      e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      const data = await authApi.signup({
        firstName: formData.firstName,
        lastName:  formData.lastName,
        email:     formData.email,
        role:      formData.role,
        class_name: formData.class,
        password:  formData.password,
      });
      authStorage.save(data);
      data.user.role === 'Admin' ? navigate('/admin-dashboard') : navigate('/student-dashboard');
    } catch (error) {
      const backendErrors = error.data;
      if (backendErrors && typeof backendErrors === 'object') {
        setServerError(Object.values(backendErrors).flat().join(' '));
      } else {
        setServerError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <section className="auth-form-panel">
        <div className="auth-form-inner">
          <h1 className="auth-title">Create account</h1>
          <p className="auth-description">Join StudySphere and start your structured Matric preparation journey.</p>

          {serverError && <p className="server-error">{serverError}</p>}

          <form onSubmit={handleSubmit} className="auth-modern-form">
            <div className="split-fields">
              <div className="field-wrap">
                <label>First Name</label>
                <div className="glass-field">
                  <input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="John" />
                </div>
                {errors.firstName && <span className="error-message">{errors.firstName}</span>}
              </div>
              <div className="field-wrap">
                <label>Last Name</label>
                <div className="glass-field">
                  <input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Doe" />
                </div>
                {errors.lastName && <span className="error-message">{errors.lastName}</span>}
              </div>
            </div>

            <div className="field-wrap">
              <label>Role</label>
              <div className="glass-field">
                <select name="role" value={formData.role} onChange={handleChange}>
                  <option value="">Select role</option>
                  <option value="Student">Student</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
              {errors.role && <span className="error-message">{errors.role}</span>}
            </div>

            {formData.role === 'Student' && (
              <div className="field-wrap">
                <label>Class</label>
                <div className="glass-field">
                  <select name="class" value={formData.class} onChange={handleChange}>
                    <option value="">Select class</option>
                    <option value="9th">9th</option>
                    <option value="10th">10th</option>
                  </select>
                </div>
                {errors.class && <span className="error-message">{errors.class}</span>}
              </div>
            )}

            <div className="field-wrap">
              <label>Email Address</label>
              <div className="glass-field">
                <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="you@example.com" />
              </div>
              {errors.email && <span className="error-message">{errors.email}</span>}
            </div>

            <div className="split-fields">
              <div className="field-wrap">
                <label>Password</label>
                <div className="glass-field has-icon">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter password"
                  />
                  <button type="button" className="icon-btn" onClick={() => setShowPassword((p) => !p)}>
                    <EyeIcon closed={showPassword} />
                  </button>
                </div>
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>

              <div className="field-wrap">
                <label>Confirm Password</label>
                <div className="glass-field has-icon">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm password"
                  />
                  <button type="button" className="icon-btn" onClick={() => setShowConfirm((p) => !p)}>
                    <EyeIcon closed={showConfirm} />
                  </button>
                </div>
                {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
              </div>
            </div>

            <button type="submit" className="primary-submit" disabled={loading}>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="divider"><span>Or continue with</span></div>

          <button type="button" className="social-btn">
            <GoogleIcon />
            Continue with Google
          </button>

          <p className="switch-copy">
            Already have an account? <Link to="/login">Sign In</Link>
          </p>
        </div>
      </section>

      <section className="auth-visual-panel">
        <div
          className="auth-visual-bg"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1523580846011-d3a5bc25702b?w=1600&q=80)' }}
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

export default SignupForm;