"""Staff endpoints for Pre-Incubation, Incubation and Internship applications."""
import json

from flask import Blueprint, jsonify, send_file
from sqlalchemy import delete, func, select, update

from .. import db, forms, notifications, storage
from ..auth import require_admin
from .common import PROGRAMS, error, json_body, svc, validation_error

bp = Blueprint("applications", __name__, url_prefix="/api/admin")

LIST_COLUMNS = {
    "preincubation": [
        "id", "name", "email", "contact_number", "startup_name", "founder_name", "sector", "startup_stage",
        "company_type", "status", "is_active", "certificate_issued", "pitch_date", "pitch_time", "pitch_link",
        "submitted_at", "updated_at",
    ],
    "incubation": [
        "id", "founder_name", "startup_name", "email", "mobile_no", "city", "state", "sector", "incubatee_level",
        "status", "submitted_at", "updated_at",
    ],
    "internship": [
        "id", "name", "email", "phone", "department", "year_of_study", "preferred_role", "hosteller_status",
        "willing_late", "status", "submitted_at", "updated_at",
    ],
}

PRE_SCALE = len(forms.OPTIONS["preIncubationScale"])
PRE_CRITERIA = [c["key"] for c in forms.OPTIONS["preIncubationCriteria"]]
INC_SCALE = forms.OPTIONS["incubationScaleMax"]
INC_CRITERIA = [c["key"] for c in forms.OPTIONS["incubationCriteria"]]


def _program(key):
    return PROGRAMS.get(key)


def _score_total(scores):
    return sum(int(v) for v in scores.values() if str(v).isdigit())


def _parse_json(raw):
    try:
        value = json.loads(raw) if raw else None
        return value if isinstance(value, dict) else None
    except (TypeError, ValueError):
        return None


def _incubation_eval_stats(conn, application_id=None):
    t = db.incubation_evaluations
    query = select(t.c.application_id, func.count(t.c.id), func.avg(t.c.total)).group_by(t.c.application_id)
    if application_id is not None:
        query = query.where(t.c.application_id == application_id)
    return {row[0]: (row[1], round(float(row[2]), 1)) for row in conn.execute(query)}


def _file_counts(conn, owner_type):
    rows = conn.execute(
        select(db.files.c.owner_id, func.count(db.files.c.id))
        .where(db.files.c.owner_type == owner_type)
        .group_by(db.files.c.owner_id)
    )
    return dict(rows.all())


def _evaluations(conn, application_id):
    t = db.incubation_evaluations
    rows = conn.execute(select(t).where(t.c.application_id == application_id).order_by(t.c.updated_at.desc())).all()
    out = []
    for row in rows:
        item = db.serialize(row)
        item["data"] = _parse_json(row.data) or {}
        out.append(item)
    return out


def _detail(conn, program, record_id):
    row = conn.execute(select(program.table).where(program.table.c.id == record_id)).first()
    if row is None:
        return None
    item = db.serialize(row)
    item["reference"] = db.reference(program.key, record_id)
    item["files"] = storage.list_files(conn, program.key, record_id)
    if program.key == "preincubation":
        item["evaluation"] = _parse_json(row.evaluation)
        item["evaluation_total"] = _score_total((item["evaluation"] or {}).get("scores", {})) if item["evaluation"] else None
    if program.key == "incubation":
        item["evaluations"] = _evaluations(conn, record_id)
        count, avg = _incubation_eval_stats(conn, record_id).get(record_id, (0, None))
        item["eval_count"], item["eval_avg"] = count, avg
    return item


@bp.get("/<program_key>/applications")
@require_admin
def list_applications(program_key):
    program = _program(program_key)
    if program is None:
        return error("Unknown program.", 404)
    table = program.table
    columns = [table.c[name] for name in LIST_COLUMNS[program.key]]
    if program.key == "preincubation":
        columns.append(table.c.evaluation)

    with svc().engine.connect() as conn:
        rows = conn.execute(select(*columns).order_by(table.c.id.desc())).all()
        file_counts = _file_counts(conn, program.key)
        eval_stats = _incubation_eval_stats(conn) if program.key == "incubation" else {}

    items = []
    for row in rows:
        item = db.serialize(row)
        item["reference"] = db.reference(program.key, row.id)
        item["file_count"] = file_counts.get(row.id, 0)
        if program.key == "preincubation":
            evaluation = _parse_json(item.pop("evaluation"))
            item["evaluation_total"] = _score_total(evaluation.get("scores", {})) if evaluation else None
            item["recommendation"] = (evaluation or {}).get("finalRecommendation") or ""
        if program.key == "incubation":
            count, avg = eval_stats.get(row.id, (0, None))
            item["eval_count"], item["eval_avg"] = count, avg
        items.append(item)
    return jsonify(items)


@bp.get("/<program_key>/applications/<int:record_id>")
@require_admin
def get_application(program_key, record_id):
    program = _program(program_key)
    if program is None:
        return error("Unknown program.", 404)
    with svc().engine.connect() as conn:
        item = _detail(conn, program, record_id)
    if item is None:
        return error("Application not found.", 404)
    return jsonify(item)


@bp.patch("/<program_key>/applications/<int:record_id>")
@require_admin
def update_application(program_key, record_id):
    program = _program(program_key)
    if program is None:
        return error("Unknown program.", 404)
    body = json_body()
    changes, errors = {}, {}

    if "status" in body:
        if body["status"] not in program.statuses:
            errors["status"] = f"Status must be one of: {', '.join(program.statuses)}"
        else:
            changes["status"] = body["status"]

    if program.key == "preincubation":
        for flag in ("is_active", "certificate_issued"):
            if flag in body:
                if not isinstance(body[flag], bool):
                    errors[flag] = f"{flag} must be true or false"
                else:
                    changes[flag] = body[flag]
        pitch_keys = [f.name for f in forms.PITCH_FIELDS]
        if any(k in body for k in pitch_keys):
            clean, pitch_errors = forms.validate(forms.PITCH_FIELDS, {k: body.get(k, "") for k in pitch_keys})
            errors.update(pitch_errors)
            changes.update(clean)

    if errors:
        return validation_error(errors)
    if not changes:
        return error("Nothing to update.")

    services = svc()
    with services.engine.begin() as conn:
        before = conn.execute(select(program.table).where(program.table.c.id == record_id)).first()
        if before is None:
            return error("Application not found.", 404)
        conn.execute(
            update(program.table).where(program.table.c.id == record_id).values(**changes, updated_at=db.utcnow())
        )
        item = _detail(conn, program, record_id)

    emailed = False
    if body.get("notify", True):
        if "status" in changes and changes["status"] != before.status:
            emailed = notifications.status_changed(services.mailer, program.key, item, changes["status"])
        if program.key == "preincubation" and changes.get("pitch_date") and body.get("notify_pitch"):
            notifications.pitch_scheduled(services.mailer, item)
            emailed = True
    item["email_sent"] = emailed and services.mailer.enabled
    return jsonify(item)


@bp.delete("/<program_key>/applications/<int:record_id>")
@require_admin
def delete_application(program_key, record_id):
    program = _program(program_key)
    if program is None:
        return error("Unknown program.", 404)
    services = svc()
    with services.engine.begin() as conn:
        exists = conn.execute(select(program.table.c.id).where(program.table.c.id == record_id)).first()
        if exists is None:
            return error("Application not found.", 404)
        storage.delete_owner_files(conn, services.storage, program.key, record_id)
        if program.key == "incubation":
            conn.execute(delete(db.incubation_evaluations).where(db.incubation_evaluations.c.application_id == record_id))
        conn.execute(delete(program.table).where(program.table.c.id == record_id))
    return jsonify(ok=True)


@bp.get("/<program_key>/applications/<int:record_id>/documents.zip")
@require_admin
def download_documents(program_key, record_id):
    program = _program(program_key)
    if program is None:
        return error("Unknown program.", 404)
    services = svc()
    with services.engine.connect() as conn:
        row = conn.execute(select(program.table).where(program.table.c.id == record_id)).first()
        if row is None:
            return error("Application not found.", 404)
        archive, count = storage.build_zip(conn, services.storage, program.key, record_id, program.file_labels)
    if count == 0:
        return error("This application has no documents to download.", 404)
    name = getattr(row, "startup_name", "") or getattr(row, "name", "") or "application"
    safe = "".join(ch if ch.isalnum() or ch in " -_" else "_" for ch in name).strip() or "application"
    return send_file(
        archive,
        mimetype="application/zip",
        as_attachment=True,
        download_name=f"{db.reference(program.key, record_id)} {safe}.zip",
    )


def _clean_scores(raw, criteria, scale_max):
    raw = raw if isinstance(raw, dict) else {}
    scores = {}
    for key in criteria:
        value = str(raw.get(key, "") or "").strip()
        if value and (not value.isdigit() or not 1 <= int(value) <= scale_max):
            raise ValueError(f"Scores must be between 1 and {scale_max}")
        scores[key] = value
    return scores


def _clean_text_map(raw, keys, limit=1000):
    raw = raw if isinstance(raw, dict) else {}
    return {key: str(raw.get(key, "") or "").strip()[:limit] for key in keys}


def _clean_str(body, key, limit=300):
    return str(body.get(key, "") or "").strip()[:limit]


@bp.put("/preincubation/applications/<int:record_id>/evaluation")
@require_admin
def save_preincubation_evaluation(record_id):
    body = json_body()
    try:
        scores = _clean_scores(body.get("scores"), PRE_CRITERIA, PRE_SCALE)
    except ValueError as exc:
        return error(str(exc), 422)
    recommendation = _clean_str(body, "finalRecommendation")
    if recommendation and recommendation not in forms.OPTIONS["preIncubationRecommendations"]:
        return error("Unknown recommendation.", 422)
    evaluation = {
        "founderNames": _clean_str(body, "founderNames"),
        "date": _clean_str(body, "date", 10),
        "scores": scores,
        "observations": _clean_text_map(body.get("observations"), PRE_CRITERIA),
        "finalRecommendation": recommendation,
        "reasons": _clean_str(body, "reasons", 4000),
        "evaluatorName": _clean_str(body, "evaluatorName", 120),
        "evaluatorSignature": _clean_str(body, "evaluatorSignature", 120),
    }
    table = db.preincubation_applications
    with svc().engine.begin() as conn:
        result = conn.execute(
            update(table)
            .where(table.c.id == record_id)
            .values(evaluation=json.dumps(evaluation), updated_at=db.utcnow())
        )
        if result.rowcount == 0:
            return error("Application not found.", 404)
    return jsonify(evaluation=evaluation, evaluation_total=_score_total(scores))


@bp.get("/incubation/applications/<int:record_id>/evaluations")
@require_admin
def list_incubation_evaluations(record_id):
    with svc().engine.connect() as conn:
        return jsonify(_evaluations(conn, record_id))


@bp.put("/incubation/applications/<int:record_id>/evaluations")
@require_admin
def save_incubation_evaluation(record_id):
    body = json_body()
    evaluator = _clean_str(body, "evaluatorName", 120)
    if not evaluator:
        return validation_error({"evaluatorName": "Evaluator name is required — it keeps each evaluator's scores separate"})
    try:
        scores = _clean_scores(body.get("scores"), INC_CRITERIA, INC_SCALE)
    except ValueError as exc:
        return error(str(exc), 422)
    data = {
        "companyName": _clean_str(body, "companyName", 150),
        "date": _clean_str(body, "date", 10),
        "evaluatorName": evaluator,
        "industry": _clean_str(body, "industry", 150),
        "stage": _clean_str(body, "stage", 120),
        "ask": _clean_str(body, "ask", 100),
        "briefDescription": _clean_str(body, "briefDescription", 2000),
        "scores": scores,
        "comments": _clean_text_map(body.get("comments"), INC_CRITERIA),
        "nextSteps": _clean_str(body, "nextSteps", 4000),
        "nameDesignation": _clean_str(body, "nameDesignation", 200),
        "evaluatorSignature": _clean_str(body, "evaluatorSignature", 120),
    }
    total = _score_total(scores)
    t = db.incubation_evaluations
    entry_id = int(body["id"]) if str(body.get("id") or "").isdigit() else None

    with svc().engine.begin() as conn:
        app_row = conn.execute(
            select(db.incubation_applications.c.id).where(db.incubation_applications.c.id == record_id)
        ).first()
        if app_row is None:
            return error("Application not found.", 404)
        same_name = conn.execute(
            select(t.c.id).where(t.c.application_id == record_id, func.lower(t.c.evaluator_name) == evaluator.lower())
        ).first()
        values = dict(evaluator_name=evaluator, data=json.dumps(data), total=total, updated_at=db.utcnow())

        if entry_id:
            if same_name and same_name.id != entry_id:
                return error(f"{evaluator} has already evaluated this startup. Edit that entry instead.", 409)
            result = conn.execute(update(t).where(t.c.id == entry_id, t.c.application_id == record_id).values(**values))
            if result.rowcount == 0:
                return error("Evaluation not found.", 404)
            saved_id = entry_id
        elif same_name:
            conn.execute(update(t).where(t.c.id == same_name.id).values(**values))
            saved_id = same_name.id
        else:
            saved_id = conn.execute(t.insert().values(application_id=record_id, **values)).inserted_primary_key[0]

        row = conn.execute(select(t).where(t.c.id == saved_id)).first()
    item = db.serialize(row)
    item["data"] = data
    return jsonify(item)


@bp.delete("/incubation/evaluations/<int:evaluation_id>")
@require_admin
def delete_incubation_evaluation(evaluation_id):
    t = db.incubation_evaluations
    with svc().engine.begin() as conn:
        result = conn.execute(delete(t).where(t.c.id == evaluation_id))
    if result.rowcount == 0:
        return error("Evaluation not found.", 404)
    return jsonify(ok=True)
