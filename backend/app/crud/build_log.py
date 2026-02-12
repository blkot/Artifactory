from sqlalchemy.orm import Session

from app.models.build_log import BuildLog
from app.schemas.build_log import BuildLogCreate


def list_by_kit(db: Session, kit_id: int) -> list[BuildLog]:
    return db.query(BuildLog).filter(BuildLog.kit_id == kit_id).order_by(BuildLog.created_at.desc()).all()


def create_for_kit(db: Session, kit_id: int, payload: BuildLogCreate) -> BuildLog:
    log = BuildLog(kit_id=kit_id, **payload.model_dump())
    db.add(log)
    db.flush()
    return log
