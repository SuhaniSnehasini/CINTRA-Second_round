def test_suspect_list_and_lookup(client):
    records = client.get("/api/v1/suspects").json()
    assert len(records) == 4
    assert "image_path" not in records[0]
    assert client.get("/api/v1/suspects/S001").json()["name"] == "Raj Kumar"
    assert client.get("/api/v1/suspects/s001").json()["name"] == "Raj Kumar"
    assert client.get("/api/v1/suspects/Raj").json()["suspect_id"] == "S001"
    assert client.get("/api/v1/suspects/S002").json()["name"] == "Arjun Mehta"
    assert client.get("/api/v1/suspects/S004").json()["name"] == "Anvi Mishra"
    assert client.get("/api/v1/suspects/none").status_code == 404

