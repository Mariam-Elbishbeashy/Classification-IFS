from sqlalchemy import Column, Integer, String, DateTime, Date, func, UniqueConstraint, text, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = "User"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(30), nullable=True)
    role = Column(String(30), nullable=False, server_default=text("'user'"))
    __table_args__ = (UniqueConstraint('email', name='uq_users_email'),)
    
    assessment_responses = relationship("AssessmentResponse", back_populates="user")

class Question(Base):
    __tablename__ = "questions"
    
    id = Column(Integer, primary_key=True, index=True)
    page_number = Column(Integer, nullable=False)
    question_id = Column(String(50), unique=True, nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), nullable=False)
    choices = Column(JSON, nullable=True)
    focus_area = Column(String(100), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

class AssessmentResponse(Base):
    __tablename__ = "assessment_responses"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("User.id"), nullable=False)
    question_id = Column(String(50), nullable=False)
    response = Column(Text, nullable=False)
    page_number = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="assessment_responses")
    
    __table_args__ = (UniqueConstraint('user_id', 'question_id', name='uq_user_question'),)