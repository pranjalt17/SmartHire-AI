import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { resumeAPI } from '../services/api';
import { FiUpload, FiFileText, FiBriefcase, FiTrendingUp, FiCheckCircle } from 'react-icons/fi';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadResumes();
    }
  }, [user]);

  const loadResumes = async () => {
    setLoading(true);
    try {
      const data = await resumeAPI.getAll(user.id);
      setResumes(data);
    } catch (err) {
      console.error('Failed to load resumes:', err);
    } finally {
      setLoading(false);
    }
  };

  const analyzedCount = resumes.filter((r) => r.has_analysis).length;
  const avgScore =
    analyzedCount > 0
      ? Math.round(
          resumes
            .filter((r) => r.analysis && r.analysis.ats_score)
            .reduce((sum, r) => sum + (r.analysis.ats_score || 0), 0) / analyzedCount
        )
      : 0;

  // Get the first analyzed resume ID for job matching
  const firstAnalyzedResume = resumes.find(r => r.has_analysis);
  const defaultResumeId = firstAnalyzedResume?.id;

  const features = [
    {
      title: 'Upload Resume',
      description: 'Upload your resume in PDF or DOCX format',
      icon: FiUpload,
      link: '/upload',
      color: 'bg-blue-500',
    },
    {
      title: 'AI Analysis',
      description: 'Get AI-powered resume analysis and ATS score',
      icon: FiFileText,
      link: '/analysis',
      color: 'bg-green-500',
    },
    {
      title: 'Job Matches',
      description: 'Find jobs matching your skills and experience',
      icon: FiBriefcase,
      link: '/jobs',
      state: defaultResumeId ? { resumeId: defaultResumeId } : null,
      color: 'bg-purple-500',
    },
    {
      title: 'Optimized Resumes',
      description: 'View all your previously optimized resumes',
      icon: FiTrendingUp,
      link: '/optimize',
      state: defaultResumeId ? { resumeId: defaultResumeId, showList: true } : null,
      color: 'bg-orange-500',
    },
  ];

  const handleNavigation = (feature) => {
    if (feature.state) {
      navigate(feature.link, { state: feature.state });
    } else {
      navigate(feature.link);
    }
  };

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.email?.split('@')[0]}! 👋
        </h1>
        <p className="text-gray-600 mt-2">
          Your AI-powered job search assistant is ready to help you land your dream job.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Resumes Uploaded</p>
              <p className="text-3xl font-bold text-gray-900">{resumes.length}</p>
            </div>
            <FiFileText className="w-10 h-10 text-primary-500 opacity-50" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Resumes Analyzed</p>
              <p className="text-3xl font-bold text-gray-900">{analyzedCount}</p>
            </div>
            <FiCheckCircle className="w-10 h-10 text-primary-500 opacity-50" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Avg ATS Score</p>
              <p className="text-3xl font-bold text-gray-900">
                {avgScore > 0 ? `${avgScore}%` : '—'}
              </p>
            </div>
            <FiTrendingUp className="w-10 h-10 text-primary-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {features.map((feature, index) => (
          <div
            key={index}
            onClick={() => handleNavigation(feature)}
            className="card hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div
              className={`${feature.color} w-12 h-12 rounded-lg flex items-center justify-center mb-4`}
            >
              <feature.icon className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
            <p className="text-gray-600 text-sm">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* Recent resumes */}
      {resumes.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Recent Resumes</h2>
          <div className="space-y-3">
            {resumes.slice(0, 3).map((resume) => (
              <div
                key={resume.id}
                onClick={() => navigate('/analysis', { state: { resumeId: resume.id } })}
                className="card bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <FiFileText className="h-8 w-8 text-primary-600" />
                    <div>
                      <p className="font-medium text-gray-900">{resume.name}</p>
                      <p className="text-sm text-gray-500">
                        Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {resume.has_analysis ? (
                    <span className="flex items-center text-green-600 text-sm font-medium">
                      <FiCheckCircle className="mr-1" />
                      ATS {resume.analysis?.ats_score || '—'}%
                    </span>
                  ) : (
                    <span className="text-yellow-600 text-sm">Not Analyzed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;