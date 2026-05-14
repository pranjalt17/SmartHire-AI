// ─── Key names ────────────────────────────────────────────────────────────────
// All keys live here. Never use raw strings elsewhere.
const K = {
  USER_ID: 'smarthire_user_id',
  USER_EMAIL: 'smarthire_user_email',
  RESUMES: (uid) => `smarthire_resumes_${uid}`,
  ANALYSIS: (resumeId) => `smarthire_analysis_${resumeId}`,
  JOB_RECS: 'smarthire_job_recommendations',
  CURRENT_RESUME: 'smarthire_current_resume_id',
};

// ─── Safe JSON helpers ────────────────────────────────────────────────────────
const safeGet = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const safeSet = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Storage write failed:', key, e);
  }
};

// ─── Auth storage ─────────────────────────────────────────────────────────────
export const authStorage = {
  save: (userId, email) => {
    localStorage.setItem(K.USER_ID, userId);
    localStorage.setItem(K.USER_EMAIL, email);
  },
  load: () => {
    const id = localStorage.getItem(K.USER_ID);
    const email = localStorage.getItem(K.USER_EMAIL);
    return id && email ? { id, email } : null;
  },
  clear: () => {
    localStorage.removeItem(K.USER_ID);
    localStorage.removeItem(K.USER_EMAIL);
  },
};

// ─── Resume library storage ───────────────────────────────────────────────────
// Each resume object shape:
// { id, name, size, uploadedAt, analysis: normalizedAnalysis | null }
export const resumeStorage = {
  getAll: (userId) => safeGet(K.RESUMES(userId)) || [],

  // Upsert a resume (adds if new, merges if exists)
  save: (userId, resumeData) => {
    const list = resumeStorage.getAll(userId);
    const idx = list.findIndex((r) => r.id === resumeData.id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...resumeData };
    } else {
      list.unshift(resumeData); // newest first
    }
    safeSet(K.RESUMES(userId), list);
    return list;
  },

  remove: (userId, resumeId) => {
    const list = resumeStorage.getAll(userId).filter((r) => r.id !== resumeId);
    safeSet(K.RESUMES(userId), list);
    return list;
  },

  // Attach analysis result directly onto the resume object
  saveAnalysis: (userId, resumeId, analysis) => {
    const list = resumeStorage.getAll(userId);
    const idx = list.findIndex((r) => r.id === resumeId);
    if (idx >= 0) {
      list[idx].analysis = analysis;
      safeSet(K.RESUMES(userId), list);
    }
    // Also store separately for fast lookup
    safeSet(K.ANALYSIS(resumeId), analysis);
  },

  // Get cached analysis (checks resume object first, then standalone key)
  getAnalysis: (userId, resumeId) => {
    const list = resumeStorage.getAll(userId);
    const resume = list.find((r) => r.id === resumeId);
    if (resume?.analysis) return resume.analysis;
    return safeGet(K.ANALYSIS(resumeId));
  },

  setCurrentId: (resumeId) => localStorage.setItem(K.CURRENT_RESUME, resumeId),
  getCurrentId: () => localStorage.getItem(K.CURRENT_RESUME),
};

// ─── Job recommendations storage ──────────────────────────────────────────────
export const jobStorage = {
  save: (jobs) => safeSet(K.JOB_RECS, jobs),
  load: () => safeGet(K.JOB_RECS) || [],
  clear: () => localStorage.removeItem(K.JOB_RECS),
};

// ─── Normalize raw API analysis response ──────────────────────────────────────
// The backend can return skills/experience as strings or objects.
// This always returns a clean, consistent shape.
export const normalizeAnalysis = (raw) => {
  if (!raw) return null;

  let skills = raw.skills || [];
  if (typeof skills === 'string') {
    try { skills = JSON.parse(skills); } catch { skills = []; }
  }
  if (!Array.isArray(skills)) skills = [];

  let experience = raw.experience || {};
  if (typeof experience === 'string') {
    try { experience = JSON.parse(experience); } catch { experience = {}; }
  }

  let improvements = raw.improvements || [];
  if (typeof improvements === 'string') {
    try { improvements = JSON.parse(improvements); } catch { improvements = []; }
  }
  if (!Array.isArray(improvements)) improvements = [];

  return {
    ats_score: Number(raw.ats_score) || 70,
    skills,
    experience,
    improvements,
    suggested_role: raw.suggested_role || raw.role || 'Software Developer',
  };
};