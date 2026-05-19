from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.kit import Kit
from app.schemas.kit import KitCreate, KitUpdate


def list_kits(db: Session, skip: int = 0, limit: int = 20, sort: str = "activity_at", order: str = "desc") -> tuple[list[Kit], int]:
    query = db.query(Kit)
    total = db.query(func.count(Kit.id)).scalar() or 0
    sort_col = getattr(Kit, sort, Kit.activity_at)
    if order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())
    return query.offset(skip).limit(limit).all(), total


def get_kit(db: Session, kit_id: int) -> Kit | None:
    return db.query(Kit).filter(Kit.id == kit_id).first()


def create_kit(db: Session, payload: KitCreate) -> Kit:
    data = payload.model_dump(exclude={"tag_ids"})
    kit = Kit(**data)
    db.add(kit)
    db.flush()
    return kit


def update_kit(kit: Kit, payload: KitUpdate) -> Kit:
    for key, value in payload.model_dump(exclude_unset=True, exclude={"tag_ids"}).items():
        setattr(kit, key, value)
    return kit


def touch_kit_activity(kit: Kit, when: datetime | None = None) -> Kit:
    kit.activity_at = when or datetime.utcnow()
    return kit


def delete_kit(db: Session, kit: Kit) -> None:
    db.delete(kit)
