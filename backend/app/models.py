from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class Suspect(Base):
    __tablename__ = "suspects"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    suspect_code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(160), nullable=False)
    wanted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    enrollment_status: Mapped[str] = mapped_column(String(32), default="REAL_ENROLLMENT", index=True, nullable=False)
    enrollment_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    reference_image_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    include_in_officer_directory: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    data_origin: Mapped[str] = mapped_column(String(32), default="OPERATIONAL", index=True, nullable=False)

    representations = relationship("FaceRepresentation", back_populates="person")
    recognition_events = relationship("RecognitionEvent", back_populates="person")


class Officer(Base):
    __tablename__ = "officers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    officer_id: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    unit: Mapped[str] = mapped_column(String(120), nullable=False)
    designation: Mapped[str] = mapped_column(String(120), nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(32), nullable=True)
    email: Mapped[str | None] = mapped_column(String(160), nullable=True)
    status: Mapped[str] = mapped_column(String(24), default="ACTIVE", index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    data_origin: Mapped[str] = mapped_column(String(32), default="DEMO_SEEDED", nullable=False)

    recognition_events = relationship("RecognitionEvent", back_populates="officer")
    evidence_records = relationship("EvidenceRecord", back_populates="officer")


class FaceRepresentation(Base):
    __tablename__ = "face_representations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    person_id: Mapped[int] = mapped_column(ForeignKey("suspects.id"), index=True, nullable=False)
    model_name: Mapped[str] = mapped_column(String(80), nullable=False)
    model_version: Mapped[str] = mapped_column(String(80), nullable=False)
    enrollment_kind: Mapped[str] = mapped_column(String(32), nullable=False)
    reference_image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    person = relationship("Suspect", back_populates="representations")


class RecognitionEvent(Base):
    __tablename__ = "recognition_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    officer_id: Mapped[int | None] = mapped_column(ForeignKey("officers.id"), index=True, nullable=True)
    officer_code: Mapped[str | None] = mapped_column(String(40), index=True, nullable=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("suspects.id"), index=True, nullable=True)
    person_code: Mapped[str | None] = mapped_column(String(40), index=True, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    match_result: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    threshold_used: Mapped[float | None] = mapped_column(Float, nullable=True)
    model_version: Mapped[str] = mapped_column(String(80), default="sface-2021dec", nullable=False)
    processing_duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="COMPLETED", nullable=False)
    message: Mapped[str | None] = mapped_column(String(255), nullable=True)
    data_origin: Mapped[str] = mapped_column(String(32), default="OPERATIONAL", index=True, nullable=False)

    officer = relationship("Officer", back_populates="recognition_events")
    person = relationship("Suspect", back_populates="recognition_events")
    evidence_records = relationship("EvidenceRecord", back_populates="recognition_event")


class EvidenceRecord(Base):
    __tablename__ = "evidence_records"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    evidence_id: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    recognition_event_id: Mapped[int | None] = mapped_column(ForeignKey("recognition_events.id"), index=True, nullable=True)
    officer_id: Mapped[int | None] = mapped_column(ForeignKey("officers.id"), index=True, nullable=True)
    officer_code: Mapped[str | None] = mapped_column(String(40), index=True, nullable=True)
    evidence_type: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    file_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    sha256_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    previous_record_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    record_hash: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    integrity_status: Mapped[str] = mapped_column(String(32), default="PENDING", index=True, nullable=False)
    chain_reference: Mapped[str | None] = mapped_column(String(80), nullable=True)
    data_origin: Mapped[str] = mapped_column(String(32), default="OPERATIONAL", nullable=False)

    recognition_event = relationship("RecognitionEvent", back_populates="evidence_records")
    officer = relationship("Officer", back_populates="evidence_records")


class Investigation(Base):
    __tablename__ = "investigations"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    case_id: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="OPEN", index=True, nullable=False)
    officer_id: Mapped[int | None] = mapped_column(ForeignKey("officers.id"), index=True, nullable=True)
    person_id: Mapped[int | None] = mapped_column(ForeignKey("suspects.id"), index=True, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    data_origin: Mapped[str] = mapped_column(String(32), default="DEMO_SEEDED", nullable=False)

    officer = relationship("Officer")
    person = relationship("Suspect")
    links = relationship("InvestigationLink", back_populates="investigation", cascade="all, delete-orphan")


class InvestigationLink(Base):
    __tablename__ = "investigation_links"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    investigation_id: Mapped[int] = mapped_column(ForeignKey("investigations.id"), index=True, nullable=False)
    resource_type: Mapped[str] = mapped_column(String(40), nullable=False)
    resource_id: Mapped[str] = mapped_column(String(40), index=True, nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    label: Mapped[str] = mapped_column(String(160), nullable=False)

    investigation = relationship("Investigation", back_populates="links")


class AdminAccount(Base):
    __tablename__ = "admin_accounts"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_user_id: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    role: Mapped[str] = mapped_column(String(24), index=True, nullable=False)
    phone_number: Mapped[str] = mapped_column(String(32), nullable=False)
    email: Mapped[str] = mapped_column(String(160), nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="ACTIVE", index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    otp_requests = relationship("AdminOtpRequest", back_populates="admin")
    sessions = relationship("AdminSession", back_populates="admin")
    audit_logs = relationship("AdminAuditLog", back_populates="admin")


class AdminOtpRequest(Base):
    __tablename__ = "admin_otp_requests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("admin_accounts.id"), index=True, nullable=False)
    request_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    otp_provider: Mapped[str] = mapped_column(String(40), nullable=False)
    otp_salt: Mapped[str] = mapped_column(String(64), nullable=False)
    otp_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_reference: Mapped[str | None] = mapped_column(String(80), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="SENT", index=True, nullable=False)

    admin = relationship("AdminAccount", back_populates="otp_requests")


class AdminSession(Base):
    __tablename__ = "admin_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_id: Mapped[int] = mapped_column(ForeignKey("admin_accounts.id"), index=True, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_activity_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    admin = relationship("AdminAccount", back_populates="sessions")


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    admin_id: Mapped[int | None] = mapped_column(ForeignKey("admin_accounts.id"), index=True, nullable=True)
    action: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(64), index=True, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    result: Mapped[str] = mapped_column(String(24), nullable=False)
    metadata_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    admin = relationship("AdminAccount", back_populates="audit_logs")


class SystemSetting(Base):
    __tablename__ = "system_settings"
    __table_args__ = (UniqueConstraint("key", name="uq_system_settings_key"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    key: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    value: Mapped[str] = mapped_column(String(255), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    updated_by_admin_id: Mapped[int | None] = mapped_column(ForeignKey("admin_accounts.id"), nullable=True)
