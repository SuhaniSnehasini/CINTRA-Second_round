# CINTRA integrated build

This folder is based on `CINTRA-2nd_round` and retains its Expo application, Admin UI, case-selection flow, backend APIs, OpenCV face matching models, and data.

## Run locally

1. `npm install`
2. `python3 -m venv backend/.venv`
3. `backend/.venv/bin/pip install -r backend/requirements.txt`
4. Confirm `backend/.env` contains a base64-encoded 32-byte `ENCRYPTION_KEY`. A local key is included for this integrated build; rotate it before deployment.
5. From `backend`, run `./.venv/bin/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
6. From the project root, run `npm start`.

Evidence uploads retain the selected `case_id`, hash the original evidence using SHA-256, store only AES-256-GCM encrypted `.enc` data, create the existing integrity-chain record, and append a custody event. Custody and integrity verification are available from the uploaded evidence detail screen.

The Fabric integration remains an external gateway integration. Configure `FABRIC_GATEWAY_URL` and leave `FABRIC_ENABLED=true` when that existing gateway is available; no Fabric-project files are included or modified here.
