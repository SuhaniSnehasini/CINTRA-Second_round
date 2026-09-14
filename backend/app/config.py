from pathlib import Path
import os

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[1]

load_dotenv(BASE_DIR / ".env")


# ------------------------------------------------------------
# Face matching configuration
# ------------------------------------------------------------

MATCHING_MODE = os.getenv(
    "MATCHING_MODE",
    "demo",
).lower()

DEMO_MATCH_THRESHOLD = float(
    os.getenv(
        "DEMO_MATCH_THRESHOLD",
        "0.40",
    )
)


# ------------------------------------------------------------
# Upload configuration
# ------------------------------------------------------------

MAX_IMAGE_SIZE_MB = int(
    os.getenv(
        "MAX_IMAGE_SIZE_MB",
        "5",
    )
)

MAX_IMAGE_SIZE_BYTES = (
    MAX_IMAGE_SIZE_MB * 1024 * 1024
)


# ------------------------------------------------------------
# Database configuration
# ------------------------------------------------------------

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{BASE_DIR / 'cintra.db'}",
)


# ------------------------------------------------------------
# Face model configuration
# ------------------------------------------------------------

MODEL_DIR = BASE_DIR / "data" / "models"

YUNET_MODEL_PATH = (
    MODEL_DIR
    / "face_detection_yunet_2023mar.onnx"
)

SFACE_MODEL_PATH = (
    MODEL_DIR
    / "face_recognition_sface_2021dec.onnx"
)


# ------------------------------------------------------------
# Hyperledger Fabric configuration
# ------------------------------------------------------------

FABRIC_ENABLED = (
    os.getenv(
        "FABRIC_ENABLED",
        "true",
    ).lower()
    in {
        "1",
        "true",
        "yes",
        "on",
    }
)

FABRIC_GATEWAY_URL = os.getenv(
    "FABRIC_GATEWAY_URL",
    "http://127.0.0.1:4100",
)

FABRIC_GATEWAY_TIMEOUT_SECONDS = float(
    os.getenv(
        "FABRIC_GATEWAY_TIMEOUT_SECONDS",
        "20",
    )
)
