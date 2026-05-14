import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signup, user, authChecked } = useAuth();
  const navigate = useNavigate();
  // toast is called inside signup() in useAuth

  useEffect(() => {
    if (user && authChecked) navigate('/dashboard', { replace: true });
  }, [user, authChecked, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!name || !email || !password || !confirmPassword) {
      // useAuth shows toast — but we can do a basic client check too
      return;
    }
    if (password !== confirmPassword) {
      // We import toast here just for this local validation
      const { default: toast } = await import('react-hot-toast');
      toast.error('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      const { default: toast } = await import('react-hot-toast');
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const ok = await signup(name, email, password);
    setLoading(false);
    if (ok) navigate('/login');
  };

  if (!authChecked) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent ">SmartHire AI</h1>
          <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
          <p className="text-gray-600 mt-2">Join SmartHire AI today</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {[
            { label: 'Full Name', val: name, set: setName, type: 'text', ph: 'Your Name', ac: 'name' },
            { label: 'Email Address', val: email, set: setEmail, type: 'email', ph: 'you@example.com', ac: 'email' },
            { label: 'Password', val: password, set: setPassword, type: 'password', ph: '•••••••• (min. 6)', ac: 'new-password' },
            { label: 'Confirm Password', val: confirmPassword, set: setConfirmPassword, type: 'password', ph: '••••••••', ac: 'new-password' },
          ].map(({ label, val, set, type, ph, ac }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
              <input
                type={type}
                value={val}
                onChange={(e) => set(e.target.value)}
                className="input-field"
                placeholder={ph}
                required
                disabled={loading}
                autoComplete={ac}
              />
            </div>
          ))}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Creating account...
              </span>
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        <p className="text-center mt-6 text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-medium">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;