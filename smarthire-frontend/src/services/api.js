const API_BASE_URL = 'http://localhost:8000';

const request = async (method, path, body = null, isForm = false, timeout = 120000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const headers = isForm ? {} : { 'Content-Type': 'application/json' };

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      signal: controller.signal,
      ...(body ? { body: isForm ? body : JSON.stringify(body) } : {}),
    });

    clearTimeout(timer);

    // For PDF responses, handle as blob
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/pdf')) {
      const blob = await res.blob();
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      return blob;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || data.detail || `Request failed (${res.status})`);
    }

    console.log(`✅ ${method} ${path}`, data);
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
    throw err;
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// AUTH API
// ──────────────────────────────────────────────────────────────────────────────
export const authAPI = {
  signup: (name, email, password) =>
    request('POST', '/auth/signup', {
      name,
      email,
      password,
      confirm_password: password,
    }),

  login: (email, password) =>
    request('POST', '/auth/login', { email, password }),
};

// ──────────────────────────────────────────────────────────────────────────────
// RESUME API
// ──────────────────────────────────────────────────────────────────────────────
export const resumeAPI = {
  upload: (userId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return request('POST', `/resume/upload?user_id=${userId}`, formData, true, 120000);
  },
  
  getAll: (userId) =>
    request('GET', `/resume/list/${userId}`, null, false, 30000),
  
  getOne: (resumeId, userId) =>
    request('GET', `/resume/${resumeId}?user_id=${userId}`, null, false, 30000),
  
  delete: (resumeId, userId) =>
    request('DELETE', `/resume/${resumeId}?user_id=${userId}`, null, false, 30000),
};

// ──────────────────────────────────────────────────────────────────────────────
// ANALYSIS API
// ──────────────────────────────────────────────────────────────────────────────
export const analysisAPI = {
  analyze: (resumeId, userId) =>
    request('POST', `/analysis/analyze/${resumeId}?user_id=${userId}`, {}, false, 180000),

  getAnalysis: (resumeId, userId) =>
    request('GET', `/analysis/${resumeId}?user_id=${userId}`, null, false, 30000),

  optimize: (resumeId, userId, jobId, jobTitle, jobDescription) =>
    request(
      'POST',
      `/analysis/optimize/${resumeId}?user_id=${userId}&job_id=${jobId}`,
      { job_title: jobTitle, job_description: jobDescription },
      false,
      180000
    ),
  
  match: (resumeId, userId, jobId, jobDescription, jobRequirements = null) =>
    request(
      'POST',
      `/analysis/match/${resumeId}?user_id=${userId}&job_id=${jobId}`,
      { job_description: jobDescription, job_requirements: jobRequirements },
      false,
      120000
    ),
  
  generatePDF: (optimizedResumeId, userId, candidateName) =>
    request(
      'POST', 
      `/analysis/generate-pdf/${optimizedResumeId}?user_id=${userId}&candidate_name=${encodeURIComponent(candidateName)}`, 
      null, 
      false, 
      60000
    ),
};

// ──────────────────────────────────────────────────────────────────────────────
// JOBS API
// ──────────────────────────────────────────────────────────────────────────────
export const jobsAPI = {
  // Search for jobs using SerpAPI
  search: (skills, role, location = "India", limit = 3) => {
    let url = `/jobs/search?location=${location}&limit=${limit}`;
    if (skills) url += `&skills=${encodeURIComponent(skills)}`;
    if (role) url += `&role=${encodeURIComponent(role)}`;
    return request('GET', url, null, false, 60000);
  },
  
  // Get job recommendations (fetches new from API)
  recommend: (userId, resumeId, limit = 5) => {
  let url = `/jobs/recommend/${userId}?limit=${limit}`;
  if (resumeId) url += `&resume_id=${resumeId}`;
  return request('GET', url, null, false, 180000); // 3 minutes timeout
  },
  
  // Get cached jobs from database (no API calls)
  getCachedJobs: (userId, resumeId = null, limit = 5, offset = 0) => {
    let url = `/jobs/cached/${userId}?limit=${limit}&offset=${offset}`;
    if (resumeId) url += `&resume_id=${resumeId}`;
    return request('GET', url, null, false, 30000);
  },
  
  // Get previously searched jobs for a specific resume
  getPreviousJobs: (resumeId, userId) =>
    request('GET', `/jobs/previous-jobs/${resumeId}?user_id=${userId}`, null, false, 30000),
  
  // Get all previously optimized resumes for a specific resume
  getPreviousOptimizations: (resumeId, userId) =>
    request('GET', `/jobs/previous-optimizations/${resumeId}?user_id=${userId}`, null, false, 30000),
  
  // Get user's job history
  getJobHistory: (userId, resumeId = null) => {
    let url = `/jobs/history/${userId}`;
    if (resumeId) url += `?resume_id=${resumeId}`;
    return request('GET', url, null, false, 30000);
  },
  
  // Search for new jobs from API
  searchNewJobs: (userId, resumeId, limit = 5) =>
    request('GET', `/jobs/search-new/${userId}?resume_id=${resumeId}&limit=${limit}`, null, false, 60000),
  
  // Get all optimized resumes for a resume
  getOptimizedResumesForResume: (resumeId, userId) =>
    request('GET', `/jobs/optimized-list/${resumeId}?user_id=${userId}`, null, false, 30000),
  
  // Track when optimized resume is viewed
  trackOptimizedView: (optimizedId, userId) =>
    request('POST', `/jobs/track-optimized-view/${optimizedId}?user_id=${userId}`, {}, false, 30000),

  // Get user's job matches
  getMatches: (userId, resumeId = null, limit = 20) => {
    let url = `/jobs/matches/${userId}?limit=${limit}`;
    if (resumeId) url += `&resume_id=${resumeId}`;
    return request('GET', url, null, false, 30000);
  },

  // Get remaining SerpAPI searches
  getRemainingSearches: () =>
    request('GET', '/jobs/remaining-searches', null, false, 10000),
  
  // Get job details by ID
  getJobDetails: (jobId) =>
    request('GET', `/jobs/${jobId}`, null, false, 30000),
};