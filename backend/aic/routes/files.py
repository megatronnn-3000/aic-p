"""Authenticated download / delete of any stored file."""
import io

from flask import Blueprint, jsonify, request, send_file
from sqlalchemy import delete, select

from .. import db
from ..auth import require_admin
from .common import error, svc

bp = Blueprint("files", __name__, url_prefix="/api/admin/files")

INLINE_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/webp"}


@bp.get("/<int:file_id>")
@require_admin
def download_file(file_id):
    services = svc()
    with services.engine.connect() as conn:
        row = conn.execute(select(db.files).where(db.files.c.id == file_id)).first()
        if row is None:
            return error("File not found.", 404)
        try:
            data = services.storage.get(row.storage_key, conn=conn)
        except FileNotFoundError:
            return error(
                "The file record exists but its contents are missing from storage "
                "(it may have been lost when the server's disk was reset).",
                410,
            )
    inline = request.args.get("inline") == "1" and row.content_type in INLINE_TYPES
    response = send_file(
        io.BytesIO(data),
        mimetype=row.content_type,
        as_attachment=not inline,
        download_name=row.original_name,
    )
    response.headers["Cache-Control"] = "private, no-store"
    return response


@bp.delete("/<int:file_id>")
@require_admin
def delete_file(file_id):
    services = svc()
    with services.engine.begin() as conn:
        row = conn.execute(select(db.files).where(db.files.c.id == file_id)).first()
        if row is None:
            return error("File not found.", 404)
        services.storage.delete(row.storage_key, conn=conn)
        conn.execute(delete(db.files).where(db.files.c.id == file_id))
    return jsonify(ok=True)
