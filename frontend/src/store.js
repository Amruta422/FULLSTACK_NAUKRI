import { configureStore } from '@reduxjs/toolkit';

import interactionReducer from './features/interactionSlice.js';

export const store = configureStore({
  reducer: {
    crm: interactionReducer,
  },
});
