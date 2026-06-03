import { api } from './client.js';

export const patientsApi = {
  list: (q) => api.get(`/patients${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  get: (id) => api.get(`/patients/${id}`),
  create: (data) => api.post('/patients', data),
  update: (id, data) => api.patch(`/patients/${id}`, data),
  remove: (id) => api.del(`/patients/${id}`),
};
