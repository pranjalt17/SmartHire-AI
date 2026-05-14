import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { resumeAPI } from '../../services/api';
import { FiLogOut, FiUser, FiFileText, FiBriefcase, FiHome, FiLoader, FiUpload, FiTrendingUp } from 'react-icons/fi';

const Layout = ({ children }) => {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [defaultResumeId, setDefaultResumeId] = useState(null);
  const [loadingResume, setLoadingResume] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadDefaultResume();
    }
  }, [user]);

  const loadDefaultResume = async () => {
    setLoadingResume(true);
    try {
      const resumes = await resumeAPI.getAll(user.id);
      const analyzedResume = resumes.find(r => r.has_analysis);
      if (analyzedResume) {
        setDefaultResumeId(analyzedResume.id);
      }
    } catch (err) {
      console.error('Error loading resume:', err);
    } finally {
      setLoadingResume(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading || loadingResume) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FiLoader className="animate-spin text-primary-600 text-4xl mx-auto" />
          <p className="mt-4 text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  const navLinks = [
    { to: '/dashboard', icon: FiHome, label: 'Dashboard', state: null },
    { to: '/upload', icon: FiUpload, label: 'Upload', state: null },
    { to: '/analysis', icon: FiFileText, label: 'Analysis', state: null },
    { to: '/jobs', icon: FiBriefcase, label: 'Jobs', state: defaultResumeId ? { resumeId: defaultResumeId } : null },
    { to: '/optimize', icon: FiTrendingUp, label: 'Optimize', state: defaultResumeId ? { resumeId: defaultResumeId, showList: true } : null },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo + nav links */}
            <div className="flex items-center space-x-6">
              <Link to="/dashboard" className="flex items-center">
                <span className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
                  SmartHire AI
                </span>
              </Link>

              <div className="hidden md:flex items-center space-x-1">
                {navLinks.map(({ to, icon: Icon, label, state }) => (
                  <Link
                    key={to}
                    to={to}
                    state={state}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === to
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:text-primary-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* User info + logout */}
            {user && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2 pl-4 border-l border-gray-200">
                  <FiUser className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 font-medium">
                    {user.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center space-x-1 text-red-600 hover:text-red-700 transition-colors text-sm"
                >
                  <FiLogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;