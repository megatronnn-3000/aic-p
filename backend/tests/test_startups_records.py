import io
import zipfile

from conftest import PDF, PNG, upload


def _startup_form(**overrides):
    form = {
        "startup_name": "SkyCrop",
        "founder": "Ravi Kumar",
        "email": "ravi@example.com",
        "phone": "9876543210",
        "stage": "Seed Stage",
        "trl_level": "TRL 5",
    }
    form.update(overrides)
    return form


def test_startup_crud_with_photo_and_documents(app, client, auth):
    create = client.post(
        "/api/admin/startups",
        data=_startup_form(
            photo=upload(PNG, "logo.png"),
            mou=[upload(name="mou-1.pdf"), upload(name="mou-2.pdf")],
            pitch_deck=upload(name="deck.pdf"),
        ),
        headers=auth,
        content_type="multipart/form-data",
    )
    assert create.status_code == 201, create.json
    startup = create.json
    assert len(startup["files"]) == 4 and startup["graduated"] is False

    listed = client.get("/api/admin/startups", headers=auth).json[0]
    assert listed["photo_file_id"] and listed["document_count"] == 3

    # Editing with a new photo replaces the old one; moving to Scaling marks it graduated.
    update = client.patch(
        f"/api/admin/startups/{startup['id']}",
        data=_startup_form(stage="Scaling", photo=upload(PNG, "new-logo.png")),
        headers=auth,
        content_type="multipart/form-data",
    )
    assert update.status_code == 200
    photos = [f for f in update.json["files"] if f["field"] == "photo"]
    assert [p["original_name"] for p in photos] == ["new-logo.png"]
    assert update.json["graduated"] is True

    archive = client.get(f"/api/admin/startups/{startup['id']}/documents.zip", headers=auth)
    assert len(zipfile.ZipFile(io.BytesIO(archive.data)).namelist()) == 4

    doc = next(f for f in update.json["files"] if f["field"] == "mou")
    assert client.delete(f"/api/admin/files/{doc['id']}", headers=auth).status_code == 200
    assert len(client.get(f"/api/admin/startups/{startup['id']}", headers=auth).json["files"]) == 3

    assert client.delete(f"/api/admin/startups/{startup['id']}", headers=auth).status_code == 200
    assert client.get("/api/admin/startups", headers=auth).json == []


def test_startup_validation(client, auth):
    response = client.post(
        "/api/admin/startups", data={"startup_name": ""}, headers=auth, content_type="multipart/form-data"
    )
    assert response.status_code == 422
    assert {"startup_name", "email", "phone"} <= set(response.json["fields"])
    assert client.patch(
        "/api/admin/startups/999", data=_startup_form(), headers=auth, content_type="multipart/form-data"
    ).status_code == 404


def test_records_crud_and_counts(client, auth):
    create = client.post(
        "/api/admin/records",
        data={
            "module": "events",
            "category": "upcoming",
            "title": "Demo Day",
            "record_date": "2030-02-01",
            "status": "Open",
            "attachment": upload(name="agenda.pdf"),
        },
        headers=auth,
        content_type="multipart/form-data",
    )
    assert create.status_code == 201, create.json
    record = create.json
    assert record["attachment"]["original_name"] == "agenda.pdf"

    dashboard = client.get("/api/admin/dashboard", headers=auth).json
    assert dashboard["upcoming_events"][0]["title"] == "Demo Day"

    moved = client.patch(
        f"/api/admin/records/{record['id']}",
        data={"module": "events", "category": "past", "title": "Demo Day", "status": "Completed", "remove_attachment": "1"},
        headers=auth,
        content_type="multipart/form-data",
    )
    assert moved.status_code == 200
    assert moved.json["category"] == "past" and moved.json["attachment"] is None

    counts = client.get("/api/admin/records/counts", headers=auth).json
    assert counts == {"events": {"past": 1}}

    assert client.delete(f"/api/admin/records/{record['id']}", headers=auth).status_code == 200
    assert client.get("/api/admin/records?module=events&category=past", headers=auth).json == []


def test_records_reject_unknown_sections_and_bad_input(client, auth):
    assert client.get("/api/admin/records?module=nope&category=x", headers=auth).status_code == 404
    bad = client.post(
        "/api/admin/records",
        data={"module": "mou", "category": "active", "title": "", "contact_email": "x"},
        headers=auth,
        content_type="multipart/form-data",
    )
    assert bad.status_code == 422
    assert {"title", "contact_email"} <= set(bad.json["fields"])


def test_database_storage_backend_roundtrip(make_app):
    app = make_app(STORAGE_BACKEND="database")
    client = app.test_client()
    token = client.post("/api/auth/login", json={"username": "admin", "password": "correct-horse-battery"}).json["token"]
    headers = {"Authorization": f"Bearer {token}"}
    created = client.post(
        "/api/admin/records",
        data={"module": "mou", "category": "active", "title": "MoU", "attachment": upload(PDF, "mou.pdf")},
        headers=headers,
        content_type="multipart/form-data",
    ).json
    download = client.get(f"/api/admin/files/{created['attachment']['id']}", headers=headers)
    assert download.status_code == 200 and download.data == PDF
    assert client.delete(f"/api/admin/records/{created['id']}", headers=headers).status_code == 200
    with app.extensions["aic"].engine.connect() as conn:
        from aic.db import file_blobs

        assert conn.execute(file_blobs.select()).all() == []


def test_s3_storage_backend_roundtrip(make_app):
    import boto3
    from moto import mock_aws

    with mock_aws():
        boto3.client("s3", region_name="us-east-1").create_bucket(Bucket="aic-test")
        app = make_app(
            STORAGE_BACKEND="s3",
            S3_BUCKET="aic-test",
            S3_REGION="us-east-1",
            S3_ACCESS_KEY_ID="test",
            S3_SECRET_ACCESS_KEY="test",
        )
        client = app.test_client()
        token = client.post("/api/auth/login", json={"username": "admin", "password": "correct-horse-battery"}).json[
            "token"
        ]
        headers = {"Authorization": f"Bearer {token}"}
        created = client.post(
            "/api/admin/records",
            data={"module": "aim", "category": "grants", "title": "Grant", "attachment": upload(PDF, "grant.pdf")},
            headers=headers,
            content_type="multipart/form-data",
        ).json
        download = client.get(f"/api/admin/files/{created['attachment']['id']}", headers=headers)
        assert download.data == PDF
        keys = boto3.client("s3", region_name="us-east-1").list_objects_v2(Bucket="aic-test").get("Contents", [])
        assert len(keys) == 1 and keys[0]["Key"].startswith("aic-portal/record/")
