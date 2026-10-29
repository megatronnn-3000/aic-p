"""Investors and mentors linked to a startup (pre-incubated or incubated)."""
from flask import Blueprint, jsonify
from sqlalchemy import delete, func, select, update

from .. import db, forms
from ..auth import require_admin
from .common import error, json_body, svc, validation_error

bp = Blueprint("support", __name__, url_prefix="/api/admin")

OWNERS = {
    "preincubation": db.preincubation_applications,
    "startup": db.incubated_startups,
}

KINDS = {
    "investors": (db.startup_investments, forms.INVESTMENT_FIELDS, "Investment"),
    "mentors": (db.startup_mentors, forms.MENTOR_FIELDS, "Mentor"),
}


def list_entries(conn, kind, owner_type, owner_id):
    table = KINDS[kind][0]
    rows = conn.execute(
        select(table).where(table.c.owner_type == owner_type, table.c.owner_id == owner_id).order_by(table.c.id)
    ).all()
    return [db.serialize(row) for row in rows]


def delete_owner_entries(conn, owner_type, owner_id):
    for table, _fields, _label in KINDS.values():
        conn.execute(delete(table).where(table.c.owner_type == owner_type, table.c.owner_id == owner_id))


def _owner_exists(conn, owner_type, owner_id):
    table = OWNERS[owner_type]
    return conn.execute(select(table.c.id).where(table.c.id == owner_id)).first() is not None


@bp.get("/mentors")
@require_admin
def mentor_directory():
    """Distinct mentors already assigned anywhere, newest details first — offered as suggestions."""
    t = db.startup_mentors
    with svc().engine.connect() as conn:
        rows = conn.execute(select(t).order_by(t.c.updated_at.desc())).all()
    seen, out = set(), []
    for row in rows:
        key = row.mentor_name.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({name: getattr(row, name) for name in ("mentor_name", "expertise", "organisation", "email", "phone")})
    return jsonify(sorted(out, key=lambda m: m["mentor_name"].lower()))


@bp.post("/<any(preincubation, startup):owner_type>/<int:owner_id>/<any(investors, mentors):kind>")
@require_admin
def create_entry(owner_type, owner_id, kind):
    table, fields, _label = KINDS[kind]
    clean, errors = forms.validate(fields, json_body())
    if errors:
        return validation_error(errors)
    if kind == "mentors" and not clean["status"]:
        clean["status"] = "Active"
    with svc().engine.begin() as conn:
        if not _owner_exists(conn, owner_type, owner_id):
            return error("Startup not found.", 404)
        if kind == "mentors":
            already = conn.execute(
                select(table.c.id).where(
                    table.c.owner_type == owner_type,
                    table.c.owner_id == owner_id,
                    func.lower(table.c.mentor_name) == clean["mentor_name"].lower(),
                )
            ).first()
            if already:
                return error(f"{clean['mentor_name']} is already assigned to this startup.", 409)
        now = db.utcnow()
        new_id = conn.execute(
            table.insert().values(owner_type=owner_type, owner_id=owner_id, created_at=now, updated_at=now, **clean)
        ).inserted_primary_key[0]
        row = conn.execute(select(table).where(table.c.id == new_id)).first()
    return jsonify(db.serialize(row)), 201


@bp.patch("/<any(investors, mentors):kind>/<int:entry_id>")
@require_admin
def update_entry(kind, entry_id):
    table, fields, label = KINDS[kind]
    clean, errors = forms.validate(fields, json_body(), partial=True)
    if errors:
        return validation_error(errors)
    if not clean:
        return error("Nothing to update.")
    with svc().engine.begin() as conn:
        result = conn.execute(update(table).where(table.c.id == entry_id).values(**clean, updated_at=db.utcnow()))
        if result.rowcount == 0:
            return error(f"{label} not found.", 404)
        row = conn.execute(select(table).where(table.c.id == entry_id)).first()
    return jsonify(db.serialize(row))


@bp.delete("/<any(investors, mentors):kind>/<int:entry_id>")
@require_admin
def delete_entry(kind, entry_id):
    table, _fields, label = KINDS[kind]
    with svc().engine.begin() as conn:
        result = conn.execute(delete(table).where(table.c.id == entry_id))
    if result.rowcount == 0:
        return error(f"{label} not found.", 404)
    return jsonify(ok=True)
