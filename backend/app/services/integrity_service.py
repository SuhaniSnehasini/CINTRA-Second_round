import hashlib
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from ..config import BASE_DIR
from ..models import EvidenceRecord, Officer, RecognitionEvent


def compute_record_hash(evidence_id: str, file_hash: str, previous_hash: str | None, timestamp: datetime) -> str:
    material = f"{evidence_id}|{file_hash}|{previous_hash or 'GENESIS'}|{timestamp.isoformat()}".encode("utf-8")
    return hashlib.sha256(material).hexdigest()


def latest_record_hash(db: Session) -> str | None:
    row = db.query(EvidenceRecord).order_by(EvidenceRecord.id.desc()).first()
    return row.record_hash if row else None


def attach_chain(db: Session, evidence: EvidenceRecord) -> None:
    evidence.previous_record_hash = latest_record_hash(db)
    evidence.record_hash = compute_record_hash(
        evidence.evidence_id,
        evidence.sha256_hash,
        evidence.previous_record_hash,
        evidence.captured_at,
    )
    evidence.chain_reference = f"COR-{evidence.evidence_id}"
    evidence.integrity_status = "HASHED"


def resolve_file(path: str | None) -> Path | None:
    if not path:
        return None
    candidate = Path(path)
    if not candidate.is_absolute():
        candidate = BASE_DIR / path
    return candidate if candidate.is_file() else None


def verify_evidence(db: Session, evidence: EvidenceRecord) -> dict:
    file_path = resolve_file(evidence.file_path)
    file_ok = None
    computed_file_hash = None
    if file_path:
        computed_file_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()
        file_ok = computed_file_hash == evidence.sha256_hash
    expected_record = compute_record_hash(
        evidence.evidence_id,
        evidence.sha256_hash,
        evidence.previous_record_hash,
        evidence.captured_at,
    )
    chain_ok = expected_record == evidence.record_hash
    if file_ok is False or not chain_ok:
        evidence.integrity_status = "FAILED"
        status = "FAILED"
    elif file_ok is True and chain_ok:
        evidence.integrity_status = "VERIFIED"
        status = "VERIFIED"
    elif file_ok is None and chain_ok:
        evidence.integrity_status = "CHAIN_VERIFIED"
        status = "CHAIN_VERIFIED"
    else:
        evidence.integrity_status = "PENDING"
        status = "PENDING"
    db.commit()
    db.refresh(evidence)
    return {
        "evidence_id": evidence.evidence_id,
        "integrity_status": status,
        "file_present": file_path is not None,
        "file_hash_matches": file_ok,
        "stored_sha256": evidence.sha256_hash,
        "computed_file_sha256": computed_file_hash,
        "record_hash": evidence.record_hash,
        "previous_record_hash": evidence.previous_record_hash,
        "chain_reference": evidence.chain_reference,
        "chain_hash_matches": chain_ok,
        "mechanism": "CHAIN-OF-RECORD / INTEGRITY VERIFICATION",
        "blockchain_claimed": False,
        "verified_at": datetime.utcnow().isoformat() + "Z",
    }


def lookup_officer(db: Session, officer_code: str | None) -> Officer | None:
    if not officer_code:
        return None
    return db.query(Officer).filter_by(officer_id=officer_code.strip()).first()


def lookup_event(db: Session, event_id: str | None) -> RecognitionEvent | None:
    if not event_id:
        return None
    return db.query(RecognitionEvent).filter_by(event_id=event_id.strip()).first()
