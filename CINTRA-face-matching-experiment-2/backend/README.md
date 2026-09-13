# CINTRA Backend

Independent FastAPI backend for the CINTRA mobile scanner. It uses SQLite, OpenCV face detection, and a deterministic **demo** matcher. Demo matching is only a pipeline demonstration, not biometric or forensic recognition.

## Setup

Requires Python 3.10+. From `backend`:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m app.utils.seed_data
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Swagger is at `http://127.0.0.1:8000/docs`. Run tests with `pytest`.

`MATCHING_MODE=demo` is the supported default. It uses local OpenCV YuNet/SFace pretrained models to compare a detected face against the explicitly enrolled images in `data/demo/`. The configurable prototype cosine threshold is `DEMO_MATCH_THRESHOLD=0.36`. It is not forensic or production identity recognition.

The supplied fictional S001 enrollment set is `data/demo/S001-1.png` through `S001-5.png`. If model or reference files are missing or cannot be decoded, identification safely returns `No Match Found` rather than assigning an identity.

The SQLite database is created/seeded at startup without deleting existing rows. `data/offline_cache.json` is a portable demo metadata cache only: a backend cannot provide offline phone identification without a mobile-side model and data.

For production, restrict the CORS origin list and add authentication/authorization separately.
