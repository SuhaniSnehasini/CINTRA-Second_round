import numpy as np
from pathlib import Path

def _jpeg():
    import cv2
    ok, buf = cv2.imencode(".jpg", np.zeros((60, 60, 3), dtype=np.uint8))
    assert ok
    return buf.tobytes()

def test_no_and_multiple_faces(client, monkeypatch):
    import app.services.identification_service as service
    monkeypatch.setattr(service, "detect_faces", lambda image: [])
    response = client.post("/api/v1/identify", files={"image": ("x.jpg", _jpeg(), "image/jpeg")})
    assert response.json()["message"] == "No face detected"
    monkeypatch.setattr(service, "detect_faces", lambda image: [(1, 1, 2, 2), (2, 2, 3, 3)])
    response = client.post("/api/v1/identify", files={"image": ("x.jpg", _jpeg(), "image/jpeg")})
    assert "Multiple faces" in response.json()["message"]

def test_demo_match_and_no_match(client, monkeypatch):
    import app.services.identification_service as service
    from app.services.face_matcher import MatchResult
    monkeypatch.setattr(service, "detect_faces", lambda image: [(1, 1, 2, 2)])
    monkeypatch.setattr(service, "match_face", lambda *args: MatchResult("S001", 94.6))
    matched = client.post("/api/v1/identify", files={"image": ("x.jpg", _jpeg(), "image/jpeg")}).json()
    assert matched["match"] is True and matched["suspect"]["confidence"] == 94.6
    monkeypatch.setattr(service, "match_face", lambda *args: MatchResult(None, None))
    response = client.post("/api/v1/identify", files={"image": ("x.jpg", _jpeg(), "image/jpeg")})
    assert response.json() == {"match": False, "suspect": None, "message": "No Match Found"}

def test_enrolled_demo_reference_matches_s001(client):
    reference = Path(__file__).parents[1] / "data" / "demo" / "S001-1.png"
    response = client.post(
        "/api/v1/identify",
        files={"image": ("S001-1.png", reference.read_bytes(), "image/png")},
    )
    payload = response.json()
    assert response.status_code == 200
    assert payload["match"] is True
    assert payload["suspect"]["suspect_id"] == "S001"
    assert payload["suspect"]["wanted"] is True

def test_enrolled_demo_reference_matches_s004(client):
    reference = Path(__file__).parents[1] / "data" / "demo" / "S004-1.jpg"
    response = client.post(
        "/api/v1/identify",
        files={"image": ("S004-1.jpg", reference.read_bytes(), "image/jpeg")},
    )
    payload = response.json()
    assert response.status_code == 200
    assert payload["match"] is True
    assert payload["suspect"]["suspect_id"] == "S004"
    assert payload["suspect"]["name"] == "Anvi Mishra"
    assert payload["suspect"]["wanted"] is True

