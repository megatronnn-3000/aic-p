import io
import os
import sqlite3
import zipfile

import pytest

from conftest import PASSWORD, PDF, PNG, internship_form, pre_incubation_form, upload


def _submit_pre(client):
    response = client.post("/api/apply/pre-incubation", data=pre_incubation_form(), content_type="multipart/form-data")
    assert response.status_code == 201
    return response.json["id"]


def _upload(client, auth, owner_type, owner_id, title="Pre-incubation offer letter", email=False, file=None):
    data = {"owner_type": owner_type, "owner_id": str(owner_id), "title": title, "document": file or upload(PDF, "offer.pdf")}
    if email:
        data["email"] = "1"
    return client.post("/api/admin/aic-documents", data=data, headers=auth, content_type="multipart/form-data")


def test_aic_document_is_kept_apart_and_emailed_with_attachment(client, auth, sent):
    app_id = _submit_pre(client)
    sent.clear()

    response = _upload(client, auth, "preincubation", app_id, email=True)
    assert response.status_code == 201, response.json
    assert response.json["email_sent"] is True
    document = response.json["document"]
    assert document["source"] == "aic" and document["title"] == "Pre-incubation offer letter"
    assert document["emailed_to"] == "asha@example.com" and document["emailed_at"]

    assert sent[-1]["to"] == "asha@example.com"
    assert sent[-1]["attachments"] == ["offer.pdf"]
    assert "Pre-incubation offer letter" in sent[-1]["subject"]

    detail = client.get(f"/api/admin/preincubation/applications/{app_id}", headers=auth).json
    assert [d["title"] for d in detail["aic_documents"]] == ["Pre-incubation offer letter"]
    assert all(f["source"] == "applicant" for f in detail["files"]) and len(detail["files"]) == 4

    listed = client.get("/api/admin/preincubation/applications", headers=auth).json[0]
    assert listed["file_count"] == 4

    archive = client.get(f"/api/admin/preincubation/applications/{app_id}/documents.zip", headers=auth)
    assert not any("offer.pdf" in name for name in zipfile.ZipFile(io.BytesIO(archive.data)).namelist())

    download = client.get(f"/api/admin/files/{document['id']}", headers=auth)
    assert download.status_code == 200 and download.data == PDF


def test_upload_without_email_sends_nothing(client, auth, sent):
    app_id = _submit_pre(client)
    sent.clear()
    response = _upload(client, auth, "preincubation", app_id, title="Agreement")
    assert response.status_code == 201
    assert response.json["email_sent"] is False and response.json["document"]["emailed_at"] is None
    assert sent == []


def test_validation(client, auth):
    app_id = _submit_pre(client)
    missing = client.post(
        "/api/admin/aic-documents",
        data={"owner_type": "preincubation", "owner_id": str(app_id), "title": ""},
        headers=auth,
        content_type="multipart/form-data",
    )
    assert missing.status_code == 422
    assert {"title", "document"} <= set(missing.json["fields"])

    wrong_type = _upload(client, auth, "preincubation", app_id, file=upload(b"MZ", "tool.exe"))
    assert wrong_type.status_code == 422

    assert _upload(client, auth, "nonsense", app_id).status_code == 404
    assert _upload(client, auth, "preincubation", 9999).status_code == 404
    assert client.post("/api/admin/aic-documents", data={}).status_code == 401


def test_attachment_too_large_to_email(make_app):
    client = make_app(MAX_EMAIL_ATTACHMENT_MB=1).test_client()
    token = client.post("/api/auth/login", json={"username": "admin", "password": PASSWORD}).json["token"]
    auth = {"Authorization": f"Bearer {token}"}
    intern = client.post("/api/apply/internship", data=internship_form(), content_type="multipart/form-data").json["id"]
    big = upload(PDF + b"0" * (1024 * 1024 + 10), "certificate.pdf")

    emailed = _upload(client, auth, "internship", intern, title="Internship certificate", email=True, file=big)
    assert emailed.status_code == 422 and "can't be emailed" in emailed.json["fields"]["document"]

    stored = _upload(client, auth, "internship", intern, title="Internship certificate", file=upload(PDF + b"0" * (1024 * 1024 + 10), "certificate.pdf"))
    assert stored.status_code == 201
    resend = client.post(f"/api/admin/aic-documents/{stored.json['document']['id']}/email", headers=auth)
    assert resend.status_code == 422


def test_resend_and_startup_owner(client, auth, sent):
    created = client.post(
        "/api/admin/startups",
        data={"startup_name": "SkyCrop", "founder": "Ravi", "email": "ravi@example.com", "phone": "9876543210", "mou": upload(name="mou.pdf")},
        headers=auth,
        content_type="multipart/form-data",
    ).json
    document = _upload(client, auth, "startup", created["id"], title="Incubation agreement", file=upload(PNG, "agreement.png")).json["document"]

    detail = client.get(f"/api/admin/startups/{created['id']}", headers=auth).json
    assert [d["title"] for d in detail["aic_documents"]] == ["Incubation agreement"]
    assert [f["field"] for f in detail["files"]] == ["mou"]
    assert client.get("/api/admin/startups", headers=auth).json[0]["document_count"] == 1

    sent.clear()
    resend = client.post(f"/api/admin/aic-documents/{document['id']}/email", headers=auth)
    assert resend.status_code == 200 and resend.json["document"]["emailed_to"] == "ravi@example.com"
    assert sent[-1]["attachments"] == ["agreement.png"] and "Hello Ravi" in sent[-1]["html"]

    applicant_file = detail["files"][0]["id"]
    assert client.post(f"/api/admin/aic-documents/{applicant_file}/email", headers=auth).status_code == 404

    assert client.delete(f"/api/admin/files/{document['id']}", headers=auth).status_code == 200
    assert client.get(f"/api/admin/startups/{created['id']}", headers=auth).json["aic_documents"] == []


def test_email_not_configured(make_app):
    client = make_app(MAIL_PROVIDER="").test_client()
    token = client.post("/api/auth/login", json={"username": "admin", "password": PASSWORD}).json["token"]
    auth = {"Authorization": f"Bearer {token}"}
    app_id = client.post("/api/apply/pre-incubation", data=pre_incubation_form(), content_type="multipart/form-data").json["id"]
    response = _upload(client, auth, "preincubation", app_id, email=True)
    assert response.status_code == 201
    assert response.json["email_sent"] is False and response.json["email_unavailable"] is True
    resend = client.post(f"/api/admin/aic-documents/{response.json['document']['id']}/email", headers=auth)
    assert resend.status_code == 503


@pytest.mark.skipif(bool(os.environ.get("TEST_DATABASE_URL")), reason="SQLite schema upgrade check")
def test_existing_database_gains_new_file_columns(make_app, tmp_path):
    path = tmp_path / "existing.db"
    make_app(DATABASE_URL=f"sqlite:///{path.as_posix()}")
    conn = sqlite3.connect(path)
    # Recreate the files table as it was before AIC documents existed.
    conn.executescript(
        """
        DROP TABLE files;
        CREATE TABLE files (id INTEGER PRIMARY KEY, owner_type VARCHAR(30) NOT NULL, owner_id INTEGER NOT NULL,
          field VARCHAR(40) NOT NULL, original_name TEXT NOT NULL, content_type VARCHAR(120) NOT NULL,
          size INTEGER NOT NULL, storage_key VARCHAR(300) NOT NULL UNIQUE, uploaded_at DATETIME NOT NULL);
        INSERT INTO files VALUES (1, 'preincubation', 1, 'resume', 'cv.pdf', 'application/pdf', 4, 'k1', '2026-10-01 00:00:00');
        """
    )
    conn.commit()
    conn.close()
    make_app(DATABASE_URL=f"sqlite:///{path.as_posix()}")
    conn = sqlite3.connect(path)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(files)")}
    source = conn.execute("SELECT source FROM files WHERE id = 1").fetchone()[0]
    conn.close()
    assert {"source", "title", "emailed_at", "emailed_to"} <= columns
    assert source == "applicant"
