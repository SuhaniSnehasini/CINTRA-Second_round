from pathlib import Path
import os
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
load_dotenv(BASE_DIR / ".env")

MATCHING_MODE = os.getenv("MATCHING_MODE", "demo").lower()
# Cosine similarity threshold for the local OpenCV SFace prototype.
DEMO_MATCH_THRESHOLD = float(os.getenv("DEMO_MATCH_THRESHOLD", "0.40"))
MAX_IMAGE_SIZE_MB = int(os.getenv("MAX_IMAGE_SIZE_MB", "5"))
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR / 'cintra.db'}")
MODEL_DIR = BASE_DIR / "data" / "models"
YUNET_MODEL_PATH = MODEL_DIR / "face_detection_yunet_2023mar.onnx"
SFACE_MODEL_PATH = MODEL_DIR / "face_recognition_sface_2021dec.onnx"
