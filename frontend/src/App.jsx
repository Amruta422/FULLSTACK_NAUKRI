import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from 'react-redux';

import {
  addAssistantMessage,
  addUserMessage,
  createInteraction,
  fetchInitialData,
  selectHcp,
} from './features/interactionSlice.js';

const now = new Date();

const initialForm = {
  rep_name: 'Amruta Rep',
  hcp_name: 'Dr. Smith',
  interaction_type: 'Meeting',
  interaction_date: now.toISOString().slice(0, 10),
  interaction_time: now.toTimeString().slice(0, 5),
  attendees: '',
  products_discussed: '',
  discussion_summary: '',
  sentiment: 'neutral',
  materials_shared: '',
  samples_requested: '',
  outcomes: '',
  next_steps: '',
};

function titleCase(value) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function extractBetween(message, starters, endings) {
  const lower = message.toLowerCase();
  const start = starters
    .map((item) => ({ item, index: lower.indexOf(item) }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index)[0];

  if (!start) return '';

  let value = message.slice(start.index + start.item.length);
  const endIndex = endings
    .map((item) => value.toLowerCase().indexOf(item))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  if (endIndex !== undefined) {
    value = value.slice(0, endIndex);
  }

  return value.replace(/[.,;]+$/g, '').trim();
}

function parseInteractionMessage(message, currentForm) {
  const hcpName = extractBetween(message, ['met with ', 'met ', 'visited ', 'saw '], [' and ', ', ', ' about ', ' discussed ']);
  const discussed = extractBetween(message, ['discussed ', 'about '], ['. ', ', positive', ', neutral', ', negative', ' sentiment', ' and shared', ' shared']);
  const materials = extractBetween(message, ['shared the ', 'shared ', 'gave ', 'provided '], ['. ', ', ', ' and ']);
  const nextSteps = extractBetween(message, ['follow up with ', 'follow-up with ', 'schedule ', 'next step is '], ['. ', ', ']);
  const lower = message.toLowerCase();

  let sentiment = currentForm.sentiment;
  if (lower.includes('positive')) sentiment = 'positive';
  if (lower.includes('negative') || lower.includes('concern')) sentiment = 'negative';
  if (lower.includes('neutral')) sentiment = 'neutral';

  return {
    ...currentForm,
    hcp_name: hcpName ? titleCase(hcpName.replace(/^dr\.?/i, 'Dr.')) : currentForm.hcp_name,
    products_discussed: discussed || currentForm.products_discussed,
    discussion_summary: discussed ? `${discussed.replace(/\.$/, '')}.` : message,
    sentiment,
    materials_shared: materials ? titleCase(materials) : currentForm.materials_shared,
    next_steps: nextSteps || currentForm.next_steps,
  };
}

export default function App() {
  const dispatch = useDispatch();
  const { hcps, interactions, chat, selectedHcpId, status, error } = useSelector((state) => state.crm);
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

  function handleHcpChange(event) {
    const hcpId = Number(event.target.value);
    const hcp = hcps.find((item) => item.id === hcpId);
    dispatch(selectHcp(hcpId));
    if (hcp) {
      setForm((current) => ({ ...current, hcp_name: hcp.name }));
    }
  }

  function buildPayload(nextForm = form) {
    return {
      hcp_id: selectedHcpId,
      rep_name: nextForm.rep_name,
      interaction_type: nextForm.interaction_type.toLowerCase(),
      interaction_date: nextForm.interaction_date,
      products_discussed: nextForm.products_discussed,
      discussion_summary: nextForm.discussion_summary || nextForm.products_discussed || 'Interaction logged from assistant note.',
      sentiment: nextForm.sentiment,
      objections: nextForm.outcomes,
      samples_requested: nextForm.samples_requested,
      next_steps: nextForm.next_steps,
      ai_summary:
        nextForm.discussion_summary ||
        `${nextForm.hcp_name} interaction covering ${nextForm.products_discussed || 'field discussion'}.`,
      compliance_flags: '',
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await dispatch(createInteraction(buildPayload()));
  }

  async function handleChatSubmit(event) {
    event.preventDefault();
    const message = chatText.trim();
    if (!message) return;

    dispatch(addUserMessage(message));
    setChatText('');

    const nextForm = parseInteractionMessage(message, form);
    setForm(nextForm);

    await dispatch(createInteraction(buildPayload(nextForm)));
    dispatch(
      addAssistantMessage({
        tone: 'success',
        content:
          'Interaction logged successfully. The HCP name, topics, sentiment, and materials were populated from your summary. Would you like to add a follow-up action?',
      }),
    );
  }

  return (
    <main className="task-shell">
      <section className="interaction-board">
        <form className="interaction-form" onSubmit={handleSubmit}>
          <h1>Log HCP Interaction</h1>

          <section className="form-section">
            <h2>Interaction Details</h2>
            <div className="two-column">
              <label className="field">
                <span>HCP Name</span>
                <select value={selectedHcpId} onChange={handleHcpChange}>
                  {hcps.map((hcp) => (
                    <option key={hcp.id} value={hcp.id}>
                      {hcp.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Interaction Type</span>
                <select name="interaction_type" value={form.interaction_type} onChange={handleFormChange}>
                  <option>Meeting</option>
                  <option>Call</option>
                  <option>Email</option>
                  <option>Conference</option>
                </select>
              </label>

              <label className="field">
                <span>Date</span>
                <input name="interaction_date" type="date" value={form.interaction_date} onChange={handleFormChange} />
              </label>

              <label className="field">
                <span>Time</span>
                <input name="interaction_time" type="time" value={form.interaction_time} onChange={handleFormChange} />
              </label>
            </div>

            <label className="field">
              <span>Attendees</span>
              <input
                name="attendees"
                value={form.attendees}
                onChange={handleFormChange}
                placeholder="Enter names or search..."
              />
            </label>

            <label className="field">
              <span>Topics Discussed</span>
              <textarea
                name="products_discussed"
                value={form.products_discussed}
                onChange={handleFormChange}
                placeholder="Enter key discussion points..."
                rows="5"
              />
            </label>

            <button className="link-button" type="button">
              Microphone Summarize from Voice Note (Requires Consent)
            </button>
          </section>

          <section className="form-section">
            <h2>Materials Shared / Samples Distributed</h2>

            <div className="inline-heading">
              <h3>Materials Shared</h3>
              <button className="secondary" type="button">
                Search/Add
              </button>
            </div>
            <input
              className="plain-entry"
              name="materials_shared"
              value={form.materials_shared}
              onChange={handleFormChange}
              placeholder="No materials added."
            />

            <div className="inline-heading">
              <h3>Samples Distributed</h3>
              <button className="secondary" type="button">
                Add Sample
              </button>
            </div>
            <input
              className="plain-entry"
              name="samples_requested"
              value={form.samples_requested}
              onChange={handleFormChange}
              placeholder="No samples added."
            />
          </section>

          <section className="form-section">
            <h2>Observed/Inferred HCP Sentiment</h2>
            <div className="sentiment-row">
              {['positive', 'neutral', 'negative'].map((sentiment) => (
                <label key={sentiment}>
                  <input
                    name="sentiment"
                    type="radio"
                    value={sentiment}
                    checked={form.sentiment === sentiment}
                    onChange={handleFormChange}
                  />
                  <span>{titleCase(sentiment)}</span>
                </label>
              ))}
            </div>

            <label className="field">
              <span>Outcomes</span>
              <textarea
                name="outcomes"
                value={form.outcomes}
                onChange={handleFormChange}
                placeholder="Key outcomes or agreements..."
                rows="5"
              />
            </label>

            <label className="field">
              <span>Follow-up Actions</span>
              <textarea
                name="next_steps"
                value={form.next_steps}
                onChange={handleFormChange}
                placeholder="Add next steps, owner, and timing..."
                rows="4"
              />
            </label>

            <button className="primary save-button" type="submit" disabled={status === 'saving'}>
              Save Interaction
            </button>
          </section>
        </form>

        <aside className="assistant-panel">
          <header className="assistant-header">
            <div>
              <h2>AI Assistant</h2>
              <p>Log Interaction details here via chat</p>
            </div>
            <span className={`status ${status}`}>{status}</span>
          </header>

          {selectedHcp && (
            <div className="selected-hcp">
              <strong>{selectedHcp.name}</strong>
              <span>{selectedHcp.specialty} | {selectedHcp.institution}</span>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="assistant-messages">
            {chat.map((item, index) => (
              <div className={`message ${item.role} ${item.tone || ''}`} key={`${item.role}-${index}`}>
                {item.content}
              </div>
            ))}
          </div>

          <form className="assistant-input" onSubmit={handleChatSubmit}>
            <textarea
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              placeholder="Describe Interaction..."
              rows="2"
            />
            <button className="primary log-button" type="submit" disabled={status === 'saving'}>
              AI Log
            </button>
          </form>
        </aside>
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
