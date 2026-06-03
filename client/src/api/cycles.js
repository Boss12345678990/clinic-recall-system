import { api } from './client.js';

export const cyclesApi = {
  sendLine: (id) => api.post(`/cycles/${id}/line`),
  recordCall: (id, body = {}) => api.post(`/cycles/${id}/calls`, body),
  setStep: (id, step, date) => api.patch(`/cycles/${id}/step`, { step, date }),
  setStatus: (id, status) => api.patch(`/cycles/${id}/status`, { status }),
  close: (id, reason) => api.post(`/cycles/${id}/close`, { reason }),
};
