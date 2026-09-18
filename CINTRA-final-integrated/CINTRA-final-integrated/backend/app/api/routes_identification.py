from pathlib import Path

import cv2
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..config import YUNET_MODEL_PATH
from ..database import get_db
from ..schemas import IdentificationResponse
from ..services.identification_service import identify_image
from ..utils.image_utils import ImageValidationError, read_validated_image

router = APIRouter(tags=["identification"])


@router.post("/identify", response_model=IdentificationResponse)
async def identify(
    image: UploadFile = File(...),
    badge_id: str | None = Form(None),
    db: Session = Depends(get_db),
):
    try:
        image_bytes, decoded = await read_validated_image(image)

        # ---------------------------------------------------------
        # TEMPORARY DEBUG: save the exact image received by backend
        # ---------------------------------------------------------
        debug_path = (
            Path(__file__).resolve().parents[2]
            / "data"
            / "debug_android_scan.jpg"
        )

        debug_path.parent.mkdir(parents=True, exist_ok=True)

        cv2.imwrite(str(debug_path), decoded)

        print("\n[CINTRA DEBUG] Identification image received")
        print("[CINTRA DEBUG] Image shape:", decoded.shape)
        print("[CINTRA DEBUG] Saved image:", debug_path)

        # Test YuNet using the same detector configuration
        # currently used by face_matcher.py.
        detector = cv2.FaceDetectorYN.create(
            str(YUNET_MODEL_PATH),
            "",
            (320, 320),
            0.60,
            0.3,
            5000,
        )

        detector.setInputSize(
            (decoded.shape[1], decoded.shape[0])
        )

        _status, faces = detector.detect(decoded)

        print(
            "[CINTRA DEBUG] YuNet faces detected:",
            0 if faces is None else len(faces),
        )

        if faces is not None:
            for index, face in enumerate(faces, start=1):
                print(
                    f"[CINTRA DEBUG] Face {index}:",
                    face,
                )

        # ---------------------------------------------------------
        # EXISTING IDENTIFICATION PIPELINE
        # ---------------------------------------------------------
        return identify_image(
            image_bytes,
            decoded,
            db,
            officer_code=badge_id,
        )

    except ImageValidationError as exc:
        raise HTTPException(
            status_code=400,
            detail=str(exc),
        )

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Unable to process identification request",
        )