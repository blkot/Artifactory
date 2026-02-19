from sqlalchemy import or_
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
            query = query.filter(Kit.grade.in_(grade))
        if brand:
            query = query.filter(or_(*[Kit.brand.ilike(f"%{item}%") for item in brand]))
        if series:
            query = query.filter(or_(*[Kit.series.ilike(f"%{item}%") for item in series]))
        if build_status:
            query = query.filter(Kit.build_status.in_(build_status))
        if scale:
            query = query.filter(Kit.scale.in_(scale))
        if tag:
            query = query.join(Kit.tags).filter(or_(*[Tag.name.ilike(f"%{item}%") for item in tag])).distinct()

        total = query.count()
        return query.offset(skip).limit(limit).all(), total
