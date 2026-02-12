from sqlalchemy.orm import Session

from app.models.tag import Tag
from app.schemas.tag import TagCreate


def list_tags(db: Session) -> list[Tag]:
    return db.query(Tag).order_by(Tag.name.asc()).all()


def get_tags_by_ids(db: Session, ids: list[int]) -> list[Tag]:
    if not ids:
        return []
    return db.query(Tag).filter(Tag.id.in_(ids)).all()


def create_tag(db: Session, payload: TagCreate) -> Tag:
    tag = Tag(name=payload.name, color=payload.color)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag
