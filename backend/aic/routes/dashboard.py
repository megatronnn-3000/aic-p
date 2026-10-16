"""Staff dashboard summary: counts per pipeline stage plus items needing attention."""
from datetime import date

from flask import Blueprint, jsonify
from sqlalchemy import func, select

from .. import db, forms
from ..auth import require_admin
from .common import svc

bp = Blueprint("dashboard", __name__, url_prefix="/api/admin")

OPEN_RECORD_STATUSES = ("", "Open", "In Progress")


def _status_counts(conn, table, statuses):
    counts = {status: 0 for status in statuses}
    for status, count in conn.execute(select(table.c.status, func.count(table.c.id)).group_by(table.c.status)):
        counts[status] = counts.get(status, 0) + count
    return counts


@bp.get("/dashboard")
@require_admin
def dashboard():
    statuses = forms.OPTIONS["statuses"]
    pre, inc, intern = db.preincubation_applications, db.incubation_applications, db.internship_applications
    startups, records, evals = db.incubated_startups, db.module_records, db.incubation_evaluations
    today = date.today().isoformat()

    with svc().engine.connect() as conn:
        pre_counts = _status_counts(conn, pre, statuses["preincubation"])
        inc_counts = _status_counts(conn, inc, statuses["incubation"])
        intern_counts = _status_counts(conn, intern, statuses["internship"])

        pre_inactive = conn.execute(
            select(func.count(pre.c.id)).where(pre.c.status == "Approved", pre.c.is_active.is_(False))
        ).scalar_one()
        evaluated_ids = select(evals.c.application_id).distinct()
        inc_unevaluated = conn.execute(
            select(func.count(inc.c.id)).where(inc.c.status == "Pending", inc.c.id.not_in(evaluated_ids))
        ).scalar_one()

        startup_total = conn.execute(select(func.count(startups.c.id))).scalar_one()
        startup_graduated = conn.execute(
            select(func.count(startups.c.id)).where(startups.c.stage == forms.OPTIONS["graduatedStartupStage"])
        ).scalar_one()

        record_counts = {}
        for module, category, count in conn.execute(
            select(records.c.module, records.c.category, func.count(records.c.id)).group_by(
                records.c.module, records.c.category
            )
        ):
            record_counts.setdefault(module, {})[category] = count

        open_enquiries = {key: 0 for key in forms.RECORD_MODULES["enquiry"]}
        for category, count in conn.execute(
            select(records.c.category, func.count(records.c.id))
            .where(records.c.module == "enquiry", records.c.status.in_(OPEN_RECORD_STATUSES))
            .group_by(records.c.category)
        ):
            open_enquiries[category] = count

        attention = []
        for key, table, waiting, title_col, subtitle_col in (
            ("preincubation", pre, "Pending", pre.c.startup_name, pre.c.name),
            ("incubation", inc, "Pending", inc.c.startup_name, inc.c.founder_name),
            ("internship", intern, "Applied", intern.c.name, intern.c.preferred_role),
        ):
            for row in conn.execute(
                select(table.c.id, title_col.label("title"), subtitle_col.label("subtitle"), table.c.submitted_at)
                .where(table.c.status == waiting)
                .order_by(table.c.submitted_at.desc())
                .limit(6)
            ):
                item = db.serialize(row)
                item.update(program=key, reference=db.reference(key, row.id))
                attention.append(item)
        attention.sort(key=lambda item: item["submitted_at"], reverse=True)

        upcoming_pitches = [
            dict(db.serialize(row), reference=db.reference("preincubation", row.id))
            for row in conn.execute(
                select(pre.c.id, pre.c.startup_name, pre.c.pitch_date, pre.c.pitch_time)
                .where(pre.c.pitch_date >= today, pre.c.status.in_(("Pending", "Approved")))
                .order_by(pre.c.pitch_date, pre.c.pitch_time)
                .limit(5)
            )
        ]
        upcoming_events = [
            db.serialize(row)
            for row in conn.execute(
                select(records.c.id, records.c.title, records.c.record_date, records.c.status)
                .where(records.c.module == "events", records.c.category == "upcoming", records.c.record_date >= today)
                .order_by(records.c.record_date)
                .limit(5)
            )
        ]

    return jsonify(
        preincubation={"by_status": pre_counts, "inactive": pre_inactive},
        incubation={"by_status": inc_counts, "awaiting_evaluation": inc_unevaluated},
        internship={"by_status": intern_counts},
        startups={"total": startup_total, "graduated": startup_graduated},
        records=record_counts,
        open_enquiries=open_enquiries,
        attention=attention[:8],
        upcoming_pitches=upcoming_pitches,
        upcoming_events=upcoming_events,
    )
