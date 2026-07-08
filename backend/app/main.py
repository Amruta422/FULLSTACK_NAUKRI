from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .agent import run_agent
from .database import Base, SessionLocal, engine, get_db
from .models import HCP, Interaction
from .schemas import ChatRequest, ChatResponse, HCPOut, InteractionCreate, InteractionOut, InteractionUpdate

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI-First HCP CRM")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def seed_hcps(db: Session) -> None:
    if db.query(HCP).count() > 0:
        return
    db.add_all(
        [
            HCP(name="Dr. Maya Patel", specialty="Cardiology", institution="Metro Heart Institute", territory="North"),
            HCP(name="Dr. Noah Williams", specialty="Endocrinology", institution="Riverbend Clinic", territory="East"),
            HCP(name="Dr. Sophia Chen", specialty="Primary Care", institution="Lakeside Health", territory="West"),
        ]
    )
    db.commit()


@app.on_event("startup")
def on_startup():
    with SessionLocal() as db:
        seed_hcps(db)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/hcps", response_model=list[HCPOut])
def list_hcps(db: Session = Depends(get_db)):
    seed_hcps(db)
    return db.query(HCP).order_by(HCP.name).all()


@app.get("/api/interactions", response_model=list[InteractionOut])
def list_interactions(db: Session = Depends(get_db)):
    return db.query(Interaction).order_by(Interaction.created_at.desc()).all()


@app.post("/api/interactions", response_model=InteractionOut)
def create_interaction(payload: InteractionCreate, db: Session = Depends(get_db)):
    if db.get(HCP, payload.hcp_id) is None:
        raise HTTPException(status_code=404, detail="HCP not found")
    interaction = Interaction(**payload.model_dump())
    db.add(interaction)
    db.commit()
    db.refresh(interaction)
    return interaction


@app.patch("/api/interactions/{interaction_id}", response_model=InteractionOut)
def update_interaction(interaction_id: int, payload: InteractionUpdate, db: Session = Depends(get_db)):
    interaction = db.get(Interaction, interaction_id)
    if interaction is None:
        raise HTTPException(status_code=404, detail="Interaction not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(interaction, field, value)
    db.commit()
    db.refresh(interaction)
    return interaction


@app.post("/api/agent/message", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)):
    response, interaction = run_agent(db, payload.message, payload.hcp_id, payload.rep_name)
    return ChatResponse(response=response, interaction=interaction)
