import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { jobsAPI, analysisAPI, resumeAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  FiBriefcase, FiMapPin, FiClock, FiTrendingUp,
  FiLoader, FiDownload, FiFile, FiRefreshCw, FiArchive, FiEye, FiExternalLink
} from 'react-icons/fi';

const JobRecommendations = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [resumes, setResumes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedResume, setSelectedResume] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [optimizing, setOptimizing] = useState(null);
  const [activeTab, setActiveTab] = useState('new');
  const [jobHistory, setJobHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Load resumes from DATABASE ──────────────────────────────────────────────
  const loadResumes = async () => {
    if (!user?.id) return;
    setLoadingResumes(true);
    try {
      const data = await resumeAPI.getAll(user.id);
      const analyzed = data.filter((r) => r.has_analysis && r.analysis);
      setResumes(analyzed);
      
      // IMPORTANT: Check for resumeId from location state (coming from Analysis page)
      const stateResumeId = location.state?.resumeId;
      console.log('Location state resumeId:', stateResumeId);
      
      let targetId = null;
      
      if (stateResumeId) {
        // If coming from Analysis page, use that resume ID
        targetId = stateResumeId;
        console.log('Using resumeId from state:', targetId);
      } else if (analyzed.length > 0) {
        // Otherwise use the first analyzed resume
        targetId = analyzed[0].id;
        console.log('Using first resume:', targetId);
      }
      
      setSelectedId(targetId);
      
      if (targetId) {
        const resume = analyzed.find(r => r.id === targetId);
        setSelectedResume(resume);
      }
    } catch (err) {
      console.error('Failed to load resumes:', err);
      toast.error('Failed to load your resumes');
    } finally {
      setLoadingResumes(false);
    }
  };

  // ── Fetch job history for selected resume ───────────────────────────────────
  const loadJobHistory = async () => {
    if (!selectedId || !user?.id) return;
    
    setLoadingHistory(true);
    try {
      const data = await jobsAPI.getPreviousJobs(selectedId, user.id);
      console.log('Job history:', data);
      setJobHistory(data.previous_jobs || []);
    } catch (err) {
      console.error('Failed to load job history:', err);
      toast.error('Failed to load job history');
    } finally {
      setLoadingHistory(false);
    }
  };

  // ── Fetch full job details for a job from history ───────────────────────────
  const fetchFullJobDetails = async (jobId) => {
    try {
      const jobDetails = await jobsAPI.getJobDetails(jobId);
      return jobDetails;
    } catch (err) {
      console.error('Failed to fetch job details:', err);
      return null;
    }
  };

  // ── Fetch new jobs from API ────────────────────────────────────────────────
  const fetchJobs = async () => {
    if (!selectedId) {
      toast.error('Please select a resume first');
      return;
    }
    
    setLoadingJobs(true);
    const loadingToast = toast.loading('Searching for jobs...');
    
    try {
      const data = await jobsAPI.recommend(user.id, selectedId, 5);
      console.log('Jobs API response:', data);
      
      const list = data.recommendations || [];
      setJobs(list);
      
      toast.dismiss(loadingToast);
      
      if (list.length === 0) {
        toast('No jobs found for your profile. Try re-analyzing your resume.');
      } else {
        toast.success(`Found ${list.length} new jobs!`);
        loadJobHistory(); // Refresh history after new search
      }
    } catch (err) {
      console.error('Job fetch error:', err);
      toast.dismiss(loadingToast);
      toast.error(err.message || 'Failed to load job recommendations');
    } finally {
      setLoadingJobs(false);
    }
  };

  useEffect(() => {
    loadResumes();
  }, [user]);

  useEffect(() => {
    if (selectedId) {
      const resume = resumes.find(r => r.id === selectedId);
      setSelectedResume(resume);
      loadJobHistory();
    }
  }, [selectedId]);

  // ── Handle Optimize from New Jobs ──────────────────────────────────────────
  const handleOptimize = async (job) => {
    const jobId = job.job_id || job.id;
    setOptimizing(jobId);
    const loadingToast = toast.loading('Optimizing resume...');
    
    try {
      const data = await analysisAPI.optimize(
        selectedId,
        user.id,
        jobId,
        job.title,
        job.description
      );

      toast.dismiss(loadingToast);
      toast.success('Resume optimized successfully!');

      navigate('/optimize', {
        state: {
          job: { 
            title: job.title, 
            company: job.company,
            match_score: job.match_score,
            description: job.description,
            link: job.link
          },
          optimizedResume: data,
          resumeId: selectedId,
        },
      });
    } catch (err) {
      console.error('Optimization error:', err);
      toast.dismiss(loadingToast);
      toast.error(err.message || 'Resume optimization failed');
    } finally {
      setOptimizing(null);
    }
  };

  // ── Handle View Optimized from History ──────────────────────────────────────
  const handleViewOptimized = async (job) => {
    console.log('View Optimized clicked for job:', job);
    console.log('optimized_resume_id:', job.optimized_resume_id);
    
    if (!job.optimized_resume_id) {
      toast.error('No optimized resume found. Please optimize this job first.');
      return;
    }
    
    const loadingToast = toast.loading('Loading optimized resume...');
    
    try {
      const optimizations = await jobsAPI.getPreviousOptimizations(selectedId, user.id);
      console.log('All optimizations:', optimizations);
      
      const found = optimizations.optimizations?.find(opt => opt.optimized_id === job.optimized_resume_id);
      console.log('Found optimization:', found);
      
      if (found && found.optimized_text) {
        toast.dismiss(loadingToast);
        
        navigate('/optimize', {
          state: {
            job: { 
              title: found.job_title, 
              company: found.job_company,
              match_score: job.match_score
            },
            optimizedResume: {
              optimized_resume_id: found.optimized_id,
              optimized_text: found.optimized_text,
              ats_score: found.ats_score,
              keywords_added: found.keywords_added || [],
              suggestions: found.suggestions || []
            },
            resumeId: selectedId,
            showList: true
          },
        });
      } else {
        toast.dismiss(loadingToast);
        toast.error('Could not load the optimized resume details. Please try re-optimizing.');
      }
    } catch (err) {
      console.error('Error loading optimized resume:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to load optimized resume');
    }
  };

  // ── Handle Apply for job (from history) ─────────────────────────────────────
  const handleApplyFromHistory = async (job) => {
    setOptimizing(job.job_id);
    const loadingToast = toast.loading('Preparing application...');
    
    try {
      let jobDescription = job.description;
      let jobLink = job.link;
      
      if (!jobDescription || !jobLink) {
        const fullJob = await fetchFullJobDetails(job.job_id);
        if (fullJob) {
          jobDescription = fullJob.description;
          jobLink = fullJob.link;
        }
      }
      
      if (job.has_optimized && job.optimized_resume_id) {
        toast.dismiss(loadingToast);
        await handleViewOptimized(job);
      } else {
        const data = await analysisAPI.optimize(
          selectedId,
          user.id,
          job.job_id,
          job.title,
          jobDescription || "Software Developer position"
        );
        
        toast.dismiss(loadingToast);
        toast.success('Resume optimized!');
        
        navigate('/optimize', {
          state: {
            job: { 
              title: job.title, 
              company: job.company,
              match_score: job.match_score,
              description: jobDescription,
              link: jobLink
            },
            optimizedResume: data,
            resumeId: selectedId,
          },
        });
      }
    } catch (err) {
      console.error('Apply error:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to prepare application');
    } finally {
      setOptimizing(null);
    }
  };

  const matchColor = (score) => {
    if (!score) return 'text-gray-600 bg-gray-100';
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingResumes) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <FiLoader className="animate-spin h-12 w-12 text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading your resumes...</p>
        </div>
      </div>
    );
  }

  // ── No analyzed resumes ─────────────────────────────────────────────────────
  if (resumes.length === 0) {
    return (
      <div className="text-center py-16">
        <FiBriefcase className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-semibold text-gray-700">Analyze a resume first</h2>
        <p className="text-gray-500 mt-2">
          Job matching requires at least one analyzed resume. Upload and analyze one first.
        </p>
        <button onClick={() => navigate('/upload')} className="btn-primary mt-6">
          Upload Resume
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Job Recommendations</h1>
        <p className="text-gray-600 mt-2">
          AI-matched jobs based on the skills in your selected resume
        </p>
      </div>

      {/* Resume selector */}
      <div className="card mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Select Resume for Matching
        </h2>
        <div className="flex flex-wrap gap-3">
          {resumes.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                selectedId === r.id
                  ? 'border-primary-500 bg-primary-50 text-primary-700'
                  : 'border-gray-200 text-gray-600 hover:border-primary-300'
              }`}
            >
              <FiFile className="h-4 w-4" />
              <span>{r.name.length > 24 ? r.name.slice(0, 24) + '…' : r.name}</span>
              {r.analysis?.ats_score && (
                <span className="text-xs font-semibold text-green-600">
                  {r.analysis.ats_score}%
                </span>
              )}
            </button>
          ))}
        </div>
        
        {/* Selected resume skills preview */}
        {selectedResume?.analysis?.skills && selectedResume.analysis.skills.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">Skills being used for matching:</p>
            <div className="flex flex-wrap gap-2">
              {selectedResume.analysis.skills.slice(0, 8).map((skill, idx) => (
                <span key={idx} className="px-2 py-1 bg-primary-100 text-primary-700 rounded-md text-xs">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Tab buttons */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setActiveTab('new')}
          className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'new'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FiRefreshCw className="h-4 w-4" />
          New Recommendations
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-primary-600 text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <FiArchive className="h-4 w-4" />
          Job History ({jobHistory.length})
        </button>
      </div>

      {/* New Recommendations Tab */}
      {activeTab === 'new' && (
        <>
          <div className="mb-4 flex justify-end">
            <button
              onClick={fetchJobs}
              disabled={loadingJobs}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loadingJobs ? (
                <FiLoader className="animate-spin h-4 w-4" />
              ) : (
                <FiRefreshCw className="h-4 w-4" />
              )}
              {loadingJobs ? 'Searching...' : 'Search for Jobs'}
            </button>
          </div>

          {loadingJobs && jobs.length === 0 ? (
            <div className="flex justify-center items-center h-64">
              <div className="text-center">
                <FiLoader className="animate-spin h-12 w-12 text-primary-600 mx-auto" />
                <p className="mt-4 text-gray-600">Finding jobs that match your skills...</p>
              </div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="card text-center py-12">
              <FiBriefcase className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No jobs found matching your profile.</p>
              <p className="text-gray-500 text-sm mb-4">
                Click the "Search for Jobs" button above to find matching positions.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {jobs.map((job, index) => {
                const jobId = job.job_id || job.id || index;
                return (
                  <div key={jobId} className="card hover:shadow-lg transition-shadow">
                    <div className="flex justify-between items-start flex-wrap gap-4">
                      <div className="flex-1">
                        <h2 className="text-xl font-semibold text-gray-900">{job.title}</h2>
                        <p className="text-gray-600 mt-1">{job.company}</p>
                        <div className="flex items-center flex-wrap gap-4 mt-2 text-sm text-gray-500">
                          {job.location && (
                            <span className="flex items-center space-x-1">
                              <FiMapPin className="h-4 w-4" />
                              <span>{job.location}</span>
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 mt-4 text-sm leading-relaxed">
                          {job.description?.substring(0, 300)}
                          {job.description?.length > 300 ? '…' : ''}
                        </p>
                        {job.missing_skills?.length > 0 && (
                          <div className="mt-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">Skills to add:</p>
                            <div className="flex flex-wrap gap-2">
                              {job.missing_skills.slice(0, 5).map((skill, idx) => (
                                <span key={idx} className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-md text-xs">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            onClick={() => handleOptimize(job)}
                            disabled={optimizing === jobId}
                            className="btn-primary"
                          >
                            {optimizing === jobId ? (
                              <span className="flex items-center">
                                <FiLoader className="animate-spin mr-2" />
                                Optimizing…
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <FiDownload className="mr-2" />
                                Optimize Resume
                              </span>
                            )}
                          </button>
                          {job.link && (
                            <a
                              href={job.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary inline-flex items-center gap-1"
                            >
                              <FiExternalLink className="h-3 w-3" />
                              Apply Now
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="text-center flex-shrink-0">
                        <div className={`px-4 py-2 rounded-full ${matchColor(job.match_score)} min-w-[80px]`}>
                          <span className="text-2xl font-bold">{job.match_score ?? '?'}%</span>
                          <span className="text-xs block">Match</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Job History Tab */}
      {activeTab === 'history' && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiArchive className="h-5 w-5 text-primary-600" />
            Previously Searched Jobs for "{selectedResume?.name || 'this resume'}"
          </h2>
          
          {loadingHistory ? (
            <div className="flex justify-center py-12">
              <FiLoader className="animate-spin h-8 w-8 text-primary-600" />
            </div>
          ) : jobHistory.length === 0 ? (
            <div className="text-center py-12">
              <FiBriefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No job history yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Click "New Recommendations" and search for jobs to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobHistory.map((job) => (
                <div
                  key={job.job_id}
                  className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 border border-gray-100"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <FiBriefcase className="h-4 w-4 text-primary-600" />
                      <h3 className="font-semibold text-gray-900">{job.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{job.company}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="flex items-center gap-1 text-gray-500">
                        <FiTrendingUp className="h-3 w-3" />
                        Match: {job.match_score}%
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <FiClock className="h-3 w-3" />
                        {new Date(job.searched_at).toLocaleDateString()}
                      </span>
                      {job.has_optimized && (
                        <span className="flex items-center gap-1 text-green-600">
                          <FiEye className="h-3 w-3" />
                          Optimized ✓
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={job.link || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`text-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-1 ${
                        job.link 
                          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                      onClick={(e) => {
                        if (!job.link) {
                          e.preventDefault();
                          toast.error('No application link available');
                        }
                      }}
                    >
                      <FiExternalLink className="h-3 w-3" />
                      Apply
                    </a>
                    
                    {job.has_optimized ? (
                      <button
                        onClick={() => handleViewOptimized(job)}
                        className="btn-primary text-sm px-4 py-2 flex items-center gap-1"
                      >
                        <FiEye className="h-3 w-3" /> View Optimized
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApplyFromHistory(job)}
                        disabled={optimizing === job.job_id}
                        className="btn-secondary text-sm px-4 py-2 flex items-center gap-1"
                      >
                        {optimizing === job.job_id ? (
                          <FiLoader className="animate-spin h-3 w-3" />
                        ) : (
                          <FiDownload className="h-3 w-3" />
                        )}
                        Optimize & Apply
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default JobRecommendations;