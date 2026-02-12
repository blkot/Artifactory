from sqlalchemy.orm import Session

from app.models.link import Link
from app.schemas.link import LinkCreate, LinkUpdate


def list_links(db: Session) -> list[Link]:
    return db.query(Link).order_by(Link.created_at.desc()).all()


def get_link(db: Session, link_id: int) -> Link | None:
    return db.query(Link).filter(Link.id == link_id).first()


def create_link(db: Session, payload: LinkCreate) -> Link:
    data = payload.model_dump(exclude={"tag_ids"})
    link = Link(**data)
    db.add(link)
    db.flush()
    return link


def update_link(link: Link, payload: LinkUpdate) -> Link:
    for key, value in payload.model_dump(exclude_unset=True, exclude={"tag_ids"}).items():
        setattr(link, key, value)
    return link


def delete_link(db: Session, link: Link) -> None:
    db.delete(link)
