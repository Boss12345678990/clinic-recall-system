import { api } from './client.js';

export const recallsApi = {
  today: () => api.get('/recalls/today'),
};
