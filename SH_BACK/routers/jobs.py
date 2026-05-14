from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional
import json
import re
from datetime import datetime, timedelta

from models import Resume, Analysis, Job, Match, OptimizedResume
from dependencies import get_db
from services.job_search import JobSearchService
from services.ai_service import match_resume_with_job

router = APIRouter(prefix="/jobs", tags=["Jobs"])
job_search = JobSearchService()


@router.get("/search")
def search_jobs(
    skills: Optional[str] = Query(None, description="Comma-separated skills"),
    role: Optional[str] = Query(None, description="Job role to search"),
    location: str = "India",
    limit: int = Query(3, description="Max 3 jobs per search"),
    db: Session = Depends(get_db)
):
    """Search for jobs using SerpAPI"""
    
    if limit > 3:
        limit = 3
    
    if skills:
        skills_list = [s.strip() for s in skills.split(",")]
        jobs = job_search.search_jobs(skills_list, location, limit)
    elif role:
        jobs = job_search.search_jobs_by_role(role, location, limit)
    else:
        raise HTTPException(status_code=400, detail="Either skills or role is required")
    
    stored_jobs = []
    for job_data in jobs:
        existing_job = db.query(Job).filter(
            Job.title == job_data.get("title"),
            Job.company == job_data.get("company")
        ).first()
        
        if existing_job:
            job_id = existing_job.id
            if not existing_job.link and job_data.get("link"):
                existing_job.link = job_data.get("link")
                db.commit()
        else:
            new_job = Job(
                title=job_data.get("title", ""),
                company=job_data.get("company", ""),
                description=job_data.get("description", ""),
                link=job_data.get("link", ""),
                location=job_data.get("location", "India"),
                posted_at=job_data.get("posted_at", "Recently")
            )
            db.add(new_job)
            db.commit()
            db.refresh(new_job)
            job_id = new_job.id
        
        final_job = db.query(Job).filter(Job.id == job_id).first()
        
        stored_jobs.append({
            "id": job_id,
            "title": job_data.get("title", ""),
            "company": job_data.get("company", ""),
            "location": job_data.get("location", "India"),
            "description": job_data.get("description", ""),
            "link": final_job.link if final_job else job_data.get("link", ""),
            "posted_at": job_data.get("posted_at", "Recently")
        })
    
    return {
        "total": len(stored_jobs),
        "remaining_searches": job_search.get_remaining_searches(),
        "jobs": stored_jobs
    }


@router.get("/recommend/{user_id}")
def recommend_jobs(
    user_id: int,
    resume_id: Optional[int] = None,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Get job recommendations for a specific resume"""
    
    print(f"🔍 Getting recommendations for user {user_id}, resume_id: {resume_id}")
    
    # Get the resume
    if resume_id:
        resume = db.query(Resume).filter(
            Resume.id == resume_id,
            Resume.user_id == user_id
        ).first()
    else:
        resume = db.query(Resume).filter(
            Resume.user_id == user_id
        ).order_by(Resume.created_at.desc()).first()
        if resume:
            resume_id = resume.id
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    # Get analysis
    analysis = db.query(Analysis).filter(Analysis.resume_id == resume.id).first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Please analyze your resume first")
    
    # Check for cached jobs
    cutoff_time = datetime.now() - timedelta(hours=24)
    
    cached_matches = db.query(Match).filter(    
        Match.user_id == user_id,
        Match.resume_id == resume_id,
        Match.created_at >= cutoff_time
    ).all()
    
    if cached_matches and len(cached_matches) >= limit:
        print(f"✅ Using {len(cached_matches)} cached jobs")
        recommended_jobs = []
        for match in cached_matches[:limit]:
            job = db.query(Job).filter(Job.id == match.job_id).first()
            if job:
                optimized = db.query(OptimizedResume).filter(
                    OptimizedResume.resume_id == resume_id,
                    OptimizedResume.job_id == job.id
                ).first()
                
                recommended_jobs.append({
                    "job_id": job.id,
                    "title": job.title,
                    "company": job.company,
                    "location": job.location or "India",
                    "description": job.description[:500] + "..." if job.description else "",
                    "link": job.link or "",
                    "match_score": match.match_score,
                    "missing_skills": json.loads(match.missing_skills) if match.missing_skills else [],
                    "has_optimized": optimized is not None,
                    "optimized_resume_id": optimized.id if optimized else None
                })
        
        return {
            "resume_id": resume_id,
            "recommendations": recommended_jobs,
            "total": len(recommended_jobs),
            "source": "cache"
        }
    
    # Extract skills
    skills = []
    try:
        if analysis.skills:
            if isinstance(analysis.skills, str):
                skills = json.loads(analysis.skills)
            else:
                skills = analysis.skills
        print(f"📋 Extracted skills: {skills[:5] if skills else 'None'}")
    except Exception as e:
        print(f"Error parsing skills: {e}")
        skills = []
    
    if not skills:
        role = analysis.role or "software developer"
        print(f"No skills found, using role: {role}")
    else:
        role = None
    
    actual_limit = min(limit, 3)
    
    try:
        if skills:
            jobs_data = job_search.search_jobs(skills[:3], "India", actual_limit)
        else:
            jobs_data = job_search.search_jobs_by_role(role, "India", actual_limit)
        
        print(f"📊 Found {len(jobs_data)} jobs from SerpAPI")
        
        if not jobs_data:
            return {
                "resume_id": resume_id,
                "recommendations": [],
                "total": 0
            }
        
        recommended_jobs = []
        for idx, job_data in enumerate(jobs_data):
            print(f"🔄 Processing job {idx + 1}: {job_data.get('title')}")
            
            existing_job = db.query(Job).filter(
                Job.title == job_data.get("title"),
                Job.company == job_data.get("company")
            ).first()
            
            if existing_job:
                job_id = existing_job.id
                if not existing_job.link and job_data.get("link"):
                    existing_job.link = job_data.get("link")
                    db.commit()
            else:
                new_job = Job(
                    title=job_data.get("title", ""),
                    company=job_data.get("company", ""),
                    description=job_data.get("description", ""),
                    link=job_data.get("link", ""),
                    location=job_data.get("location", "India"),
                    posted_at=job_data.get("posted_at", "Recently"),
                    search_query=str(skills[:3]) if skills else role,
                    last_used=datetime.now()
                )
                db.add(new_job)
                db.commit()
                db.refresh(new_job)
                job_id = new_job.id
            
            final_job = db.query(Job).filter(Job.id == job_id).first()
            final_link = final_job.link if final_job else job_data.get("link", "")
            
            # Calculate match score
            match_score = 50
            missing_skills = []
            try:
                match_result = match_resume_with_job(
                    resume.extracted_text[:3000],
                    job_data.get("description", "")[:2000],
                    None
                )
                cleaned = re.sub(r'```json\s*', '', match_result)
                cleaned = re.sub(r'```\s*$', '', cleaned)
                cleaned = cleaned.strip()
                if cleaned:
                    match_data = json.loads(cleaned)
                    match_score = match_data.get("match_score", 50)
                    missing_skills = match_data.get("missing_skills", [])
                print(f"  Match score: {match_score}%")
            except Exception as e:
                print(f"  Error calculating match: {e}")
            
            # Save match
            existing_match = db.query(Match).filter(
                Match.user_id == user_id,
                Match.job_id == job_id,
                Match.resume_id == resume_id
            ).first()
            
            if not existing_match:
                new_match = Match(
                    user_id=user_id,
                    job_id=job_id,
                    resume_id=resume_id,
                    match_score=match_score,
                    missing_skills=json.dumps(missing_skills)
                )
                db.add(new_match)
                db.commit()
            
            optimized = db.query(OptimizedResume).filter(
                OptimizedResume.resume_id == resume_id,
                OptimizedResume.job_id == job_id
            ).first()
            
            recommended_jobs.append({
                "job_id": job_id,
                "title": job_data.get("title", ""),
                "company": job_data.get("company", ""),
                "location": job_data.get("location", "India"),
                "description": job_data.get("description", "")[:300] + "..." if job_data.get("description") else "",
                "link": final_link,
                "match_score": match_score,
                "missing_skills": missing_skills[:5] if missing_skills else [],
                "has_optimized": optimized is not None,
                "optimized_resume_id": optimized.id if optimized else None
            })
        
        recommended_jobs.sort(key=lambda x: x["match_score"], reverse=True)
        
        print(f"✅ Returning {len(recommended_jobs)} recommendations")
        
        return {
            "resume_id": resume_id,
            "recommendations": recommended_jobs,
            "total": len(recommended_jobs),
            "source": "fresh"
        }
        
    except Exception as e:
        print(f"❌ Error in recommend_jobs: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Job search failed: {str(e)}")


@router.get("/previous-optimizations/{resume_id}")
def get_previous_optimizations(
    resume_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get all previously optimized resumes for a specific resume"""
    
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == user_id
    ).first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    optimizations = db.query(OptimizedResume).filter(
        OptimizedResume.resume_id == resume_id
    ).order_by(OptimizedResume.created_at.desc()).all()
    
    result = []
    for opt in optimizations:
        job = db.query(Job).filter(Job.id == opt.job_id).first()
        if job:
            result.append({
                "optimized_id": opt.id,
                "job_id": job.id,
                "job_title": job.title,
                "job_company": job.company,
                "job_link": job.link or "",
                "ats_score": opt.ats_score,
                "optimized_at": opt.created_at,
                "optimized_text": opt.optimized_text
            })
    
    return {"optimizations": result, "total": len(result)}


@router.get("/previous-jobs/{resume_id}")
def get_previous_jobs(
    resume_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get all previously searched jobs for a specific resume"""
    
    matches = db.query(Match).filter(
        Match.resume_id == resume_id,
        Match.user_id == user_id
    ).order_by(Match.created_at.desc()).all()
    
    previous_jobs = []
    for match in matches:
        job = db.query(Job).filter(Job.id == match.job_id).first()
        if job:
            optimized = db.query(OptimizedResume).filter(
                OptimizedResume.resume_id == resume_id,
                OptimizedResume.job_id == job.id
            ).first()
            
            previous_jobs.append({
                "job_id": job.id,
                "title": job.title,
                "company": job.company,
                "link": job.link or "",
                "match_score": match.match_score,
                "has_optimized": optimized is not None,
                "optimized_resume_id": optimized.id if optimized else None,
                "searched_at": match.created_at
            })
    
    return {"previous_jobs": previous_jobs, "total": len(previous_jobs)}


@router.get("/cached/{user_id}")
def get_cached_jobs(
    user_id: int,
    resume_id: Optional[int] = None,
    limit: int = 5,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """Get cached jobs from database (no API calls)"""
    
    query = db.query(Job).join(Match, Match.job_id == Job.id).filter(Match.user_id == user_id)
    
    if resume_id:
        query = query.filter(Match.resume_id == resume_id)
    
    query = query.order_by(Job.created_at.desc())
    
    total = query.count()
    jobs = query.offset(offset).limit(limit).all()
    has_more = (offset + limit) < total
    
    result = []
    for job in jobs:
        match = db.query(Match).filter(
            Match.job_id == job.id,
            Match.user_id == user_id
        )
        if resume_id:
            match = match.filter(Match.resume_id == resume_id)
        match = match.first()
        
        optimized = None
        if resume_id:
            optimized = db.query(OptimizedResume).filter(
                OptimizedResume.resume_id == resume_id,
                OptimizedResume.job_id == job.id
            ).first()
        
        result.append({
            "job_id": job.id,
            "title": job.title,
            "company": job.company,
            "description": job.description[:300] + "..." if job.description else "",
            "link": job.link or "",
            "match_score": match.match_score if match else None,
            "has_optimized": optimized is not None,
            "optimized_resume_id": optimized.id if optimized else None
        })
    
    return {
        "jobs": result,
        "total": total,
        "has_more": has_more,
        "offset": offset,
        "limit": limit
    }


@router.get("/history/{user_id}")
def get_job_history(
    user_id: int,
    resume_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get user's job interaction history"""
    
    query = db.query(Match).filter(Match.user_id == user_id)
    if resume_id:
        query = query.filter(Match.resume_id == resume_id)
    
    matches = query.order_by(Match.created_at.desc()).all()
    
    history = []
    for match in matches:
        job = db.query(Job).filter(Job.id == match.job_id).first()
        if job:
            optimized = None
            if match.resume_id:
                optimized = db.query(OptimizedResume).filter(
                    OptimizedResume.resume_id == match.resume_id,
                    OptimizedResume.job_id == job.id
                ).first()
            
            history.append({
                "job_id": job.id,
                "title": job.title,
                "company": job.company,
                "link": job.link or "",
                "match_score": match.match_score,
                "has_optimized": optimized is not None,
                "optimized_resume_id": optimized.id if optimized else None,
                "interacted_at": match.created_at
            })
    
    return {"history": history, "total": len(history)}


@router.get("/search-new/{user_id}")
def search_new_jobs(
    user_id: int,
    resume_id: int,
    limit: int = 5,
    db: Session = Depends(get_db)
):
    """Search for NEW jobs from API and cache them"""
    
    print(f"🔍 Searching new jobs for user {user_id}, resume {resume_id}")
    
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == user_id
    ).first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    analysis = db.query(Analysis).filter(Analysis.resume_id == resume.id).first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Please analyze your resume first")
    
    skills = []
    try:
        if analysis.skills:
            skills = json.loads(analysis.skills) if isinstance(analysis.skills, str) else analysis.skills
    except:
        skills = []
    
    if not skills:
        role = analysis.role or "software developer"
    else:
        role = None
    
    if skills:
        jobs_data = job_search.search_jobs(skills[:3], "India", limit)
    else:
        jobs_data = job_search.search_jobs_by_role(role, "India", limit)
    
    new_jobs = []
    for job_data in jobs_data:
        existing_job = db.query(Job).filter(
            Job.title == job_data.get("title"),
            Job.company == job_data.get("company")
        ).first()
        
        if existing_job:
            job_id = existing_job.id
            if not existing_job.link and job_data.get("link"):
                existing_job.link = job_data.get("link")
                db.commit()
        else:
            new_job = Job(
                title=job_data.get("title", ""),
                company=job_data.get("company", ""),
                description=job_data.get("description", ""),
                link=job_data.get("link", ""),
                location=job_data.get("location", "India"),
                posted_at=job_data.get("posted_at", "Recently")
            )
            db.add(new_job)
            db.commit()
            db.refresh(new_job)
            job_id = new_job.id
        
        final_job = db.query(Job).filter(Job.id == job_id).first()
        
        try:
            match_result = match_resume_with_job(
                resume.extracted_text[:5000],
                job_data.get("description", "")[:3000],
                None
            )
            cleaned = re.sub(r'```json\s*', '', match_result)
            cleaned = re.sub(r'```\s*$', '', cleaned)
            match_data = json.loads(cleaned)
            match_score = match_data.get("match_score", 50)
            missing_skills = match_data.get("missing_skills", [])
        except:
            match_score = 50
            missing_skills = []
        
        new_jobs.append({
            "job_id": job_id,
            "title": job_data.get("title", ""),
            "company": job_data.get("company", ""),
            "location": job_data.get("location", "India"),
            "description": job_data.get("description", "")[:300],
            "link": final_job.link if final_job else job_data.get("link", ""),
            "match_score": match_score,
            "missing_skills": missing_skills[:5] if missing_skills else []
        })
    
    return {"jobs": new_jobs, "total": len(new_jobs)}


@router.post("/track-optimized-view/{optimized_id}")
def track_optimized_view(
    optimized_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Track when an optimized resume is viewed"""
    
    optimized = db.query(OptimizedResume).filter(OptimizedResume.id == optimized_id).first()
    if optimized:
        resume = db.query(Resume).filter(Resume.id == optimized.resume_id).first()
        if resume and resume.user_id == user_id:
            optimized.last_viewed = datetime.now()
            optimized.view_count = (optimized.view_count or 0) + 1
            db.commit()
            return {"message": "View tracked"}
    
    raise HTTPException(status_code=404, detail="Optimized resume not found")


@router.get("/matches/{user_id}")
def get_user_matches(
    user_id: int,
    resume_id: Optional[int] = None,
    limit: int = 20,
    db: Session = Depends(get_db)
):
    """Get all job matches for a user from database"""
    
    query = db.query(Match).filter(Match.user_id == user_id)
    if resume_id:
        query = query.filter(Match.resume_id == resume_id)
    
    matches = query.order_by(Match.match_score.desc()).limit(limit).all()
    
    results = []
    for match in matches:
        job = db.query(Job).filter(Job.id == match.job_id).first()
        if job:
            try:
                missing_skills = json.loads(match.missing_skills) if match.missing_skills else []
            except:
                missing_skills = []
            
            results.append({
                "match_id": match.id,
                "job_id": job.id,
                "title": job.title,
                "company": job.company,
                "description": job.description[:200] + "..." if job.description else "",
                "link": job.link or "",
                "match_score": match.match_score,
                "missing_skills": missing_skills,
                "matched_at": match.created_at
            })
    
    return {
        "total": len(results),
        "matches": results
    }


@router.get("/remaining-searches")
def get_remaining_searches():
    """Check remaining SerpAPI searches"""
    return {
        "remaining_searches": job_search.get_remaining_searches(),
        "total_monthly_limit": 100
    }


@router.get("/optimized-list/{resume_id}")
def get_optimized_resumes_for_resume(
    resume_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get all optimized resumes for a specific uploaded resume"""
    
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == user_id
    ).first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    optimizations = db.query(OptimizedResume).filter(
        OptimizedResume.resume_id == resume_id
    ).order_by(OptimizedResume.created_at.desc()).all()
    
    result = []
    for opt in optimizations:
        job = db.query(Job).filter(Job.id == opt.job_id).first()
        if job:
            result.append({
                "optimized_id": opt.id,
                "job_id": job.id,
                "job_title": job.title,
                "job_company": job.company,
                "job_link": job.link or "",
                "ats_score": opt.ats_score,
                "optimized_at": opt.created_at,
                "optimized_text": opt.optimized_text
            })
    
    return {
        "resume_id": resume_id,
        "resume_name": resume.original_file_path.split("/")[-1] if resume.original_file_path else "Unknown",
        "optimized_resumes": result,
        "total": len(result)
    }


@router.get("/{job_id}")
def get_job_details(
    job_id: int,
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific job"""
    
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "description": job.description,
        "link": job.link or "",
        "created_at": job.created_at
    }


@router.put("/update-job-link/{job_id}")
def update_job_link(
    job_id: int,
    link: str,
    db: Session = Depends(get_db)
):
    """Update a job's application link manually"""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job.link = link
    job.last_used = datetime.now()
    db.commit()
    
    return {"message": "Link updated successfully", "link": link}