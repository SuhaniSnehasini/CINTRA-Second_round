from datetime import datetime
from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
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
