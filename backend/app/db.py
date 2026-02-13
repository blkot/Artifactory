from collections.abc import Generator
import logging
import time

from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import get_settings

settings = get_settings()
db_logger = logging.getLogger("app.db")
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()


if settings.sql_slow_query_log_enabled:

    @event.listens_for(engine, "before_cursor_execute")
    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        conn.info.setdefault("query_start_time", []).append(time.perf_counter())


    @event.listens_for(engine, "after_cursor_execute")
    def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        start_stack = conn.info.get("query_start_time")
        if not start_stack:
            return
        duration_ms = (time.perf_counter() - start_stack.pop()) * 1000
        if duration_ms < settings.sql_slow_query_threshold_ms:
            return

        db_logger.warning(
            "slow_query",
            extra={
                "duration_ms": round(duration_ms, 2),
                "threshold_ms": settings.sql_slow_query_threshold_ms,
                "statement": statement.strip()[:500],
                "executemany": bool(executemany),
            },
        )


def get_db() -> Generator:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
