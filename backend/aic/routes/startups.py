"""Staff endpoints for incubated startup records and their documents."""
from flask import Blueprint, jsonify, request, send_file
from sqlalchemy import delete, func, insert, select, update

from .. import db, forms, storage
from ..auth import require_admin
from . import support
from .common import error, max_file_bytes, svc, validation_error

bp = Blueprint("startups", __name__, url_prefix="/api/admin/startups")

OWNER = "startup"
FILE_LABELS = {f.name: f.label for f in forms.INCUBATED_STARTUP_FILES}
GRADUATED_STAGE = forms.OPTIONS["graduatedStartupStage"]


def _detail(conn, startup_id):
    row = conn.execute(select(db.incubated_startups).where(db.incubated_startups.c.id == startup_id)).first()
    if row is None:
        return None
    item = db.serialize(row)
    item["files"] = storage.list_files(conn, OWNER, startup_id)
    item["aic_documents"] = storage.list_files(conn, OWNER, startup_id, source=db.FILE_SOURCE_AIC)
    item["graduated"] = row.stage == GRADUATED_STAGE
    return item


def _source_application(form):
    value = (form.get("source_application_id") or "").strip()
    return int(value) if value.isdigit() else None


@bp.get("")
@require_admin
def list_startups():
    t = db.incubated_startups
    with svc().engine.connect() as conn:
        rows = conn.execute(select(t).order_by(t.c.id.desc())).all()
        file_rows = conn.execute(
            select(db.files.c.owner_id, db.files.c.field, func.max(db.files.c.id), func.count(db.files.c.id))
            .where(db.files.c.owner_type == OWNER, db.files.c.source == db.FILE_SOURCE_APPLICANT)
            .group_by(db.files.c.owner_id, db.files.c.field)
        ).all()
    photos, doc_counts = {}, {}
    for owner_id, field, latest_id, count in file_rows:
        if field == "photo":
            photos[owner_id] = latest_id
        else:
            doc_counts[owner_id] = doc_counts.get(owner_id, 0) + count
    items = []
    for row in rows:
        item = db.serialize(row)
        item["photo_file_id"] = photos.get(row.id)
        item["document_count"] = doc_counts.get(row.id, 0)
        item["graduated"] = row.stage == GRADUATED_STAGE
        items.append(item)
    return jsonify(items)


@bp.get("/<int:startup_id>")
@require_admin
def get_startup(startup_id):
    with svc().engine.connect() as conn:
        item = _detail(conn, startup_id)
    if item is None:
        return error("Startup not found.", 404)
    return jsonify(item)


def _save(startup_id=None):
    clean, errors = forms.validate(forms.INCUBATED_STARTUP_FIELDS, request.form)
    uploads, file_errors = storage.collect_uploads(
        request.files, forms.INCUBATED_STARTUP_FILES, clean, max_file_bytes(), require=False
    )
    errors.update(file_errors)
    if errors:
        return validation_error(errors)

    services = svc()
    t = db.incubated_startups
    written = []
    try:
        with services.engine.begin() as conn:
            now = db.utcnow()
            if startup_id is None:
                startup_id = conn.execute(
                    insert(t).values(
                        **clean, source_application_id=_source_application(request.form), created_at=now, updated_at=now
                    )
                ).inserted_primary_key[0]
                status = 201
            else:
                result = conn.execute(update(t).where(t.c.id == startup_id).values(**clean, updated_at=now))
                if result.rowcount == 0:
                    return error("Startup not found.", 404)
                status = 200
                if any(u["field"] == "photo" for u in uploads):
                    # A new photo replaces the old one rather than piling up.
                    old = conn.execute(
                        select(db.files.c.id, db.files.c.storage_key).where(
                            db.files.c.owner_type == OWNER, db.files.c.owner_id == startup_id, db.files.c.field == "photo"
                        )
                    ).all()
                    for f in old:
                        services.storage.delete(f.storage_key, conn=conn)
                    conn.execute(delete(db.files).where(db.files.c.id.in_([f.id for f in old])))
            storage.save_uploads(conn, services.storage, OWNER, startup_id, uploads, written)
            item = _detail(conn, startup_id)
    except Exception:
        storage.discard_keys(services.storage, written)
        raise
    return jsonify(item), status


@bp.post("")
@require_admin
def create_startup():
    return _save()


@bp.patch("/<int:startup_id>")
@require_admin
def update_startup(startup_id):
    return _save(startup_id)


@bp.delete("/<int:startup_id>")
@require_admin
def delete_startup(startup_id):
    services = svc()
    t = db.incubated_startups
    with services.engine.begin() as conn:
        if conn.execute(select(t.c.id).where(t.c.id == startup_id)).first() is None:
            return error("Startup not found.", 404)
        storage.delete_owner_files(conn, services.storage, OWNER, startup_id)
        support.delete_owner_entries(conn, OWNER, startup_id)
        conn.execute(delete(t).where(t.c.id == startup_id))
    return jsonify(ok=True)


@bp.get("/<int:startup_id>/documents.zip")
@require_admin
def download_documents(startup_id):
    services = svc()
    with services.engine.connect() as conn:
        row = conn.execute(select(db.incubated_startups).where(db.incubated_startups.c.id == startup_id)).first()
        if row is None:
            return error("Startup not found.", 404)
        archive, count = storage.build_zip(conn, services.storage, OWNER, startup_id, FILE_LABELS)
    if count == 0:
        return error("No documents have been uploaded for this startup.", 404)
    safe = "".join(ch if ch.isalnum() or ch in " -_" else "_" for ch in row.startup_name).strip() or "startup"
    return send_file(archive, mimetype="application/zip", as_attachment=True, download_name=f"{safe} documents.zip")
