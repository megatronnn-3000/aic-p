"""AIC MUJ portal API — application factory."""
import logging
import re
from types import SimpleNamespace

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge
from werkzeug.middleware.proxy_fix import ProxyFix

from .auth import RateLimiter, init_auth
from .config import BACKEND_DIR, load_config
from .db import init_db, make_engine
from .mailer import Mailer
from .storage import build_storage


def create_app(overrides=None):
    if not (overrides or {}).get("TESTING"):
        load_dotenv(BACKEND_DIR / ".env")  # never overrides real environment variables

    config = load_config(overrides)
    app = Flask(__name__)
    app.config.update(config)
    app.config["MAX_CONTENT_LENGTH"] = config["MAX_REQUEST_MB"] * 1024 * 1024
    app.json.sort_keys = False

    if not app.debug and not app.testing:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    app.logger.setLevel(logging.INFO)

    if config["TRUST_PROXY"]:
        # Render and Vercel terminate TLS and forward the client IP; needed for rate limiting.
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)

    origins = list(config["CORS_ORIGINS"])
    if config["CORS_ORIGIN_REGEX"]:
        origins.append(re.compile(config["CORS_ORIGIN_REGEX"]))
    CORS(
        app,
        resources={r"/api/*": {"origins": origins}},
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Content-Disposition"],
        max_age=600,
    )

    engine = make_engine(config["DATABASE_URL"])
    init_db(engine, config["UPLOAD_DIR"], logger=app.logger)

    app.extensions["aic"] = SimpleNamespace(
        engine=engine,
        storage=build_storage(config),
        mailer=Mailer(config, app.logger),
        submission_limiter=RateLimiter(config["PUBLIC_SUBMISSIONS_PER_HOUR"], 3600),
    )
    init_auth(app)

    if config["APP_ENV"] == "production" and config["STORAGE_BACKEND"] == "local":
        app.logger.warning(
            "STORAGE_BACKEND=local in production: uploads are lost whenever the disk is reset "
            "(e.g. every deploy on Render's free tier). Use 'database' or 's3'."
        )
    if not app.extensions["aic"].mailer.enabled:
        app.logger.info("MAIL_PROVIDER is not set; confirmation and status emails are disabled.")

    from .auth import bp as auth_bp
    from .routes.aic_documents import bp as aic_documents_bp
    from .routes.applications import bp as applications_bp
    from .routes.dashboard import bp as dashboard_bp
    from .routes.files import bp as files_bp
    from .routes.public import bp as public_bp
    from .routes.records import bp as records_bp
    from .routes.startups import bp as startups_bp
    from .routes.support import bp as support_bp

    for blueprint in (
        public_bp, auth_bp, dashboard_bp, applications_bp, startups_bp, records_bp, files_bp, aic_documents_bp,
        support_bp,
    ):
        app.register_blueprint(blueprint)

    @app.get("/")
    def index():
        return jsonify(service="AIC MUJ portal API", status="ok")

    @app.errorhandler(RequestEntityTooLarge)
    def too_large(_exc):
        limit = app.config["MAX_REQUEST_MB"]
        return jsonify(error=f"The upload is too large. Keep the total under {limit} MB."), 413

    @app.errorhandler(HTTPException)
    def http_error(exc):
        return jsonify(error=exc.description or exc.name), exc.code

    @app.errorhandler(Exception)
    def unexpected_error(exc):
        app.logger.exception("Unhandled error on %s %s", request.method, request.path)
        return jsonify(error="Something went wrong on our side. Please try again."), 500

    @app.after_request
    def security_headers(response):
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        return response

    return app
