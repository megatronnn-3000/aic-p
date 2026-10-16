"""Public (unauthenticated) endpoints: health, applications and enquiries."""
from datetime import date

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import func, insert, select, text

from .. import db, forms, notifications, storage
from ..mailer import render_email
from .common import PROGRAMS_BY_SLUG, client_key, error, max_file_bytes, svc, validation_error

bp = Blueprint("public", __name__, url_prefix="/api")


@bp.get("/health")
def health():
    with svc().engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return jsonify(status="ok")


@bp.post("/apply/<slug>")
def apply(slug):
    program = PROGRAMS_BY_SLUG.get(slug)
    if program is None:
        return error("Unknown program.", 404)

    limiter = svc().submission_limiter
    if limiter.blocked(client_key()):
        return error("Too many applications from your network in the last hour. Please try again later.", 429)

    clean, errors = forms.validate(program.fields, request.form)
    uploads, file_errors = storage.collect_uploads(request.files, program.files, clean, max_file_bytes())
    errors.update(file_errors)
    if errors:
        return validation_error(errors)

    services = svc()
    table = program.table
    written = []
    try:
        with services.engine.begin() as conn:
            if request.form.get("confirm_duplicate") != "1":
                duplicate = conn.execute(
                    select(table.c.id).where(func.lower(table.c.email) == clean["email"].lower()).limit(1)
                ).first()
                if duplicate:
                    return error(
                        "An application with this email address has already been submitted.",
                        409,
                        duplicate=True,
                    )
            now = db.utcnow()
            result = conn.execute(
                insert(table).values(**clean, status=program.default_status, submitted_at=now, updated_at=now)
            )
            new_id = result.inserted_primary_key[0]
            saved = storage.save_uploads(conn, services.storage, program.key, new_id, uploads, written)
    except Exception:
        storage.discard_keys(services.storage, written)
        raise

    limiter.hit(client_key())
    record = {**clean, "id": new_id}
    notifications.application_received(services.mailer, program.key, record)
    notifications.admin_new_application(services.mailer, current_app.config["ADMIN_NOTIFY_EMAIL"], program.key, record)

    return (
        jsonify(
            id=new_id,
            reference=db.reference(program.key, new_id),
            submitted_at=db.serialize({"t": now})["t"],
            files=[{"field": f["field"], "original_name": f["original_name"]} for f in saved],
            email_enabled=services.mailer.enabled,
        ),
        201,
    )


@bp.post("/enquiries")
def create_enquiry():
    payload = request.get_json(silent=True) or {}
    # Honeypot: real visitors never see or fill this field.
    if str(payload.get("company_website", "")).strip():
        return jsonify(ok=True), 201

    limiter = svc().submission_limiter
    if limiter.blocked(client_key()):
        return error("Too many messages from your network in the last hour. Please try again later.", 429)

    clean, errors = forms.validate(forms.ENQUIRY_FIELDS, payload)
    if errors:
        return validation_error(errors)

    now = db.utcnow()
    with svc().engine.begin() as conn:
        conn.execute(
            insert(db.module_records).values(
                module="enquiry",
                category=clean["program"],
                title=clean["name"],
                contact_name=clean["name"],
                contact_email=clean["email"],
                contact_phone=clean["phone"],
                description=clean["message"],
                record_date=date.today().isoformat(),
                status="Open",
                source="public",
                created_at=now,
                updated_at=now,
            )
        )
    limiter.hit(client_key())

    admin_email = current_app.config["ADMIN_NOTIFY_EMAIL"]
    program_name = forms.OPTIONS["enquiryPrograms"][clean["program"]]
    if admin_email:
        svc().mailer.send(
            admin_email,
            f"New {program_name} enquiry from {clean['name']}",
            render_email(
                f"New {program_name} enquiry",
                [clean["message"]],
                [("From", clean["name"]), ("Email", clean["email"]), ("Phone", clean["phone"])],
                closing="",
            ),
        )
    return jsonify(ok=True), 201
