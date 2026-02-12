from datetime import date, datetime

from sqlalchemy import Column, Date, DateTime, Enum, Integer, Numeric, String
from sqlalchemy.orm import relationship

from app.db import Base
from app.models.enums import BuildStatus, KitGrade


class Kit(Base):
    __tablename__ = "kits"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    grade = Column(Enum(KitGrade), nullable=False)
    series = Column(String(120), nullable=False)
    brand = Column(String(120), nullable=False)
    scale = Column(String(32), nullable=False)
    kit_number = Column(String(64), nullable=True)
    purchase_date = Column(Date, nullable=True)
    purchase_price = Column(Numeric(10, 2), nullable=True)
    purchase_shop = Column(String(200), nullable=True)
    build_status = Column(Enum(BuildStatus), nullable=False, default=BuildStatus.NEW)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    assets = relationship("Asset", back_populates="kit", cascade="all, delete-orphan")
    links = relationship("Link", back_populates="kit", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary="kit_tags", back_populates="kits")
    build_logs = relationship("BuildLog", back_populates="kit", cascade="all, delete-orphan")
