from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.kit import Kit
from app.models.tag import Tag


class SearchService:
    def __init__(self, db: Session):
        self.db = db

    def search_kits(
        self,
        q: str | None = None,
        grade: list[str] | None = None,
        brand: list[str] | None = None,
        series: list[str] | None = None,
        build_status: list[str] | None = None,
        scale: list[str] | None = None,
        tag: list[str] | None = None,
        skip: int = 0,
        limit: int = 20,
    ) -> tuple[list[Kit], int]:
        query = self.db.query(Kit)

        if q:
            query = query.filter(Kit.name.ilike(f"%{q}%"))
        if grade:
            normalized_grades = [item.strip().upper() for item in grade if item and item.strip()]
            if normalized_grades:
                query = query.filter(Kit.grade.in_(normalized_grades))
        if brand:
            query = query.filter(or_(*[Kit.brand.ilike(f"%{item}%") for item in brand]))
        if series:
            query = query.filter(or_(*[Kit.series.ilike(f"%{item}%") for item in series]))
        if build_status:
            normalized_status = [item.strip().upper() for item in build_status if item and item.strip()]
            if normalized_status:
                query = query.filter(Kit.build_status.in_(normalized_status))
        if scale:
            normalized_scale = [item.strip().lower() for item in scale if item and item.strip()]
            if normalized_scale:
                query = query.filter(func.lower(Kit.scale).in_(normalized_scale))
        if tag:
            query = query.join(Kit.tags).filter(or_(*[Tag.name.ilike(f"%{item}%") for item in tag])).distinct()

        total = query.count()
        return query.offset(skip).limit(limit).all(), total
