from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from .config import DATABASE_URL
from .database import Base, engine

_SUSPECT_COLUMNS = {
    "updated_at": "DATETIME",
    "enrollment_status": "VARCHAR(32) DEFAULT 'REAL_ENROLLMENT'",
    "enrollment_date": "DATETIME",
    "reference_image_count": "INTEGER DEFAULT 0",
    "include_in_officer_directory": "BOOLEAN DEFAULT 1",
    "data_origin": "VARCHAR(32) DEFAULT 'OPERATIONAL'",
}


def _add_missing_columns(table: str, columns: dict[str, str]) -> None:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns(table)}
    with engine.begin() as conn:
        for name, ddl in columns.items():
            if name not in existing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def ensure_schema() -> None:
    Base.metadata.create_all(bind=engine)
    if DATABASE_URL.startswith("sqlite"):
        _add_missing_columns("suspects", _SUSPECT_COLUMNS)


def get_setting_value(db: Session, key: str, default: str) -> str:
    from .models import SystemSetting
    row = db.query(SystemSetting).filter_by(key=key).first()
    return row.value if row else default
