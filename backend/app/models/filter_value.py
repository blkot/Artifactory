from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint

from app.db import Base


class FilterValue(Base):
    __tablename__ = "filter_values"

    id = Column(Integer, primary_key=True, index=True)
    field = Column(String(50), nullable=False, index=True)
    value = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("field", "value", name="uq_filter_value_field_value"),
    )
