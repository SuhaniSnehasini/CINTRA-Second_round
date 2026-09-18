def test_missing_and_invalid_images(client):
    assert client.post("/api/v1/identify").status_code == 422
    response = client.post("/api/v1/identify", files={"image": ("bad.jpg", b"not an image", "image/jpeg")})
    assert response.status_code == 400

def test_oversized_image(client, monkeypatch):
    import app.utils.image_utils as utils
    monkeypatch.setattr(utils, "MAX_IMAGE_SIZE_BYTES", 4)
    response = client.post("/api/v1/identify", files={"image": ("large.jpg", b"12345", "image/jpeg")})
    assert response.status_code == 400
