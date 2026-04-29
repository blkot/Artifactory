from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.db import Base


class RevokedToken(Base):
    __tablename__ = "revoked_tokens"

    id = Column(Integer, primary_key=True, index=True)
    token_jti = Column(String(64), unique=True, nullable=False, index=True)
    revoked_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    reason = Column(String(50), nullable=True)
