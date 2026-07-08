import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from 'react-redux';

import {
  addUserMessage,
  createInteraction,
  fetchInitialData,
  selectHcp,
  sendAgentMessage,
} from './features/interactionSlice.js';

const today = new Date().toISOString().slice(0, 10);

const initialForm = {
  rep_name: 'Amruta Rep',
  interaction_type: 'in-person',
  interaction_date: today,
  products_discussed: '',
  discussion_summary: '',
  sentiment: 'neutral',
  objections: '',
  samples_requested: '',
  next_steps: '',
  ai_summary: '',
  compliance_flags: '',
};

export default function App() {
  const dispatch = useDispatch();
  const { hcps, interactions, chat, selectedHcpId, status, error } = useSelector((state) => state.crm);
  const [mode, setMode] = useState('form');
  const [form, setForm] = useState(initialForm);
  const [chatText, setChatText] = useState('');

  useEffect(() => {
    dispatch(fetchInitialData());
  }, [dispatch]);

  const selectedHcp = useMemo(
    () => hcps.find((hcp) => hcp.id === selectedHcpId),
    [hcps, selectedHcpId],
  );

  function handleFormChange(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await dispatch(createInteraction({ ...form, hcp_id: selectedHcpId }));
    setForm({ ...initialForm, rep_name: form.rep_name });
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    const message = chatText.trim();
    if (!message) return;
    dispatch(addUserMessage(message));
    setChatText('');
    await dispatch(sendAgentMessage({ message, hcp_id: selectedHcpId, rep_name: form.rep_name }));
  }

  return (
    <main className="shell">
      <section className="workspace">
        <aside className="context-panel">
          <p className="eyebrow">AI-first CRM</p>
          <h1>Log HCP Interaction</h1>
          <p className="intro">
            Capture compliant field activity with either a structured form or a LangGraph-powered chat workflow.
          </p>

          <label className="field">
            <span>Healthcare Professional</span>
            <select value={selectedHcpId} onChange={(event) => dispatch(selectHcp(event.target.value))}>
              {hcps.map((hcp) => (
                <option key={hcp.id} value={hcp.id}>
                  {hcp.name} - {hcp.specialty}
                </option>
              ))}
            </select>
          </label>

          {selectedHcp && (
            <div className="hcp-summary">
              <strong>{selectedHcp.name}</strong>
              <span>{selectedHcp.specialty}</span>
              <span>{selectedHcp.institution}</span>
              <span>Territory: {selectedHcp.territory}</span>
            </div>
          )}

          <div className="agent-tools">
            <h2>LangGraph tools</h2>
            <ul>
              <li>Log Interaction</li>
              <li>Edit Interaction</li>
              <li>Search HCP</li>
              <li>Retrieve History</li>
              <li>Compliance Check</li>
              <li>Next Best Action</li>
            </ul>
          </div>
        </aside>

        <section className="log-panel">
          <div className="toolbar">
            <div className="segmented" aria-label="Log mode">
              <button className={mode === 'form' ? 'active' : ''} onClick={() => setMode('form')} type="button">
                Structured Form
              </button>
              <button className={mode === 'chat' ? 'active' : ''} onClick={() => setMode('chat')} type="button">
                Conversational Chat
              </button>
            </div>
            <span className={`status ${status}`}>{status}</span>
          </div>

          {error && <div className="error">{error}</div>}

          {mode === 'form' ? (
            <form className="form-grid" onSubmit={handleSubmit}>
              <label className="field">
                <span>Representative</span>
                <input name="rep_name" value={form.rep_name} onChange={handleFormChange} required />
              </label>
              <label className="field">
                <span>Interaction Type</span>
                <select name="interaction_type" value={form.interaction_type} onChange={handleFormChange}>
                  <option value="in-person">In-person</option>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                  <option value="conference">Conference</option>
                </select>
              </label>
              <label className="field">
                <span>Date</span>
                <input name="interaction_date" type="date" value={form.interaction_date} onChange={handleFormChange} />
              </label>
              <label className="field">
                <span>Sentiment</span>
                <select name="sentiment" value={form.sentiment} onChange={handleFormChange}>
                  <option value="positive">Positive</option>
                  <option value="neutral">Neutral</option>
                  <option value="concerned">Concerned</option>
                </select>
              </label>
              <label className="field wide">
                <span>Products Discussed</span>
                <input name="products_discussed" value={form.products_discussed} onChange={handleFormChange} />
              </label>
              <label className="field wide">
                <span>Discussion Summary</span>
                <textarea
                  name="discussion_summary"
                  value={form.discussion_summary}
                  onChange={handleFormChange}
                  required
                  rows="5"
                />
              </label>
              <label className="field">
                <span>Objections</span>
                <textarea name="objections" value={form.objections} onChange={handleFormChange} rows="3" />
              </label>
              <label className="field">
                <span>Samples Requested</span>
                <textarea name="samples_requested" value={form.samples_requested} onChange={handleFormChange} rows="3" />
              </label>
              <label className="field wide">
                <span>Next Steps</span>
                <textarea name="next_steps" value={form.next_steps} onChange={handleFormChange} rows="3" />
              </label>
              <button className="primary" type="submit" disabled={status === 'saving'}>
                Save Interaction
              </button>
            </form>
          ) : (
            <section className="chat-panel">
              <div className="messages">
                {chat.map((item, index) => (
                  <div className={`message ${item.role}`} key={`${item.role}-${index}`}>
                    {item.content}
                  </div>
                ))}
              </div>
              <form className="chat-input" onSubmit={handleChatSubmit}>
                <input
                  value={chatText}
                  onChange={(event) => setChatText(event.target.value)}
                  placeholder="Example: Logged a call with Dr. Patel about CardioMax..."
                />
                <button className="primary" type="submit" disabled={status === 'thinking'}>
                  Send
                </button>
              </form>
            </section>
          )}
        </section>
      </section>

      <section className="history">
        <h2>Recent Interactions</h2>
        <div className="history-grid">
          {interactions.length === 0 && <p className="empty">No interactions logged yet.</p>}
          {interactions.map((interaction) => (
            <article className="interaction-card" key={interaction.id}>
              <div>
                <strong>{hcps.find((hcp) => hcp.id === interaction.hcp_id)?.name || `HCP #${interaction.hcp_id}`}</strong>
                <span>{interaction.interaction_date} - {interaction.interaction_type}</span>
              </div>
              <p>{interaction.ai_summary || interaction.discussion_summary}</p>
              <small>Next: {interaction.next_steps || 'Review and schedule follow-up'}</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
