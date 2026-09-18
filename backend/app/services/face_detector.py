import cv2
from ..config import YUNET_MODEL_PATH

_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")

def detect_faces(image):
    """Return face boxes, preferring the enrolled-model-compatible YuNet detector."""
    if YUNET_MODEL_PATH.is_file() and hasattr(cv2, "FaceDetectorYN"):
        detector = cv2.FaceDetectorYN.create(str(YUNET_MODEL_PATH), "", (320, 320), 0.10, 0.3, 5000)
        detector.setInputSize((image.shape[1], image.shape[0]))
        _status, faces = detector.detect(image)
        if faces is not None:
            return [tuple(map(int, face[:4])) for face in faces]

    # Fallback for a fresh clone before optional model files are downloaded.
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    faces = _CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    return [tuple(map(int, face)) for face in faces]
