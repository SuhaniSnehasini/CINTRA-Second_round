"""SYNTHETIC / DEMO DATA ONLY.

This seed does not contain real people, real phone numbers, real case identifiers,
or real biometric embeddings. Records are labeled DEMO_SEEDED or clearly fictional.
It is safe to run repeatedly.
"""
from __future__ import annotations

import hashlib
import random
from datetime import datetime, timedelta

from ..database import SessionLocal
from ..models import (
    AdminAccount,
    AdminAuditLog,
    EvidenceRecord,
    FaceRepresentation,
    Investigation,
    InvestigationLink,
    Officer,
    RecognitionEvent,
    Suspect,
    SystemSetting,
)
from ..schema_migrate import ensure_schema
from ..services.integrity_service import compute_record_hash
from .seed_data import seed_database

SEED_VERSION = "1"
RNG = random.Random(20260914)

UNITS = [
    "Digital Investigation Unit",
    "Forensic Analysis Unit",
    "Field Investigation Unit",
    "Technical Operations Unit",
]

OFFICER_NAMES = [
    ("OFF001", "Jordan Hale"),
    ("CINTRA-OFC-001", "Morgan Quill"),
    ("CINTRA-OFC-002", "Riley Voss"),
    ("CINTRA-OFC-003", "Casey North"),
    ("CINTRA-OFC-004", "Avery Lang"),
    ("CINTRA-OFC-005", "Quinn Adler"),
    ("CINTRA-OFC-006", "Reese Calder"),
    ("CINTRA-OFC-007", "Drew Halden"),
    ("CINTRA-OFC-008", "Skyler Pate"),
    ("CINTRA-OFC-009", "Harper Niles"),
    ("CINTRA-OFC-010", "Rowan Blake"),
    ("CINTRA-OFC-011", "Emerson Pike"),
    ("CINTRA-OFC-012", "Finley Shore"),
    ("CINTRA-OFC-013", "Sawyer Venn"),
    ("CINTRA-OFC-014", "Dakota Ellison"),
    ("CINTRA-OFC-015", "Cameron Frost"),
    ("CINTRA-OFC-016", "Peyton Marsh"),
]

PERSON_NAMES = [
    "Alex Rivera-Demo",
    "Sam Ortega-Demo",
    "Taylor Chen-Demo",
    "Jamie Brooks-Demo",
    "Chris Nolan-Demo",
    "Pat Singh-Demo",
    "Lee Navarro-Demo",
    "Jordan Kim-Demo",
    "Morgan Diaz-Demo",
    "Casey Patel-Demo",
    "Riley Ghosh-Demo",
    "Avery Cole-Demo",
    "Quinn Shah-Demo",
    "Reese Banerjee-Demo",
    "Drew Iyer-Demo",
    "Skyler Rao-Demo",
    "Harper Das-Demo",
    "Rowan Mehta-Demo",
    "Emerson Kapoor-Demo",
    "Finley Bose-Demo",
    "Sawyer Nair-Demo",
    "Dakota Reddy-Demo",
    "Cameron Joshi-Demo",
    "Peyton Malik-Demo",
    "Blair Sen-Demo",
    "Hayden Pillai-Demo",
    "Logan Bhat-Demo",
    "Parker Iyer-Demo",
    "Reese Kulkarni-Demo",
    "Sydney Rao-Demo",
    "Marley Dasgupta-Demo",
    "Eden Sharma-Demo",
    "Frankie Gupta-Demo",
    "Shawn Banerjee-Demo",
    "Micah Verma-Demo",
    "Noah Chatterjee-Demo",
]

ROLES = ["Fraud Inquiry", "Cyber Incident", "Field Review", "Records Cross-check", "Demo Watchlist"]
RESULTS = ["MATCH", "NO_MATCH", "LOW_CONFIDENCE", "PROCESSING_ERROR"]
EVIDENCE_TYPES = ["Image", "Document", "Audio", "Video"]
ADMIN_ACTIONS = [
    "ADMIN_LOGIN",
    "VIEW_OFFICER",
    "VIEW_PERSON",
    "VIEW_RECOGNITION",
    "VIEW_EVIDENCE",
    "VIEW_AUDIT_LOG",
    "CREATE_OFFICER",
    "DISABLE_OFFICER",
    "EXPORT_REPORT",
    "CHANGE_SETTING",
    "LOGOUT",
]


def _ensure_setting(db, key: str, value: str) -> None:
    row = db.query(SystemSetting).filter_by(key=key).first()
    if not row:
        db.add(SystemSetting(key=key, value=value))


def _set_setting(db, key: str, value: str) -> None:
    row = db.query(SystemSetting).filter_by(key=key).first()
    if row:
        row.value = value
    else:
        db.add(SystemSetting(key=key, value=value))


def _jitter(days_ago_max: int, hours_span: int = 20) -> datetime:
    now = datetime.utcnow()
    days = RNG.randint(0, days_ago_max)
    hours = RNG.randint(0, hours_span)
    minutes = RNG.randint(0, 59)
    return now - timedelta(days=days, hours=hours, minutes=minutes)


def seed_admin_data() -> None:
    ensure_schema()
    seed_database()
    with SessionLocal() as db:
        already = db.query(SystemSetting).filter_by(key="admin_seed_version").first()
        _seed_admins(db)
        _seed_officers(db)
        _seed_extra_persons(db)
        _seed_face_metadata(db)
        _ensure_setting(db, "recognition_threshold", "0.40")
        _set_setting(db, "otp_expiry_seconds", "60")
        _ensure_setting(db, "otp_max_attempts", "3")
        _set_setting(db, "session_timeout_seconds", "60")
        db.commit()
        if already and already.value == SEED_VERSION:
            db.commit()
            return
        _seed_events_and_evidence(db)
        _seed_investigations(db)
        _seed_audit(db)
        _ensure_setting(db, "admin_seed_version", SEED_VERSION)
        db.commit()


def _seed_admins(db) -> None:
    specs = [
        ("CINTRA-ADM-001", "Amina Solace", "SUPER_ADMIN", "+15550001001", "amina.solace@demo.cintra.local"),
        ("CINTRA-ADM-002", "Victor Hale", "ADMIN", "+15550001002", "victor.hale@demo.cintra.local"),
        ("CINTRA-AUD-001", "Priya Quartz", "AUDITOR", "+15550001003", "priya.quartz@demo.cintra.local"),
    ]
    for admin_user_id, name, role, phone, email in specs:
        if not db.query(AdminAccount).filter_by(admin_user_id=admin_user_id).first():
            db.add(
                AdminAccount(
                    admin_user_id=admin_user_id,
                    display_name=name,
                    role=role,
                    phone_number=phone,
                    email=email,
                    status="ACTIVE",
                )
            )


def _seed_officers(db) -> None:
    designations = ["Inspector", "Sub-Inspector", "Analyst", "Field Officer"]
    for index, (officer_id, name) in enumerate(OFFICER_NAMES):
        if db.query(Officer).filter_by(officer_id=officer_id).first():
            continue
        created = datetime.utcnow() - timedelta(days=40 - index)
        db.add(
            Officer(
                officer_id=officer_id,
                name=name,
                unit=UNITS[index % len(UNITS)],
                designation=designations[index % len(designations)],
                phone_number=f"+1555010{index:04d}",
                email=f"{officer_id.lower().replace('-', '.')}@demo.cintra.local",
                status="ACTIVE" if index % 11 else "SUSPENDED",
                created_at=created,
                last_login_at=created + timedelta(days=RNG.randint(1, 20)),
                data_origin="DEMO_SEEDED",
            )
        )
    off001 = db.query(Officer).filter_by(officer_id="OFF001").first()
    if off001:
        off001.status = "ACTIVE"


def _seed_extra_persons(db) -> None:
    for index, name in enumerate(PERSON_NAMES, start=1):
        code = f"P-DEMO-{index:03d}"
        if db.query(Suspect).filter_by(suspect_code=code).first():
            continue
        enrolled = datetime.utcnow() - timedelta(days=RNG.randint(8, 45), hours=RNG.randint(0, 20))
        db.add(
            Suspect(
                suspect_code=code,
                name=name,
                role=ROLES[index % len(ROLES)],
                wanted=index % 5 == 0,
                active=True,
                created_at=enrolled,
                enrollment_status="DEMO_SEEDED",
                enrollment_date=enrolled,
                reference_image_count=RNG.randint(0, 3),
                include_in_officer_directory=False,
                data_origin="DEMO_SEEDED",
            )
        )


def _seed_face_metadata(db) -> None:
    persons = db.query(Suspect).all()
    for person in persons:
        if db.query(FaceRepresentation).filter_by(person_id=person.id).first():
            continue
        kind = "REAL_ENROLLMENT" if person.include_in_officer_directory and person.image_path else "DEMO_SEEDED"
        db.add(
            FaceRepresentation(
                person_id=person.id,
                model_name="sface",
                model_version="2021dec",
                enrollment_kind=kind,
                reference_image_path=person.image_path,
                quality_score=round(RNG.uniform(0.55, 0.92), 2) if kind == "REAL_ENROLLMENT" else None,
                created_at=person.enrollment_date or person.created_at,
            )
        )


def _score_for(result: str) -> float | None:
    if result == "MATCH":
        return round(RNG.uniform(0.82, 0.97) * 100, 1)
    if result == "NO_MATCH":
        return round(RNG.uniform(0.15, 0.69) * 100, 1)
    if result == "LOW_CONFIDENCE":
        return round(RNG.uniform(0.50, 0.79) * 100, 1)
    return None


def _seed_events_and_evidence(db) -> None:
    if db.query(RecognitionEvent).filter_by(data_origin="DEMO_SEEDED").count() >= 150:
        return
    officers = db.query(Officer).all()
    persons = db.query(Suspect).all()
    events = []
    for index in range(220):
        result = RNG.choices(RESULTS, weights=[38, 40, 14, 8], k=1)[0]
        officer = RNG.choice(officers)
        person = RNG.choice(persons) if result in {"MATCH", "LOW_CONFIDENCE"} else (RNG.choice(persons) if RNG.random() < 0.2 else None)
        enrolled = person.enrollment_date if person and person.enrollment_date else datetime.utcnow() - timedelta(days=30)
        ts = _jitter(18)
        if person and ts < enrolled:
            ts = enrolled + timedelta(hours=RNG.randint(1, 48))
        if index < 18:
            ts = datetime.utcnow() - timedelta(hours=RNG.randint(0, 12), minutes=RNG.randint(0, 50))
        elif index < 40:
            ts = datetime.utcnow() - timedelta(days=1, hours=RNG.randint(0, 20))
        event = RecognitionEvent(
            event_id=f"EVT-DEMO-{index:04d}",
            officer_id=officer.id,
            officer_code=officer.officer_id,
            person_id=person.id if person else None,
            person_code=person.suspect_code if person else None,
            timestamp=ts,
            match_result=result,
            confidence=_score_for(result),
            threshold_used=0.40,
            model_version="sface-2021dec",
            processing_duration_ms=RNG.randint(80, 900),
            status="COMPLETED" if result != "PROCESSING_ERROR" else "ERROR",
            message="SYNTHETIC demo recognition event",
            data_origin="DEMO_SEEDED",
        )
        db.add(event)
        events.append(event)
    db.flush()
    previous = None
    for index in range(80):
        event = events[index * 2]
        captured = event.timestamp + timedelta(minutes=RNG.randint(1, 25))
        payload = f"demo-evidence-{index}-{event.event_id}".encode("utf-8")
        file_hash = hashlib.sha256(payload).hexdigest()
        evidence_id = f"EVD-DEMO-{index:04d}"
        record_hash = compute_record_hash(evidence_id, file_hash, previous, captured)
        record = EvidenceRecord(
            evidence_id=evidence_id,
            recognition_event_id=event.id,
            officer_id=event.officer_id,
            officer_code=event.officer_code,
            evidence_type=EVIDENCE_TYPES[index % len(EVIDENCE_TYPES)],
            file_path=None,
            original_filename=f"demo_{index}.bin",
            captured_at=captured,
            created_at=captured,
            sha256_hash=file_hash,
            previous_record_hash=previous,
            record_hash=record_hash,
            integrity_status="HASHED",
            chain_reference=f"COR-{evidence_id}",
            data_origin="DEMO_SEEDED",
        )
        db.add(record)
        previous = record_hash
        event.evidence_records.append(record)


def _seed_investigations(db) -> None:
    if db.query(Investigation).count() >= 10:
        return
    officers = db.query(Officer).all()
    persons = db.query(Suspect).all()
    events = db.query(RecognitionEvent).filter_by(data_origin="DEMO_SEEDED").order_by(RecognitionEvent.timestamp).all()
    evidence = db.query(EvidenceRecord).filter_by(data_origin="DEMO_SEEDED").all()
    for index in range(15):
        case_id = f"CASE-2026-{index + 1:04d}"
        if db.query(Investigation).filter_by(case_id=case_id).first():
            continue
        officer = officers[index % len(officers)]
        person = persons[index % len(persons)]
        created = person.enrollment_date or (datetime.utcnow() - timedelta(days=20))
        inv = Investigation(
            case_id=case_id,
            title=f"Demo inquiry {index + 1} / {person.suspect_code}",
            status=RNG.choice(["OPEN", "OPEN", "REVIEW", "CLOSED"]),
            officer_id=officer.id,
            person_id=person.id,
            summary="SYNTHETIC investigation record for CINTRA admin portal demonstration.",
            created_at=created,
            data_origin="DEMO_SEEDED",
        )
        db.add(inv)
        db.flush()
        event = events[index * 5] if events else None
        ev = evidence[index * 3] if evidence else None
        links = [
            InvestigationLink(
                investigation_id=inv.id,
                resource_type="enrollment",
                resource_id=person.suspect_code,
                occurred_at=created,
                label="Enrollment",
            )
        ]
        if event:
            links.append(
                InvestigationLink(
                    investigation_id=inv.id,
                    resource_type="recognition",
                    resource_id=event.event_id,
                    occurred_at=event.timestamp,
                    label="Recognition Event",
                )
            )
        if ev:
            links.append(
                InvestigationLink(
                    investigation_id=inv.id,
                    resource_type="evidence",
                    resource_id=ev.evidence_id,
                    occurred_at=ev.captured_at,
                    label="Evidence Created",
                )
            )
            links.append(
                InvestigationLink(
                    investigation_id=inv.id,
                    resource_type="hash",
                    resource_id=ev.sha256_hash[:16],
                    occurred_at=ev.captured_at + timedelta(seconds=2),
                    label="Hash Generated",
                )
            )
            links.append(
                InvestigationLink(
                    investigation_id=inv.id,
                    resource_type="integrity",
                    resource_id=ev.chain_reference or ev.evidence_id,
                    occurred_at=ev.captured_at + timedelta(seconds=5),
                    label="Record Verified",
                )
            )
        links.append(
            InvestigationLink(
                investigation_id=inv.id,
                resource_type="admin_review",
                resource_id="CINTRA-ADM-002",
                occurred_at=created + timedelta(days=2, hours=3),
                label="Admin Review",
            )
        )
        db.add_all(links)


def _seed_audit(db) -> None:
    if db.query(AdminAuditLog).filter(AdminAuditLog.metadata_json.like("%seeded%")).count() >= 100:
        return
    admins = db.query(AdminAccount).all()
    officers = db.query(Officer).all()
    for index in range(140):
        admin = admins[index % len(admins)]
        action = ADMIN_ACTIONS[index % len(ADMIN_ACTIONS)]
        ts = datetime.utcnow() - timedelta(days=RNG.randint(0, 16), hours=RNG.randint(0, 20), minutes=index % 50)
        db.add(
            AdminAuditLog(
                admin_id=admin.id,
                action=action,
                resource_type="officer" if "OFFICER" in action else "recognition",
                resource_id=officers[index % len(officers)].officer_id,
                timestamp=ts,
                result="SUCCESS" if index % 9 else "FAILED",
                metadata_json='{"seeded": true, "demo": true}',
            )
        )


def main():
    seed_admin_data()
    print("CINTRA SYNTHETIC/DEMO admin dataset seeded (idempotent).")


if __name__ == "__main__":
    main()
