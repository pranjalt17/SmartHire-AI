import os
import random
from serpapi import GoogleSearch
from typing import List, Dict, Optional
import json
from datetime import datetime

class JobSearchService:
    def __init__(self):
        self.api_key = os.getenv("SERPAPI_KEY")
        self.search_count = 0
        self.last_search_time = None
        self.search_history = []
        self.strategy_index = 0
        
    def search_jobs(self, skills: List[str], location: str = "India", num_results: int = 3) -> List[Dict]:
        """
        Search for jobs based on skills using SerpAPI - Returns DIFFERENT jobs each time
        """
        if not self.api_key:
            print("❌ SERPAPI_KEY not found")
            return self._get_mock_jobs(skills)
        
        # Rotate through different search strategies to get varied results
        strategies = [
            self._search_by_skill_combinations,
            self._search_by_skill_with_boost,
            self._search_by_related_roles,
            self._search_by_company_types,
            self._search_with_different_sorting
        ]
        
        # Pick a strategy in rotation
        strategy = strategies[self.strategy_index % len(strategies)]
        self.strategy_index += 1
        
        print(f"🔄 Using search strategy #{self.strategy_index}")
        
        jobs = strategy(skills, location, num_results)
        
        # If no jobs found, try fallback
        if not jobs:
            print("⚠️ No jobs found, trying alternative strategy...")
            jobs = self._search_by_related_roles(skills, location, num_results)
        
        return jobs
    
    def _search_by_skill_combinations(self, skills: List[str], location: str, num_results: int) -> List[Dict]:
        """Search using different skill combinations"""
        if not skills:
            return self._get_mock_jobs([])
        
        # Shuffle skills and take different combinations
        shuffled = skills.copy()
        random.shuffle(shuffled)
        
        # Use different skill combinations each time
        if len(shuffled) >= 3:
            skill_combo = f"{shuffled[0]} {shuffled[1]} {shuffled[2]}"
        elif len(shuffled) >= 2:
            skill_combo = f"{shuffled[0]} {shuffled[1]}"
        else:
            skill_combo = shuffled[0] if shuffled else "developer"
        
        # Add variety to search query
        search_modifiers = ["", "urgent", "hiring", "remote", "immediate joiners"]
        modifier = random.choice(search_modifiers)
        
        if modifier:
            search_query = f"{skill_combo} {modifier} jobs in {location}"
        else:
            search_query = f"{skill_combo} jobs in {location}"
        
        return self._execute_search(search_query, location, num_results)
    
    def _search_by_skill_with_boost(self, skills: List[str], location: str, num_results: int) -> List[Dict]:
        """Search with boosted keywords"""
        if not skills:
            return self._get_mock_jobs([])
        
        # Add "senior" or "junior" or "lead" randomly
        levels = ["", "senior", "junior", "lead", "entry level", "experienced"]
        level = random.choice(levels)
        
        # Take different primary skill
        primary_skill = random.choice(skills)
        
        if level:
            search_query = f"{level} {primary_skill} developer jobs in {location}"
        else:
            search_query = f"{primary_skill} jobs in {location}"
        
        return self._execute_search(search_query, location, num_results)
    
    def _search_by_related_roles(self, skills: List[str], location: str, num_results: int) -> List[Dict]:
        """Search by related job roles instead of skills"""
        if not skills:
            return self._get_mock_jobs([])
        
        role_mapping = {
            "python": ["Python Developer", "Backend Engineer", "Software Engineer", "Data Engineer"],
            "java": ["Java Developer", "Software Engineer", "Backend Developer", "Full Stack Engineer"],
            "javascript": ["Frontend Developer", "JavaScript Engineer", "Web Developer", "React Developer"],
            "sql": ["Database Administrator", "Data Analyst", "Backend Developer", "SQL Developer"],
            "android": ["Android Developer", "Mobile App Developer", "Kotlin Developer", "Mobile Engineer"],
            "kotlin": ["Android Developer", "Kotlin Developer", "Mobile Engineer"],
            "react": ["React Developer", "Frontend Engineer", "UI Developer", "Web Developer"],
            "html": ["Frontend Developer", "Web Developer", "UI Developer"],
            "css": ["Frontend Developer", "Web Designer", "UI Developer"],
            "c": ["Software Engineer", "Embedded Engineer", "System Programmer"],
        }
        
        # Find first matching skill
        primary_skill = skills[0].lower()
        roles = role_mapping.get(primary_skill, ["Software Developer", "Software Engineer"])
        
        selected_role = random.choice(roles)
        search_query = f"{selected_role} jobs in {location}"
        
        return self._execute_search(search_query, location, num_results)
    
    def _search_by_company_types(self, skills: List[str], location: str, num_results: int) -> List[Dict]:
        """Search by company types"""
        if not skills:
            return self._get_mock_jobs([])
        
        company_types = ["startup", "MNC", "product based", "service based", "tech giant"]
        company_type = random.choice(company_types)
        
        skill_str = " ".join(skills[:2])
        search_query = f"{skill_str} {company_type} jobs in {location}"
        
        return self._execute_search(search_query, location, num_results)
    
    def _search_with_different_sorting(self, skills: List[str], location: str, num_results: int) -> List[Dict]:
        """Search with different sorting parameters"""
        if not skills:
            return self._get_mock_jobs([])
        
        skill_str = " ".join(skills[:3])
        search_query = f"{skill_str} jobs in {location}"
        
        return self._execute_search(search_query, location, num_results)
    
    def _execute_search(self, search_query: str, location: str, num_results: int) -> List[Dict]:
        """Execute the actual search"""
        params = {
            "api_key": self.api_key,
            "engine": "google_jobs",
            "q": search_query,
            "location": location,
            "hl": "en",
            "num": min(num_results, 5)
        }
        
        try:
            self.search_count += 1
            print(f"🔍 Search #{self.search_count} - Query: {search_query[:80]}")
            
            search = GoogleSearch(params)
            results = search.get_dict()
            
            jobs = []
            job_ids = set()
            
            if "jobs_results" in results:
                for job in results["jobs_results"][:num_results]:
                    # Create unique job ID to avoid duplicates
                    job_key = f"{job.get('title')}_{job.get('company_name')}"
                    if job_key in job_ids:
                        continue
                    job_ids.add(job_key)
                    
                    direct_link = self._extract_job_link(job)
                    
                    job_data = {
                        "title": job.get("title", ""),
                        "company": job.get("company_name", ""),
                        "location": job.get("location", ""),
                        "description": job.get("description", ""),
                        "link": direct_link,
                        "via": job.get("via", ""),
                        "posted_at": job.get("detected_extensions", {}).get("posted_at", "")
                    }
                    jobs.append(job_data)
            
            if not jobs:
                print(f"⚠️ No results found for query: {search_query}")
                return self._get_mock_jobs([])
            
            return jobs
            
        except Exception as e:
            print(f"❌ Error searching jobs: {e}")
            return self._get_mock_jobs([])
    
    def _extract_job_link(self, job: dict) -> str:
        """Extract direct job link from job data"""
        if job.get("share_link"):
            return job.get("share_link")
        elif job.get("apply_link"):
            return job.get("apply_link")
        elif job.get("via"):
            via = job.get("via", "").lower()
            job_id = job.get("job_id", "")
            if "indeed" in via and job_id:
                return f"https://www.indeed.com/viewjob?jk={job_id}"
            elif "linkedin" in via and job_id:
                return f"https://www.linkedin.com/jobs/view/{job_id}"
        return ""
    
    def search_jobs_by_role(self, role: str, location: str = "India", num_results: int = 3) -> List[Dict]:
        """Search jobs by specific role with variation"""
        role_variations = [
            role,
            f"{role} engineer",
            f"{role} developer",
            f"junior {role}",
            f"senior {role}"
        ]
        
        selected_role = random.choice(role_variations[:3])
        search_query = f"{selected_role} jobs in {location}"
        
        return self._execute_search(search_query, location, num_results)
    
    def get_remaining_searches(self) -> int:
        return max(0, 100 - self.search_count)
    
    def _get_mock_jobs(self, skills: List[str]) -> List[Dict]:
        """Return varied mock job data"""
        # Extract a skill for job title if available
        skill_str = skills[0] if skills else "Software"
        
        mock_jobs_pool = [
            {
                "title": f"{skill_str} Developer",
                "company": "Google",
                "location": "Bangalore, India",
                "description": f"We are looking for a skilled {skill_str} developer to join our team. You will work on cutting-edge technology.",
                "link": "https://careers.google.com/jobs/results",
                "via": "Google Careers",
                "posted_at": "2 days ago"
            },
            {
                "title": f"{skill_str} Engineer",
                "company": "Microsoft",
                "location": "Hyderabad, India",
                "description": f"Join Microsoft's engineering team. Looking for strong {skill_str} skills.",
                "link": "https://careers.microsoft.com/us/en/search-results",
                "via": "Microsoft Careers",
                "posted_at": "4 days ago"
            },
            {
                "title": f"Software Engineer - {skill_str}",
                "company": "Amazon",
                "location": "Chennai, India",
                "description": f"Amazon is hiring! Need expertise in {skill_str} for our core platforms.",
                "link": "https://www.amazon.jobs/en/search",
                "via": "Amazon Jobs",
                "posted_at": "1 week ago"
            },
            {
                "title": f"{skill_str} Developer",
                "company": "Flipkart",
                "location": "Bangalore, India",
                "description": f"Build scalable solutions using {skill_str} at India's largest e-commerce platform.",
                "link": "https://www.flipkartcareers.com",
                "via": "Flipkart Careers",
                "posted_at": "3 days ago"
            },
            {
                "title": f"Senior {skill_str} Engineer",
                "company": "Paytm",
                "location": "Noida, India",
                "description": f"Lead development of financial technology products using {skill_str}.",
                "link": "https://paytm.com/careers",
                "via": "Paytm Careers",
                "posted_at": "1 day ago"
            }
        ]
        
        # Return random selection from pool
        random.shuffle(mock_jobs_pool)
        return mock_jobs_pool[:3]