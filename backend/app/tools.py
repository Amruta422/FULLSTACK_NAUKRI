from datetime import date

from langchain_core.tools import tool
from sqlalchemy.orm import Session

from .models import HCP, Interaction


def _serialize_interaction(interaction: Interaction) -> dict:
    return {
        "id": interaction.id,
        "hcp_id": interaction.hcp_id,
        "rep_name": interaction.rep_name,
        "interaction_type": interaction.interaction_type,
        "interaction_date": interaction.interaction_date,
        "products_discussed": interaction.products_discussed,
        "discussion_summary": interaction.discussion_summary,
        "sentiment": interaction.sentiment,
        "objections": interaction.objections,
        "samples_requested": interaction.samples_requested,
        "next_steps": interaction.next_steps,
        "ai_summary": interaction.ai_summary,
        "compliance_flags": interaction.compliance_flags,
    }


def build_sales_tools(db: Session):
    @tool
    def search_hcp(name_or_specialty: str) -> list[dict]:
        """Find HCP records by name, specialty, institution, or territory."""
        term = f"%{name_or_specialty}%"
        rows = (
            db.query(HCP)
            .filter(
                HCP.name.ilike(term)
                | HCP.specialty.ilike(term)
                | HCP.institution.ilike(term)
                | HCP.territory.ilike(term)
            )
            .limit(5)
            .all()
        )
        return [
            {
                "id": hcp.id,
                "name": hcp.name,
                "specialty": hcp.specialty,
                "institution": hcp.institution,
                "territory": hcp.territory,
            }
            for hcp in rows
        ]

    @tool
    def retrieve_interaction_history(hcp_id: int) -> list[dict]:
        """Fetch recent interactions for an HCP to ground the next field conversation."""
        rows = (
            db.query(Interaction)
            .filter(Interaction.hcp_id == hcp_id)
            .order_by(Interaction.created_at.desc())
            .limit(5)
            .all()
        )
        return [_serialize_interaction(row) for row in rows]

    @tool
    def check_compliance(summary: str) -> dict:
        """Flag language that may need medical, legal, or regulatory review."""
        risky_terms = ["guarantee", "cure", "off-label", "kickback", "free vacation"]
        found = [term for term in risky_terms if term in summary.lower()]
        return {
            "status": "review_required" if found else "clear",
            "flags": found,
            "guidance": "Escalate flagged claims before final submission." if found else "No obvious risky wording detected.",
        }

    @tool
    def suggest_next_best_action(hcp_id: int, summary: str) -> dict:
        """Recommend a sales follow-up action based on HCP context and interaction content."""
        history_count = db.query(Interaction).filter(Interaction.hcp_id == hcp_id).count()
        if "sample" in summary.lower():
            action = "Confirm sample eligibility and schedule a follow-up on product experience."
        elif history_count == 0:
            action = "Send approved introductory materials and book a needs-discovery visit."
        else:
            action = "Share targeted clinical evidence and confirm the next discussion topic."
        return {"next_best_action": action, "basis": f"{history_count} prior interaction(s) found."}

    @tool
    def log_interaction(
        hcp_id: int,
        rep_name: str,
        interaction_type: str,
        discussion_summary: str,
        products_discussed: str = "",
        sentiment: str = "neutral",
        objections: str = "",
        samples_requested: str = "",
        next_steps: str = "",
    ) -> dict:
        """Create a structured interaction log from chat or form data."""
        compliance = check_compliance.invoke({"summary": discussion_summary})
        interaction = Interaction(
            hcp_id=hcp_id,
            rep_name=rep_name,
            interaction_type=interaction_type,
            interaction_date=str(date.today()),
            products_discussed=products_discussed,
            discussion_summary=discussion_summary,
            sentiment=sentiment,
            objections=objections,
            samples_requested=samples_requested,
            next_steps=next_steps,
            ai_summary=discussion_summary[:500],
            compliance_flags=", ".join(compliance["flags"]),
        )
        db.add(interaction)
        db.commit()
        db.refresh(interaction)
        return _serialize_interaction(interaction)

    @tool
    def edit_interaction(interaction_id: int, field: str, value: str) -> dict:
        """Modify a field on an existing interaction after rep review or HCP follow-up."""
        allowed_fields = {
            "rep_name",
            "interaction_type",
            "interaction_date",
            "products_discussed",
            "discussion_summary",
            "sentiment",
            "objections",
            "samples_requested",
            "next_steps",
            "ai_summary",
            "compliance_flags",
        }
        if field not in allowed_fields:
            return {"error": f"Field '{field}' cannot be edited."}
        interaction = db.get(Interaction, interaction_id)
        if interaction is None:
            return {"error": "Interaction not found."}
        setattr(interaction, field, value)
        db.commit()
        db.refresh(interaction)
        return _serialize_interaction(interaction)

    return [
        search_hcp,
        retrieve_interaction_history,
        check_compliance,
        suggest_next_best_action,
        log_interaction,
        edit_interaction,
    ]
