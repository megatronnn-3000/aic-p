# Picked up automatically by `gunicorn app:app` when run from backend/.
import os

bind = f"0.0.0.0:{os.environ.get('PORT', '5000')}"
# One process keeps the in-memory rate limiters consistent and suits the
# 512 MB free tier; threads handle concurrent requests.
workers = int(os.environ.get("WEB_CONCURRENCY", "1"))
threads = int(os.environ.get("GUNICORN_THREADS", "8"))
worker_class = "gthread"
# Large uploads from slow connections need longer than the 30s default.
timeout = 120
accesslog = "-"
