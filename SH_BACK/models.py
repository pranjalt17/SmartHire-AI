from sqlalchemy import Column, Integer, String, Text, ForeignKey, Float, TIMESTAMP, Boolean, DateTime
from sqlalchemy.sql import func
from database import Base

# 1. USERS
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    created_at = Column(TIMESTAMP, server_default=func.now())


# 2. RESUMES
class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    original_file_path = Column(Text)
    extracted_text = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())


# 3. ANALYSIS
class Analysis(Base):
    __tablename__ = "analysis"

    id = Column(Integer, primary_key=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"))
    skills = Column(Text)
    role = Column(String)
    experience = Column(Text)
    ats_score = Column(Float, nullable=True)
    improvements = Column(Text, nullable=True)
    created_at = Column(TIMESTAMP, server_default=func.now())


# 4. JOBS (with cache tracking)
class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True)
    title = Column(String)
    company = Column(String)
    description = Column(Text)
    link = Column(Text)
    location = Column(String, nullable=True)  # Added
    posted_at = Column(String, nullable=True)  # Added
    search_query = Column(String, nullable=True)  # Track what search found this job
    created_at = Column(TIMESTAMP, server_default=func.now())
    last_used = Column(DateTime, nullable=True)  # Track when last shown to user


# 5. MATCHES
class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    job_id = Column(Integer, ForeignKey("jobs.id"))
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=True)  # Added - link to specific resume
    match_score = Column(Float)
    missing_skills = Column(Text)
    created_at = Column(TIMESTAMP, server_default=func.now())


# 6. OPTIMIZED RESUMES (with view tracking)
class OptimizedResume(Base):
    __tablename__ = "optimized_resumes"

    id = Column(Integer, primary_key=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"))
    job_id = Column(Integer, ForeignKey("jobs.id"))
    optimized_text = Column(Text)
    ats_score = Column(Float)
    created_at = Column(TIMESTAMP, server_default=func.now())
    last_viewed = Column(DateTime, nullable=True)  # Track when last viewed
    view_count = Column(Integer, default=0)  # Track how many times viewed