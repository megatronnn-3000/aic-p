"""Environment-driven configuration.

Every secret and deployment-specific value comes from the environment (or a
local ``backend/.env`` file in development). Nothing sensitive is hard-coded.
See ``backend/.env.example`` for the full list.
"""
import os
import secrets
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def _bool(value, default=False):
    if value is None or value == "":
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _list(value):
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def normalize_database_url(url):
    """Render/Heroku/Neon hand out ``postgres://`` URLs; SQLAlchemy needs the driver named."""
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    if url.startswith("postgresql://"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]
    return url


def load_config(overrides=None):
    env = dict(os.environ)
    if overrides:
        env.update({k: v for k, v in overrides.items() if isinstance(v, str)})

    app_env = env.get("APP_ENV", "production" if env.get("RENDER") else "development")

    database_url = env.get("DATABASE_URL") or f"sqlite:///{(BACKEND_DIR / 'startups.db').as_posix()}"
    database_url = normalize_database_url(database_url)
    is_sqlite = database_url.startswith("sqlite")

    s3_bucket = env.get("S3_BUCKET", "")
    storage_backend = env.get("STORAGE_BACKEND", "").strip().lower()
    if not storage_backend:
        # Pick the most durable option that is configured. Local disk is only
        # safe where the filesystem survives restarts (i.e. not Render free tier).
        storage_backend = "s3" if s3_bucket else ("local" if is_sqlite else "database")

    secret_key = env.get("SECRET_KEY", "")
    config = {
        "APP_ENV": app_env,
        "SECRET_KEY": secret_key or secrets.token_urlsafe(48),
        "SECRET_KEY_IS_EPHEMERAL": not secret_key,
        "DATABASE_URL": database_url,
        "STORAGE_BACKEND": storage_backend,
        "UPLOAD_DIR": env.get("UPLOAD_DIR") or str(BACKEND_DIR / "uploads"),
        "S3_BUCKET": s3_bucket,
        "S3_REGION": env.get("S3_REGION", ""),
        "S3_ENDPOINT_URL": env.get("S3_ENDPOINT_URL", ""),
        "S3_ACCESS_KEY_ID": env.get("S3_ACCESS_KEY_ID", ""),
        "S3_SECRET_ACCESS_KEY": env.get("S3_SECRET_ACCESS_KEY", ""),
        "S3_PREFIX": env.get("S3_PREFIX", "aic-portal/"),
        "ADMIN_USERNAME": env.get("ADMIN_USERNAME", "admin"),
        "ADMIN_PASSWORD": env.get("ADMIN_PASSWORD", ""),
        "ADMIN_PASSWORD_HASH": env.get("ADMIN_PASSWORD_HASH", ""),
        "TOKEN_TTL_HOURS": _int(env.get("TOKEN_TTL_HOURS"), 12),
        "CORS_ORIGINS": _list(env.get("CORS_ORIGINS"))
        or ["http://localhost:5173", "http://127.0.0.1:5173", "https://pre-incubation-ui.vercel.app"],
        # Vercel preview deployments get unique sub-domains.
        "CORS_ORIGIN_REGEX": env.get("CORS_ORIGIN_REGEX", r"https://pre-incubation[a-z0-9-]*\.vercel\.app"),
        "TRUST_PROXY": _bool(env.get("TRUST_PROXY"), default=bool(env.get("RENDER"))),
        "MAIL_PROVIDER": env.get("MAIL_PROVIDER", "").strip().lower(),
        "MAIL_FROM": env.get("MAIL_FROM", ""),
        "MAIL_FROM_NAME": env.get("MAIL_FROM_NAME", "AIC MUJ Incubation Foundation"),
        "ADMIN_NOTIFY_EMAIL": env.get("ADMIN_NOTIFY_EMAIL", ""),
        "BREVO_API_KEY": env.get("BREVO_API_KEY", ""),
        "RESEND_API_KEY": env.get("RESEND_API_KEY", ""),
        "SMTP_HOST": env.get("SMTP_HOST", ""),
        "SMTP_PORT": _int(env.get("SMTP_PORT"), 587),
        "SMTP_USERNAME": env.get("SMTP_USERNAME", ""),
        "SMTP_PASSWORD": env.get("SMTP_PASSWORD", ""),
        "MAIL_ASYNC": _bool(env.get("MAIL_ASYNC"), default=True),
        "MAX_FILE_MB": _int(env.get("MAX_FILE_MB"), 20),
        "MAX_REQUEST_MB": _int(env.get("MAX_REQUEST_MB"), 80),
        # Email providers reject large messages; Brevo and Gmail cap well below 25 MB.
        "MAX_EMAIL_ATTACHMENT_MB": _int(env.get("MAX_EMAIL_ATTACHMENT_MB"), 10),
        "PUBLIC_SUBMISSIONS_PER_HOUR": _int(env.get("PUBLIC_SUBMISSIONS_PER_HOUR"), 100),
        "LOGIN_ATTEMPTS_PER_15_MIN": _int(env.get("LOGIN_ATTEMPTS_PER_15_MIN"), 8),
    }
    if overrides:
        config.update(overrides)
        config["DATABASE_URL"] = normalize_database_url(config["DATABASE_URL"])
    return config
