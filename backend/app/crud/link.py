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


def infer_link_source(value: str) -> str | None:
    try:
        host = urlsplit(value.strip()).netloc.lower().removeprefix("www.")
    except ValueError:
        return None
    if host == "b23.tv" or host.endswith(".b23.tv") or "bilibili.com" in host:
        return "bilibili"
    if host == "xhslink.com" or host.endswith(".xhslink.com") or "xiaohongshu.com" in host:
        return "xiaohongshu"
    return None


def _normalize_source(value: str | None) -> str | None:
    normalized = (value or "").strip().lower()
    return normalized or None


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
    data["source"] = _normalize_source(data.get("source")) or infer_link_source(data["url"])
    link = Link(**data)
    db.add(link)
    db.flush()
    return link


def update_link(link: Link, payload: LinkUpdate) -> Link:
    data = payload.model_dump(exclude_unset=True, exclude={"tag_ids"})
    for key, value in data.items():
        if key == "url" and value is not None:
            value = str(value)
        if key == "source":
            value = _normalize_source(value)
        setattr(link, key, value)
    if "url" in data and "source" not in data and not link.source:
        link.source = infer_link_source(link.url)
    return link


def delete_link(db: Session, link: Link) -> None:
    db.delete(link)
