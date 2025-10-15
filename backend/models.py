from sqlalchemy import Column, Integer, String, DateTime, Date, func, UniqueConstraint, text
from .database import Base

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
