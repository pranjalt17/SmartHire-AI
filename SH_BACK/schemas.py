from pydantic import BaseModel

# Signup
class UserCreate(BaseModel):
    name: str
    email: str
    password: str
    confirm_password: str

# Login
class UserLogin(BaseModel):
    email: str
    password: str