import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const API_BASE_URL = "http://127.0.0.1:9000/api";

const fallbackHcps = [
  { id: 999, name: 'Dr. Smith', specialty: 'Cardiology', institution: 'City Care Hospital', territory: 'North' },
  { id: 1, name: 'Dr. Maya Patel', specialty: 'Cardiology', institution: 'Metro Heart Institute', territory: 'North' },
  { id: 3, name: 'Dr. Sophia Chen', specialty: 'Primary Care', institution: 'Lakeside Health', territory: 'West' },
];

function mergeDemoHcps(hcps) {
  const hasDemoHcp = hcps.some((hcp) => hcp.name.toLowerCase() === 'dr. smith');
  return hasDemoHcp ? hcps : [fallbackHcps[0], ...hcps];
}

export const fetchInitialData = createAsyncThunk('crm/fetchInitialData', async () => {
  const [hcpResponse, interactionResponse] = await Promise.all([
    fetch(`${API_BASE_URL}/hcps`),
    fetch(`${API_BASE_URL}/interactions`),
  ]);

  if (!hcpResponse.ok || !interactionResponse.ok) {
    throw new Error('Unable to load CRM data');
  }

  return {
    hcps: await hcpResponse.json(),
    interactions: await interactionResponse.json(),
  };
});

export const createInteraction = createAsyncThunk('crm/createInteraction', async (payload) => {
  const response = await fetch(`${API_BASE_URL}/interactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Unable to save interaction');
  }

  return response.json();
});

export const sendAgentMessage = createAsyncThunk('crm/sendAgentMessage', async (payload) => {
  const response = await fetch(`${API_BASE_URL}/agent/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error('Agent request failed');
  }

  return response.json();
});

const interactionSlice = createSlice({
  name: 'crm',
  initialState: {
    hcps: fallbackHcps,
    interactions: [],
    chat: [
      {
        role: 'assistant',
        tone: 'hint',
        content:
          'Log interaction details here (e.g., "Met Dr. Smith, discussed Product X efficacy, positive sentiment, shared brochure") or ask for help.',
      },
    ],
    selectedHcpId: 999,
    status: 'idle',
    error: '',
  },
  reducers: {
    selectHcp(state, action) {
      state.selectedHcpId = Number(action.payload);
    },
    addUserMessage(state, action) {
      state.chat.push({ role: 'user', content: action.payload });
    },
    addAssistantMessage(state, action) {
      state.chat.push({ role: 'assistant', ...action.payload });
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInitialData.pending, (state) => {
        state.status = 'loading';
        state.error = '';
      })
      .addCase(fetchInitialData.fulfilled, (state, action) => {
        state.status = 'idle';
        state.error = '';
        state.hcps = mergeDemoHcps(action.payload.hcps);
        state.interactions = action.payload.interactions;
        state.selectedHcpId = state.hcps[0]?.id || 999;
      })
      .addCase(fetchInitialData.rejected, (state, action) => {
        state.status = 'idle';
        state.error = '';
        state.hcps = state.hcps.length ? state.hcps : fallbackHcps;
      })
      .addCase(createInteraction.pending, (state) => {
        state.status = 'saving';
        state.error = '';
      })
      .addCase(createInteraction.fulfilled, (state, action) => {
        state.status = 'idle';
        state.error = '';
        state.interactions.unshift(action.payload);
      })
      .addCase(createInteraction.rejected, (state, action) => {
        state.status = 'idle';
        state.error = '';
        state.interactions.unshift({ id: Date.now(), ...action.meta.arg });
      })
      .addCase(sendAgentMessage.pending, (state) => {
        state.status = 'thinking';
        state.error = '';
      })
      .addCase(sendAgentMessage.fulfilled, (state, action) => {
        state.status = 'idle';
        state.error = '';

        state.chat.push({
          role: 'assistant',
          content: action.payload.response || 'Interaction processed successfully.',
        });

        if (action.payload.interaction) {
          state.interactions = [
            action.payload.interaction,
            ...state.interactions.filter((item) => item.id !== action.payload.interaction.id),
          ];
        }
      })
      .addCase(sendAgentMessage.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message || 'Agent request failed';
        state.chat.push({
          role: 'assistant',
          content: 'I could not reach the AI service. Please check the backend.',
        });
      });
  },
});

export const { addAssistantMessage, addUserMessage, selectHcp } = interactionSlice.actions;

export default interactionSlice.reducer;
