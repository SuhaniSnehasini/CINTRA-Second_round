import cv2
import numpy as np
from fastapi import UploadFile
from ..config import MAX_IMAGE_SIZE_BYTES

class ImageValidationError(ValueError):
    pass

async def read_validated_image(upload: UploadFile):
    if not upload or not upload.filename:
        raise ImageValidationError("Image file is required")
    data = await upload.read(MAX_IMAGE_SIZE_BYTES + 1)
    if not data:
        raise ImageValidationError("Image file is empty")
    if len(data) > MAX_IMAGE_SIZE_BYTES:
        raise ImageValidationError("Image exceeds the configured size limit")
    decoded = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if decoded is None:
        raise ImageValidationError("Unsupported, corrupted, or undecodable image")
    # imdecode validates content; magic bytes prevent arbitrary decodable formats.
    if not (data.startswith(b"\xff\xd8\xff") or data.startswith(b"\x89PNG\r\n\x1a\n")):
        raise ImageValidationError("Only JPEG and PNG images are supported")
    return data, decoded
