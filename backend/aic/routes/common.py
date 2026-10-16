from dataclasses import dataclass

from flask import current_app, jsonify, request

from .. import db, forms


def svc():
    return current_app.extensions["aic"]


def error(message, status=400, **extra):
    return jsonify(error=message, **extra), status


def validation_error(errors):
    message = next(iter(errors.values())) if len(errors) == 1 else "Please correct the highlighted fields."
    return jsonify(error=message, fields=errors), 422


def max_file_bytes():
    return current_app.config["MAX_FILE_MB"] * 1024 * 1024


def client_key():
    return request.remote_addr or "unknown"


def json_body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


@dataclass(frozen=True)
class Program:
    key: str
    slug: str
    table: object
    fields: list
    files: list
    default_status: str
    file_labels: dict

    @property
    def statuses(self):
        return forms.OPTIONS["statuses"][self.key]


PROGRAMS = {
    "preincubation": Program(
        "preincubation",
        "pre-incubation",
        db.preincubation_applications,
        forms.PRE_INCUBATION_FIELDS,
        forms.PRE_INCUBATION_FILES,
        "Pending",
        {f.name: f.label for f in forms.PRE_INCUBATION_FILES},
    ),
    "incubation": Program(
        "incubation",
        "incubation",
        db.incubation_applications,
        forms.INCUBATION_FIELDS,
        forms.INCUBATION_FILES,
        "Pending",
        {f.name: f.label for f in forms.INCUBATION_FILES},
    ),
    "internship": Program(
        "internship",
        "internship",
        db.internship_applications,
        forms.INTERNSHIP_FIELDS,
        forms.INTERNSHIP_FILES,
        "Applied",
        {f.name: f.label for f in forms.INTERNSHIP_FILES},
    ),
}

PROGRAMS_BY_SLUG = {p.slug: p for p in PROGRAMS.values()}
