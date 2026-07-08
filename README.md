# AI-First CRM HCP Module - Log Interaction Screen

Full-stack assignment implementation for an AI-first life sciences CRM screen where field representatives can log Healthcare Professional interactions through either a structured form or a conversational AI interface.

## Stack

- Frontend: React, Redux Toolkit, Vite, Google Inter
- Backend: Python, FastAPI, SQLAlchemy
- Agent framework: LangGraph
- LLM: Groq `gemma2-9b-it` by default, with optional `llama-3.3-70b-versatile`
- Database: PostgreSQL or MySQL through `DATABASE_URL`; SQLite is included for quick local review

## LangGraph Agent Role

The LangGraph agent coordinates the HCP interaction workflow. It turns conversational notes into structured CRM records, retrieves HCP context, checks for compliance-sensitive language, recommends next best actions, and edits interaction records when the representative asks for changes.

Implemented agent tools:

1. `log_interaction`: Captures HCP ID, rep, channel, summary, products, sentiment, objections, samples, and next steps. The LLM can call it after summarizing and extracting entities from chat.
2. `edit_interaction`: Updates approved fields on an existing interaction after rep review.
3. `search_hcp`: Finds HCP records by name, specialty, institution, or territory.
4. `retrieve_interaction_history`: Loads recent HCP interactions for context.
5. `check_compliance`: Flags risky phrases such as guarantee, cure, off-label, or kickback.
6. `suggest_next_best_action`: Recommends follow-up actions based on interaction context and history.

## Run Locally

Backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
copy .env.example .env
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Environment

Create `backend/.env`:

```env
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=gemma2-9b-it
DATABASE_URL=postgresql+psycopg://crm_user:crm_password@localhost:5432/hcp_crm
```

For MySQL:

```env
DATABASE_URL=mysql+pymysql://crm_user:crm_password@localhost:3306/hcp_crm
```

If `GROQ_API_KEY` is missing, the chat endpoint uses a deterministic fallback so reviewers can still test the logging workflow locally. For final submission, add a real Groq key so LangGraph invokes the Groq LLM.

## API

- `GET /api/hcps`: seeded HCP list
- `GET /api/interactions`: recent interaction logs
- `POST /api/interactions`: create structured form interaction
- `PATCH /api/interactions/{id}`: edit interaction fields
- `POST /api/agent/message`: conversational LangGraph logging endpoint

## Submission Notes

Push this repository to GitHub and submit the repository URL through the assignment Google Form.
