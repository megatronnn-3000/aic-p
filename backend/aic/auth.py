"""Staff authentication.

A single staff account (``ADMIN_USERNAME`` / ``ADMIN_PASSWORD``) signs in and
receives a signed, expiring bearer token. Tokens are used instead of cookies
because the frontend (Vercel) and API (Render) are on different sites, and
browsers such as Safari block third-party cookies.
"""
import hmac
import threading
import time
from collections import defaultdict, deque
from functools import wraps

from flask import Blueprint, current_app, g, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

TOKEN_SALT = "aic-staff-token"

bp = Blueprint("auth", __name__, url_prefix="/api/auth")


class RateLimiter:
    """In-memory sliding-window limiter (sufficient for a single-process deployment)."""

    def __init__(self, limit, window_seconds):
        self.limit = limit
        self.window = window_seconds
        self._hits = defaultdict(deque)
        self._lock = threading.Lock()

    def _prune(self, key, now):
        hits = self._hits[key]
        while hits and hits[0] <= now - self.window:
            hits.popleft()
        return hits

    def blocked(self, key):
        with self._lock:
            return len(self._prune(key, time.monotonic())) >= self.limit

    def hit(self, key):
        with self._lock:
            now = time.monotonic()
            hits = self._prune(key, now)
            hits.append(now)
            return len(hits) <= self.limit

    def reset(self, key):
        with self._lock:
            self._hits.pop(key, None)


def init_auth(app):
    config = app.config
    password_hash = config["ADMIN_PASSWORD_HASH"]
    if not password_hash and config["ADMIN_PASSWORD"]:
        password_hash = generate_password_hash(config["ADMIN_PASSWORD"])
    config["_ADMIN_HASH"] = password_hash
    if not password_hash:
        app.logger.error("Staff sign-in is disabled: set ADMIN_PASSWORD (or ADMIN_PASSWORD_HASH).")
    if config["SECRET_KEY_IS_EPHEMERAL"]:
        app.logger.warning("SECRET_KEY is not set; staff sessions will end whenever the server restarts.")
    app.extensions["aic"].login_limiter = RateLimiter(config["LOGIN_ATTEMPTS_PER_15_MIN"], 15 * 60)


def _serializer():
    return URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt=TOKEN_SALT)


def issue_token(username):
    return _serializer().dumps({"sub": username})


def verify_token(token):
    try:
        data = _serializer().loads(token, max_age=current_app.config["TOKEN_TTL_HOURS"] * 3600)
    except (BadSignature, SignatureExpired):
        return None
    if not hmac.compare_digest(str(data.get("sub", "")), current_app.config["ADMIN_USERNAME"]):
        return None
    return data["sub"]


def _bearer_token():
    header = request.headers.get("Authorization", "")
    if header.lower().startswith("bearer "):
        return header[7:].strip()
    return ""


def require_admin(view):
    @wraps(view)
    def wrapper(*args, **kwargs):
        username = verify_token(_bearer_token())
        if not username:
            return jsonify(error="Your session has expired. Please sign in again.", code="unauthorized"), 401
        g.staff_user = username
        return view(*args, **kwargs)

    return wrapper


@bp.post("/login")
def login():
    config = current_app.config
    if not config["_ADMIN_HASH"]:
        return jsonify(error="Staff sign-in isn't configured on the server yet (ADMIN_PASSWORD is not set)."), 503

    limiter = current_app.extensions["aic"].login_limiter
    client = request.remote_addr or "unknown"
    if limiter.blocked(client):
        return jsonify(error="Too many sign-in attempts. Please wait 15 minutes and try again."), 429

    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))
    if not username or not password:
        return jsonify(error="Enter your username and password."), 400

    username_ok = hmac.compare_digest(username.lower(), config["ADMIN_USERNAME"].lower())
    password_ok = check_password_hash(config["_ADMIN_HASH"], password)
    if not (username_ok and password_ok):
        limiter.hit(client)
        return jsonify(error="Incorrect username or password."), 401

    limiter.reset(client)
    ttl = config["TOKEN_TTL_HOURS"] * 3600
    return jsonify(
        token=issue_token(config["ADMIN_USERNAME"]),
        username=config["ADMIN_USERNAME"],
        expires_at=int(time.time()) + ttl,
    )


@bp.get("/me")
@require_admin
def me():
    return jsonify(username=g.staff_user)
