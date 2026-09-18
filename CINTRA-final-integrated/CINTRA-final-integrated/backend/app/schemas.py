from pydantic import BaseModel, Field

class HealthResponse(BaseModel):
    status: str
    service: str

class SuspectResponse(BaseModel):
    suspect_id: str
    name: str
    role: str
    wanted: bool
    image_path: str | None = None
    enrollment_status: str | None = None
    enrollment_date: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    data_origin: str | None = None
    alias: str | None = None
    dob: str | None = None
    gender: str | None = None
    nationality: str | None = None
    fir_number: str | None = None
    offence_category: str | None = None
    incident_date: str | None = None
    incident_location: str | None = None
    police_station: str | None = None
    court_name: str | None = None
    court_case_number: str | None = None
    filing_date: str | None = None
    offence_description: str | None = None
    applicable_section: str | None = None
    severity: str | None = None
    case_status: str | None = None
    judgment_date: str | None = None
    verdict: str | None = None
    sentence_type: str | None = None
    sentence_duration: str | None = None
    penalty: str | None = None
    appeal_status: str | None = None

class MatchedSuspectResponse(SuspectResponse):
    confidence: float = Field(ge=0, le=100)

class IdentificationResponse(BaseModel):
    match: bool
    suspect: MatchedSuspectResponse | None = None
    message: str
