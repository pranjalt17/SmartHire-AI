from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib import colors
import io
import re

class PDFResumeGenerator:
    def __init__(self):
        self.font_name = 'Helvetica'
        self.font_bold = 'Helvetica-Bold'
    
    def create_professional_resume(self, resume_text: str, job_title: str, candidate_name: str = "Candidate") -> bytes:
        """
        Generate a professional, tightly formatted 1-page PDF resume
        """
        buffer = io.BytesIO()
        
        # Use minimal margins for maximum content space
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=36,   # 0.5 inch
            leftMargin=36,    # 0.5 inch
            topMargin=36,     # 0.5 inch
            bottomMargin=36,  # 0.5 inch
        )
        
        styles = getSampleStyleSheet()
        
        # Compact, professional styles with minimal spacing
        name_style = ParagraphStyle(
            'NameStyle',
            parent=styles['Normal'],
            fontSize=16,
            fontName=self.font_bold,
            textColor=colors.HexColor('#1a1a2e'),
            alignment=TA_CENTER,
            spaceAfter=2,
            leading=18
        )
        
        contact_style = ParagraphStyle(
            'ContactStyle',
            parent=styles['Normal'],
            fontSize=8.5,
            fontName=self.font_name,
            textColor=colors.HexColor('#4a4a6a'),
            alignment=TA_CENTER,
            spaceAfter=6,
            leading=10
        )
        
        section_style = ParagraphStyle(
            'SectionStyle',
            parent=styles['Normal'],
            fontSize=10,
            fontName=self.font_bold,
            textColor=colors.HexColor('#16213e'),
            alignment=TA_LEFT,
            spaceBefore=4,
            spaceAfter=1,
            leading=12
        )
        
        body_style = ParagraphStyle(
            'BodyStyle',
            parent=styles['Normal'],
            fontSize=8.5,
            fontName=self.font_name,
            alignment=TA_LEFT,
            spaceAfter=0.5,
            leading=10
        )
        
        bullet_style = ParagraphStyle(
            'BulletStyle',
            parent=styles['Normal'],
            fontSize=8.5,
            fontName=self.font_name,
            alignment=TA_LEFT,
            spaceAfter=0.5,
            leading=10,
            leftIndent=8
        )
        
        story = []
        
        # Clean the resume text - remove asterisks and clean up formatting
        cleaned_text = self._clean_resume_text(resume_text)
        lines = cleaned_text.split('\n')
        
        line_count = 0
        max_lines = 50  # Target for 1 page
        
        for line in lines:
            if line_count > max_lines:
                break
                
            line = line.strip()
            if not line:
                story.append(Spacer(1, 1))  # Minimal spacing
                continue
            
            # Remove any remaining asterisks or special characters
            line = line.replace('*', '').replace('"', '').strip()
            
            # Skip duplicate header lines
            if 'pranjaltiwari504@gmail.com' in line.lower() and 'summary' in lines[line_count+1:line_count+3] if line_count < len(lines)-2 else False:
                continue
            
            upper_line = line.upper()
            
            # Identify section headers
            if re.match(r'^[A-Z][A-Z\s]+$', line) and len(line) < 35:
                story.append(Paragraph(line, section_style))
                line_count += 1
                
            # Contact line
            elif '@' in line and '|' in line:
                story.append(Paragraph(line, contact_style))
                line_count += 1
                
            # Name line (all caps, 2-3 words)
            elif re.match(r'^[A-Z][A-Z\s]+$', line) and len(line.split()) <= 3:
                story.append(Paragraph(line, name_style))
                line_count += 1
                
            # Bullet point (starts with • or -)
            elif line.startswith(('•', '-', '·')):
                bullet_text = line[1:].strip()
                if bullet_text and len(bullet_text) > 3:
                    # Check if it's a job title line
                    if 'intern' in bullet_text.lower() or 'developer' in bullet_text.lower() or 'engineer' in bullet_text.lower():
                        # Format as job title line
                        story.append(Paragraph(bullet_text, body_style))
                    else:
                        story.append(Paragraph(f"• {bullet_text}", bullet_style))
                    line_count += 1
                    
            # Job title (contains | or company name)
            elif '|' in line or ('intern' in line.lower() and len(line) < 60):
                story.append(Paragraph(line, body_style))
                line_count += 1
                
            # Regular text - wrap if too long
            elif len(line) > 80:
                wrapped = self._wrap_text(line, 80)
                for w in wrapped[:2]:
                    story.append(Paragraph(w, body_style))
                    line_count += 1
            else:
                story.append(Paragraph(line, body_style))
                line_count += 1
        
        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
    
    def _clean_resume_text(self, text: str) -> str:
        """Clean resume text - remove extra spaces, fix formatting"""
        # Remove duplicate lines
        lines = text.split('\n')
        unique_lines = []
        seen = set()
        
        for line in lines:
            line = line.strip()
            # Skip empty lines
            if not line:
                continue
            # Skip duplicate headers
            key = line.lower().replace(' ', '')
            if key not in seen:
                seen.add(key)
                unique_lines.append(line)
        
        # Remove excessive spacing
        cleaned = '\n'.join(unique_lines)
        cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
        
        return cleaned
    
    def _wrap_text(self, text: str, width: int) -> list:
        """Wrap long text to specified width"""
        words = text.split()
        lines = []
        current = []
        current_len = 0
        
        for word in words:
            if current_len + len(word) + 1 <= width:
                current.append(word)
                current_len += len(word) + 1
            else:
                if current:
                    lines.append(' '.join(current))
                current = [word]
                current_len = len(word)
        
        if current:
            lines.append(' '.join(current))
        
        return lines