from conftest import pre_incubation_form


def _submit_pre(client, **overrides):
    form = pre_incubation_form(**overrides)
    response = client.post("/api/apply/pre-incubation", data=form, content_type="multipart/form-data")
    assert response.status_code == 201
    return response.json["id"]


def test_investors_are_recorded_edited_and_listed_on_the_startup(client, auth):
    app_id = _submit_pre(client)
    response = client.post(
        f"/api/admin/preincubation/{app_id}/investors",
        json={"investor_name": "Seed Fund", "investor_type": "Venture capital", "amount": "25,00,000", "invested_on": "2026-01-15"},
        headers=auth,
    )
    assert response.status_code == 201, response.json
    investment = response.json
    assert investment["amount"] == "2500000" and investment["owner_type"] == "preincubation"

    patched = client.patch(f"/api/admin/investors/{investment['id']}", json={"instrument": "Equity"}, headers=auth)
    assert patched.status_code == 200 and patched.json["instrument"] == "Equity"
    assert patched.json["investor_name"] == "Seed Fund"

    detail = client.get(f"/api/admin/preincubation/applications/{app_id}", headers=auth).json
    assert [i["investor_name"] for i in detail["investors"]] == ["Seed Fund"]
    assert detail["mentors"] == []

    assert client.delete(f"/api/admin/investors/{investment['id']}", headers=auth).status_code == 200
    assert client.get(f"/api/admin/preincubation/applications/{app_id}", headers=auth).json["investors"] == []


def test_investment_validation(client, auth):
    app_id = _submit_pre(client)
    url = f"/api/admin/preincubation/{app_id}/investors"
    missing = client.post(url, json={"amount": "100"}, headers=auth)
    assert missing.status_code == 422 and "investor_name" in missing.json["fields"]
    bad = client.post(url, json={"investor_name": "X", "amount": "lots", "investor_type": "Uncle"}, headers=auth)
    assert set(bad.json["fields"]) == {"amount", "investor_type"}
    assert client.post("/api/admin/preincubation/9999/investors", json={"investor_name": "X"}, headers=auth).status_code == 404
    assert client.post(f"/api/admin/internship/{app_id}/investors", json={"investor_name": "X"}, headers=auth).status_code == 404


def test_mentors_are_assigned_once_and_suggested_across_startups(client, auth):
    first, second = _submit_pre(client), _submit_pre(client, email="ravi@example.com", startup_name="Other")
    mentor = {"mentor_name": "Dr. Rao", "expertise": "Go-to-market", "email": "rao@example.com"}
    response = client.post(f"/api/admin/preincubation/{first}/mentors", json=mentor, headers=auth)
    assert response.status_code == 201 and response.json["status"] == "Active"

    duplicate = client.post(f"/api/admin/preincubation/{first}/mentors", json={"mentor_name": "dr. rao"}, headers=auth)
    assert duplicate.status_code == 409

    directory = client.get("/api/admin/mentors", headers=auth).json
    assert directory == [{"mentor_name": "Dr. Rao", "expertise": "Go-to-market", "organisation": "", "email": "rao@example.com", "phone": ""}]
    assert client.post(f"/api/admin/preincubation/{second}/mentors", json=mentor, headers=auth).status_code == 201
    assert len(client.get("/api/admin/mentors", headers=auth).json) == 1

    assert client.patch(f"/api/admin/mentors/{response.json['id']}", json={"status": "Completed"}, headers=auth).json["status"] == "Completed"


def test_deleting_the_application_removes_its_investors_and_mentors(app, client, auth):
    app_id = _submit_pre(client)
    client.post(f"/api/admin/preincubation/{app_id}/investors", json={"investor_name": "Angel"}, headers=auth)
    client.post(f"/api/admin/preincubation/{app_id}/mentors", json={"mentor_name": "Mentor"}, headers=auth)
    assert client.delete(f"/api/admin/preincubation/applications/{app_id}", headers=auth).status_code == 200
    assert client.get("/api/admin/mentors", headers=auth).json == []


def test_requires_login(client):
    assert client.post("/api/admin/preincubation/1/mentors", json={"mentor_name": "X"}).status_code == 401
    assert client.get("/api/admin/mentors").status_code == 401
