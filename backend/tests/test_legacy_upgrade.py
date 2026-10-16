"""A database created by the original backend is upgraded in place without data loss."""
import os
import sqlite3
from pathlib import Path

import pytest

from conftest import PASSWORD, PDF, PNG

SCHEMA = (Path(__file__).parent / "fixtures" / "legacy_schema.sql").read_text()

pytestmark = pytest.mark.skipif(
    bool(os.environ.get("TEST_DATABASE_URL")), reason="legacy upgrade only applies to SQLite databases"
)


def _legacy_db(tmp_path):
    db_path = tmp_path / "startups.db"
    uploads = tmp_path / "uploads"
    for sub in ("", "incubation_ppts", "startup_photos", "documents", "internship_files", "module_records"):
        (uploads / sub).mkdir(parents=True, exist_ok=True)
    (uploads / "deck.pdf").write_bytes(PDF)
    (uploads / "incubation_ppts" / "inc_deck.pdf").write_bytes(PDF)
    (uploads / "startup_photos" / "logo.png").write_bytes(PNG)
    (uploads / "documents" / "SkyCrop_aoa_pics.png").write_bytes(PNG)
    (uploads / "internship_files" / "cv.pdf").write_bytes(PDF)

    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    conn.execute(
        "INSERT INTO startups (id, name, email, startup_name, sector, status, pitch_deck, resume, certificate_status, is_active) "
        "VALUES (7, 'Asha', 'asha@example.com', 'GreenLoop', 'Edtech', 'Approved', 'deck.pdf', 'missing.pdf', 'Issued', 'No')"
    )
    conn.execute(
        "INSERT INTO incubation_applications (id, startupName, email, mobileNo, typeOfProgram, sdgGoals, pptFilename, submitted_at) "
        "VALUES (3, 'SkyCrop', 'ravi@example.com', '9876543210', 'Mentorship support', 'Climate action', 'inc_deck.pdf', '2026-05-01 10:00:00')"
    )
    conn.execute(
        "INSERT INTO incubation_evaluations (application_id, evaluator_name, evaluation_data, updated_at) "
        "VALUES (3, 'Priya', '{\"scores\": {\"team\": \"4\", \"solution\": \"5\"}}', '2026-05-02 09:00:00')"
    )
    conn.execute(
        "INSERT INTO startup_crm (id, startup_name, current_status, assigned_rm, current_milestone, logo, created_at) "
        "VALUES (5, 'SkyCrop', '12', 'Scaling', 'Raised seed round', 'logo.png', '2026-06-01 12:00:00')"
    )
    conn.execute("INSERT INTO document_repository (startup, aoa) VALUES ('skycrop', 'SkyCrop_aoa_pics.png')")
    conn.execute(
        "INSERT INTO internship_applications (id, name, email, phone, cv_filename, is_past_intern, submitted_at) "
        "VALUES (2, 'Meera', 'meera@example.com', '9123456780', 'cv.pdf', 'Yes', '2026-04-01 08:00:00')"
    )
    conn.execute(
        "INSERT INTO module_records (module, category, title, status, created_at) "
        "VALUES ('events', 'past', 'Bootcamp', 'Completed', '2026-03-01 08:00:00')"
    )
    conn.commit()
    conn.close()
    return db_path, uploads


def test_legacy_database_is_upgraded(make_app, tmp_path):
    db_path, uploads = _legacy_db(tmp_path)
    app = make_app(DATABASE_URL=f"sqlite:///{db_path.as_posix()}", UPLOAD_DIR=str(uploads))
    client = app.test_client()
    token = client.post("/api/auth/login", json={"username": "admin", "password": PASSWORD}).json["token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert (tmp_path / "startups.db.pre-upgrade-backup").exists()

    pre = client.get("/api/admin/preincubation/applications/7", headers=headers).json
    assert pre["startup_name"] == "GreenLoop" and pre["status"] == "Approved"
    assert pre["certificate_issued"] is True and pre["is_active"] is False
    assert [f["field"] for f in pre["files"]] == ["pitch_deck"]  # missing.pdf isn't on disk, so it is skipped
    deck = client.get(f"/api/admin/files/{pre['files'][0]['id']}", headers=headers)
    assert deck.status_code == 200 and deck.data == PDF

    inc = client.get("/api/admin/incubation/applications/3", headers=headers).json
    assert inc["startup_name"] == "SkyCrop" and inc["mobile_no"] == "9876543210"
    assert inc["sdg_goal"] == "Climate action" and inc["files"][0]["field"] == "pitch_deck"
    assert inc["eval_count"] == 1 and inc["evaluations"][0]["total"] == 9

    startup = client.get("/api/admin/startups/5", headers=headers).json
    assert startup["employees"] == "12" and startup["stage"] == "Scaling" and startup["graduated"] is True
    assert startup["success_story"] == "Raised seed round"
    assert {f["field"] for f in startup["files"]} == {"photo", "product_pics"}

    intern = client.get("/api/admin/internship/applications/2", headers=headers).json
    assert intern["status"] == "Completed" and intern["files"][0]["field"] == "cv"

    events = client.get("/api/admin/records?module=events&category=past", headers=headers).json
    assert events[0]["title"] == "Bootcamp"

    # New rows continue after the preserved ids.
    conn = sqlite3.connect(db_path)
    tables = {r[0] for r in conn.execute("select name from sqlite_master where type='table'")}
    conn.close()
    assert {"legacy_startups", "legacy_startup_crm", "legacy_founder_crm"} <= tables


def test_upgrade_runs_only_once(make_app, tmp_path):
    db_path, uploads = _legacy_db(tmp_path)
    make_app(DATABASE_URL=f"sqlite:///{db_path.as_posix()}", UPLOAD_DIR=str(uploads))
    # A second start must not try to rename tables again.
    make_app(DATABASE_URL=f"sqlite:///{db_path.as_posix()}", UPLOAD_DIR=str(uploads))
