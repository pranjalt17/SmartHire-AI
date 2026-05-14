from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
import shutil
import os
import json

from models import Resume, Analysis
from dependencies import get_db

import fitz  # PyMuPDF
import docx

router = APIRouter(prefix="/resume", tags=["Resume"])

UPLOAD_FOLDER = "uploads"

# ✅ Extract text from PDF
def extract_text_from_pdf(file_path):
    text = ""
    doc = fitz.open(file_path)
    for page in doc:
        text += page.get_text()
    return text

# ✅ Extract text from DOCX
def extract_text_from_docx(file_path):
    doc = docx.Document(file_path)
    return "\n".join([para.text for para in doc.paragraphs])


@router.post("/upload")
def upload_resume(user_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Upload a resume file (PDF or DOCX)
    """
    # ✅ Create uploads folder if not exists
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)

    file_path = os.path.join(UPLOAD_FOLDER, file.filename)

    # ✅ Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # ✅ Extract text based on file type
    if file.filename.endswith(".pdf"):
        extracted_text = extract_text_from_pdf(file_path)
    elif file.filename.endswith(".docx"):
        extracted_text = extract_text_from_docx(file_path)
    else:
        return {"error": "Unsupported file format"}

    # ✅ Save to DB
    new_resume = Resume(
        user_id=user_id,
        original_file_path=file_path,
        extracted_text=extracted_text
    )

    db.add(new_resume)
    db.commit()
    db.refresh(new_resume)

    return {
        "message": "Resume uploaded successfully",
        "resume_id": new_resume.id
    }


@router.get("/list/{user_id}")
def get_user_resumes(user_id: int, db: Session = Depends(get_db)):
    """
    Get all resumes for a specific user with their analysis status
    """
    resumes = db.query(Resume).filter(Resume.user_id == user_id).order_by(Resume.created_at.desc()).all()
    
    result = []
    for resume in resumes:
        # Check if analysis exists for this resume
        analysis = db.query(Analysis).filter(Analysis.resume_id == resume.id).first()
        has_analysis = analysis is not None
        
        # Parse analysis data if it exists
        analysis_data = None
        if has_analysis and analysis:
            try:
                # Parse skills
                skills = []
                if analysis.skills:
                    try:
                        skills = json.loads(analysis.skills)
                    except:
                        skills = []
                
                # Parse experience
                experience = {}
                if analysis.experience:
                    try:
                        experience = json.loads(analysis.experience)
                    except:
                        experience = {}
                
                # Parse improvements
                improvements = []
                if hasattr(analysis, 'improvements') and analysis.improvements:
                    try:
                        improvements = json.loads(analysis.improvements)
                    except:
                        improvements = []
                
                analysis_data = {
                    "ats_score": analysis.ats_score if hasattr(analysis, 'ats_score') else None,
                    "skills": skills if isinstance(skills, list) else [],
                    "experience": experience if isinstance(experience, dict) else {},
                    "improvements": improvements if isinstance(improvements, list) else [],
                    "suggested_role": analysis.role or ""
                }
            except Exception as e:
                print(f"Error parsing analysis for resume {resume.id}: {e}")
                analysis_data = None
        
        # Get file size
        file_size = 0
        if os.path.exists(resume.original_file_path):
            file_size = os.path.getsize(resume.original_file_path)
        
        result.append({
            "id": resume.id,
            "name": os.path.basename(resume.original_file_path),
            "size": file_size,
            "uploadedAt": resume.created_at,
            "has_analysis": has_analysis,
            "analysis": analysis_data
        })
    
    return result


@router.get("/{resume_id}")
def get_resume(resume_id: int, user_id: int, db: Session = Depends(get_db)):
    """
    Get a specific resume by ID
    """
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == user_id
    ).first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    # Check if analysis exists
    analysis = db.query(Analysis).filter(Analysis.resume_id == resume.id).first()
    
    return {
        "id": resume.id,
        "user_id": resume.user_id,
        "name": os.path.basename(resume.original_file_path),
        "file_path": resume.original_file_path,
        "extracted_text": resume.extracted_text[:1000],  # Return first 1000 chars
        "created_at": resume.created_at,
        "has_analysis": analysis is not None
    }


@router.delete("/{resume_id}")
def delete_resume(resume_id: int, user_id: int, db: Session = Depends(get_db)):
    """
    Delete a resume and its associated analysis
    """
    # Find the resume
    resume = db.query(Resume).filter(
        Resume.id == resume_id,
        Resume.user_id == user_id
    ).first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    
    # Delete associated analysis first (foreign key constraint)
    analysis = db.query(Analysis).filter(Analysis.resume_id == resume_id).first()
    if analysis:
        db.delete(analysis)
    
    # Delete the resume
    db.delete(resume)
    db.commit()
    
    # Delete the physical file if it exists
    if os.path.exists(resume.original_file_path):
        try:
            os.remove(resume.original_file_path)
        except Exception as e:
            print(f"Error deleting file: {e}")
    
    return {"message": "Resume deleted successfully"}