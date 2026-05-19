from urllib.parse import urlsplit, urlunsplit

from sqlalchemy.orm import Session

from app.models.link import Link
from app.schemas.link import LinkCreate, LinkUpdate


def _normalize_url(value: str) -> str:
    trimmed = value.strip()
    try:
        parts = urlsplit(trimmed)
    except ValueError:
        return trimmed

    scheme = parts.scheme.lower()
    netloc = parts.netloc.lower()
    path = parts.path
    while len(path) > 1 and path.endswith("/"):
        path = path[:-1]
    return urlunsplit((scheme, netloc, path, parts.query, ""))


def list_links(db: Session, kit_id: int | None = None) -> list[Link]:
    query = db.query(Link)
    if kit_id is not None:
        query = query.filter(Link.kit_id == kit_id)
    return query.order_by(Link.created_at.desc()).all()


def get_link(db: Session, link_id: int) -> Link | None:
    return db.query(Link).filter(Link.id == link_id).first()


def find_duplicate_link(db: Session, kit_id: int, url: str) -> Link | None:
    normalized_url = _normalize_url(url)
    links = db.query(Link).filter(Link.kit_id == kit_id).all()
    return next((link for link in links if _normalize_url(link.url) == normalized_url), None)


def create_link(db: Session, payload: LinkCreate) -> Link:
    data = payload.model_dump(exclude={"tag_ids"})
    if "url" in data and data["url"] is not None:
        data["url"] = str(data["url"])
    link = Link(**data)
    db.add(link)
    db.flush()
    return link


def update_link(link: Link, payload: LinkUpdate) -> Link:
    for key, value in payload.model_dump(exclude_unset=True, exclude={"tag_ids"}).items():
        if key == "url" and value is not None:
            value = str(value)
        setattr(link, key, value)
    return link


def delete_link(db: Session, link: Link) -> None:
    db.delete(link)
