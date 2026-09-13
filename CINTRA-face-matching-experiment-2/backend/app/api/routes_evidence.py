import hashlib
import os
import shutil
from datetime import datetime
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

router = APIRouter(prefix="/evidence", tags=["evidence"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_evidence(
    file: UploadFile = File(...),
    type: str = Form("Evidence"),
    badge_id: str = Form(None)
):
    if not file:
        raise HTTPException(status_code=400, detail="No evidence file uploaded")

    try:
        # Read file content to compute SHA-256
        content = await file.read()
        sha256_hash = hashlib.sha256(content).hexdigest()

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{file.filename}"
        file_path = os.path.join(UPLOAD_DIR, safe_filename)

        # Save content to disk
        with open(file_path, "wb") as f:
            f.write(content)

        return {
            "success": True,
            "filename": safe_filename,
            "type": type,
            "badge_id": badge_id,
            "sha256": sha256_hash,
            "size_bytes": len(content),
            "file_path": f"/uploads/{safe_filename}",
            "message": f"{type} evidence uploaded successfully."
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evidence upload failed: {str(e)}")
