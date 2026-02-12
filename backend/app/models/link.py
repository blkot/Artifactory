from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import LinkCategory


class Link(Base):
    __tablename__ = "links"

    id = Column(Integer, primary_key=True, index=True)
    kit_id = Column(Integer, ForeignKey("kits.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(String(512), nullable=False)
    category = Column(Enum(LinkCategory), nullable=False)
    title = Column(String(200), nullable=False)
    notes = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    kit = relationship("Kit", back_populates="links")
    tags = relationship("Tag", secondary="link_tags", back_populates="links")
