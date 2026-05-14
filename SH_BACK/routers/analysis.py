from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel
import json
import re
import io
from datetime import datetime

from models import Resume, Analysis, User, Job, OptimizedResume, Match
from dependencies import get_db
from services.ai_service import analyze_resume, match_resume_with_job, optimize_resume_for_job
from fastapi.responses import StreamingResponse
from services.pdf_service import PDFResumeGenerator

router = APIRouter(prefix="/analysis", tags=["Analysis"])
pdf_generator = PDFResumeGenerator()


class OptimizeRequest(BaseModel):
    job_title: Optional[str] = None
    job_description: Optional[str] = None


class MatchRequest(BaseModel):
    job_description: str
    job_requirements: Optional[str] = None


def clean_ai_response(response_text: str) -> str:
    """Remove markdown code blocks and extract clean JSON"""
    if not response_text:
        return "{}"
    
    cleaned = re.sub(r'```json\s*', '', response_text)
    cleaned = re.sub(r'```\s*$', '', cleaned)
    cleaned = re.sub(r'^```\s*', '', cleaned)
    cleaned = cleaned.strip()
    
    return cleaned


def parse_json_field(field_value, default):
    """Safely parse JSON field from database"""
    if not field_value:
        return default
    
    try:
        parsed = json.loads(field_value)
        return parsed
    except (json.JSONDecodeError, TypeError):
        if isinstance(field_value, (list, dict)):
            return field_value
        if isinstance(field_value, str):
            cleaned = clean_ai_response(field_value)
            try:
                return json.loads(cleaned)
            except:
                return default
        return default


@router.post("/analyze/{resume_id}")
def analyze_user_resume(resume_id: int, user_id: int, db: Session = Depends(get_db)):
    """Analyze a specific resume using AI"""
    
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == user_id
    ).first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    existing_analysis = db.query(Analysis).filter(Analysis.resume_id == resume_id).first()
    
    try:
        ai_response = analyze_resume(resume.extracted_text)
        cleaned_response = clean_ai_response(ai_response)
        print(f"Cleaned AI response: {cleaned_response[:200]}...")
        analysis_data = json.loads(cleaned_response)
        print(f"Parsed analysis data: {analysis_data}")
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error: {e}")
        return {
            "message": "Analysis completed but response parsing failed",
            "analysis_id": existing_analysis.id if existing_analysis else None,
            "skills": [],
            "experience": {"years": "Not specified", "summary": "Unable to parse AI response"},
            "suggested_role": "Software Developer",
            "ats_score": None,
            "improvements": ["Please try re-analyzing the resume"],
        }
    
    except Exception as e:
        print(f"Unexpected error: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    
    skills_list = analysis_data.get("skills", [])
    if not isinstance(skills_list, list):
        skills_list = []
    skills = json.dumps(skills_list)
    
    experience_data = analysis_data.get("experience", {})
    if isinstance(experience_data, str):
        try:
            experience_data = json.loads(experience_data)
        except:
            experience_data = {"years": "Not specified", "summary": experience_data}
    if not isinstance(experience_data, dict):
        experience_data = {"years": "Not specified", "summary": str(experience_data)}
    experience = json.dumps(experience_data)
    
    suggested_roles = analysis_data.get("suggested_roles", [])
    suggested_role_str = analysis_data.get("suggested_role", "")
    
    if suggested_role_str and isinstance(suggested_role_str, str):
        role = suggested_role_str
    elif isinstance(suggested_roles, list) and len(suggested_roles) > 0:
        role = suggested_roles[0]
    else:
        role = "Software Developer"
    
    ats_score = analysis_data.get("ats_score")
    if ats_score is not None:
        try:
            ats_score = float(ats_score)
        except (ValueError, TypeError):
            ats_score = None
    
    improvements_raw = analysis_data.get("improvements", [])
    if not isinstance(improvements_raw, list):
        improvements_raw = []
    improvements = json.dumps(improvements_raw)
    
    if existing_analysis:
        existing_analysis.skills = skills
        existing_analysis.experience = experience
        existing_analysis.role = role
        existing_analysis.ats_score = ats_score
        existing_analysis.improvements = improvements
        db.commit()
        db.refresh(existing_analysis)
        
        return {
            "analysis_id": existing_analysis.id,
            "skills": skills_list,
            "experience": experience_data,
            "suggested_role": role,
            "ats_score": ats_score,
            "improvements": improvements_raw,
        }
    else:
        new_analysis = Analysis(
            resume_id=resume_id,
            skills=skills,
            role=role,
            experience=experience,
            ats_score=ats_score,
            improvements=improvements
        )
        db.add(new_analysis)
        db.commit()
        db.refresh(new_analysis)
        
        return {
            "analysis_id": new_analysis.id,
            "skills": skills_list,
            "experience": experience_data,
            "suggested_role": role,
            "ats_score": ats_score,
            "improvements": improvements_raw,
        }


@router.get("/{resume_id}")
def get_resume_analysis(resume_id: int, user_id: int, db: Session = Depends(get_db)):
    """Get stored analysis for a resume"""
    
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == user_id
    ).first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    analysis = db.query(Analysis).filter(Analysis.resume_id == resume_id).first()
    
    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found for this resume")
    
    skills = parse_json_field(analysis.skills, [])
    experience = parse_json_field(analysis.experience, {})
    improvements = parse_json_field(analysis.improvements, []) if analysis.improvements else []
    ats_score = float(analysis.ats_score) if analysis.ats_score else None
    
    return {
        "analysis_id": analysis.id,
        "resume_id": analysis.resume_id,
        "skills": skills,
        "experience": experience,
        "suggested_role": analysis.role or "",
        "ats_score": ats_score,
        "improvements": improvements,
        "created_at": analysis.created_at,
    }


@router.post("/match/{resume_id}")
def match_with_job(
    resume_id: int,
    user_id: int,
    job_id: int,
    body: MatchRequest,
    db: Session = Depends(get_db)
):
    """Match resume with a specific job"""
    
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == user_id
    ).first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    job = db.query(Job).filter(Job.id == job_id).first()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    try:
        match_result = match_resume_with_job(
            resume.extracted_text,
            body.job_description or job.description,
            body.job_requirements
        )
        
        cleaned_response = clean_ai_response(match_result)
        match_data = json.loads(cleaned_response)
        
        new_match = Match(
            user_id=user_id,
            job_id=job_id,
            match_score=match_data.get("match_score", 0),
            missing_skills=json.dumps(match_data.get("missing_skills", []))
        )
        
        db.add(new_match)
        db.commit()
        db.refresh(new_match)
        
        return {
            "match_id": new_match.id,
            "match_score": match_data.get("match_score"),
            "matched_skills": match_data.get("matched_skills"),
            "missing_skills": match_data.get("missing_skills"),
            "experience_match": match_data.get("experience_match"),
            "recommendations": match_data.get("recommendations")
        }
        
    except json.JSONDecodeError as e:
        print(f"JSON parse error in match: {e}")
        return {"message": "Matching completed but response parsing failed"}
    
    except Exception as e:
        print(f"Error in match: {e}")
        raise HTTPException(status_code=500, detail=f"Matching failed: {str(e)}")


@router.post("/optimize/{resume_id}")
def optimize_resume(
    resume_id: int,
    user_id: int,
    job_id: int,
    body: OptimizeRequest,
    db: Session = Depends(get_db)
):
    """Optimize resume for a specific job with professional ATS scoring"""

    print(f"🚀 OPTIMIZE: resume={resume_id}, user={user_id}, job={job_id}")

    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == user_id
    ).first()

    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    job = db.query(Job).filter(Job.id == job_id).first()

    final_job_title = body.job_title or (job.title if job else "Software Developer")
    final_job_description = body.job_description or (job.description if job else "")

    if not final_job_description:
        raise HTTPException(status_code=400, detail="Job description is required")

    try:
        # AI CALL with professional ATS scoring
        optimized_result = optimize_resume_for_job(
            resume.extracted_text,
            final_job_description,
            final_job_title
        )

        print("RAW AI RESPONSE:", optimized_result[:500])

        cleaned_response = clean_ai_response(optimized_result)
        
        try:
            opt_data = json.loads(cleaned_response)
        except:
            opt_data = {
                "optimized_text": cleaned_response,
                "ats_score": 75,
                "breakdown": {
                    "keywords_match": 70,
                    "formatting": 80,
                    "experience": 70,
                    "education": 75
                },
                "keywords_added": [],
                "missing_keywords": [],
                "suggestions": ["Review the optimized resume above"]
            }

        optimized_text = opt_data.get("optimized_text", cleaned_response)
        ats_score = opt_data.get("ats_score", 75)
        breakdown = opt_data.get("breakdown", {})
        keywords_added = opt_data.get("keywords_added", [])
        missing_keywords = opt_data.get("missing_keywords", [])
        suggestions = opt_data.get("suggestions", [])

        # Check if already exists
        existing = db.query(OptimizedResume).filter(
            OptimizedResume.resume_id == resume_id,
            OptimizedResume.job_id == job_id
        ).first()
        
        if existing:
            existing.optimized_text = optimized_text
            existing.ats_score = ats_score
            db.commit()
            db.refresh(existing)
            optimized_id = existing.id
            print("✅ UPDATED existing optimized resume ID:", optimized_id)
        else:
            new_optimized = OptimizedResume(
                resume_id=resume_id,
                job_id=job_id,
                optimized_text=optimized_text,
                ats_score=ats_score
            )
            db.add(new_optimized)
            db.commit()
            db.refresh(new_optimized)
            optimized_id = new_optimized.id
            print("✅ CREATED new optimized resume ID:", optimized_id)

        return {
            "optimized_resume_id": optimized_id,
            "optimized_text": optimized_text,
            "ats_score": ats_score,
            "breakdown": breakdown,
            "keywords_added": keywords_added,
            "missing_keywords": missing_keywords,
            "suggestions": suggestions
        }

    except json.JSONDecodeError as e:
        print("❌ JSON ERROR:", e)
        raise HTTPException(
            status_code=500,
            detail="AI returned invalid format. Try again."
        )

    except Exception as e:
        print("❌ ERROR:", e)
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Optimization failed: {str(e)}"
        )


@router.post("/generate-pdf/{optimized_resume_id}")
def generate_pdf_resume(
    optimized_resume_id: int,
    user_id: int,
    candidate_name: str = "Professional Resume",
    db: Session = Depends(get_db)
):
    """Generate a professional 1-page PDF from optimized resume"""
    
    optimized = db.query(OptimizedResume).filter(
        OptimizedResume.id == optimized_resume_id
    ).first()
    
    if not optimized:
        raise HTTPException(status_code=404, detail="Optimized resume not found")
    
    job = db.query(Job).filter(Job.id == optimized.job_id).first()
    job_title = job.title if job else "Professional Position"
    
    pdf_bytes = pdf_generator.create_professional_resume(
        optimized.optimized_text,
        job_title,
        candidate_name
    )
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=optimized_resume_{optimized_resume_id}.pdf"}
    )


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


@router.get("/all-optimizations/{user_id}")
def get_all_user_optimizations(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get all optimized resumes for a user across all resumes"""
    
    resumes = db.query(Resume).filter(Resume.user_id == user_id).all()
    resume_ids = [r.id for r in resumes]
    
    optimizations = db.query(OptimizedResume).filter(
        OptimizedResume.resume_id.in_(resume_ids) if resume_ids else False
    ).order_by(OptimizedResume.created_at.desc()).all()
    
    result = []
    for opt in optimizations:
        resume = db.query(Resume).filter(Resume.id == opt.resume_id).first()
        job = db.query(Job).filter(Job.id == opt.job_id).first()
        if resume and job:
            result.append({
                "optimized_id": opt.id,
                "resume_id": resume.id,
                "resume_name": resume.original_file_path.split("/")[-1] if resume.original_file_path else "Unknown",
                "job_title": job.title,
                "job_company": job.company,
                "ats_score": opt.ats_score,
                "optimized_at": opt.created_at
            })
    
    return {
        "optimizations": result,
        "total": len(result)
    }