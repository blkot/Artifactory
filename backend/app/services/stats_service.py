import threading
import time

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.kit import Kit


class StatsService:
    _cache_lock = threading.Lock()
    _cached_payload: dict | None = None
    _cached_snapshot: tuple[int, str | None] | None = None
    _cached_until_monotonic: float = 0.0

    def __init__(self, db: Session):
        self.db = db
        self.settings = get_settings()

    @classmethod
    def reset_cache(cls) -> None:
        with cls._cache_lock:
            cls._cached_payload = None
            cls._cached_snapshot = None
            cls._cached_until_monotonic = 0.0

    def _current_snapshot(self) -> tuple[int, str | None]:
        total_kits = self.db.query(func.count(Kit.id)).scalar() or 0
        latest_update = self.db.query(func.max(Kit.updated_at)).scalar()
        latest_update_iso = latest_update.isoformat() if latest_update else None
        return int(total_kits), latest_update_iso

    def get_stats(self) -> dict:
        if not self.settings.stats_cache_enabled:
            return self._compute_stats()

        snapshot = self._current_snapshot()
        now = time.monotonic()
        with self._cache_lock:
            if (
                self._cached_payload is not None
                and self._cached_snapshot == snapshot
                and now <= self._cached_until_monotonic
            ):
                return self._cached_payload

        payload = self._compute_stats()
        with self._cache_lock:
            self._cached_payload = payload
            self._cached_snapshot = snapshot
            self._cached_until_monotonic = now + max(1, self.settings.stats_cache_ttl_seconds)
        return payload

    def _compute_stats(self) -> dict:
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
