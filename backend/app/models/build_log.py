from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import BuildStatus


class BuildLog(Base):
    __tablename__ = "build_logs"

    id = Column(Integer, primary_key=True, index=True)
    kit_id = Column(Integer, ForeignKey("kits.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(Enum(BuildStatus), nullable=False)
    notes = Column(String(500), nullable=True)
    photo_id = Column(Integer, ForeignKey("assets.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    kit = relationship("Kit", back_populates="build_logs")
    photo = relationship("Asset", foreign_keys=[photo_id])
