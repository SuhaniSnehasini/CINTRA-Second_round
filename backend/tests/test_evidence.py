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
