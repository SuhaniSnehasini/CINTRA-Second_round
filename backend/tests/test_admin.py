from datetime import datetime, timedelta

from app.database import SessionLocal
from app.models import AdminAccount, AdminOtpRequest, Officer, RecognitionEvent, SystemSetting
from app.utils.seed_admin_data import seed_admin_data


def _seed_admins():
    db = SessionLocal()
    try:
        if not db.query(AdminAccount).filter_by(admin_user_id="CINTRA-ADM-001").first():
            db.add_all([
                AdminAccount(
                    admin_user_id="CINTRA-ADM-001",
                    display_name="Amina Solace",
                    role="SUPER_ADMIN",
                    phone_number="+15550001001",
                    email="amina.solace@demo.cintra.local",
                    status="ACTIVE",
                ),
                AdminAccount(
                    admin_user_id="CINTRA-ADM-002",
                    display_name="Victor Hale",
                    role="ADMIN",
                    phone_number="+15550001002",
                    email="victor.hale@demo.cintra.local",
                    status="ACTIVE",
                ),
                AdminAccount(
                    admin_user_id="CINTRA-AUD-001",
                    display_name="Priya Quartz",
                    role="AUDITOR",
                    phone_number="+15550001003",
                    email="priya.quartz@demo.cintra.local",
                    status="ACTIVE",
                ),
            ])
            db.add(SystemSetting(key="otp_max_attempts", value="3"))
            db.add(SystemSetting(key="otp_expiry_seconds", value="60"))
            db.commit()
    finally:
        db.close()


def _login(client, admin_user_id="CINTRA-ADM-001"):
    sent = client.post("/api/v1/admin/auth/send-otp", json={"admin_user_id": admin_user_id})
    assert sent.status_code == 200, sent.text
    otp = sent.json()["dev_otp"]
    verified = client.post(
        "/api/v1/admin/auth/verify-otp",
        json={"admin_user_id": admin_user_id, "otp": otp, "request_id": sent.json()["request_id"]},
    )
    assert verified.status_code == 200, verified.text
    return verified.json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def test_invalid_admin_id(client):
    _seed_admins()
    response = client.post("/api/v1/admin/auth/send-otp", json={"admin_user_id": "CINTRA-ADM-999"})
    assert response.status_code == 401


def test_admin_otp_request_and_verify(client):
    _seed_admins()
    sent = client.post("/api/v1/admin/auth/send-otp", json={"admin_user_id": "CINTRA-ADM-001"})
    body = sent.json()
    assert sent.status_code == 200
    assert body["expires_in"] == 60
    assert body["expires_at"].endswith("Z")
    token = _login(client)
    me = client.get("/api/v1/admin/me", headers=_auth(token))
    assert me.status_code == 200
    assert me.json()["admin_user_id"] == "CINTRA-ADM-001"
    assert me.json()["role"] == "SUPER_ADMIN"


def test_otp_cannot_be_reused(client):
    _seed_admins()
    sent = client.post("/api/v1/admin/auth/send-otp", json={"admin_user_id": "CINTRA-ADM-001"})
    otp = sent.json()["dev_otp"]
    request_id = sent.json()["request_id"]
    first = client.post(
        "/api/v1/admin/auth/verify-otp",
        json={"admin_user_id": "CINTRA-ADM-001", "otp": otp, "request_id": request_id},
    )
    assert first.status_code == 200
    reused = client.post(
        "/api/v1/admin/auth/verify-otp",
        json={"admin_user_id": "CINTRA-ADM-001", "otp": otp, "request_id": request_id},
    )
    assert reused.status_code == 400


def test_resend_invalidates_previous_otp(client):
    _seed_admins()
    first = client.post("/api/v1/admin/auth/send-otp", json={"admin_user_id": "CINTRA-ADM-001"}).json()
    second = client.post("/api/v1/admin/auth/send-otp", json={"admin_user_id": "CINTRA-ADM-001"}).json()
    old = client.post(
        "/api/v1/admin/auth/verify-otp",
        json={"admin_user_id": "CINTRA-ADM-001", "otp": first["dev_otp"], "request_id": first["request_id"]},
    )
    assert old.status_code == 400
    ok = client.post(
        "/api/v1/admin/auth/verify-otp",
        json={"admin_user_id": "CINTRA-ADM-001", "otp": second["dev_otp"], "request_id": second["request_id"]},
    )
    assert ok.status_code == 200


def test_incorrect_and_locked_otp(client):
    _seed_admins()
    sent = client.post("/api/v1/admin/auth/send-otp", json={"admin_user_id": "CINTRA-ADM-001"})
    request_id = sent.json()["request_id"]
    for _ in range(2):
        failed = client.post(
            "/api/v1/admin/auth/verify-otp",
            json={"admin_user_id": "CINTRA-ADM-001", "otp": "000000", "request_id": request_id},
        )
        assert failed.status_code == 401
    locked = client.post(
        "/api/v1/admin/auth/verify-otp",
        json={"admin_user_id": "CINTRA-ADM-001", "otp": "000000", "request_id": request_id},
    )
    assert locked.status_code == 423


def test_expired_otp(client):
    _seed_admins()
    sent = client.post("/api/v1/admin/auth/send-otp", json={"admin_user_id": "CINTRA-ADM-001"})
    db = SessionLocal()
    try:
        row = db.query(AdminOtpRequest).filter_by(request_id=sent.json()["request_id"]).first()
        row.expires_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
    finally:
        db.close()
    expired = client.post(
        "/api/v1/admin/auth/verify-otp",
        json={"admin_user_id": "CINTRA-ADM-001", "otp": sent.json()["dev_otp"], "request_id": sent.json()["request_id"]},
    )
    assert expired.status_code == 400


def test_unauthorized_admin_endpoint(client):
    _seed_admins()
    response = client.get("/api/v1/admin/dashboard/overview")
    assert response.status_code == 401


def test_role_restrictions(client):
    _seed_admins()
    auditor = _login(client, "CINTRA-AUD-001")
    denied = client.post(
        "/api/v1/admin/officers",
        headers=_auth(auditor),
        json={
            "officer_id": "CINTRA-OFC-TEST",
            "name": "Test Officer",
            "unit": "Digital Investigation Unit",
            "designation": "Analyst",
        },
    )
    assert denied.status_code == 403
    admins = client.get("/api/v1/admin/admins", headers=_auth(auditor))
    assert admins.status_code == 403


def test_officer_person_recognition_evidence_and_audit(client):
    _seed_admins()
    token = _login(client)
    created = client.post(
        "/api/v1/admin/officers",
        headers=_auth(token),
        json={
            "officer_id": "CINTRA-OFC-TEST",
            "name": "Test Officer",
            "unit": "Digital Investigation Unit",
            "designation": "Analyst",
        },
    )
    assert created.status_code == 200
    officers = client.get("/api/v1/admin/officers?q=TEST", headers=_auth(token))
    assert officers.status_code == 200
    assert officers.json()["total"] >= 1
    persons = client.get("/api/v1/admin/persons?page=1&page_size=10", headers=_auth(token))
    assert persons.status_code == 200
    recognition = client.get("/api/v1/admin/recognition?result=MATCH", headers=_auth(token))
    assert recognition.status_code == 200
    evidence = client.get("/api/v1/admin/evidence", headers=_auth(token))
    assert evidence.status_code == 200
    audit = client.get("/api/v1/admin/audit?action=CREATE_OFFICER", headers=_auth(token))
    assert audit.status_code == 200
    assert any(item["action"] == "CREATE_OFFICER" for item in audit.json()["items"])


def test_dashboard_statistics_match_database(client):
    _seed_admins()
    db = SessionLocal()
    try:
        officer = Officer(
            officer_id="CINTRA-OFC-STAT",
            name="Stat Officer",
            unit="Technical Operations Unit",
            designation="Analyst",
            status="ACTIVE",
            data_origin="DEMO_SEEDED",
        )
        db.add(officer)
        db.flush()
        today = datetime.utcnow()
        db.add(RecognitionEvent(
            event_id="EVT-STAT-1",
            officer_id=officer.id,
            officer_code=officer.officer_id,
            timestamp=today,
            match_result="MATCH",
            confidence=91.2,
            data_origin="DEMO_SEEDED",
        ))
        db.add(RecognitionEvent(
            event_id="EVT-STAT-2",
            officer_id=officer.id,
            officer_code=officer.officer_id,
            timestamp=today,
            match_result="NO_MATCH",
            confidence=22.0,
            data_origin="DEMO_SEEDED",
        ))
        db.commit()
        expected_scans = db.query(RecognitionEvent).filter(RecognitionEvent.timestamp >= datetime(today.year, today.month, today.day)).count()
        expected_matches = db.query(RecognitionEvent).filter(
            RecognitionEvent.timestamp >= datetime(today.year, today.month, today.day),
            RecognitionEvent.match_result == "MATCH",
        ).count()
        expected_officers = db.query(Officer).filter_by(status="ACTIVE").count()
    finally:
        db.close()
    token = _login(client)
    overview = client.get("/api/v1/admin/dashboard/overview", headers=_auth(token)).json()
    assert overview["todays_scans"] == expected_scans
    assert overview["todays_matches"] == expected_matches
    assert overview["active_officers"] == expected_officers


def test_system_health_and_logout(client):
    _seed_admins()
    token = _login(client)
    health = client.get("/api/v1/admin/system/health", headers=_auth(token))
    assert health.status_code == 200
    assert health.json()["checks"]["database"]["status"] == "healthy"
    assert health.json()["checks"]["api"]["status"] == "healthy"
    logout = client.post("/api/v1/admin/auth/logout", headers=_auth(token))
    assert logout.status_code == 200
    denied = client.get("/api/v1/admin/me", headers=_auth(token))
    assert denied.status_code == 401


def test_seed_admin_data_is_idempotent():
    seed_admin_data()
    seed_admin_data()
    db = SessionLocal()
    try:
        admins = db.query(AdminAccount).count()
        assert admins >= 3
        events = db.query(RecognitionEvent).filter_by(data_origin="DEMO_SEEDED").count()
        assert events >= 150
    finally:
        db.close()
