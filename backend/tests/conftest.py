import io
import os

import pytest
from sqlalchemy import create_engine

from aic import create_app
from aic.config import normalize_database_url
from aic.db import metadata

PDF = b"%PDF-1.4\n% test document\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
PASSWORD = "correct-horse-battery"


def _reset_postgres(url):
    engine = create_engine(normalize_database_url(url))
    metadata.drop_all(engine)
    engine.dispose()


@pytest.fixture
def make_app(tmp_path):
    """Build an app against SQLite, or Postgres when TEST_DATABASE_URL is set."""

    def factory(**overrides):
        pg_url = os.environ.get("TEST_DATABASE_URL")
        if pg_url and "DATABASE_URL" not in overrides:
            _reset_postgres(pg_url)
        config = {
            "TESTING": True,
            "APP_ENV": "test",
            "SECRET_KEY": "test-secret",
            "DATABASE_URL": pg_url or f"sqlite:///{(tmp_path / 'test.db').as_posix()}",
            "UPLOAD_DIR": str(tmp_path / "uploads"),
            "STORAGE_BACKEND": "local",
            "ADMIN_USERNAME": "admin",
            "ADMIN_PASSWORD": PASSWORD,
            "ADMIN_PASSWORD_HASH": "",
            "MAIL_PROVIDER": "console",
            "MAIL_ASYNC": False,
            "ADMIN_NOTIFY_EMAIL": "office@example.org",
            "TRUST_PROXY": False,
        }
        config.update(overrides)
        app = create_app(config)
        app.testing = True
        return app

    return factory


@pytest.fixture
def app(make_app):
    return make_app()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def auth(client):
    response = client.post("/api/auth/login", json={"username": "admin", "password": PASSWORD})
    assert response.status_code == 200, response.json
    return {"Authorization": f"Bearer {response.json['token']}"}


@pytest.fixture
def sent(app):
    return app.extensions["aic"].mailer.sent


def upload(data=PDF, name="file.pdf"):
    return (io.BytesIO(data), name)


def pre_incubation_form(**overrides):
    form = {
        "name": "Asha Verma",
        "email": "asha@example.com",
        "contact_number": "98765 43210",
        "startup_name": "GreenLoop",
        "company_type": "Not Registered",
        "sector": "Sustainability / Recycling",
        "startup_stage": "Prototype",
        "problem_statement": "Campus plastic waste is not recycled.",
        "founder_name": "Asha Verma",
        "why_applying": "Mentorship and lab access.",
        "website_url": "greenloop.example",
        "pitch_deck": upload(name="deck.pdf"),
        "resume": upload(name="cv.pdf"),
        "pan_card": upload(PNG, "pan.png"),
        "business_plan": upload(name="plan.pdf"),
    }
    form.update(overrides)
    return form


def incubation_form(**overrides):
    form = {
        "founder_name": "Ravi Kumar",
        "startup_name": "SkyCrop",
        "email": "ravi@example.com",
        "mobile_no": "9876543210",
        "sector": "Drones",
        "incubatee_level": "Prototype",
        "program_types": ["Mentorship support", "Fundraising support"],
        "description": "Drone-based crop monitoring.",
    }
    form.update(overrides)
    return form


def internship_form(**overrides):
    form = {
        "name": "Meera Shah",
        "email": "meera@example.com",
        "phone": "9123456780",
        "department": "B.Tech CSE",
        "year_of_study": "Second Year",
        "preferred_role": "Tech",
        "why_interested": "I want to build products.",
        "skills_experience": "React, Python.",
        "hosteller_status": "Hosteller",
        "willing_late": "Yes",
    }
    form.update(overrides)
    return form
