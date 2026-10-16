"""Database schema and helpers (SQLAlchemy Core).

Works against SQLite (local development) and PostgreSQL (production, via
``DATABASE_URL``). Column definitions for the application tables are derived
from the field specs in ``forms.py``.
"""
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    LargeBinary,
    MetaData,
    String,
    Table,
    Text,
    create_engine,
    event,
    false,
    inspect,
    text,
    true,
)
from sqlalchemy.schema import CreateColumn

from . import forms

SCHEMA_VERSION = "2"

metadata = MetaData()


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _text_columns(fields):
    return [Column(f.name, Text, nullable=False, default="", server_default="") for f in fields]


def _status_column(default):
    return Column("status", String(20), nullable=False, default=default, server_default=default)


def _timestamp(name):
    return Column(name, DateTime, nullable=False, default=utcnow)


preincubation_applications = Table(
    "preincubation_applications",
    metadata,
    Column("id", Integer, primary_key=True),
    *_text_columns(forms.PRE_INCUBATION_FIELDS),
    _status_column("Pending"),
    Column("is_active", Boolean, nullable=False, default=True, server_default=true()),
    Column("certificate_issued", Boolean, nullable=False, default=False, server_default=false()),
    *_text_columns(forms.PITCH_FIELDS),
    Column("evaluation", Text, nullable=True),
    _timestamp("submitted_at"),
    _timestamp("updated_at"),
)

incubation_applications = Table(
    "incubation_applications",
    metadata,
    Column("id", Integer, primary_key=True),
    *_text_columns(forms.INCUBATION_FIELDS),
    _status_column("Pending"),
    _timestamp("submitted_at"),
    _timestamp("updated_at"),
)

incubation_evaluations = Table(
    "incubation_evaluations",
    metadata,
    Column("id", Integer, primary_key=True),
    Column(
        "application_id",
        Integer,
        ForeignKey("incubation_applications.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    ),
    Column("evaluator_name", String(120), nullable=False),
    Column("data", Text, nullable=False, default="{}", server_default="{}"),
    Column("total", Integer, nullable=False, default=0, server_default="0"),
    _timestamp("updated_at"),
)

internship_applications = Table(
    "internship_applications",
    metadata,
    Column("id", Integer, primary_key=True),
    *_text_columns(forms.INTERNSHIP_FIELDS),
    _status_column("Applied"),
    _timestamp("submitted_at"),
    _timestamp("updated_at"),
)

incubated_startups = Table(
    "incubated_startups",
    metadata,
    Column("id", Integer, primary_key=True),
    *_text_columns(forms.INCUBATED_STARTUP_FIELDS),
    Column("source_application_id", Integer, nullable=True),
    _timestamp("created_at"),
    _timestamp("updated_at"),
)

module_records = Table(
    "module_records",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("module", String(30), nullable=False),
    Column("category", String(30), nullable=False),
    *_text_columns(forms.RECORD_FIELDS),
    Column("source", String(10), nullable=False, default="staff", server_default="staff"),
    _timestamp("created_at"),
    _timestamp("updated_at"),
    Index("ix_module_records_module_category", "module", "category"),
)

# Every uploaded file, whatever it belongs to. ``owner_type`` is one of
# preincubation / incubation / internship / startup / record.
files = Table(
    "files",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("owner_type", String(30), nullable=False),
    Column("owner_id", Integer, nullable=False),
    Column("field", String(40), nullable=False),
    Column("original_name", Text, nullable=False),
    Column("content_type", String(120), nullable=False),
    Column("size", Integer, nullable=False),
    Column("storage_key", String(300), nullable=False, unique=True),
    _timestamp("uploaded_at"),
    Index("ix_files_owner", "owner_type", "owner_id"),
)

# File contents when STORAGE_BACKEND=database (keeps everything in Postgres,
# so a free-tier host with an ephemeral disk loses nothing on redeploy).
file_blobs = Table(
    "file_blobs",
    metadata,
    Column("storage_key", String(300), primary_key=True),
    Column("data", LargeBinary, nullable=False),
)

schema_info = Table(
    "schema_info",
    metadata,
    Column("key", String(60), primary_key=True),
    Column("value", Text, nullable=False),
)

REFERENCE_PREFIX = {"preincubation": "PRE", "incubation": "INC", "internship": "INT"}


def reference(program, record_id):
    return f"{REFERENCE_PREFIX[program]}-{record_id:05d}"


def make_engine(url):
    if url.startswith("sqlite"):
        engine = create_engine(url, connect_args={"check_same_thread": False, "timeout": 30})

        @event.listens_for(engine, "connect")
        def _sqlite_pragmas(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.execute("PRAGMA journal_mode=WAL")
            cursor.execute("PRAGMA busy_timeout=30000")
            cursor.close()

        return engine
    return create_engine(url, pool_pre_ping=True, pool_recycle=300)


def add_missing_columns(engine):
    """Add columns that exist in the schema but not yet in the database.

    A minimal forward-only migration: new columns are always nullable or carry
    a server default, so ``ALTER TABLE ... ADD COLUMN`` is safe on existing rows.
    """
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {col["name"] for col in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name not in existing:
                    definition = CreateColumn(column).compile(dialect=engine.dialect)
                    conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN {definition}'))


def init_db(engine, upload_dir, logger=None):
    from . import legacy  # local import: legacy depends on the tables above

    if engine.dialect.name == "sqlite" and legacy.needs_upgrade(engine):
        legacy.upgrade(engine, upload_dir, logger=logger)

    metadata.create_all(engine)
    add_missing_columns(engine)

    with engine.begin() as conn:
        row = conn.execute(schema_info.select().where(schema_info.c.key == "schema_version")).first()
        if row is None:
            conn.execute(schema_info.insert().values(key="schema_version", value=SCHEMA_VERSION))


def serialize(row):
    """Convert a Row/mapping into JSON-ready primitives."""
    out = {}
    for key, value in dict(row._mapping if hasattr(row, "_mapping") else row).items():
        if isinstance(value, datetime):
            out[key] = value.replace(microsecond=0).isoformat() + "Z"
        else:
            out[key] = value
    return out
