from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Suspect(Base):
    __tablename__ = "suspects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)

    suspect_code: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        index=True,
        nullable=False,
    )

    name: Mapped[str] = mapped_column(
        String(120),
        nullable=False,
    )

    role: Mapped[str] = mapped_column(
        String(160),
        nullable=False,
    )

    wanted: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    image_path: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )


class Evidence(Base):
    """
    Stores the canonical metadata for an uploaded evidence item.

    The actual evidence file remains on the backend filesystem.
    The SHA-256 hash represents the exact file that was registered.
    """

    __tablename__ = "evidence"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    evidence_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
    )

    case_id: Mapped[str | None] = mapped_column(
        String(64),
        index=True,
        nullable=True,
    )

    filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    original_filename: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    evidence_type: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
    )

    mime_type: Mapped[str | None] = mapped_column(
        String(120),
        nullable=True,
    )

    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False,
    )

    sha256: Mapped[str] = mapped_column(
        String(64),
        index=True,
        nullable=False,
    )

    size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    original_badge_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    current_custodian: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(40),
        default="IN_CUSTODY",
        nullable=False,
    )

    registered_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class CustodyEvent(Base):
    """
    Append-only-style audit events for an evidence item.

    These records form the foundation for the later
    Hyperledger Fabric blockchain integration.
    """

    __tablename__ = "custody_events"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
    )

    event_id: Mapped[str] = mapped_column(
        String(64),
        unique=True,
        index=True,
        nullable=False,
    )

    evidence_id: Mapped[str] = mapped_column(
        String(64),
        ForeignKey("evidence.evidence_id"),
        index=True,
        nullable=False,
    )

    action: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
    )

    actor_badge_id: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    from_custodian: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    to_custodian: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
    )

    reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    file_sha256: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )

    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    blockchain_tx_id: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
    )

    blockchain_status: Mapped[str] = mapped_column(
        String(40),
        default="NOT_RECORDED",
        nullable=False,
    )