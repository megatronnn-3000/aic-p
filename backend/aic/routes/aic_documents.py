"""Documents AIC issues to applicants and startups (offer letters, certificates,
agreements). Stored apart from what the applicant submitted (files.source = "aic")
and optionally emailed to them as an attachment."""
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import select, update

from .. import db, notifications, storage
from ..auth import require_admin
from ..forms import FileField
from .common import error, max_file_bytes, svc, validation_error

bp = Blueprint("aic_documents", __name__, url_prefix="/api/admin/aic-documents")

OWNERS = {
    "preincubation": db.preincubation_applications,
    "incubation": db.incubation_applications,
    "internship": db.internship_applications,
    "startup": db.incubated_startups,
}

DOCUMENT = FileField("document", "Document", ["pdf", "image", "word"], required=True)
TITLE_MAX = 150


def _owner(conn, owner_type, owner_id):
    table = OWNERS[owner_type]
    row = conn.execute(select(table).where(table.c.id == owner_id)).first()
    return dict(row._mapping) if row else None


def _attachment_limit():
    return current_app.config["MAX_EMAIL_ATTACHMENT_MB"] * 1024 * 1024


def _too_large_message():
    return (
        f"Files over {current_app.config['MAX_EMAIL_ATTACHMENT_MB']} MB can't be emailed. "
        "Untick “Email this document”, or upload a smaller file."
    )


def _file_row(conn, file_id):
    return conn.execute(
        select(db.files).where(db.files.c.id == file_id, db.files.c.source == db.FILE_SOURCE_AIC)
    ).first()


def _mark_emailed(conn, file_id, to):
    conn.execute(update(db.files).where(db.files.c.id == file_id).values(emailed_at=db.utcnow(), emailed_to=to))


@bp.post("")
@require_admin
def upload_document():
    form = request.form
    owner_type = form.get("owner_type", "")
    owner_id = form.get("owner_id", "")
    if owner_type not in OWNERS or not owner_id.isdigit():
        return error("Unknown record.", 404)
    owner_id = int(owner_id)

    title = " ".join(form.get("title", "").split())
    errors = {}
    if not title:
        errors["title"] = "Document name is required"
    elif len(title) > TITLE_MAX:
        errors["title"] = f"Document name must be {TITLE_MAX} characters or fewer"
    uploads, file_errors = storage.collect_uploads(request.files, [DOCUMENT], {}, max_file_bytes())
    errors.update(file_errors)
    send = form.get("email") == "1"
    if send and uploads and len(uploads[0]["data"]) > _attachment_limit():
        errors["document"] = _too_large_message()
    if errors:
        return validation_error(errors)

    services = svc()
    email_ready = send and services.mailer.enabled
    written = []
    try:
        with services.engine.begin() as conn:
            owner = _owner(conn, owner_type, owner_id)
            if owner is None:
                return error("Record not found.", 404)
            saved = storage.save_uploads(
                conn, services.storage, owner_type, owner_id, uploads, written, source=db.FILE_SOURCE_AIC, title=title
            )
            file_id = saved[0]["id"]
            if email_ready:
                _mark_emailed(conn, file_id, owner["email"])
            document = storage.file_info(_file_row(conn, file_id))
    except Exception:
        storage.discard_keys(services.storage, written)
        raise

    if email_ready:
        upload = uploads[0]
        notifications.document_shared(
            services.mailer,
            owner_type,
            owner,
            title,
            {"filename": upload["original_name"], "content": upload["data"], "content_type": upload["content_type"]},
        )
    return (
        jsonify(
            document=document,
            email_sent=email_ready,
            email_unavailable=send and not services.mailer.enabled,
        ),
        201,
    )


@bp.post("/<int:file_id>/email")
@require_admin
def email_document(file_id):
    services = svc()
    if not services.mailer.enabled:
        return error("Email isn't set up on the server yet (MAIL_PROVIDER), so documents can't be sent.", 503)
    with services.engine.begin() as conn:
        row = _file_row(conn, file_id)
        if row is None:
            return error("Document not found.", 404)
        if row.size > _attachment_limit():
            return error(_too_large_message(), 422)
        owner = _owner(conn, row.owner_type, row.owner_id)
        if owner is None:
            return error("The record this document belongs to no longer exists.", 404)
        try:
            data = services.storage.get(row.storage_key, conn=conn)
        except FileNotFoundError:
            return error("The file's contents are missing from storage, so it can't be emailed.", 410)
        _mark_emailed(conn, file_id, owner["email"])
        document = storage.file_info(_file_row(conn, file_id))

    notifications.document_shared(
        services.mailer,
        row.owner_type,
        owner,
        row.title or row.original_name,
        {"filename": row.original_name, "content": data, "content_type": row.content_type},
    )
    return jsonify(document=document, email_sent=True)
