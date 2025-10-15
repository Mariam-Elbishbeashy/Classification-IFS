from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import date


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    date_of_birth: Optional[date] = None   # YYYY-MM-DD
    gender: Optional[str] = None 

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    class Config:
        from_attributes = True  # pydantic v2
