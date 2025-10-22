from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from .database import Base, engine, get_db
from .models import User, Question, AssessmentResponse
from .schemas import UserCreate, UserLogin, UserOut
from .auth import hash_password, verify_password, create_access_token, decode_token
from fastapi import Header
from typing import List
from pydantic import BaseModel

app = FastAPI(title="ANA Auth API")
Base.metadata.create_all(bind=engine)

# CORS – allow your Next.js app
origins = ["http://localhost:3000"]
app.add_middleware(
    CORSMiddleware, allow_origins=origins, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# Assessment schemas
class ResponseItem(BaseModel):
    question_id: str
    response: str
    page_number: int

class SaveResponsesRequest(BaseModel):
    responses: List[ResponseItem]

# Existing auth endpoints...
@app.post("/auth/signup", response_model=UserOut, status_code=201)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        name=payload.name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        date_of_birth=payload.date_of_birth,
        gender=payload.gender,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

@app.post("/auth/login")
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/auth/me", response_model=UserOut)
def me(Authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = Authorization.split(" ", 1)[1]
    data = decode_token(token)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).get(int(data["sub"]))
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Assessment endpoints
@app.get("/assessment/questions")
def get_questions(db: Session = Depends(get_db)):
    questions = db.query(Question).order_by(Question.page_number, Question.id).all()
    return questions

@app.get("/assessment/responses")
def get_user_responses(Authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = Authorization.split(" ", 1)[1]
    data = decode_token(token)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = int(data["sub"])
    responses = db.query(AssessmentResponse).filter(AssessmentResponse.user_id == user_id).all()
    return responses

@app.post("/assessment/save")
def save_responses(payload: SaveResponsesRequest, Authorization: str = Header(default=""), db: Session = Depends(get_db)):
    if not Authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")
    token = Authorization.split(" ", 1)[1]
    data = decode_token(token)
    if not data or "sub" not in data:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = int(data["sub"])
    
    try:
        for response_item in payload.responses:
            # Check if response already exists
            existing_response = db.query(AssessmentResponse).filter(
                AssessmentResponse.user_id == user_id,
                AssessmentResponse.question_id == response_item.question_id
            ).first()
            
            if existing_response:
                # Update existing response
                existing_response.response = response_item.response
                existing_response.page_number = response_item.page_number
            else:
                # Create new response
                new_response = AssessmentResponse(
                    user_id=user_id,
                    question_id=response_item.question_id,
                    response=response_item.response,
                    page_number=response_item.page_number
                )
                db.add(new_response)
        
        db.commit()
        return {"message": "Responses saved successfully"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save responses: {str(e)}")