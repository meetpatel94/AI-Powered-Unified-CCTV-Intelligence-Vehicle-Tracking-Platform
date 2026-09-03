"""SQLAlchemy engine and session management.

Connection pooling is tuned via environment variables and a statement timeout
is set on every PostgreSQL connection so a runaway query can never pin a
worker. ``pool_pre_ping`` ensures stale connections are recycled instead of
raising on use.
"""

from collections.abc import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# QueuePool sizing is PostgreSQL-only; SQLite (dev fallback / tests) must not
# receive those arguments.
_engine_kwargs: dict = {"pool_pre_ping": True, "future": True}
if not settings.database_url.startswith("sqlite"):
    _engine_kwargs.update(
        {
            "pool_size": settings.db_pool_size,
            "max_overflow": settings.db_max_overflow,
            "pool_timeout": settings.db_pool_timeout_seconds,
            "pool_recycle": settings.db_pool_recycle_seconds,
        }
    )
engine = create_engine(settings.database_url, **_engine_kwargs)

# Enforce a server-side statement timeout (PostgreSQL only) to protect the API
# from long-running queries. Silently skipped on other backends (dev SQLite).
if settings.db_statement_timeout_ms and settings.database_url.startswith("postgresql"):
    @event.listens_for(engine, "connect")
    def _set_statement_timeout(dbapi_connection, _connection_record) -> None:  # pragma: no cover
        try:
            with dbapi_connection.cursor() as cursor:
                cursor.execute(f"SET statement_timeout = {int(settings.db_statement_timeout_ms)}")
        except Exception:
            pass


SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database() -> bool:
    """Return True if the database accepts connections."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
