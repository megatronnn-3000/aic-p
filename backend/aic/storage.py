"""Uploaded-file validation and storage backends.

Backends (``STORAGE_BACKEND``):
- ``local``    files under ``UPLOAD_DIR`` (development, or hosts with a persistent disk)
- ``database`` file bytes in the ``file_blobs`` table (durable on Render's free tier
               when ``DATABASE_URL`` points at a hosted Postgres)
- ``s3``       any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, ...)
"""
import io
import mimetypes
import re
import uuid
import zipfile
from pathlib import Path

from sqlalchemy import delete, insert, select

from . import db

FILE_KINDS = {
    "pdf": [".pdf"],
    "image": [".png", ".jpg", ".jpeg", ".webp"],
    "word": [".doc", ".docx"],
    "excel": [".xls", ".xlsx", ".csv"],
    "powerpoint": [".ppt", ".pptx"],
    "text": [".txt"],
}

_OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_ZIP = b"PK\x03\x04"
SIGNATURES = {
    ".pdf": [b"%PDF"],
    ".png": [b"\x89PNG\r\n\x1a\n"],
    ".jpg": [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".doc": [_OLE],
    ".xls": [_OLE],
    ".ppt": [_OLE],
    ".docx": [_ZIP],
    ".xlsx": [_ZIP],
    ".pptx": [_ZIP],
}

CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
}


class UploadError(ValueError):
    def __init__(self, field, message):
        super().__init__(message)
        self.field = field
        self.message = message


def allowed_extensions(kinds):
    return [ext for kind in kinds for ext in FILE_KINDS[kind]]


def clean_display_name(filename):
    name = Path(str(filename or "file").replace("\\", "/")).name
    name = re.sub(r"[\x00-\x1f\x7f]", "", name).strip() or "file"
    return name[-180:]


def _matches_signature(ext, data):
    if ext == ".webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    if ext in (".csv", ".txt"):
        return b"\x00" not in data[:4096]
    signatures = SIGNATURES.get(ext)
    return signatures is None or any(data.startswith(sig) for sig in signatures)


def read_upload(file_storage, spec, max_bytes):
    """Validate one uploaded file against a FileField spec and return a dict."""
    original = clean_display_name(file_storage.filename)
    ext = Path(original).suffix.lower()
    allowed = allowed_extensions(spec.kinds)
    if ext not in allowed:
        pretty = ", ".join(e.lstrip(".").upper() for e in allowed)
        raise UploadError(spec.name, f"{spec.label} must be one of: {pretty}")

    data = file_storage.stream.read(max_bytes + 1)
    if len(data) > max_bytes:
        raise UploadError(spec.name, f"{spec.label} is larger than {max_bytes // (1024 * 1024)} MB")
    if not data:
        raise UploadError(spec.name, f"{spec.label} is empty")
    if not _matches_signature(ext, data):
        raise UploadError(spec.name, f"{spec.label} doesn't look like a valid {ext.lstrip('.').upper()} file")

    return {
        "field": spec.name,
        "original_name": original,
        "ext": ext,
        "content_type": CONTENT_TYPES.get(ext) or mimetypes.guess_type(original)[0] or "application/octet-stream",
        "data": data,
    }


def collect_uploads(request_files, specs, clean_data, max_bytes, require=True):
    """Read and validate every file field. Returns (uploads, errors)."""
    uploads, errors = [], {}
    for spec in specs:
        items = [f for f in request_files.getlist(spec.name) if f and f.filename]
        if not spec.multiple:
            items = items[:1]
        if not items:
            if require and spec.is_required(clean_data):
                errors[spec.name] = f"{spec.label} is required"
            continue
        for item in items:
            try:
                uploads.append(read_upload(item, spec, max_bytes))
            except UploadError as exc:
                errors[spec.name] = exc.message
                break
    return uploads, errors


class LocalStorage:
    name = "local"

    def __init__(self, root):
        self.root = Path(root).resolve()

    def _path(self, key):
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise ValueError("Invalid storage key")
        return path

    def put(self, key, data, content_type, conn=None):
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get(self, key, conn=None):
        path = self._path(key)
        if not path.is_file():
            raise FileNotFoundError(key)
        return path.read_bytes()

    def delete(self, key, conn=None):
        try:
            self._path(key).unlink(missing_ok=True)
        except ValueError:
            pass


class DatabaseStorage:
    name = "database"
    # Writes go through the caller's connection so they share its transaction.

    def put(self, key, data, content_type, conn=None):
        conn.execute(insert(db.file_blobs).values(storage_key=key, data=data))

    def get(self, key, conn=None):
        row = conn.execute(select(db.file_blobs.c.data).where(db.file_blobs.c.storage_key == key)).first()
        if row is None:
            raise FileNotFoundError(key)
        return bytes(row.data)

    def delete(self, key, conn=None):
        conn.execute(delete(db.file_blobs).where(db.file_blobs.c.storage_key == key))


class S3Storage:
    name = "s3"

    def __init__(self, bucket, prefix="", client=None, **client_kwargs):
        if client is None:
            import boto3

            client = boto3.client("s3", **{k: v for k, v in client_kwargs.items() if v})
        self.client = client
        self.bucket = bucket
        self.prefix = prefix

    def put(self, key, data, content_type, conn=None):
        self.client.put_object(Bucket=self.bucket, Key=self.prefix + key, Body=data, ContentType=content_type)

    def get(self, key, conn=None):
        try:
            response = self.client.get_object(Bucket=self.bucket, Key=self.prefix + key)
        except self.client.exceptions.NoSuchKey as exc:
            raise FileNotFoundError(key) from exc
        return response["Body"].read()

    def delete(self, key, conn=None):
        self.client.delete_object(Bucket=self.bucket, Key=self.prefix + key)


def build_storage(config):
    backend = config["STORAGE_BACKEND"]
    if backend == "local":
        return LocalStorage(config["UPLOAD_DIR"])
    if backend == "database":
        return DatabaseStorage()
    if backend == "s3":
        if not config["S3_BUCKET"]:
            raise RuntimeError("STORAGE_BACKEND=s3 requires S3_BUCKET")
        return S3Storage(
            config["S3_BUCKET"],
            prefix=config["S3_PREFIX"],
            region_name=config["S3_REGION"],
            endpoint_url=config["S3_ENDPOINT_URL"],
            aws_access_key_id=config["S3_ACCESS_KEY_ID"],
            aws_secret_access_key=config["S3_SECRET_ACCESS_KEY"],
        )
    raise RuntimeError(f"Unknown STORAGE_BACKEND '{backend}' (use local, database or s3)")


def save_uploads(conn, storage, owner_type, owner_id, uploads, written_keys):
    """Persist validated uploads and their metadata rows. Keys written to external
    storage are appended to ``written_keys`` so callers can clean up on failure."""
    saved = []
    for upload in uploads:
        key = f"{owner_type}/{owner_id}/{uuid.uuid4().hex}{upload['ext']}"
        storage.put(key, upload["data"], upload["content_type"], conn=conn)
        if storage.name != "database":
            written_keys.append(key)
        result = conn.execute(
            insert(db.files).values(
                owner_type=owner_type,
                owner_id=owner_id,
                field=upload["field"],
                original_name=upload["original_name"],
                content_type=upload["content_type"],
                size=len(upload["data"]),
                storage_key=key,
                uploaded_at=db.utcnow(),
            )
        )
        saved.append({"id": result.inserted_primary_key[0], "field": upload["field"], "original_name": upload["original_name"]})
    return saved


def discard_keys(storage, keys):
    for key in keys:
        try:
            storage.delete(key)
        except Exception:  # best-effort cleanup of orphaned objects
            pass


def list_files(conn, owner_type, owner_id):
    rows = conn.execute(
        select(db.files)
        .where(db.files.c.owner_type == owner_type, db.files.c.owner_id == owner_id)
        .order_by(db.files.c.id)
    ).all()
    return [
        {
            "id": r.id,
            "field": r.field,
            "original_name": r.original_name,
            "content_type": r.content_type,
            "size": r.size,
            "uploaded_at": db.serialize({"t": r.uploaded_at})["t"],
        }
        for r in rows
    ]


def delete_owner_files(conn, storage, owner_type, owner_id):
    rows = conn.execute(
        select(db.files.c.id, db.files.c.storage_key).where(
            db.files.c.owner_type == owner_type, db.files.c.owner_id == owner_id
        )
    ).all()
    for row in rows:
        storage.delete(row.storage_key, conn=conn)
    conn.execute(delete(db.files).where(db.files.c.owner_type == owner_type, db.files.c.owner_id == owner_id))


def build_zip(conn, storage, owner_type, owner_id, labels):
    """Zip every file owned by a record. ``labels`` maps field -> readable prefix."""
    buffer = io.BytesIO()
    used = set()
    count = 0
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for row in conn.execute(
            select(db.files).where(db.files.c.owner_type == owner_type, db.files.c.owner_id == owner_id)
        ).all():
            try:
                data = storage.get(row.storage_key, conn=conn)
            except FileNotFoundError:
                continue
            name = f"{labels.get(row.field, row.field)} - {row.original_name}"
            stem, suffix = Path(name).stem, Path(name).suffix
            candidate, n = name, 2
            while candidate in used:
                candidate, n = f"{stem} ({n}){suffix}", n + 1
            used.add(candidate)
            archive.writestr(candidate, data)
            count += 1
    buffer.seek(0)
    return buffer, count
