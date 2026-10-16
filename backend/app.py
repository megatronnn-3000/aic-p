"""Entry point.

Production:  gunicorn app:app           (settings in gunicorn.conf.py)
Development: python app.py              (or: flask --app app run --debug)
"""
import os

from aic import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    # Bind publicly only when a host platform supplies PORT; the debugger is
    # opt-in because it allows arbitrary code execution.
    host = "0.0.0.0" if "PORT" in os.environ else "127.0.0.1"
    app.run(host=host, port=port, debug=os.environ.get("FLASK_DEBUG") == "1")
