import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { analysisAPI, jobsAPI, resumeAPI } from '../services/api';
import toast from 'react-hot-toast';
import {
  FiCopy, FiDownload, FiCheckCircle, FiTrendingUp,
  FiArrowLeft, FiPrinter, FiLoader, FiFile, FiClock, FiBriefcase, FiList
} from 'react-icons/fi';

const OptimizeResume = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [previousOptimizations, setPreviousOptimizations] = useState([]);
  const [loadingPrevious, setLoadingPrevious] = useState(true);
  const [selectedOptimization, setSelectedOptimization] = useState(null);
  const [showList, setShowList] = useState(true);
  const [resumes, setResumes] = useState([]);
  const [selectedResumeId, setSelectedResumeId] = useState(null);

  // Get data from navigation state
  const { job, optimizedResume, resumeId, showListView } = location.state || {};

  // Load all resumes for the user
  const loadResumes = async () => {
    if (!user?.id) return;
    try {
      const data = await resumeAPI.getAll(user.id);
      const analyzed = data.filter((r) => r.has_analysis && r.analysis);
      setResumes(analyzed);
      
      if (!resumeId && analyzed.length > 0 && !selectedResumeId) {
        setSelectedResumeId(analyzed[0].id);
      } else if (resumeId) {
        setSelectedResumeId(resumeId);
      }
    } catch (err) {
      console.error('Failed to load resumes:', err);
    }
  };

  // Load all previous optimizations for selected resume
  const loadPreviousOptimizations = async () => {
    if (!selectedResumeId || !user?.id) {
      setLoadingPrevious(false);
      return;
    }
    
    setLoadingPrevious(true);
    try {
      const data = await jobsAPI.getPreviousOptimizations(selectedResumeId, user.id);
      console.log('Previous optimizations:', data);
      setPreviousOptimizations(data.optimizations || []);
      
      if (showListView || (data.optimizations && data.optimizations.length > 0 && !optimizedResume)) {
        setShowList(true);
      } else if (optimizedResume) {
        setShowList(false);
        setSelectedOptimization({
          optimized_id: optimizedResume.optimized_resume_id,
          optimized_resume_id: optimizedResume.optimized_resume_id,
          job_title: job?.title,
          job_company: job?.company,
          ats_score: optimizedResume.ats_score,
          optimized_text: optimizedResume.optimized_text,
          optimized_at: new Date(),
          keywords_added: optimizedResume.keywords_added || [],
          suggestions: optimizedResume.suggestions || []
        });
      }
    } catch (err) {
      console.error('Failed to load previous optimizations:', err);
      toast.error('Failed to load optimized resumes');
    } finally {
      setLoadingPrevious(false);
    }
  };

  useEffect(() => {
    loadResumes();
  }, [user?.id]);

  useEffect(() => {
    if (selectedResumeId) {
      loadPreviousOptimizations();
    }
  }, [selectedResumeId]);

  const loadOptimization = (opt) => {
    console.log('Loading optimization:', opt);
    
    // Create a complete object with both field names
    const optimizationData = {
      optimized_id: opt.optimized_id,
      optimized_resume_id: opt.optimized_id,  // IMPORTANT: Set both
      job_title: opt.job_title,
      job_company: opt.job_company,
      ats_score: opt.ats_score,
      optimized_text: opt.optimized_text,
      optimized_at: opt.optimized_at,
      keywords_added: opt.keywords_added || [],
      suggestions: opt.suggestions || []
    };
    
    setSelectedOptimization(optimizationData);
    setShowList(false);
    toast.success(`Loaded optimized resume for ${opt.job_title}`);
  };

  const handleDirectPDFDownload = async (opt) => {
    if (!opt.optimized_id) {
      toast.error('No optimized resume ID found');
      return;
    }

    setDownloadingPDF(true);
    const loadingToast = toast.loading('Generating PDF...');

    try {
      const blob = await analysisAPI.generatePDF(
        opt.optimized_id,
        user?.id,
        user?.name || "Professional Resume"
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `optimized_resume_${(opt.job_title || 'resume').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.dismiss(loadingToast);
      toast.success('PDF Downloaded!');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const goBackToList = () => {
    setShowList(true);
    setSelectedOptimization(null);
  };

  // Get current optimization data
  const currentOptimization = selectedOptimization;
  const currentJob = currentOptimization || job;
  
  // Create currentOptimizedResume with proper ID
  const currentOptimizedResume = currentOptimization ? {
    optimized_resume_id: currentOptimization.optimized_id || currentOptimization.optimized_resume_id,
    optimized_text: currentOptimization.optimized_text,
    ats_score: currentOptimization.ats_score,
    keywords_added: currentOptimization.keywords_added || [],
    suggestions: currentOptimization.suggestions || []
  } : optimizedResume;
  
  const optimizedText = currentOptimizedResume?.optimized_text || '';
  const newAts = currentOptimizedResume?.ats_score || 85;
  const keywordsAdded = currentOptimizedResume?.keywords_added || [];
  const suggestions = currentOptimizedResume?.suggestions || [];
  const optimizedResumeId = currentOptimizedResume?.optimized_resume_id;

  console.log('Current optimizedResumeId:', optimizedResumeId);

  const handleCopy = () => {
    navigator.clipboard.writeText(optimizedText);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([optimizedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `optimized_resume_${(currentJob?.title || 'resume').replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Resume downloaded as TXT!');
  };

  const handleDownloadPDF = async () => {
    console.log('Download PDF - optimizedResumeId:', optimizedResumeId);
    
    if (!optimizedResumeId) {
      toast.error('No optimized resume ID found. Please try downloading from the list view.');
      return;
    }

    setDownloadingPDF(true);
    const loadingToast = toast.loading('Generating professional PDF...');

    try {
      const blob = await analysisAPI.generatePDF(
        optimizedResumeId,
        user?.id,
        user?.name || "Professional Resume"
      );

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `optimized_resume_${(currentJob?.title || 'resume').replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.dismiss(loadingToast);
      toast.success('Professional PDF Resume downloaded!');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to generate PDF');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Optimized Resume – ${currentJob?.title || 'Resume'}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { color: #2563eb; }
            pre { white-space: pre-wrap; font-family: inherit; }
            hr { margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>Optimized Resume for ${currentJob?.title || 'Position'}</h1>
          <p><strong>Company:</strong> ${currentJob?.company || '—'}</p>
          <p><strong>ATS Score:</strong> ${newAts}%</p>
          <hr />
          <pre>${optimizedText}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Loading state
  if (loadingPrevious) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <FiLoader className="animate-spin h-12 w-12 text-primary-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading optimized resumes...</p>
        </div>
      </div>
    );
  }

  // No resumes found
  if (resumes.length === 0 && !loadingPrevious) {
    return (
      <div className="text-center py-16">
        <FiFile className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">No Resumes Found</h2>
        <p className="text-gray-500 mt-2">
          Please upload and analyze a resume first.
        </p>
        <button onClick={() => navigate('/upload')} className="btn-primary mt-6">
          Upload Resume
        </button>
      </div>
    );
  }

  // Resume selector when multiple resumes exist
  if (resumes.length > 1 && !selectedResumeId) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Select a Resume</h1>
        <div className="space-y-3">
          {resumes.map((resume) => (
            <div
              key={resume.id}
              onClick={() => setSelectedResumeId(resume.id)}
              className="card cursor-pointer hover:shadow-lg transition-all p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{resume.name}</h3>
                  <p className="text-sm text-gray-500">
                    Uploaded {new Date(resume.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                <button className="btn-primary">Select</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show list of previous optimizations
  if (showList && previousOptimizations.length > 0) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Optimized Resumes</h1>
          <p className="text-gray-600 mt-2">
            Select a previously optimized resume to view or download
          </p>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FiList className="h-5 w-5 text-primary-600" />
            Your Optimized Resumes ({previousOptimizations.length})
          </h2>
          
          <div className="space-y-3">
            {previousOptimizations.map((opt) => (
              <div
                key={opt.optimized_id}
                className="flex justify-between items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200 border border-gray-100 hover:border-primary-200"
              >
                <div className="flex-1 cursor-pointer" onClick={() => loadOptimization(opt)}>
                  <div className="flex items-center gap-2">
                    <FiBriefcase className="h-4 w-4 text-primary-600" />
                    <h3 className="font-semibold text-gray-900">{opt.job_title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{opt.job_company}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FiTrendingUp className="h-3 w-3" />
                      ATS Score: {opt.ats_score}%
                    </span>
                    <span className="flex items-center gap-1">
                      <FiClock className="h-3 w-3" />
                      {new Date(opt.optimized_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDirectPDFDownload(opt)}
                    disabled={downloadingPDF}
                    className="bg-green-600 text-white text-sm px-3 py-2 rounded-lg hover:bg-green-700 flex items-center gap-1"
                  >
                    {downloadingPDF ? (
                      <FiLoader className="animate-spin h-3 w-3" />
                    ) : (
                      <FiFile className="h-3 w-3" />
                    )}
                    Download PDF
                  </button>
                  <button
                    onClick={() => loadOptimization(opt)}
                    className="btn-primary text-sm px-4 py-2"
                  >
                    View Resume
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show message if no optimizations exist
  if (previousOptimizations.length === 0 && !optimizedResume && !showList) {
    return (
      <div className="text-center py-16">
        <FiFile className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">No Optimized Resumes Yet</h2>
        <p className="text-gray-500 mt-2">
          Go to Jobs and click "Optimize Resume" to create your first optimized resume.
        </p>
        <button onClick={() => navigate('/jobs')} className="btn-primary mt-6">
          Go to Jobs
        </button>
      </div>
    );
  }

  // Show single optimized resume
  return (
    <div className="max-w-6xl mx-auto">
      {/* Back button */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => {
            if (previousOptimizations.length > 0) {
              setShowList(true);
              setSelectedOptimization(null);
            } else {
              navigate('/jobs');
            }
          }}
          className="flex items-center text-gray-600 hover:text-primary-600 transition-colors"
        >
          <FiArrowLeft className="mr-2" />
          {previousOptimizations.length > 0 ? 'Back to List' : 'Back to Jobs'}
        </button>
        
        {previousOptimizations.length > 1 && (
          <button
            onClick={() => {
              setShowList(true);
              setSelectedOptimization(null);
            }}
            className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
          >
            <FiList className="h-4 w-4" />
            View All ({previousOptimizations.length})
          </button>
        )}
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Optimized Resume</h1>
        <p className="text-gray-600 mt-2">
          Tailored for <strong>{currentJob?.title}</strong>
          {currentJob?.company ? <> at <strong>{currentJob.company}</strong></> : ''}
        </p>
        {currentOptimization && (
          <p className="text-xs text-gray-400 mt-1">
            Optimized on {new Date(currentOptimization.optimized_at).toLocaleDateString()}
          </p>
        )}
        {optimizedResumeId && (
          <p className="text-xs text-green-600 mt-1">
            ✓ Ready for PDF download (ID: {optimizedResumeId})
          </p>
        )}
      </div>

      {/* Score cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-r from-green-500 to-green-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm">ATS Score</p>
              <p className="text-4xl font-bold mt-1">{newAts}%</p>
            </div>
            <FiTrendingUp className="h-10 w-10 text-green-200" />
          </div>
        </div>

        <div className="card text-center">
          <p className="text-gray-600 text-sm">Job Match</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">{currentJob?.match_score ?? '—'}%</p>
          <p className="text-xs text-gray-400 mt-1">with this position</p>
        </div>

        <div className="card text-center">
          <p className="text-gray-600 text-sm">Keywords Added</p>
          <p className="text-3xl font-bold text-primary-600 mt-1">{keywordsAdded.length}</p>
          <p className="text-xs text-gray-400 mt-1">relevant keywords</p>
        </div>
      </div>
      
       {/* Professional ATS Breakdown */}
{optimizedResume?.breakdown && (
  <div className="card mb-6">
    <h2 className="text-lg font-semibold text-gray-900 mb-3">ATS Score Breakdown</h2>
    <div className="space-y-3">
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Keywords Match</span>
          <span>{optimizedResume.breakdown.keywords_match}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full" style={{width: `${optimizedResume.breakdown.keywords_match}%`}}></div>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Formatting</span>
          <span>{optimizedResume.breakdown.formatting}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-green-600 h-2 rounded-full" style={{width: `${optimizedResume.breakdown.formatting}%`}}></div>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Experience Match</span>
          <span>{optimizedResume.breakdown.experience}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-yellow-600 h-2 rounded-full" style={{width: `${optimizedResume.breakdown.experience}%`}}></div>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-sm mb-1">
          <span>Education</span>
          <span>{optimizedResume.breakdown.education}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-purple-600 h-2 rounded-full" style={{width: `${optimizedResume.breakdown.education}%`}}></div>
        </div>
      </div>
    </div>
  </div>
)}   
      {/* Keywords added */}
      {keywordsAdded.length > 0 && (
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Keywords Added</h2>
          <div className="flex flex-wrap gap-2">
            {keywordsAdded.map((kw, i) => (
              <span key={i} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="card mb-6 bg-blue-50 border border-blue-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Improvement Suggestions</h2>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start space-x-2">
                <FiCheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 text-sm">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Optimized resume content */}
      <div className="card">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-semibold text-gray-900">Optimized Resume Content</h2>
          <div className="flex space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-primary-600 border rounded-lg text-sm transition-colors"
            >
              <FiCopy className="h-4 w-4" />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-primary-600 border rounded-lg text-sm transition-colors"
            >
              <FiDownload className="h-4 w-4" />
              <span>TXT</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPDF || !optimizedResumeId}
              className={`flex items-center space-x-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                optimizedResumeId 
                  ? 'bg-green-600 text-white hover:bg-green-700' 
                  : 'bg-gray-400 text-white cursor-not-allowed'
              }`}
              title={!optimizedResumeId ? 'No ID found. Use Download PDF from list view.' : ''}
            >
              {downloadingPDF ? (
                <FiLoader className="animate-spin h-4 w-4" />
              ) : (
                <FiFile className="h-4 w-4" />
              )}
              <span>PDF</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1 px-3 py-2 text-gray-600 hover:text-primary-600 border rounded-lg text-sm transition-colors"
            >
              <FiPrinter className="h-4 w-4" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {optimizedText ? (
          <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap font-sans text-gray-700 text-sm leading-relaxed">
              {optimizedText}
            </pre>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-8">No optimized content available.</p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 flex gap-4">
        <button onClick={() => navigate('/jobs')} className="btn-secondary flex-1">
          Find More Jobs
        </button>
        <button 
          onClick={handleDownloadPDF} 
          disabled={downloadingPDF || !optimizedResumeId} 
          className={`flex-1 font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 ${
            optimizedResumeId 
              ? 'bg-green-600 text-white hover:bg-green-700' 
              : 'bg-gray-400 text-white cursor-not-allowed'
          }`}
        >
          {downloadingPDF ? (
            <span className="flex items-center justify-center gap-2">
              <FiLoader className="animate-spin" />
              Generating PDF...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <FiFile className="h-4 w-4" />
              Download Professional PDF
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default OptimizeResume;