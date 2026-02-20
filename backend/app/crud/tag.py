from sqlalchemy.orm import Session

from app.models.tag import Tag
from app.schemas.tag import TagCreate, TagUpdate


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


def get_tag(db: Session, tag_id: int) -> Tag | None:
    return db.query(Tag).filter(Tag.id == tag_id).first()


def update_tag(tag: Tag, payload: TagUpdate) -> Tag:
    updates = payload.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(tag, field, value)
    return tag
