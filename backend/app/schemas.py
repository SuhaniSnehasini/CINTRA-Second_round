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
    confidence: float = Field(ge=0, le=100)

class IdentificationResponse(BaseModel):
    match: bool
    suspect: MatchedSuspectResponse | None = None
    message: str
