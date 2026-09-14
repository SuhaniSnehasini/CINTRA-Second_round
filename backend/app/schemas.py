from datetime import datetime

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    service: str


class SuspectResponse(BaseModel):
    suspect_id: str
    name: str
    role: str
    wanted: bool


class MatchedSuspectResponse(SuspectResponse):
    confidence: float = Field(
        ge=0,
        le=100,
    )


class IdentificationResponse(BaseModel):
    match: bool
    suspect: MatchedSuspectResponse | None = None
    message: str


class EvidenceResponse(BaseModel):
    evidence_id: str
    case_id: str | None

    filename: str
    original_filename: str
    evidence_type: str
    mime_type: str | None
    file_path: str

    sha256: str
    size_bytes: int

    # Collector / registering officer
    original_badge_id: str | None
    collector_name: str | None
    collector_agency: str | None

    # Evidence collection details
    collection_timestamp: datetime | None
    description: str | None

    # Current custody
    current_custodian: str | None
    status: str

    registered_at: datetime

    # Fabric blockchain state
    blockchain_status: str


class CustodyEventResponse(BaseModel):
    event_id: str
    evidence_id: str
    action: str

    actor_badge_id: str | None
    from_custodian: str | None
    to_custodian: str | None

    reason: str | None

    file_sha256: str
    timestamp: datetime

    blockchain_tx_id: str | None
    blockchain_status: str


class EvidenceCustodyResponse(BaseModel):
    evidence: EvidenceResponse
    events: list[CustodyEventResponse]


class EvidenceVerifyResponse(BaseModel):
    evidence_id: str
    stored_sha256: str
    current_sha256: str
    verified: bool
    message: str