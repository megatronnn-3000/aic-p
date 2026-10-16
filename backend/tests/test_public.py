from conftest import PDF, PNG, incubation_form, internship_form, pre_incubation_form, upload


def test_health(client):
    assert client.get("/api/health").json == {"status": "ok"}


def test_pre_incubation_submission_stores_record_files_and_sends_emails(client, auth, sent):
    response = client.post("/api/apply/pre-incubation", data=pre_incubation_form(), content_type="multipart/form-data")
    assert response.status_code == 201, response.json
    body = response.json
    assert body["reference"] == "PRE-00001"
    assert {f["field"] for f in body["files"]} == {"pitch_deck", "resume", "pan_card", "business_plan"}

    detail = client.get(f"/api/admin/preincubation/applications/{body['id']}", headers=auth).json
    assert detail["startup_name"] == "GreenLoop"
    assert detail["status"] == "Pending"
    assert detail["website_url"] == "https://greenloop.example"  # bare domains are normalised
    assert len(detail["files"]) == 4

    recipients = [m["to"] for m in sent]
    assert "asha@example.com" in recipients and "office@example.org" in recipients


def test_required_fields_are_reported_per_field(client):
    response = client.post(
        "/api/apply/pre-incubation", data={"email": "not-an-email"}, content_type="multipart/form-data"
    )
    assert response.status_code == 422
    fields = response.json["fields"]
    for name in ("name", "startup_name", "contact_number", "problem_statement", "pitch_deck", "resume"):
        assert name in fields
    assert "valid email" in fields["email"]


def test_certificate_required_only_for_registered_companies(client):
    unregistered = client.post("/api/apply/pre-incubation", data=pre_incubation_form(), content_type="multipart/form-data")
    assert unregistered.status_code == 201

    registered = client.post(
        "/api/apply/pre-incubation",
        data=pre_incubation_form(email="b@example.com", company_type="Private Limited"),
        content_type="multipart/form-data",
    )
    assert registered.status_code == 422
    assert "certificate" in registered.json["fields"]


def test_rejects_wrong_file_type_and_spoofed_pdf(client):
    wrong_ext = client.post(
        "/api/apply/pre-incubation",
        data=pre_incubation_form(pitch_deck=upload(b"MZ...", "deck.exe")),
        content_type="multipart/form-data",
    )
    assert wrong_ext.status_code == 422
    assert "must be one of" in wrong_ext.json["fields"]["pitch_deck"]

    spoofed = client.post(
        "/api/apply/pre-incubation",
        data=pre_incubation_form(resume=upload(b"<html>not a pdf</html>", "cv.pdf")),
        content_type="multipart/form-data",
    )
    assert spoofed.status_code == 422
    assert "valid PDF" in spoofed.json["fields"]["resume"]


def test_rejects_oversized_file(make_app):
    client = make_app(MAX_FILE_MB=1).test_client()
    big = PDF + b"0" * (1024 * 1024 + 10)
    response = client.post(
        "/api/apply/pre-incubation",
        data=pre_incubation_form(pitch_deck=upload(big, "deck.pdf")),
        content_type="multipart/form-data",
    )
    assert response.status_code == 422
    assert "larger than 1 MB" in response.json["fields"]["pitch_deck"]


def test_request_body_limit_returns_json_413(make_app):
    client = make_app(MAX_REQUEST_MB=1).test_client()
    response = client.post(
        "/api/apply/pre-incubation",
        data=pre_incubation_form(pitch_deck=upload(PDF + b"0" * (2 * 1024 * 1024), "deck.pdf")),
        content_type="multipart/form-data",
    )
    assert response.status_code == 413
    assert "too large" in response.json["error"]


def test_duplicate_email_needs_confirmation(client):
    assert client.post("/api/internship", data={}).status_code == 404
    first = client.post("/api/apply/internship", data=internship_form(), content_type="multipart/form-data")
    assert first.status_code == 201

    again = client.post(
        "/api/apply/internship", data=internship_form(email="MEERA@example.com"), content_type="multipart/form-data"
    )
    assert again.status_code == 409 and again.json["duplicate"] is True

    confirmed = client.post(
        "/api/apply/internship",
        data=internship_form(confirm_duplicate="1"),
        content_type="multipart/form-data",
    )
    assert confirmed.status_code == 201
    assert confirmed.json["reference"] == "INT-00002"


def test_incubation_accepts_multiple_program_types(client, auth):
    response = client.post(
        "/api/apply/incubation",
        data=incubation_form(pitch_deck=upload(name="deck.pdf")),
        content_type="multipart/form-data",
    )
    assert response.status_code == 201, response.json
    detail = client.get(f"/api/admin/incubation/applications/{response.json['id']}", headers=auth).json
    assert detail["program_types"] == "Mentorship support, Fundraising support"
    assert detail["files"][0]["original_name"] == "deck.pdf"


def test_unknown_choice_is_rejected(client):
    response = client.post(
        "/api/apply/incubation", data=incubation_form(sector="Space Pirates"), content_type="multipart/form-data"
    )
    assert response.status_code == 422
    assert "sector" in response.json["fields"]


def test_javascript_urls_are_rejected(client):
    response = client.post(
        "/api/apply/pre-incubation",
        data=pre_incubation_form(website_url="javascript:alert(1)"),
        content_type="multipart/form-data",
    )
    assert response.status_code == 422
    assert "website_url" in response.json["fields"]


def test_internship_cv_must_be_pdf_or_word(client):
    response = client.post(
        "/api/apply/internship",
        data=internship_form(cv=upload(PNG, "cv.png")),
        content_type="multipart/form-data",
    )
    assert response.status_code == 422


def test_public_enquiry_creates_open_record(client, auth, sent):
    response = client.post(
        "/api/enquiries",
        json={"program": "incubation", "name": "Kabir", "email": "kabir@example.com", "message": "Is there a fee?"},
    )
    assert response.status_code == 201
    records = client.get("/api/admin/records?module=enquiry&category=incubation", headers=auth).json
    assert len(records) == 1
    assert records[0]["status"] == "Open" and records[0]["source"] == "public"
    assert records[0]["contact_email"] == "kabir@example.com"
    assert any(m["to"] == "office@example.org" for m in sent)


def test_enquiry_honeypot_is_silently_dropped(client, auth):
    response = client.post(
        "/api/enquiries",
        json={"program": "incubation", "name": "Bot", "email": "bot@example.com", "message": "spam", "company_website": "x"},
    )
    assert response.status_code == 201
    assert client.get("/api/admin/records?module=enquiry&category=incubation", headers=auth).json == []


def test_submission_rate_limit(make_app):
    client = make_app(PUBLIC_SUBMISSIONS_PER_HOUR=2).test_client()
    payload = {"program": "internship", "name": "A", "email": "a@example.com", "message": "Hi"}
    assert client.post("/api/enquiries", json=payload).status_code == 201
    assert client.post("/api/enquiries", json=payload).status_code == 201
    assert client.post("/api/enquiries", json=payload).status_code == 429


def test_email_content_escapes_applicant_input(client, sent):
    form = pre_incubation_form(name='<script>alert("x")</script>', founder_name="<b>Bold</b>", startup_name="<img src=x>")
    assert client.post("/api/apply/pre-incubation", data=form, content_type="multipart/form-data").status_code == 201
    for message in sent:
        assert "<script>" not in message["html"] and "<img src=x>" not in message["html"]
    assert any("&lt;img src=x&gt;" in m["html"] for m in sent)
