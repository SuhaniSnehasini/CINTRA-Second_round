import time
import uuid
from datetime import datetime

import cv2
import numpy as np
from sqlalchemy.orm import Session

from ..config import DEMO_MATCH_THRESHOLD, MATCHING_MODE, YUNET_MODEL_PATH
from ..models import RecognitionEvent
from ..schema_migrate import get_setting_value
from .face_detector import detect_faces
from .face_matcher import match_face
from .integrity_service import lookup_officer
from .suspect_service import get_suspect, list_suspects


def reset_scan_counter():
    """
    Kept for compatibility with the existing application.
    Identification no longer depends on scan count.
    """
    return None


def _threshold(db: Session) -> float:
    return float(
        get_setting_value(
            db,
            "recognition_threshold",
            str(DEMO_MATCH_THRESHOLD),
        )
    )


def _persist_event(
    db: Session,
    payload: dict,
    officer_code: str | None,
    duration_ms: int,
) -> None:
    suspect = payload.get("suspect") or {}
    person_code = suspect.get("suspect_id")
    person = get_suspect(db, person_code) if person_code else None
    officer = lookup_officer(db, officer_code)

    if payload.get("match"):
        result = "MATCH"
    elif payload.get("message") in {
        "No face detected",
        "Multiple faces detected. Please scan one person at a time.",
    }:
        result = "PROCESSING_ERROR"
    else:
        confidence = suspect.get("confidence")
        result = "NO_MATCH"

        if (
            isinstance(confidence, (int, float))
            and 50 <= float(confidence) < 82
        ):
            result = "LOW_CONFIDENCE"

    event = RecognitionEvent(
        event_id=f"EVT-{uuid.uuid4().hex[:10].upper()}",
        officer_id=officer.id if officer else None,
        officer_code=officer_code,
        person_id=person.id if person else None,
        person_code=person_code,
        timestamp=datetime.utcnow(),
        match_result=result,
        confidence=suspect.get("confidence"),
        threshold_used=_threshold(db),
        model_version="sface-2021dec",
        processing_duration_ms=duration_ms,
        status="COMPLETED",
        message=payload.get("message"),
        data_origin="OPERATIONAL",
    )

    db.add(event)
    db.commit()


def _box_iou(box_a, box_b) -> float:
    """
    Calculate Intersection over Union (IoU) for two face boxes.

    Each box is:
        [x, y, width, height]
    """

    ax, ay, aw, ah = [float(value) for value in box_a[:4]]
    bx, by, bw, bh = [float(value) for value in box_b[:4]]

    a_left = ax
    a_top = ay
    a_right = ax + aw
    a_bottom = ay + ah

    b_left = bx
    b_top = by
    b_right = bx + bw
    b_bottom = by + bh

    intersection_left = max(a_left, b_left)
    intersection_top = max(a_top, b_top)
    intersection_right = min(a_right, b_right)
    intersection_bottom = min(a_bottom, b_bottom)

    intersection_width = max(
        0.0,
        intersection_right - intersection_left,
    )
    intersection_height = max(
        0.0,
        intersection_bottom - intersection_top,
    )

    intersection_area = (
        intersection_width * intersection_height
    )

    area_a = max(0.0, aw) * max(0.0, ah)
    area_b = max(0.0, bw) * max(0.0, bh)

    union_area = area_a + area_b - intersection_area

    if union_area <= 0:
        return 0.0

    return intersection_area / union_area


def _center_distance_ratio(box_a, box_b) -> float:
    """
    Measure the distance between two box centers relative to
    the larger face diagonal.

    This helps distinguish duplicate detections of one face
    from genuinely separate faces.
    """

    ax, ay, aw, ah = [float(value) for value in box_a[:4]]
    bx, by, bw, bh = [float(value) for value in box_b[:4]]

    a_center_x = ax + aw / 2.0
    a_center_y = ay + ah / 2.0

    b_center_x = bx + bw / 2.0
    b_center_y = by + bh / 2.0

    distance = float(
        np.hypot(
            a_center_x - b_center_x,
            a_center_y - b_center_y,
        )
    )

    diagonal_a = float(np.hypot(aw, ah))
    diagonal_b = float(np.hypot(bw, bh))

    reference_diagonal = max(
        diagonal_a,
        diagonal_b,
        1.0,
    )

    return distance / reference_diagonal


def _collapse_duplicate_face_detections(faces):
    """
    Collapse highly overlapping detections that represent the
    same physical face.

    Genuine separate faces remain separate when their boxes do
    not overlap substantially.

    The highest-confidence detection is retained for each
    overlapping group.
    """

    if not faces:
        return []

    # Convert to a normal list so the function works with both
    # Python lists and NumPy arrays returned by OpenCV.
    candidates = [
        np.asarray(face, dtype=np.float32)
        for face in faces
    ]

    # Highest-confidence detections are considered first.
    candidates.sort(
        key=lambda face: float(face[14]),
        reverse=True,
    )

    kept = []

    for candidate in candidates:
        duplicate = False

        for existing in kept:
            iou = _box_iou(candidate, existing)
            center_ratio = _center_distance_ratio(
                candidate,
                existing,
            )

            # These two detections are considered the same face
            # when they overlap substantially and their centers
            # are close relative to face size.
            if iou >= 0.45 and center_ratio <= 0.35:
                duplicate = True
                break

        if not duplicate:
            kept.append(candidate)

    return kept


def identify_image(
    image_bytes,
    decoded_image,
    db,
    officer_code: str | None = None,
):
    started = time.perf_counter()

    faces = detect_faces(decoded_image)

    print(
        "[CINTRA IDENTIFICATION] Raw face detections:",
        len(faces),
    )

    faces = _collapse_duplicate_face_detections(faces)

    print(
        "[CINTRA IDENTIFICATION] Face detections after "
        "duplicate filtering:",
        len(faces),
    )

    if not faces:
        payload = {
            "match": False,
            "suspect": None,
            "message": "No face detected",
        }

        _persist_event(
            db,
            payload,
            officer_code,
            int(
                (time.perf_counter() - started) * 1000
            ),
        )

        return payload

    if len(faces) > 1:
        payload = {
            "match": False,
            "suspect": None,
            "message": (
                "Multiple faces detected. "
                "Please scan one person at a time."
            ),
        }

        _persist_event(
            db,
            payload,
            officer_code,
            int(
                (time.perf_counter() - started) * 1000
            ),
        )

        return payload

    result = match_face(
        decoded_image,
        faces[0],
        list_suspects(db),
        MATCHING_MODE,
    )

    if result.suspect_code:
        suspect = get_suspect(
            db,
            result.suspect_code,
        )

        if suspect:
            payload = {
                "match": True,
                "suspect": {
                    "suspect_id": suspect.suspect_code,
                    "name": suspect.name,
                    "role": suspect.role,
                    "confidence": result.confidence,
                    "wanted": suspect.wanted,
                },
                "message": "Match Found",
            }

            _persist_event(
                db,
                payload,
                officer_code,
                int(
                    (time.perf_counter() - started) * 1000
                ),
            )

            return payload

    # IMPORTANT:
    # Do not manufacture an S004 match when the ML matcher
    # cannot find a valid match.
    payload = {
        "match": False,
        "suspect": None,
        "message": "No Match Found",
    }

    _persist_event(
        db,
        payload,
        officer_code,
        int(
            (time.perf_counter() - started) * 1000
        ),
    )

    return payload