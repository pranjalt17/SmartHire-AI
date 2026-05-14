import { useState, useEffect } from 'react';
import { authAPI } from '../services/api';
import { authStorage } from '../utils/storage';
import toast from 'react-hot-toast';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  // On mount: restore session from localStorage
  useEffect(() => {
    const saved = authStorage.load();
    if (saved) {
      setUser(saved); // { id, email }
    }
    setLoading(false);
    setAuthChecked(true);
  }, []);

  const signup = async (name, email, password) => {
    try {
      const data = await authAPI.signup(name, email, password);
      toast.success('Account created! Please sign in.');
      return true;
    } catch (err) {
      toast.error(err.message || 'Signup failed');
      return false;
    }
  };

  const login = async (email, password) => {
    try {
      const data = await authAPI.login(email, password);

      if (!data.user_id) throw new Error('No user ID returned from server');

      const userData = { id: data.user_id, email };
      authStorage.save(data.user_id, email);
      setUser(userData);

      toast.success('Welcome back!');
      return true;
    } catch (err) {
      toast.error(err.message || 'Login failed');
      return false;
    }
  };

  const logout = () => {
    authStorage.clear();
    setUser(null);
    toast.success('Logged out');
  };

  return {
    user,
    loading,
    authChecked,
    signup,
    login,
    logout,
    isAuthenticated: !!user,
  };
};