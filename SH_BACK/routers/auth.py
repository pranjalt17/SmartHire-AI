from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from models import User
from schemas import UserCreate, UserLogin
from dependencies import get_db
from utils.security import hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    
    # ✅ Check password match
    if user.password != user.confirm_password:
        return {"error": "Passwords do not match"}

    # ✅ Check existing user
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        return {"error": "Email already exists"}

    # ✅ Create user
    new_user = User(
        name=user.name,
        email=user.email,
        password=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User created successfully"}


@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == user.email).first()

    if not db_user or not verify_password(user.password, db_user.password):
        return {"error": "Invalid credentials"}

    return {"message": "Login successful", "user_id": db_user.id}