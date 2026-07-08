from pydantic import BaseModel, ConfigDict


class HCPOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    specialty: str
    institution: str
    territory: str


class InteractionBase(BaseModel):
    hcp_id: int
    rep_name: str
    interaction_type: str
    interaction_date: str
    products_discussed: str = ""
    discussion_summary: str
    sentiment: str = "neutral"
    objections: str = ""
    samples_requested: str = ""
    next_steps: str = ""
    ai_summary: str = ""
    compliance_flags: str = ""


class InteractionCreate(InteractionBase):
    pass


class InteractionUpdate(BaseModel):
    rep_name: str | None = None
    interaction_type: str | None = None
    interaction_date: str | None = None
    products_discussed: str | None = None
    discussion_summary: str | None = None
    sentiment: str | None = None
    objections: str | None = None
    samples_requested: str | None = None
    next_steps: str | None = None
    ai_summary: str | None = None
    compliance_flags: str | None = None


class InteractionOut(InteractionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class ChatRequest(BaseModel):
    message: str
    hcp_id: int | None = None
    rep_name: str = "Field Rep"


class ChatResponse(BaseModel):
    response: str
    interaction: InteractionOut | None = None
