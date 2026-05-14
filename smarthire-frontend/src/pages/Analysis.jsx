import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { analysisAPI, jobsAPI, resumeAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiUser, FiBriefcase, FiTrendingUp, FiAward, FiThumbsUp, FiStar, FiLoader, FiRefreshCw, FiFile } from 'react-icons/fi';

const Analysis = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [resumes, setResumes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reanalysing, setReanalysing] = useState(false);
  const [findingJobs, setFindingJobs] = useState(false);

  // Load resumes from DATABASE
  const loadResumes = async () => {
    if (!user?.id) return;
    try {
      const data = await resumeAPI.getAll(user.id);
      setResumes(data);
    } catch (err) {
      console.error('Failed to load resumes:', err);
      toast.error('Failed to load your resumes');
    }
  };

  // ✅ SAFE LOAD ANALYSIS - with proper data validation
  const loadAnalysis = async (resumeId) => {
    if (!resumeId || !user?.id) return;
    setLoading(true);
    try {
      const data = await analysisAPI.getAnalysis(resumeId, user.id);
      console.log('Raw analysis data from API:', data);
      
      const safeAnalysis = {
        skills: Array.isArray(data.skills) ? data.skills : [],
        experience: data.experience && typeof data.experience === 'object' ? data.experience : {},
        improvements: Array.isArray(data.improvements) ? data.improvements : [],
        suggested_role: data.suggested_role || data.role || 'Not specified',
        ats_score: data.ats_score ? Number(data.ats_score) : null
      };
      
      console.log('Safe analysis object:', safeAnalysis);
      setAnalysis(safeAnalysis);
    } catch (err) {
      console.error('Failed to load analysis:', err);
      if (err.message?.includes('404')) {
        setAnalysis(null);
      } else {
        toast.error('Failed to load analysis');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResumes();
  }, [user?.id]);

  useEffect(() => {
    if (resumes.length > 0) {
      const fromState = location.state?.resumeId;
      const firstId = resumes[0]?.id;
      setSelectedId(fromState || firstId);
    }
  }, [resumes, location.state]);

  useEffect(() => {
    if (selectedId) {
      loadAnalysis(selectedId);
    }
  }, [selectedId]);

  const handleReAnalyze = async () => {
    if (!selectedId) return;
    setReanalysing(true);
    try {
      await analysisAPI.analyze(selectedId, user.id);
      await loadAnalysis(selectedId);
      toast.success('Analysis complete!');
    } catch (err) {
      console.error('Analysis error:', err);
      toast.error(err?.message || 'Analysis failed');
    } finally {
      setReanalysing(false);
    }
  };

  // ✅ FIXED: Pass selectedId to the API
  const handleFindJobs = async () => {
    if (!selectedId) {
      toast.error('Please select a resume first');
      return;
    }
    
    setFindingJobs(true);
    try {
      const data = await jobsAPI.recommend(user.id, selectedId, 5);
      console.log('Jobs API response:', data);
      
      const list = data.recommendations || data.jobs || [];
      if (list.length > 0) {
        navigate('/jobs', { state: { resumeId: selectedId, recommendations: list } });
      } else {
        toast('No jobs found — try uploading a more detailed resume.');
      }
    } catch (err) {
      console.error('Find jobs error:', err);
      toast.error(err.message || 'Failed to find jobs. Please try again.');
    } finally {
      setFindingJobs(false);
    }
  };

  // No resumes uploaded yet
  if (resumes.length === 0) {
    return (
      <div className="text-center py-16">
        <FiFile className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">No resumes found</h2>
        <p className="text-gray-500 mt-2">Upload a resume first to see its analysis.</p>
        <button onClick={() => navigate('/upload')} className="btn-primary mt-6">
          Upload Resume
        </button>
      </div>
    );
  }

  const ats = analysis?.ats_score;
  const atsLabel = ats == null ? null
    : ats >= 80 ? 'Excellent! Your resume is well-optimized.'
    : ats >= 60 ? 'Good! A few improvements can boost your score.'
    : 'Needs improvement — check the suggestions below.';

  const hasSkills = analysis?.skills && Array.isArray(analysis.skills) && analysis.skills.length > 0;
  const hasImprovements = analysis?.improvements && Array.isArray(analysis.improvements) && analysis.improvements.length > 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Resume Analysis</h1>
          <p className="text-gray-600 mt-2">Select a resume to view its AI analysis</p>
        </div>
        {selectedId && (
          <button
            onClick={handleReAnalyze}
            disabled={reanalysing}
            className="flex items-center space-x-2 px-4 py-2 text-primary-600 border border-primary-600 rounded-lg hover:bg-primary-50 disabled:opacity-50 transition-colors"
          >
            {reanalysing ? <FiLoader className="animate-spin h-4 w-4" /> : <FiRefreshCw className="h-4 w-4" />}
            <span>Re-analyze</span>
          </button>
        )}
      </div>

      {/* Resume selector */}
      <div className="card mb-8">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Choose a Resume</p>
        <div className="space-y-2">
          {resumes.map((r) => {
            const isActive = selectedId === r.id;
            return (
              <div
                key={r.id}
                onClick={() => setSelectedId(r.id)}
                className={`flex items-center justify-between p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  isActive ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <FiFile className={`h-5 w-5 ${isActive ? 'text-primary-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{r.name}</p>
                    <p className="text-xs text-gray-400">{new Date(r.uploadedAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    isActive && analysis ? 'bg-green-100 text-green-700' : 'bg-yellow-50 text-yellow-600'
                  }`}
                >
                  {isActive && analysis ? (ats != null ? `ATS ${ats}%` : 'Analyzed') : 'Click to load'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Analysis results */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <FiLoader className="animate-spin h-12 w-12 text-primary-600 mx-auto" />
            <p className="mt-4 text-gray-600">Loading analysis…</p>
          </div>
        </div>
      ) : !analysis ? (
        <div className="card text-center py-12">
          <FiFile className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-2">No analysis found for this resume</p>
          <p className="text-sm text-gray-400 mb-6">Run an AI analysis to see skills, ATS score, and improvement suggestions.</p>
          <button onClick={handleReAnalyze} disabled={reanalysing} className="btn-primary">
            {reanalysing ? <span className="flex items-center gap-2"><FiLoader className="animate-spin" /> Analyzing…</span> : 'Analyze Now'}
          </button>
        </div>
      ) : (
        <>
          {ats != null ? (
            <div className="card mb-8 bg-gradient-to-r from-primary-500 to-primary-700 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary-100 text-sm">ATS Compatibility Score</p>
                  <p className="text-5xl font-bold mt-2">{ats}%</p>
                  <p className="text-primary-100 mt-2 text-sm">{atsLabel}</p>
                  <div className="mt-4 bg-white bg-opacity-20 rounded-full h-2 w-64">
                    <div className="bg-white h-2 rounded-full" style={{ width: `${ats}%` }} />
                  </div>
                </div>
                <FiAward className="h-16 w-16 text-primary-200 hidden sm:block" />
              </div>
            </div>
          ) : (
            <div className="card mb-8 bg-amber-50 border border-amber-200">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-amber-800 font-semibold">ATS Score not available</p>
                  <p className="text-amber-600 text-sm mt-1">Click <strong>Re-analyze</strong> to get your full ATS score.</p>
                </div>
                <button onClick={handleReAnalyze} disabled={reanalysing} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50">
                  {reanalysing ? <FiLoader className="animate-spin" /> : <FiRefreshCw />} Re-analyze
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="card">
              <div className="flex items-center space-x-3 mb-4">
                <FiStar className="h-6 w-6 text-primary-600" />
                <h2 className="text-xl font-semibold text-gray-900">Extracted Skills</h2>
              </div>
              {hasSkills ? (
                <div className="flex flex-wrap gap-2">
                  {analysis.skills.map((skill, i) => (
                    <span key={i} className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  No skills detected.{' '}
                  <button onClick={handleReAnalyze} className="text-primary-600 underline">
                    Re-analyze
                  </button>
                </p>
              )}
            </div>

            <div className="card">
              <div className="flex items-center space-x-3 mb-4">
                <FiBriefcase className="h-6 w-6 text-primary-600" />
                <h2 className="text-xl font-semibold text-gray-900">Experience Summary</h2>
              </div>
              <p className="text-gray-700 font-medium">
                {analysis.experience?.years || 'Experience not specified'}
              </p>
              <p className="text-gray-600 mt-2 text-sm leading-relaxed">
                {analysis.experience?.summary || 'No experience summary available.'}
              </p>
            </div>

            <div className="card">
              <div className="flex items-center space-x-3 mb-4">
                <FiUser className="h-6 w-6 text-primary-600" />
                <h2 className="text-xl font-semibold text-gray-900">Suggested Job Role</h2>
              </div>
              <p className="text-lg font-semibold text-primary-700">{analysis.suggested_role}</p>
              <p className="text-gray-500 text-sm mt-1">
                Best match based on your skills and experience
              </p>
            </div>

            <div className="card">
              <div className="flex items-center space-x-3 mb-4">
                <FiTrendingUp className="h-6 w-6 text-primary-600" />
                <h2 className="text-xl font-semibold text-gray-900">Improvement Suggestions</h2>
              </div>
              {hasImprovements ? (
                <ul className="space-y-3">
                  {analysis.improvements.map((imp, i) => (
                    <li key={i} className="flex items-start space-x-2">
                      <FiThumbsUp className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-700 text-sm">{imp}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div>
                  <p className="text-gray-400 text-sm mb-3">
                    No improvement suggestions available.
                  </p>
                  <button
                    onClick={handleReAnalyze}
                    disabled={reanalysing}
                    className="flex items-center gap-2 text-sm text-primary-600 border border-primary-300 rounded-lg px-3 py-1.5 hover:bg-primary-50 disabled:opacity-50"
                  >
                    {reanalysing ? <FiLoader className="animate-spin h-4 w-4" /> : <FiRefreshCw className="h-4 w-4" />}
                    Get Suggestions
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <button onClick={handleFindJobs} disabled={findingJobs} className="btn-primary flex-1">
              {findingJobs ? (
                <span className="flex items-center justify-center gap-2">
                  <FiLoader className="animate-spin" /> Finding Jobs…
                </span>
              ) : (
                'Find Matching Jobs'
              )}
            </button>
            <button onClick={() => navigate('/upload')} className="btn-secondary flex-1">
              Upload Another Resume
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Analysis;