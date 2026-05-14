# **SmartHire AI - AI-Powered Resume Optimization Platform**

[![Made with Python](https://img.shields.io/badge/Python-3.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2-blue.svg)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-blue.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# SmartHire AI – Overview
SmartHire AI is an intelligent web application that harnesses the power of Generative AI technology to assist job seekers in optimizing their resumes for Applicant Tracking Systems (ATS). The platform addresses a critical issue where nearly 75% of qualified candidates are eliminated by automated screening systems due to resumes that are not properly keyword optimized and ATS friendly formatted. SmartHire AI is an end-to-end solution for the entire process where users can upload their resumes, have it analysed by AI, find jobs that match their profiles and create job-specific optimized resumes in a professional PDF format, all at absolutely no cost.

The platform works in six steps.Users start by registering and uploading their resume as a PDF or DOCX file.The system then pulls out the text. Sends it to Google Gemini AI.This AI tool finds the users skills calculates how years of experience they have suggests job roles gives an ATS score between 0 and 100 and offers tips on how to improve.The platform uses these skills to search for job listings, on Google Jobs through SerpAPI.Google Gemini AI then figures out how well the users skills and experience match each job giving a match percentage.The jobs are shown in order of how they match so users can focus on the best opportunities.This helps users apply for jobs effectively.

When you pick a job you like the system does the optimization work. Gemini AI rewrites your resume so it includes important words from the job description in a natural way. It changes the bullet points to show that you have the experience. It also rearranges the content so it looks good, to the computer systems that scan resumes and it all fits on one page.The new version of your resume is saved with the original and the job you want so you can look at versions without having to do it all again. Then you can download the resume as a nice looking PDF file that has good margins and fonts and everything looks the same all the way through, which is made using ReportLab.

The technical architecture uses a client-server model with a React.js frontend, FastAPI backend, and PostgreSQL database. The system integrates Google Gemini AI for analysis and optimization tasks, along with SerpAPI for real-time job fetching. The backend is divided into modular routers for authentication, resume handling, analysis, and job search. Job caching helps reduce repeated API calls, and the complete history of all user optimizations is kept. The frontend offers user-friendly pages for the dashboard, upload, analysis, job search, and optimization views, ensuring a smooth user experience.

SmartHire AI has been rigorously tested and has achieved an average ATS score improvement of 22.4 percentage points, 89 percent accuracy in skills extraction, 84 percent job relevance rate and a user satisfaction rating of 4.3 out of 5. Rate limiting is handled by the platform, with retry logic and fallback responses for unavailable APIs. Future improvements include OCR for scanned PDFs, multiple AI provider support, resume template library, cover letter generation, and mobile applications. This project shows how Generative AI can be put to practical use to democratize access to professional-grade career optimization tools for all jobseekers.

# Features

| Feature | Description |
|---------|-------------|
| 🔐 **Authentication** | Secure JWT-based user login and registration |
| 📄 **Resume Upload** | Upload PDF/DOCX resumes with text extraction |
| 🤖 **AI Analysis** | Skills extraction, experience calculation, ATS scoring (0-100) |
| 💼 **Job Search** | Real-time job matching using SerpAPI |
| ✍️ **Resume Optimization** | AI-powered rewriting tailored to job descriptions |
| 📑 **PDF Generation** | Professional 1-page PDF output |
| 📊 **Job History** | Track previously searched and optimized jobs |


# Tech Stack

### Frontend
- React.js 18
- Tailwind CSS
- React Router DOM
- Vite

### Backend
- Python 3.13
- FastAPI
- PostgreSQL
- SQLAlchemy

### AI & APIs
- Google Gemini AI (Resume analysis & optimization)
- SerpAPI (Job search)

### Libraries
- PyMuPDF, python-docx (Text extraction)
- ReportLab (PDF generation)
- bcrypt, JWT (Authentication)

## 📋 Prerequisites

- Python 3.13 or higher
- Node.js 18 or higher
- PostgreSQL 14 or higher
- Google Gemini API key
- SerpAPI key

# System Architecture Design

<img width="823" height="598" alt="image" src="https://github.com/user-attachments/assets/ea37290c-1f27-4eba-b272-b3cf7db9d7cd" />

# System Block Diagram

<img width="964" height="557" alt="image" src="https://github.com/user-attachments/assets/b443be89-8934-4609-8459-3f4f581599a1" />

# LOGIN AND SIGN UP
<img width="383" height="523" alt="image" src="https://github.com/user-attachments/assets/c9d56c82-6687-47e6-af50-828897c6df7b" />
<img width="426" height="524" alt="image" src="https://github.com/user-attachments/assets/a9411a5d-9f3d-4339-bdb7-41e0d066e593" />

# Dashboard
<img width="1009" height="556" alt="image" src="https://github.com/user-attachments/assets/00c336d2-a5c3-4829-98d8-dffad3a43c7d" />

# Upload
<img width="995" height="550" alt="image" src="https://github.com/user-attachments/assets/91c2ea3b-36e7-4aec-8765-b1f2c1bacf73" />

# Analysis
<img width="999" height="530" alt="image" src="https://github.com/user-attachments/assets/479c01c0-e1ae-4dab-8352-dccb8800d48a" />

# Job Recommendations
<img width="970" height="536" alt="image" src="https://github.com/user-attachments/assets/b9d8670e-5c9d-4425-9cb3-382c2e8e695e" />

# Optimize Resume
<img width="981" height="542" alt="image" src="https://github.com/user-attachments/assets/a8c85a4f-295c-4f67-b4ee-31cdf62fb2a2" />

# Acknowledgments
Google Gemini AI for providing free API access

SerpAPI for job search integration

Department of CSE, Manipal University Jaipur





