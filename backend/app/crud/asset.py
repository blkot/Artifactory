from sqlalchemy.orm import Session

from app.models.asset import Asset


def get_asset(db: Session, asset_id: int) -> Asset | None:
    return db.query(Asset).filter(Asset.id == asset_id).first()


def delete_asset(db: Session, asset: Asset) -> None:
    db.delete(asset)
