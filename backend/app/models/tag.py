from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.associations import kit_tags, link_tags


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(64), unique=True, nullable=False, index=True)
    color = Column(String(16), nullable=True)

    kits = relationship("Kit", secondary=kit_tags, back_populates="tags")
    links = relationship("Link", secondary=link_tags, back_populates="tags")
