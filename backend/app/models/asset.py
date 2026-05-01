from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import AssetType


class Asset(Base):
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    kit_id = Column(Integer, ForeignKey("kits.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(Enum(AssetType), nullable=False)
    file_path = Column(String(255), nullable=False)
    thumbnail_path = Column(String(255), nullable=True)
    original_filename = Column(String(255), nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String(128), nullable=False)
    description = Column(String(255), nullable=True)
    is_external_reference = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    kit = relationship("Kit", back_populates="assets", foreign_keys=[kit_id])
