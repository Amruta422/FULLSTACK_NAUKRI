import os
import re
from typing import Annotated, TypedDict

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_groq import ChatGroq
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition
from sqlalchemy.orm import Session

from .models import Interaction
from .tools import build_sales_tools


SYSTEM_PROMPT = """You are an AI-first life sciences CRM assistant for field representatives.
Help log, edit, and reason about Healthcare Professional interactions.
Use tools for HCP search, history lookup, compliance checks, next-best-action suggestions,
interaction logging, and interaction editing. Keep outputs concise and compliant."""


class AgentState(TypedDict):
    messages: Annotated[list, add_messages]


def _latest_interaction(db: Session) -> Interaction | None:
    return db.query(Interaction).order_by(Interaction.created_at.desc()).first()


def _fallback_response(db: Session, message: str, hcp_id: int | None, rep_name: str) -> str:
    summary = message.strip()
    if not summary:
        return "Tell me what happened with the HCP and I can create a structured interaction log."

    interaction_type = "chat"
    if re.search(r"\b(call|phone)\b", summary, re.I):
        interaction_type = "call"
    elif re.search(r"\b(email|mail)\b", summary, re.I):
        interaction_type = "email"
    elif re.search(r"\b(meeting|visit|lunch)\b", summary, re.I):
        interaction_type = "in-person"

    target_hcp_id = hcp_id or 1
    tools = {tool.name: tool for tool in build_sales_tools(db)}
    interaction = tools["log_interaction"].invoke(
        {
            "hcp_id": target_hcp_id,
            "rep_name": rep_name,
            "interaction_type": interaction_type,
            "discussion_summary": summary,
            "products_discussed": _extract_after(summary, "product") or "",
            "sentiment": "positive" if re.search(r"\b(interested|positive|agreed)\b", summary, re.I) else "neutral",
            "objections": _extract_after(summary, "objection") or "",
            "samples_requested": "requested" if "sample" in summary.lower() else "",
            "next_steps": _extract_after(summary, "next") or "Follow up with approved materials.",
        }
    )
    nba = tools["suggest_next_best_action"].invoke({"hcp_id": target_hcp_id, "summary": summary})
    return (
        f"Logged interaction #{interaction['id']} for HCP #{target_hcp_id}. "
        f"AI summary: {interaction['ai_summary']} Next best action: {nba['next_best_action']}"
    )


def _extract_after(text: str, marker: str) -> str | None:
    match = re.search(rf"{marker}[:\s-]+([^.;]+)", text, re.I)
    return match.group(1).strip() if match else None


def run_agent(db: Session, message: str, hcp_id: int | None, rep_name: str) -> tuple[str, Interaction | None]:
    tools = build_sales_tools(db)
    api_key = os.getenv("GROQ_API_KEY")

    if not api_key:
        response = _fallback_response(db, message, hcp_id, rep_name)
        return response, _latest_interaction(db)

    llm = ChatGroq(
        api_key=api_key,
        model=os.getenv("GROQ_MODEL", "gemma2-9b-it"),
        temperature=0.2,
    ).bind_tools(tools)

    def assistant(state: AgentState):
        return {"messages": [llm.invoke(state["messages"])]}

    graph = StateGraph(AgentState)
    graph.add_node("assistant", assistant)
    graph.add_node("tools", ToolNode(tools))
    graph.add_edge(START, "assistant")
    graph.add_conditional_edges("assistant", tools_condition, {"tools": "tools", END: END})
    graph.add_edge("tools", "assistant")
    app = graph.compile()

    result = app.invoke(
        {
            "messages": [
                SystemMessage(content=SYSTEM_PROMPT),
                HumanMessage(
                    content=(
                        f"Rep: {rep_name}. Preferred HCP ID: {hcp_id or 'unknown'}. "
                        f"User request: {message}"
                    )
                ),
            ]
        },
        {"recursion_limit": 8},
    )
    last_message = result["messages"][-1]
    return str(last_message.content), _latest_interaction(db)
