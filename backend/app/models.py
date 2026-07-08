from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class HCP(Base):
    __tablename__ = "hcps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    specialty: Mapped[str] = mapped_column(String(120), nullable=False)
    institution: Mapped[str] = mapped_column(String(160), nullable=False)
    territory: Mapped[str] = mapped_column(String(80), nullable=False)

    interactions: Mapped[list["Interaction"]] = relationship(back_populates="hcp")


class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    hcp_id: Mapped[int] = mapped_column(ForeignKey("hcps.id"), nullable=False, index=True)
    rep_name: Mapped[str] = mapped_column(String(120), nullable=False)
    interaction_type: Mapped[str] = mapped_column(String(60), nullable=False)
    interaction_date: Mapped[str] = mapped_column(String(30), nullable=False)
    products_discussed: Mapped[str] = mapped_column(Text, nullable=False, default="")
    discussion_summary: Mapped[str] = mapped_column(Text, nullable=False)
    sentiment: Mapped[str] = mapped_column(String(40), nullable=False, default="neutral")
    objections: Mapped[str] = mapped_column(Text, nullable=False, default="")
    samples_requested: Mapped[str] = mapped_column(Text, nullable=False, default="")
    next_steps: Mapped[str] = mapped_column(Text, nullable=False, default="")
    ai_summary: Mapped[str] = mapped_column(Text, nullable=False, default="")
    compliance_flags: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    hcp: Mapped[HCP] = relationship(back_populates="interactions")
