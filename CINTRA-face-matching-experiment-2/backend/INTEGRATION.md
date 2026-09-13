# Person 1 integration contract

Start the backend from `backend` with `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`. Check `GET /api/v1/health` first. API docs: `http://127.0.0.1:8000/docs`.

Send `POST /api/v1/identify` as `multipart/form-data`; the required field is exactly `image` and its value is the captured JPEG or PNG. Do not send base64 JSON. Use `response.match` to choose UI state—never the message text. A match has `suspect.name`, `role`, `confidence`, and `wanted`.

```json
{"match":true,"suspect":{"suspect_id":"S001","name":"Raj Kumar","role":"Theft Suspect","confidence":94.6,"wanted":true},"message":"Match Found"}
```

No match: `{"match":false,"suspect":null,"message":"No Match Found"}`. No face: `{"match":false,"suspect":null,"message":"No face detected"}`. Multiple faces: `{"match":false,"suspect":null,"message":"Multiple faces detected. Please scan one person at a time."}`.

On a physical phone, `127.0.0.1` points to the phone, not this laptop. Connect both devices to the same network and use the laptop LAN IPv4 address in one configurable mobile base URL, e.g. `http://<laptop-lan-ip>:8000` (find it with `ipconfig`). Ensure the firewall permits port 8000. For connection errors, check health at that LAN address, server host `0.0.0.0`, Wi-Fi, and firewall. The backend does not make the mobile app offline-capable.
