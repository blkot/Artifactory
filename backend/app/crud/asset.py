from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.models.asset import Asset


def get_asset(db: Session, asset_id: int) -> Asset | None:
    return db.query(Asset).filter(Asset.id == asset_id).first()


def list_assets(
    db: Session,
    *,
    kit_id: int | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[Asset], int]:
    query = db.query(Asset)
    if kit_id is not None:
        query = query.filter(Asset.kit_id == kit_id)

    total = query.with_entities(func.count(Asset.id)).scalar() or 0
    items = query.order_by(desc(Asset.created_at)).offset(skip).limit(limit).all()
    return items, total


def delete_asset(db: Session, asset: Asset) -> None:
    db.delete(asset)
