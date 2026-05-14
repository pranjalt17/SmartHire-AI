// UploadResume.jsx - COMPLETE REWRITE without localStorage
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { resumeAPI, analysisAPI } from '../services/api';
import toast from 'react-hot-toast';
import { FiUpload, FiFile, FiCheckCircle, FiLoader, FiTrash2 } from 'react-icons/fi';

const UploadResume = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [resumes, setResumes] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  // ✅ Load resumes from DATABASE, not localStorage
  const loadResumes = async () => {
    if (!user?.id) return;
    setLoadingResumes(true);
    try {
      const data = await resumeAPI.getAll(user.id);
      setResumes(data);
    } catch (err) {
      console.error('Failed to load resumes:', err);
      toast.error('Failed to load your resumes');
    } finally {
      setLoadingResumes(false);
    }
  };

  useEffect(() => {
    loadResumes();
  }, [user]);

  const validateAndSet = (f) => {
    const valid = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!valid.includes(f.type)) {
      toast.error('Only PDF or DOCX files allowed');
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5 MB');
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }
    setUploading(true);

    try {
      // ✅ Step 1: Upload to database
      const uploadResult = await resumeAPI.upload(user.id, file);
      const resumeId = uploadResult.resume_id;
      
      if (!resumeId) throw new Error('Server did not return a resume_id');

      toast.success('Resume uploaded! Running AI analysis…');
      setUploading(false);
      setAnalyzing(true);

      // ✅ Step 2: Analyze using database
      const analysisResult = await analysisAPI.analyze(resumeId, user.id);
      
      toast.success('AI analysis complete!');
      setFile(null);
      
      // ✅ Step 3: Refresh the list from database
      await loadResumes();

      // ✅ Step 4: Navigate to analysis page
      navigate('/analysis', { state: { resumeId } });
    } catch (err) {
      console.error('Upload/analysis error:', err);
      toast.error(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  const handleAnalyzeExisting = async (resumeId) => {
    setAnalyzing(true);
    try {
      await analysisAPI.analyze(resumeId, user.id);
      toast.success('Analysis complete!');
      await loadResumes(); // Refresh to show analysis status
      navigate('/analysis', { state: { resumeId } });
    } catch (err) {
      toast.error(err?.message || 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (resumeId) => {
    try {
      await resumeAPI.delete(resumeId, user.id);
      toast.success('Resume removed');
      await loadResumes(); // Refresh list from database
    } catch (err) {
      toast.error('Failed to delete resume');
    }
  };

  const loading = uploading || analyzing;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Upload Your Resume</h1>
        <p className="text-gray-600 mt-2">
          Upload a PDF or DOCX (max 5 MB). AI analysis runs automatically.
        </p>
      </div>

      {/* Drop zone - same as before */}
      <div className="card mb-8">
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            file ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400'
          } ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!loading) {
              const f = e.dataTransfer.files[0];
              if (f) validateAndSet(f);
            }
          }}
          onClick={() => {
            if (!loading && !file) document.getElementById('fileInput').click();
          }}
        >
          <input
            id="fileInput"
            type="file"
            className="hidden"
            accept=".pdf,.docx"
            onChange={(e) => {
              const f = e.target.files[0];
              if (f) validateAndSet(f);
              e.target.value = '';
            }}
          />

          {!file ? (
            <>
              <FiUpload className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-gray-600">Drag and drop your resume here, or</p>
              <span className="mt-4 inline-block btn-primary cursor-pointer">Browse Files</span>
              <p className="mt-4 text-sm text-gray-500">PDF or DOCX · Max 5 MB</p>
            </>
          ) : (
            <div className="flex items-center justify-center space-x-4">
              <FiFile className="h-10 w-10 text-primary-600" />
              <div className="text-left">
                <p className="font-medium text-gray-900">{file.name}</p>
                <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                className="text-red-600 hover:text-red-700"
                disabled={loading}
              >
                <FiTrash2 className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {file && !loading && (
          <button className="btn-primary w-full mt-6" onClick={handleUpload}>
            Upload &amp; Analyze Resume
          </button>
        )}

        {loading && (
          <div className="mt-6 text-center">
            <FiLoader className="animate-spin h-8 w-8 text-primary-600 mx-auto" />
            <p className="mt-2 text-gray-600 font-medium">
              {uploading ? 'Uploading resume…' : 'AI is analyzing your resume — this may take a moment…'}
            </p>
          </div>
        )}
      </div>

      {/* Resume library - NOW FROM DATABASE */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Resume Library</h2>
        {loadingResumes ? (
          <div className="flex justify-center py-8">
            <FiLoader className="animate-spin h-8 w-8 text-primary-600" />
          </div>
        ) : resumes.length === 0 ? (
          <div className="card bg-gray-50 text-center py-8">
            <p className="text-gray-500">No resumes uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {resumes.map((resume) => (
              <div key={resume.id} className="card bg-gray-50 hover:bg-gray-100 transition-colors">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center space-x-3">
                    <FiFile className="h-8 w-8 text-primary-600 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-gray-900">{resume.name}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(resume.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    {resume.has_analysis ? (
                      <span className="flex items-center text-green-600 text-sm font-medium">
                        <FiCheckCircle className="mr-1" />
                        Analyzed
                      </span>
                    ) : (
                      <button
                        className="btn-secondary text-sm py-1 px-3"
                        onClick={() => handleAnalyzeExisting(resume.id)}
                        disabled={loading}
                      >
                        {analyzing ? <FiLoader className="animate-spin" /> : 'Analyze'}
                      </button>
                    )}

                    <button
                      className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                      onClick={() => {
                        navigate('/analysis', { state: { resumeId: resume.id } });
                      }}
                    >
                      View Details
                    </button>

                    <button
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDelete(resume.id)}
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadResume;