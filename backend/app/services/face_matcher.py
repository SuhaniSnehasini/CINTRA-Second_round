"""
Local, consented-demo face matching using OpenCV YuNet and SFace models.

This module is limited to the fictional demo records. It is not a forensic or
production identity system and must not be used for decisions about real people.
"""

from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from ..config import (
    BASE_DIR,
    DEMO_MATCH_THRESHOLD,
    SFACE_MODEL_PATH,
    YUNET_MODEL_PATH,
)


@dataclass(frozen=True)
class MatchResult:
    suspect_code: str | None
    confidence: float | None


# =========================================================
# ENROLLMENT IMAGES
# =========================================================

def _enrollment_paths(suspect) -> list[Path]:
    """
    Return all valid enrollment images for a suspect.

    Expected naming convention:
        S001-1.png
        S001-2.png
        S001-3.png

    Files such as S001.jpg are intentionally not included.
    """

    demo_dir = BASE_DIR / "data" / "demo"

    return sorted(
        path
        for path in demo_dir.glob(
            f"{suspect.suspect_code}-*.*"
        )
        if path.suffix.lower()
        in {".jpg", ".jpeg", ".png"}
    )


# =========================================================
# MODEL AVAILABILITY
# =========================================================

def _models_available() -> bool:
    """Return True when both YuNet and SFace models are available."""

    return (
        YUNET_MODEL_PATH.is_file()
        and SFACE_MODEL_PATH.is_file()
    )


# =========================================================
# FACE DETECTION
# =========================================================

def _detect_one(detector, image):
    """
    Detect a face using YuNet.

    If multiple detections are returned, choose the largest
    detected bounding box.

    The largest detected region performed better than selecting
    the highest-confidence detection on the project demo data.
    """

    detector.setInputSize(
        (image.shape[1], image.shape[0])
    )

    _status, faces = detector.detect(image)

    if faces is None or len(faces) == 0:
        return None

    # Select the largest detected face.
    #
    # YuNet face format:
    # [x, y, width, height, landmarks..., confidence]
    #
    # Face area = width * height
    return max(
        faces,
        key=lambda face: float(
            face[2] * face[3]
        ),
    )


# =========================================================
# FEATURE EXTRACTION
# =========================================================

def _feature(recognizer, image, face):
    """
    Align the detected face using YuNet landmarks and
    extract the SFace embedding.
    """

    aligned = recognizer.alignCrop(
        image,
        face,
    )

    return recognizer.feature(
        aligned
    ).astype(np.float32)


# =========================================================
# EMBEDDING NORMALIZATION
# =========================================================

def _normalize(feature):
    """
    L2-normalize an SFace embedding.
    """

    norm = np.linalg.norm(feature)

    if norm == 0:
        return feature

    return feature / norm


# =========================================================
# FACE MATCHING
# =========================================================

def match_face(
    query_image,
    _query_face_box,
    suspects,
    mode: str = "demo",
) -> MatchResult:
    """
    Match one query face against the local consented
    enrollment set.

    Recognition pipeline:

        Query image
             |
             v
        YuNet detection
             |
             v
        Largest detected face
             |
             v
        SFace alignCrop
             |
             v
        SFace embedding
             |
             v
        Compare against every enrollment image
             |
             v
        Highest cosine similarity
             |
             v
        Threshold decision
    """

    # -----------------------------------------------------
    # Safety / mode checks
    # -----------------------------------------------------

    if (
        mode != "demo"
        or not suspects
        or not _models_available()
    ):
        return MatchResult(
            None,
            None,
        )

    # -----------------------------------------------------
    # Create YuNet detector
    # -----------------------------------------------------

    detector = cv2.FaceDetectorYN.create(
        str(YUNET_MODEL_PATH),
        "",
        (320, 320),

        # Detection confidence threshold.
        #
        # Experiments showed that 0.60 gives much better
        # usable-image coverage than the previous 0.10.
        0.60,

        0.3,
        5000,
    )

    # -----------------------------------------------------
    # Create SFace recognizer
    # -----------------------------------------------------

    recognizer = cv2.FaceRecognizerSF.create(
        str(SFACE_MODEL_PATH),
        "",
    )

    # -----------------------------------------------------
    # Detect query face
    # -----------------------------------------------------

    query_face = _detect_one(
        detector,
        query_image,
    )

    if query_face is None:
        return MatchResult(
            None,
            None,
        )

    # -----------------------------------------------------
    # Extract query embedding
    # -----------------------------------------------------

    query_feature = _feature(
        recognizer,
        query_image,
        query_face,
    )

    query_feature = _normalize(
        query_feature
    )

    # -----------------------------------------------------
    # Compare query against individual enrollment images
    # -----------------------------------------------------

    best_suspect = None
    best_score = None

    for suspect in suspects:

        for path in _enrollment_paths(suspect):

            # -------------------------------------------------
            # Read enrollment image
            # -------------------------------------------------

            reference = cv2.imread(
                str(path)
            )

            if reference is None:
                continue

            # -------------------------------------------------
            # Detect enrollment face
            # -------------------------------------------------

            reference_face = _detect_one(
                detector,
                reference,
            )

            if reference_face is None:
                continue

            # -------------------------------------------------
            # Extract enrollment embedding
            # -------------------------------------------------

            reference_feature = _feature(
                recognizer,
                reference,
                reference_face,
            )

            reference_feature = _normalize(
                reference_feature
            )

            # -------------------------------------------------
            # Calculate cosine similarity
            # -------------------------------------------------

            score = float(
                recognizer.match(
                    query_feature,
                    reference_feature,
                    cv2.FaceRecognizerSF_FR_COSINE,
                )
            )

            # -------------------------------------------------
            # Keep highest score
            # -------------------------------------------------

            if (
                best_score is None
                or score > best_score
            ):
                best_score = score
                best_suspect = suspect.suspect_code

    # -----------------------------------------------------
    # No usable enrollment images
    # -----------------------------------------------------

    if (
        best_suspect is None
        or best_score is None
    ):
        return MatchResult(
            None,
            None,
        )

    # -----------------------------------------------------
    # Threshold decision
    # -----------------------------------------------------

    if best_score < DEMO_MATCH_THRESHOLD:
        return MatchResult(
            None,
            None,
        )

    # -----------------------------------------------------
    # Convert cosine similarity to percentage
    # -----------------------------------------------------

    confidence = round(
        best_score * 100,
        1,
    )

    return MatchResult(
        best_suspect,
        confidence,
    )