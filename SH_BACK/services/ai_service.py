import os
import google.generativeai as genai  # ✅ FIXED: Changed from 'google.generative' to 'google.generativeai'
from dotenv import load_dotenv
import json
import re

# Load environment variables
load_dotenv()

# Configure Gemini API
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=GOOGLE_API_KEY)

# Initialize the model
model = genai.GenerativeModel('gemini-2.5-flash')


def clean_json_response(response_text):
    """Remove markdown code blocks and extract clean JSON"""
    if not response_text:
        return "{}"
    
    # Remove ```json and ``` markers
    cleaned = re.sub(r'```json\s*', '', response_text)
    cleaned = re.sub(r'```\s*$', '', cleaned)
    cleaned = re.sub(r'^```\s*', '', cleaned)  # Remove starting ```
    cleaned = cleaned.strip()
    return cleaned


def analyze_resume(resume_text: str):
    """
    Analyze resume text using Gemini AI to extract:
    - Skills
    - Experience
    - Suggested Job Roles
    - Resume Improvements
    """
    
    prompt = f"""
    You are an expert resume analyzer. Analyze the following resume and provide a structured analysis.
    
    Resume Text:
    {resume_text[:10000]}  # Limit text to avoid token limits
    
    IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks. Just the raw JSON object.
    
    Provide the analysis in the following JSON format:
    {{
        "skills": ["skill1", "skill2", "skill3"],
        "experience": {{
            "years": "X years",
            "summary": "Brief summary of experience"
        }},
        "suggested_roles": ["role1", "role2", "role3"],
        "improvements": ["improvement1", "improvement2", "improvement3"],
        "ats_score": 75
    }}
    
    Make sure:
    1. Extract ALL technical and soft skills mentioned
    2. Calculate total years of experience from dates mentioned
    3. Suggest 3-5 relevant job roles based on skills and experience
    4. Provide 3-5 specific improvements to make the resume better
    5. Give an ATS score from 0-100 based on formatting, keywords, and completeness
    
    Return ONLY the JSON object, nothing else.
    """
    
    try:
        response = model.generate_content(prompt)
        raw_response = response.text
        
        # Clean the response to remove any markdown
        cleaned_response = clean_json_response(raw_response)
        
        # Validate it's valid JSON
        json.loads(cleaned_response)  # This will raise an error if invalid
        
        return cleaned_response
    except Exception as e:
        print(f"Error in analyze_resume: {e}")
        print(f"Raw response: {raw_response if 'raw_response' in locals() else 'No response'}")
        # Return a fallback JSON structure
        return json.dumps({
            "skills": [],
            "experience": {"years": "Not specified", "summary": "Unable to analyze"},
            "suggested_roles": ["Software Developer"],
            "improvements": ["Please re-upload the resume for better analysis"],
            "ats_score": 50
        })


def optimize_resume_for_job(resume_text: str, job_description: str, job_title: str):
    """
    Optimize resume for a specific job using Gemini AI
    Returns structured JSON instead of plain text
    """
    
    prompt = f"""
    You are an expert ATS resume optimizer and professional resume writer. 
    Rewrite and optimize the following resume for the job described below.
    
    IMPORTANT:
    - Return ONLY valid JSON
    - NO markdown
    - NO code blocks
    -
    **CRITICAL RULES:**
    1. Do NOT use asterisks (*) or quotes (") anywhere
    2. Use plain text only
    3. Keep bullet points with simple dashes (-)
    4. NO markdown formatting
    5. Use | symbol for separation, not asterisks

    **RETURN ONLY PLAIN TEXT. NO ASTERISKS. NO QUOTES.**
    
    FORMAT:
    {{
        "optimized_text": "full optimized resume text",
        "ats_score": 85,
        "keywords_added": ["keyword1", "keyword2"],
        "suggestions": ["suggestion1", "suggestion2"]
    }}
    
    ORIGINAL RESUME:
    {resume_text[:6000]}
    
    JOB TITLE: {job_title}
    
    JOB DESCRIPTION:
    {job_description[:3000]}
    
    REQUIREMENTS:
    1. Keep the same contact information structure
    2. Reorder and rephrase experience bullet points to highlight skills matching the job
    3. Add relevant keywords from the job description naturally
    4. Keep the resume to 1-2 pages
    5. Use professional formatting with clear sections:
       - Contact Information
       - Professional Summary (tailored to the job)
       - Core Competencies / Skills
       - Work Experience (with achievements quantified)
       - Education
       - Certifications (if any)
    
    RULES:
    - "optimized_text" should contain the FULL formatted resume
    - "ats_score" should be between 0-100
    - "keywords_added" must be extracted from job description
    - "suggestions" should improve resume quality
    
    Return ONLY JSON, nothing else.
    """
    
    try:
        response = model.generate_content(prompt)
        raw_response = response.text
        
        # Clean markdown if AI adds it
        cleaned_response = re.sub(r'```json\s*', '', raw_response)
        cleaned_response = re.sub(r'```\s*$', '', cleaned_response)
        cleaned_response = cleaned_response.strip()

        # Validate JSON
        json.loads(cleaned_response)

        return cleaned_response
        
    except Exception as e:
        print(f"Error in optimize_resume_for_job: {e}")
        
        # ✅ fallback JSON (IMPORTANT)
        return json.dumps({
            "optimized_text": resume_text,
            "ats_score": 60,
            "keywords_added": [],
            "suggestions": ["AI optimization failed, try again"]
        })
    
def match_resume_with_job(resume_text: str, job_description: str, job_requirements: str = None):
    """
    Match resume with job and calculate match score
    """
    
    requirements = job_requirements if job_requirements else "Extract requirements from job description"
    
    prompt = f"""
    You are an expert job matching AI. Compare the resume with the job requirements and calculate a match score.
    
    Resume:
    {resume_text[:5000]}
    
    Job Description:
    {job_description[:4000]}
    
    IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks. Just the raw JSON object.
    
    Please analyze and return in JSON format:
    {{
        "match_score": 75,
        "matched_skills": ["skill1", "skill2"],
        "missing_skills": ["skill3", "skill4"],
        "experience_match": "Good",
        "recommendations": ["recommendation1", "recommendation2"]
    }}
    
    Calculate match_score as percentage (0-100) based on:
    - Skill match (50% weight)
    - Experience match (30% weight)
    - Education/qualifications (20% weight)
    
    Return ONLY the JSON object, nothing else.
    """
    
    try:
        response = model.generate_content(prompt)
        raw_response = response.text
        cleaned_response = clean_json_response(raw_response)
        json.loads(cleaned_response)  # Validate
        return cleaned_response
    except Exception as e:
        print(f"Error in match_resume_with_job: {e}")
        return json.dumps({
            "match_score": 0,
            "matched_skills": [],
            "missing_skills": [],
            "experience_match": "Unable to analyze",
            "recommendations": ["Please try again"]
        })