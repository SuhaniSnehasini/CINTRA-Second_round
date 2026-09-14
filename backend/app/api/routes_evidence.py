import hashlib
import os
from datetime import datetime

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.services.encryption_service import encrypt_data

router = APIRouter(prefix="/evidence", tags=["evidence"])

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "uploads"
)

os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_evidence(
    file: UploadFile = File(...),
    type: str = Form("Evidence"),
    badge_id: str = Form(None)
):
    if not file:
        raise HTTPException(
            status_code=400,
            detail="No evidence file uploaded"
        )

    try:
        # Read the original evidence file
        content = await file.read()

        # Calculate SHA-256 of the ORIGINAL evidence
        sha256_hash = hashlib.sha256(content).hexdigest()

        # Encrypt the original evidence using AES-256-GCM
        nonce, encrypted_content = encrypt_data(content)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_filename = f"{timestamp}_{file.filename}.enc"

        file_path = os.path.join(UPLOAD_DIR, safe_filename)

        # Store nonce + encrypted content
        # First 12 bytes = nonce
        # Remaining bytes = encrypted evidence
        with open(file_path, "wb") as f:
            f.write(nonce)
            f.write(encrypted_content)

        return {
            "success": True,
            "filename": safe_filename,
            "type": type,
            "badge_id": badge_id,
            "sha256": sha256_hash,
            "size_bytes": len(content),
            "encrypted_size_bytes": len(nonce) + len(encrypted_content),
            "file_path": f"/uploads/{safe_filename}",
            "encryption": "AES-256-GCM",
            "message": f"{type} evidence uploaded and encrypted successfully."
        }

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Evidence upload failed: {str(e)}"
        )
    