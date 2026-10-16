"""One-time upgrade of a SQLite database created by the original single-file app.

The original schema used inconsistent names (camelCase columns, a ``startups``
table for pre-incubation applications, UI labels re-purposing unrelated
columns, uploaded file names stored in ad-hoc columns). This module:

1. copies the database file to ``<name>.pre-upgrade-backup``;
2. renames each old table to ``legacy_<name>`` (nothing is dropped);
3. creates the current schema and copies every row across, mapping the
   re-purposed columns to their real meaning;
4. registers previously uploaded files that still exist on disk.
"""
import mimetypes
import shutil
from datetime import datetime
from pathlib import Path

from sqlalchemy import inspect, text

from . import db, forms

LEGACY_TABLES = [
    "startups",
    "incubation_applications",
    "incubation_evaluations",
    "startup_crm",
    "founder_crm",
    "document_repository",
    "internship_applications",
    "module_records",
]


def needs_upgrade(engine):
    names = set(inspect(engine).get_table_names())
    if "schema_info" in names:
        return False
    return bool(names & set(LEGACY_TABLES))


def _parse_ts(value):
    if value:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.strptime(str(value), fmt)
            except ValueError:
                pass
    return db.utcnow()


def _s(value):
    return "" if value is None else str(value)


def _rows(conn, table):
    return [dict(r) for r in conn.execute(text(f'SELECT * FROM "{table}"')).mappings()]


def _register_file(conn, upload_dir, owner_type, owner_id, field, relative_key):
    if not relative_key:
        return
    path = Path(upload_dir) / relative_key
    if not path.is_file():
        return
    exists = conn.execute(db.files.select().where(db.files.c.storage_key == relative_key)).first()
    if exists:
        return
    conn.execute(
        db.files.insert().values(
            owner_type=owner_type,
            owner_id=owner_id,
            field=field,
            original_name=path.name,
            content_type=mimetypes.guess_type(path.name)[0] or "application/octet-stream",
            size=path.stat().st_size,
            storage_key=relative_key,
            uploaded_at=db.utcnow(),
        )
    )


def upgrade(engine, upload_dir, logger=None):
    db_path = engine.url.database
    if db_path and Path(db_path).is_file():
        backup = Path(db_path).with_name(Path(db_path).name + ".pre-upgrade-backup")
        if not backup.exists():
            shutil.copy2(db_path, backup)
        if logger:
            logger.warning("Upgrading legacy database schema. Backup written to %s", backup)

    present = [t for t in LEGACY_TABLES if t in set(inspect(engine).get_table_names())]
    with engine.begin() as conn:
        for table in present:
            conn.execute(text(f'ALTER TABLE "{table}" RENAME TO "legacy_{table}"'))

    db.metadata.create_all(engine)
    names = {f"legacy_{t}" for t in present}
    now = db.utcnow()

    with engine.begin() as conn:
        if "legacy_startups" in names:
            statuses = forms.OPTIONS["statuses"]["preincubation"]
            for r in _rows(conn, "legacy_startups"):
                values = {f.name: _s(r.get(f.name)) for f in forms.PRE_INCUBATION_FIELDS}
                values.update(
                    id=r["id"],
                    status=r.get("status") if r.get("status") in statuses else "Pending",
                    is_active=_s(r.get("is_active") or "Yes") != "No",
                    certificate_issued=r.get("certificate_status") == "Issued",
                    pitch_date=_s(r.get("pitch_date")),
                    pitch_time=_s(r.get("pitch_time")),
                    pitch_link=_s(r.get("pitch_link")),
                    evaluation=r.get("evaluation_data") or None,
                    submitted_at=now,
                    updated_at=now,
                )
                conn.execute(db.preincubation_applications.insert().values(**values))
                for field in ("pitch_deck", "resume", "pan_card", "certificate", "business_plan", "other_document"):
                    _register_file(conn, upload_dir, "preincubation", r["id"], field, _s(r.get(field)))

        if "legacy_incubation_applications" in names:
            mapping = {
                "startup_name": "startupName",
                "email": "email",
                "mobile_no": "mobileNo",
                "state": "state",
                "city": "city",
                "sector": "sector",
                "incubatee_level": "incubateeLevel",
                "program_types": "typeOfProgram",
                "operational_model": "operationalModel",
                "govt_programme": "govtProgramme",
                "msme_registered": "msmeRegistered",
                "dipp_registered": "dippRegistered",
                "sdg_goal": "sdgGoals",
                "description": "description",
            }
            for r in _rows(conn, "legacy_incubation_applications"):
                values = {new: _s(r.get(old)) for new, old in mapping.items()}
                submitted = _parse_ts(r.get("submitted_at"))
                values.update(id=r["id"], founder_name="", status="Pending", submitted_at=submitted, updated_at=submitted)
                conn.execute(db.incubation_applications.insert().values(**values))
                pdf = _s(r.get("pptFilename"))
                if pdf:
                    _register_file(conn, upload_dir, "incubation", r["id"], "pitch_deck", f"incubation_ppts/{pdf}")

        if "legacy_incubation_evaluations" in names:
            import json

            app_ids = {row.id for row in conn.execute(db.incubation_applications.select())}
            for r in _rows(conn, "legacy_incubation_evaluations"):
                if r.get("application_id") not in app_ids:
                    continue
                raw = r.get("evaluation_data") or "{}"
                try:
                    parsed = json.loads(raw)
                    total = sum(int(v) for v in (parsed.get("scores") or {}).values() if str(v).isdigit())
                except (ValueError, TypeError, AttributeError):
                    total = 0
                conn.execute(
                    db.incubation_evaluations.insert().values(
                        application_id=r["application_id"],
                        evaluator_name=_s(r.get("evaluator_name")) or "Unknown evaluator",
                        data=raw,
                        total=total,
                        updated_at=_parse_ts(r.get("updated_at")),
                    )
                )

        startup_ids_by_name = {}
        if "legacy_startup_crm" in names:
            for r in _rows(conn, "legacy_startup_crm"):
                values = {f.name: _s(r.get(f.name)) for f in forms.INCUBATED_STARTUP_FIELDS}
                # The old UI stored these under unrelated column names.
                values.update(
                    startup_code=_s(r.get("startup_id")),
                    employees=_s(r.get("employees")) or _s(r.get("current_status")),
                    stage=_s(r.get("assigned_rm")) if r.get("assigned_rm") in forms.OPTIONS["startupStages"] else "",
                    success_story=_s(r.get("current_milestone")),
                    trl_level=_s(r.get("trl_level")) if r.get("trl_level") in forms.OPTIONS["trlLevels"] else "",
                )
                created = _parse_ts(r.get("created_at"))
                values.update(id=r["id"], created_at=created, updated_at=created)
                conn.execute(db.incubated_startups.insert().values(**values))
                startup_ids_by_name.setdefault(values["startup_name"].strip().lower(), r["id"])
                if r.get("logo"):
                    _register_file(conn, upload_dir, "startup", r["id"], "photo", f"startup_photos/{r['logo']}")

        if "legacy_document_repository" in names:
            columns = {key: key for key, _ in forms.STARTUP_DOCUMENT_TYPES}
            columns["product_pics"] = "aoa"  # "Product Pics" were stored in the AoA column
            for r in _rows(conn, "legacy_document_repository"):
                owner = startup_ids_by_name.get(_s(r.get("startup")).strip().lower())
                if owner is None:
                    continue  # unmatched rows stay readable in legacy_document_repository
                for field, legacy_column in columns.items():
                    name = _s(r.get(legacy_column))
                    if name:
                        _register_file(conn, upload_dir, "startup", owner, field, f"documents/{name}")

        if "legacy_internship_applications" in names:
            for r in _rows(conn, "legacy_internship_applications"):
                values = {f.name: _s(r.get(f.name)) for f in forms.INTERNSHIP_FIELDS}
                submitted = _parse_ts(r.get("submitted_at"))
                values.update(
                    id=r["id"],
                    status="Completed" if r.get("is_past_intern") == "Yes" else "Applied",
                    submitted_at=submitted,
                    updated_at=submitted,
                )
                conn.execute(db.internship_applications.insert().values(**values))
                if r.get("cv_filename"):
                    _register_file(conn, upload_dir, "internship", r["id"], "cv", f"internship_files/{r['cv_filename']}")

        if "legacy_module_records" in names:
            for r in _rows(conn, "legacy_module_records"):
                values = {f.name: _s(r.get(f.name)) for f in forms.RECORD_FIELDS}
                if values["status"] not in forms.OPTIONS["recordStatuses"]:
                    values["status"] = ""
                created = _parse_ts(r.get("created_at"))
                values.update(
                    id=r["id"],
                    module=_s(r.get("module")),
                    category=_s(r.get("category")),
                    source="staff",
                    created_at=created,
                    updated_at=created,
                )
                conn.execute(db.module_records.insert().values(**values))
                if r.get("attachment"):
                    _register_file(conn, upload_dir, "record", r["id"], "attachment", f"module_records/{r['attachment']}")

        conn.execute(db.schema_info.insert().values(key="schema_version", value=db.SCHEMA_VERSION))
        conn.execute(db.schema_info.insert().values(key="legacy_upgrade_at", value=now.isoformat()))

    # Postgres-style sequences don't exist in SQLite; AUTOINCREMENT-less INTEGER
    # PRIMARY KEY columns continue from max(id), so preserved ids are safe.
