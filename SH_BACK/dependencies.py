from database import SessionLocal
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()