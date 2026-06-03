import { api } from './client.js';

export const cyclesApi = {
  sendLine: (id) => api.post(`/cycles/${id}/line`),
  recordCall: (id, body = {}) => api.post(`/cycles/${id}/calls`, body),
};
