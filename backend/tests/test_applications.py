import io
import zipfile
from pathlib import Path

from conftest import incubation_form, internship_form, pre_incubation_form, upload


def _submit(client, slug, form):
    response = client.post(f"/api/apply/{slug}", data=form, content_type="multipart/form-data")
    assert response.status_code == 201, response.json
    return response.json["id"]


def test_status_change_emails_applicant(client, auth, sent):
    app_id = _submit(client, "pre-incubation", pre_incubation_form())
    sent.clear()
    response = client.patch(
        f"/api/admin/preincubation/applications/{app_id}", json={"status": "Approved"}, headers=auth
    )
    assert response.status_code == 200
    assert response.json["status"] == "Approved" and response.json["email_sent"] is True
    assert sent[-1]["to"] == "asha@example.com"
    assert "accepted" in sent[-1]["subject"].lower()


def test_status_change_without_notification(client, auth, sent):
    app_id = _submit(client, "internship", internship_form())
    sent.clear()
    response = client.patch(
        f"/api/admin/internship/applications/{app_id}", json={"status": "Selected", "notify": False}, headers=auth
    )
    assert response.status_code == 200 and response.json["status"] == "Selected"
    assert sent == []


def test_invalid_status_rejected(client, auth):
    app_id = _submit(client, "internship", internship_form())
    response = client.patch(f"/api/admin/internship/applications/{app_id}", json={"status": "Approved"}, headers=auth)
    assert response.status_code == 422


def test_pitch_scheduling_validates_and_notifies(client, auth, sent):
    app_id = _submit(client, "pre-incubation", pre_incubation_form())
    bad = client.patch(
        f"/api/admin/preincubation/applications/{app_id}",
        json={"pitch_date": "2030-01-10", "pitch_time": "25:00"},
        headers=auth,
    )
    assert bad.status_code == 422 and "pitch_time" in bad.json["fields"]

    sent.clear()
    good = client.patch(
        f"/api/admin/preincubation/applications/{app_id}",
        json={"pitch_date": "2030-01-10", "pitch_time": "14:30", "pitch_link": "meet.google.com/abc", "notify_pitch": True},
        headers=auth,
    )
    assert good.status_code == 200
    assert good.json["pitch_link"] == "https://meet.google.com/abc"
    assert "scheduled" in sent[-1]["subject"].lower()


def test_flags_and_list_summary(client, auth):
    app_id = _submit(client, "pre-incubation", pre_incubation_form())
    client.patch(
        f"/api/admin/preincubation/applications/{app_id}",
        json={"is_active": False, "certificate_issued": True},
        headers=auth,
    )
    item = client.get("/api/admin/preincubation/applications", headers=auth).json[0]
    assert item["is_active"] is False and item["certificate_issued"] is True
    assert item["reference"] == "PRE-00001" and item["file_count"] == 4
    assert client.patch(
        f"/api/admin/preincubation/applications/{app_id}", json={"is_active": "no"}, headers=auth
    ).status_code == 422


def test_pre_incubation_evaluation_roundtrip(client, auth):
    app_id = _submit(client, "pre-incubation", pre_incubation_form())
    payload = {
        "scores": {"businessPlan": "4", "mvp": "3", "innovation": "2"},
        "observations": {"mvp": "Working demo"},
        "finalRecommendation": "Incubation",
        "evaluatorName": "Dr. Rao",
        "unexpected": "dropped",
    }
    response = client.put(f"/api/admin/preincubation/applications/{app_id}/evaluation", json=payload, headers=auth)
    assert response.status_code == 200
    assert response.json["evaluation_total"] == 9
    assert "unexpected" not in response.json["evaluation"]

    listed = client.get("/api/admin/preincubation/applications", headers=auth).json[0]
    assert listed["evaluation_total"] == 9 and listed["recommendation"] == "Incubation"

    bad = client.put(
        f"/api/admin/preincubation/applications/{app_id}/evaluation", json={"scores": {"mvp": "9"}}, headers=auth
    )
    assert bad.status_code == 422


def test_incubation_multi_evaluator_flow(client, auth):
    app_id = _submit(client, "incubation", incubation_form())
    base = f"/api/admin/incubation/applications/{app_id}/evaluations"

    missing_name = client.put(base, json={"scores": {"team": "5"}}, headers=auth)
    assert missing_name.status_code == 422

    a = client.put(base, json={"evaluatorName": "Priya", "scores": {"team": "5", "solution": "4"}}, headers=auth).json
    client.put(base, json={"evaluatorName": "Arjun", "scores": {"team": "3"}}, headers=auth)
    # Same evaluator name (any case) updates their existing entry instead of duplicating it.
    again = client.put(base, json={"evaluatorName": "priya", "scores": {"team": "2"}}, headers=auth).json
    assert again["id"] == a["id"] and again["total"] == 2

    detail = client.get(f"/api/admin/incubation/applications/{app_id}", headers=auth).json
    assert detail["eval_count"] == 2 and detail["eval_avg"] == 2.5

    listed = client.get("/api/admin/incubation/applications", headers=auth).json[0]
    assert listed["eval_count"] == 2

    # Renaming an entry onto another evaluator's name is refused.
    clash = client.put(base, json={"id": a["id"], "evaluatorName": "Arjun", "scores": {}}, headers=auth)
    assert clash.status_code == 409

    assert client.put(base, json={"evaluatorName": "X", "scores": {"team": "6"}}, headers=auth).status_code == 422
    assert client.delete(f"/api/admin/incubation/evaluations/{a['id']}", headers=auth).status_code == 200
    assert len(client.get(base, headers=auth).json) == 1


def test_documents_zip_and_file_download(client, auth):
    app_id = _submit(client, "pre-incubation", pre_incubation_form())
    response = client.get(f"/api/admin/preincubation/applications/{app_id}/documents.zip", headers=auth)
    assert response.status_code == 200
    names = zipfile.ZipFile(io.BytesIO(response.data)).namelist()
    assert "Pitch deck - deck.pdf" in names and len(names) == 4

    detail = client.get(f"/api/admin/preincubation/applications/{app_id}", headers=auth).json
    deck = next(f for f in detail["files"] if f["field"] == "pitch_deck")
    download = client.get(f"/api/admin/files/{deck['id']}", headers=auth)
    assert download.status_code == 200 and download.data.startswith(b"%PDF")
    assert "deck.pdf" in download.headers["Content-Disposition"]
    assert download.headers["X-Content-Type-Options"] == "nosniff"


def test_missing_stored_file_returns_410(app, client, auth):
    app_id = _submit(client, "pre-incubation", pre_incubation_form())
    detail = client.get(f"/api/admin/preincubation/applications/{app_id}", headers=auth).json
    for path in Path(app.config["UPLOAD_DIR"]).rglob("*.pdf"):
        path.unlink()
    deck = next(f for f in detail["files"] if f["field"] == "pitch_deck")
    assert client.get(f"/api/admin/files/{deck['id']}", headers=auth).status_code == 410


def test_delete_application_removes_files(app, client, auth):
    app_id = _submit(client, "incubation", incubation_form(pitch_deck=upload(name="deck.pdf")))
    client.put(
        f"/api/admin/incubation/applications/{app_id}/evaluations",
        json={"evaluatorName": "Priya", "scores": {"team": "4"}},
        headers=auth,
    )
    uploads = Path(app.config["UPLOAD_DIR"])
    assert any(uploads.rglob("*.pdf"))
    assert client.delete(f"/api/admin/incubation/applications/{app_id}", headers=auth).status_code == 200
    assert not any(uploads.rglob("*.pdf"))
    assert client.get(f"/api/admin/incubation/applications/{app_id}", headers=auth).status_code == 404
    assert client.delete(f"/api/admin/incubation/applications/{app_id}", headers=auth).status_code == 404


def test_dashboard_summary(client, auth):
    _submit(client, "pre-incubation", pre_incubation_form())
    _submit(client, "incubation", incubation_form())
    intern = _submit(client, "internship", internship_form())
    client.patch(f"/api/admin/internship/applications/{intern}", json={"status": "Selected"}, headers=auth)
    client.post("/api/enquiries", json={"program": "internship", "name": "Z", "email": "z@example.com", "message": "?"})

    data = client.get("/api/admin/dashboard", headers=auth).json
    assert data["preincubation"]["by_status"]["Pending"] == 1
    assert data["incubation"]["awaiting_evaluation"] == 1
    assert data["internship"]["by_status"]["Selected"] == 1
    assert data["open_enquiries"]["internship"] == 1
    assert {item["program"] for item in data["attention"]} == {"preincubation", "incubation"}
