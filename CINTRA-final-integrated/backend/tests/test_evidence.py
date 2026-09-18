import io
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_upload_evidence():
    file_content = b"Mock evidence document content for testing"
    test_file = io.BytesIO(file_content)

    response = client.post(
        "/api/v1/evidence/upload",
        files={"file": ("test_doc.txt", test_file, "text/plain")},
        data={"type": "Document", "badge_id": "OFF001"}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["type"] == "Document"
    assert data["badge_id"] == "OFF001"
    assert "sha256" in data
    assert data["size_bytes"] == len(file_content)

def test_custody_history_and_transfer():
    file_content = b"Custody test evidence payload"
    test_file = io.BytesIO(file_content)

    upload_res = client.post(
        "/api/v1/evidence/upload",
        files={"file": ("custody_test.pdf", test_file, "application/pdf")},
        data={"type": "Document", "badge_id": "OFF001"}
    )
    assert upload_res.status_code == 200
    ev_data = upload_res.json()
    ev_id = ev_data["evidence"]["evidence_id"]

    # 1. Fetch custody history
    custody_res = client.get(f"/api/v1/evidence/{ev_id}/custody")
    assert custody_res.status_code == 200
    custody_json = custody_res.json()
    assert custody_json["success"] is True
    assert len(custody_json["events"]) >= 1
    assert custody_json["events"][0]["action"] == "REGISTERED"

    # 2. Transfer evidence
    transfer_res = client.post(
        f"/api/v1/evidence/{ev_id}/transfer",
        data={
          "badge_id": "OFF001",
          "to_custodian": "OFF002",
          "reason": "Transfer for forensic analysis"
        }
    )
    assert transfer_res.status_code == 200
    transfer_json = transfer_res.json()
    assert transfer_json["success"] is True

    # 3. Re-verify custody history contains transfer event
    custody_after = client.get(f"/api/v1/evidence/{ev_id}/custody")
    assert custody_after.status_code == 200
    after_events = custody_after.json()["events"]
    assert len(after_events) >= 2
    assert after_events[-1]["action"] == "TRANSFERRED"
    assert after_events[-1]["to_custodian"] == "OFF002"
