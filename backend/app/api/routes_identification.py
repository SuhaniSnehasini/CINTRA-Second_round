from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session
from ..database import get_db
from ..schemas import IdentificationResponse
from ..services.identification_service import identify_image
from ..utils.image_utils import ImageValidationError, read_validated_image

router = APIRouter(tags=["identification"])

@router.post("/identify", response_model=IdentificationResponse)
async def identify(image: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        image_bytes, decoded = await read_validated_image(image)
        return identify_image(image_bytes, decoded, db)
    except ImageValidationError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception:
        raise HTTPException(status_code=500, detail="Unable to process identification request")
