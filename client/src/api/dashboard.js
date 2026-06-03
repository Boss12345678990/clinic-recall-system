import { api } from './client.js';

export const dashboardApi = {
  get: () => api.get('/dashboard'),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (patch) => api.put('/settings', patch),
};

export const usersApi = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.patch(`/users/${id}`, data),
};
