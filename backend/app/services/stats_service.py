from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.kit import Kit


class StatsService:
    def __init__(self, db: Session):
        self.db = db

    def get_stats(self) -> dict:
        total_kits = self.db.query(func.count(Kit.id)).scalar() or 0
        total_spent = float(self.db.query(func.coalesce(func.sum(Kit.purchase_price), 0)).scalar() or 0)

        completed = self.db.query(func.count(Kit.id)).filter(Kit.build_status == "COMPLETED").scalar() or 0
        completion_rate = (completed / total_kits * 100) if total_kits else 0

        status_rows = self.db.query(Kit.build_status, func.count(Kit.id)).group_by(Kit.build_status).all()
        grade_rows = self.db.query(Kit.grade, func.count(Kit.id)).group_by(Kit.grade).all()

        return {
            "total_kits": total_kits,
            "total_spent": total_spent,
            "completion_rate": round(completion_rate, 2),
            "by_status": [
                {"status": getattr(status, "value", str(status)), "count": count}
                for status, count in status_rows
            ],
            "by_grade": [
                {"grade": getattr(grade, "value", str(grade)), "count": count}
                for grade, count in grade_rows
            ],
        }
