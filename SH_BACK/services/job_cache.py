from sqlalchemy.orm import Session
from models import Job, Match, OptimizedResume
from datetime import datetime, timedelta
from typing import List, Dict, Optional

class JobCache:
    """
    Enhanced job cache with history tracking
    """
    
    @staticmethod
    def get_cached_jobs(db: Session, user_id: int, resume_id: int = None, limit: int = 3, offset: int = 0) -> dict:
        """
        Get cached jobs that haven't been shown to user yet
        Returns: {jobs: [...], total: int, has_more: bool}
        """
        from sqlalchemy import and_, or_
        
        # Get jobs that have matches for this user
        query = db.query(Job).join(Match, Match.job_id == Job.id).filter(Match.user_id == user_id)
        
        # Filter by resume if specified
        if resume_id:
            query = query.filter(Match.resume_id == resume_id)
        
        # Order by most recent first
        query = query.order_by(Job.created_at.desc())
        
        total = query.count()
        
        # Apply pagination
        jobs = query.offset(offset).limit(limit).all()
        
        # Check if there are more jobs
        has_more = (offset + limit) < total
        
        # Convert to dict
        result = []
        for job in jobs:
            # Check if optimized resume exists for this job and resume
            optimized = db.query(OptimizedResume).filter(
                OptimizedResume.job_id == job.id,
                OptimizedResume.resume_id == resume_id
            ).first() if resume_id else None
            
            # Get match score
            match = db.query(Match).filter(
                Match.job_id == job.id,
                Match.user_id == user_id,
                Match.resume_id == resume_id if resume_id else True
            ).first()
            
            result.append({
                "id": job.id,
                "title": job.title,
                "company": job.company,
                "location": job.location or "India",
                "description": job.description[:500] + "..." if job.description else "",
                "link": job.link,
                "posted_at": job.posted_at or "Recently",
                "match_score": match.match_score if match else None,
                "has_optimized": optimized is not None,
                "optimized_resume_id": optimized.id if optimized else None,
                "cached_at": job.created_at
            })
        
        return {
            "jobs": result,
            "total": total,
            "has_more": has_more,
            "offset": offset,
            "limit": limit
        }
    
    @staticmethod
    def get_user_job_history(db: Session, user_id: int, resume_id: int = None) -> List[dict]:
        """
        Get all jobs a user has interacted with (optimized or matched)
        """
        history = []
        
        # Get all matches for this user
        matches_query = db.query(Match).filter(Match.user_id == user_id)
        if resume_id:
            matches_query = matches_query.filter(Match.resume_id == resume_id)
        
        matches = matches_query.order_by(Match.created_at.desc()).all()
        
        for match in matches:
            job = db.query(Job).filter(Job.id == match.job_id).first()
            if job:
                optimized = db.query(OptimizedResume).filter(
                    OptimizedResume.job_id == job.id,
                    OptimizedResume.resume_id == match.resume_id
                ).first()
                
                history.append({
                    "job_id": job.id,
                    "title": job.title,
                    "company": job.company,
                    "match_score": match.match_score,
                    "optimized_at": optimized.created_at if optimized else None,
                    "has_optimized": optimized is not None,
                    "optimized_resume_id": optimized.id if optimized else None,
                    "matched_at": match.created_at
                })
        
        return history
    
    @staticmethod
    def save_job_to_cache(db: Session, job_data: dict, search_query: str = None) -> Job:
        """
        Save a job to cache (avoid duplicates)
        """
        # Check if job already exists
        existing = db.query(Job).filter(
            Job.title == job_data.get("title"),
            Job.company == job_data.get("company")
        ).first()
        
        if existing:
            # Update last_used
            existing.last_used = datetime.now()
            db.commit()
            db.refresh(existing)
            return existing
        
        # Create new job
        new_job = Job(
            title=job_data.get("title", ""),
            company=job_data.get("company", ""),
            description=job_data.get("description", ""),
            link=job_data.get("link", ""),
            location=job_data.get("location", "India"),
            posted_at=job_data.get("posted_at", "Recently"),
            search_query=search_query,
            last_used=datetime.now()
        )
        
        db.add(new_job)
        db.commit()
        db.refresh(new_job)
        
        return new_job
    
    @staticmethod
    def get_optimized_resumes_for_resume(db: Session, resume_id: int) -> List[dict]:
        """
        Get all optimized resumes for a specific uploaded resume
        """
        optimized_list = db.query(OptimizedResume).filter(
            OptimizedResume.resume_id == resume_id
        ).order_by(OptimizedResume.created_at.desc()).all()
        
        result = []
        for opt in optimized_list:
            job = db.query(Job).filter(Job.id == opt.job_id).first()
            if job:
                result.append({
                    "optimized_id": opt.id,
                    "job_id": job.id,
                    "job_title": job.title,
                    "job_company": job.company,
                    "ats_score": opt.ats_score,
                    "optimized_at": opt.created_at,
                    "last_viewed": opt.last_viewed,
                    "view_count": opt.view_count
                })
        
        return result
    
    @staticmethod
    def update_optimized_view(db: Session, optimized_id: int):
        """
        Track when an optimized resume is viewed
        """
        optimized = db.query(OptimizedResume).filter(OptimizedResume.id == optimized_id).first()
        if optimized:
            optimized.last_viewed = datetime.now()
            optimized.view_count = (optimized.view_count or 0) + 1
            db.commit()