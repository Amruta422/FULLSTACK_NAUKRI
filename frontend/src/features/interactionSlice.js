import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const fetchInitialData = createAsyncThunk('crm/fetchInitialData', async () => {
  const [hcpResponse, interactionResponse] = await Promise.all([
    fetch(`${API_BASE}/api/hcps`),
    fetch(`${API_BASE}/api/interactions`),
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
  const response = await fetch(`${API_BASE}/api/interactions`, {
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
  const response = await fetch(`${API_BASE}/api/agent/message`, {
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
    hcps: [],
    interactions: [],
    chat: [
      {
        role: 'assistant',
        content: 'Tell me about the HCP conversation and I will turn it into a CRM interaction log.',
      },
    ],
    selectedHcpId: 1,
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchInitialData.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchInitialData.fulfilled, (state, action) => {
        state.status = 'idle';
        state.hcps = action.payload.hcps;
        state.interactions = action.payload.interactions;
        state.selectedHcpId = action.payload.hcps[0]?.id || 1;
      })
      .addCase(fetchInitialData.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message;
      })
      .addCase(createInteraction.pending, (state) => {
        state.status = 'saving';
      })
      .addCase(createInteraction.fulfilled, (state, action) => {
        state.status = 'idle';
        state.interactions.unshift(action.payload);
      })
      .addCase(createInteraction.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message;
      })
      .addCase(sendAgentMessage.pending, (state) => {
        state.status = 'thinking';
      })
      .addCase(sendAgentMessage.fulfilled, (state, action) => {
        state.status = 'idle';
        state.chat.push({ role: 'assistant', content: action.payload.response });
        if (action.payload.interaction) {
          state.interactions = [
            action.payload.interaction,
            ...state.interactions.filter((item) => item.id !== action.payload.interaction.id),
          ];
        }
      })
      .addCase(sendAgentMessage.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.error.message;
        state.chat.push({ role: 'assistant', content: 'I could not reach the AI service. Please check the backend.' });
      });
  },
});

export const { addUserMessage, selectHcp } = interactionSlice.actions;
export default interactionSlice.reducer;
