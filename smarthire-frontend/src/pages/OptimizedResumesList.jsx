import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { analysisAPI, resumeAPI } from '../services/api';
import toast from 'react-hot-toast';
import { 
  FiFile, FiLoader, FiDownload, FiTrash2, 
  FiClock, FiTrendingUp, FiEye 
} from 'react-icons/fi';

const OptimizedResumesList = ({ resumeId, onSelectOptimized }) => {
  const { user } = useAuth();
  const [optimizedResumes, setOptimizedResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);

  const loadOptimizedResumes = async () => {
    if (!resumeId || !user?.id) return;
    
    setLoading(true);
    try {
      const data = await analysisAPI.getOptimizedResumesForResume(resumeId, user.id);
      setOptimizedResumes(data);
    } catch (err) {
      console.error('Failed to load optimized resumes:', err);
      toast.error('Failed to load saved resumes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOptimizedResumes();
  }, [resumeId]);

  const handleView = async (optimized) => {
    try {
      const data = await analysisAPI.getOptimizedResumeById(optimized.id, user.id);
      if (onSelectOptimized) {
        onSelectOptimized({
          optimized_text: data.optimized_text,
          ats_score: data.ats_score,
          job_title: data.job_title,
          job_company: data.job_company,
          optimized_resume_id: data.id
        });
      }
      toast.success('Loaded saved resume');
    } catch (err) {
      console.error('Failed to load optimized resume:', err);
      toast.error('Failed to load resume');
    }
  };

  const handleDownload = async (optimized) => {
    setDownloading(optimized.id);
    try {
      // Get the full optimized resume
      const data = await analysisAPI.getOptimizedResumeById(optimized.id, user.id);
      
      // Download as text
      const blob = new Blob([data.optimized_text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `optimized_resume_${optimized.job_title.replace(/\s+/g, '_')}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('Resume downloaded!');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download');
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (optimized) => {
    if (!confirm('Delete this optimized resume?')) return;
    
    try {
      await analysisAPI.deleteOptimizedResume(optimized.id, user.id);
      toast.success('Deleted successfully');
      loadOptimizedResumes(); // Refresh list
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <FiLoader className="animate-spin h-6 w-6 text-primary-600 mx-auto" />
        <p className="text-sm text-gray-500 mt-2">Loading saved resumes...</p>
      </div>
    );
  }

  if (optimizedResumes.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        No saved optimized resumes yet. Optimize a resume to save it here.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Saved Optimized Resumes</h3>
      {optimizedResumes.map((opt) => (
        <div key={opt.id} className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <FiFile className="text-primary-600 h-4 w-4" />
                <span className="font-medium text-gray-900 text-sm">{opt.job_title}</span>
                {opt.job_company && (
                  <span className="text-gray-500 text-xs">at {opt.job_company}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <FiTrendingUp className="h-3 w-3" />
                  ATS: {opt.ats_score}%
                </span>
                <span className="flex items-center gap-1">
                  <FiClock className="h-3 w-3" />
                  {formatDate(opt.created_at)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                {opt.optimized_text_preview}
              </p>
            </div>
            <div className="flex gap-2 ml-3">
              <button
                onClick={() => handleView(opt)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Load this version"
              >
                <FiEye className="h-4 w-4" />
              </button>
              <button
                onClick={() => handleDownload(opt)}
                disabled={downloading === opt.id}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors"
                title="Download"
              >
                {downloading === opt.id ? (
                  <FiLoader className="animate-spin h-4 w-4" />
                ) : (
                  <FiDownload className="h-4 w-4" />
                )}
              </button>
              <button
                onClick={() => handleDelete(opt)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <FiTrash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OptimizedResumesList;