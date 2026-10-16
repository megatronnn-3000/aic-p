"""Staff endpoints for module records: enquiries, events, MoUs, AIM, SISFS,
coworking and facility logs. One table, keyed by ``module`` + ``category``."""
from flask import Blueprint, jsonify, request
from sqlalchemy import delete, func, insert, select, update

from .. import db, forms, storage
from ..auth import require_admin
from .common import error, max_file_bytes, svc, validation_error

bp = Blueprint("records", __name__, url_prefix="/api/admin/records")

OWNER = "record"


def _valid_section(module, category):
    return category in forms.RECORD_MODULES.get(module, [])


def _attachments(conn, record_ids):
    if not record_ids:
        return {}
    rows = conn.execute(
        select(db.files.c.id, db.files.c.owner_id, db.files.c.original_name, db.files.c.size)
        .where(db.files.c.owner_type == OWNER, db.files.c.owner_id.in_(record_ids))
        .order_by(db.files.c.id)
    ).all()
    return {row.owner_id: {"id": row.id, "original_name": row.original_name, "size": row.size} for row in rows}


def _serialize(row, attachments):
    item = db.serialize(row)
    item["attachment"] = attachments.get(row.id)
    return item


@bp.get("")
@require_admin
def list_records():
    module, category = request.args.get("module", ""), request.args.get("category", "")
    if not _valid_section(module, category):
        return error("Unknown section.", 404)
    t = db.module_records
    with svc().engine.connect() as conn:
        rows = conn.execute(
            select(t).where(t.c.module == module, t.c.category == category).order_by(t.c.id.desc())
        ).all()
        attachments = _attachments(conn, [r.id for r in rows])
    return jsonify([_serialize(r, attachments) for r in rows])


@bp.get("/counts")
@require_admin
def record_counts():
    t = db.module_records
    with svc().engine.connect() as conn:
        rows = conn.execute(select(t.c.module, t.c.category, func.count(t.c.id)).group_by(t.c.module, t.c.category))
        counts = {}
        for module, category, count in rows:
            counts.setdefault(module, {})[category] = count
    return jsonify(counts)


def _save(record_id=None):
    form = request.form
    module, category = form.get("module", ""), form.get("category", "")
    if record_id is None and not _valid_section(module, category):
        return error("Unknown section.", 404)
    clean, errors = forms.validate(forms.RECORD_FIELDS, form)
    uploads, file_errors = storage.collect_uploads(request.files, forms.RECORD_FILES, clean, max_file_bytes(), require=False)
    errors.update(file_errors)
    if errors:
        return validation_error(errors)

    services = svc()
    t = db.module_records
    written = []
    try:
        with services.engine.begin() as conn:
            now = db.utcnow()
            if record_id is None:
                record_id = conn.execute(
                    insert(t).values(module=module, category=category, **clean, created_at=now, updated_at=now)
                ).inserted_primary_key[0]
                status = 201
            else:
                values = dict(clean, updated_at=now)
                if _valid_section(module, category):
                    values.update(module=module, category=category)  # allows moving e.g. upcoming -> past
                result = conn.execute(update(t).where(t.c.id == record_id).values(**values))
                if result.rowcount == 0:
                    return error("Record not found.", 404)
                status = 200
                if uploads or form.get("remove_attachment") == "1":
                    storage.delete_owner_files(conn, services.storage, OWNER, record_id)
            storage.save_uploads(conn, services.storage, OWNER, record_id, uploads, written)
            row = conn.execute(select(t).where(t.c.id == record_id)).first()
            item = _serialize(row, _attachments(conn, [record_id]))
    except Exception:
        storage.discard_keys(services.storage, written)
        raise
    return jsonify(item), status


@bp.post("")
@require_admin
def create_record():
    return _save()


@bp.patch("/<int:record_id>")
@require_admin
def update_record(record_id):
    return _save(record_id)


@bp.delete("/<int:record_id>")
@require_admin
def delete_record(record_id):
    services = svc()
    t = db.module_records
    with services.engine.begin() as conn:
        if conn.execute(select(t.c.id).where(t.c.id == record_id)).first() is None:
            return error("Record not found.", 404)
        storage.delete_owner_files(conn, services.storage, OWNER, record_id)
        conn.execute(delete(t).where(t.c.id == record_id))
    return jsonify(ok=True)
