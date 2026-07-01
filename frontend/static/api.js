// API client — all calls go through here

const API_BASE = '';  // same origin

let _token = localStorage.getItem('al_token') || '';

function setToken(t) {
  _token = t;
  if (t) localStorage.setItem('al_token', t);
  else    localStorage.removeItem('al_token');
}

async function apiFetch(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const res = await fetch(API_BASE + path, { ...opts, headers });

  if (res.status === 401) {
    setToken('');
    showAuth();
    throw new Error('Sessão expirada');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Erro desconhecido');
  }
  if (res.status === 204) return null;
  return res.json();
}

const api = {
  // Auth
  setupNeeded:     ()         => apiFetch('/api/auth/setup-needed'),
  login:           (u, p)     => apiFetch('/api/auth/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:`username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}` }),
  register:        (d)        => apiFetch('/api/auth/register', { method:'POST', body: JSON.stringify(d) }),
  me:              ()         => apiFetch('/api/auth/me'),

  // Properties
  getProperties:   ()         => apiFetch('/api/properties'),
  createProperty:  (d)        => apiFetch('/api/properties', { method:'POST', body: JSON.stringify(d) }),
  updateProperty:  (id, d)    => apiFetch(`/api/properties/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  deleteProperty:  (id)       => apiFetch(`/api/properties/${id}`, { method:'DELETE' }),

  // Reservations
  getReservations: (p={})     => apiFetch('/api/reservations?' + new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([,v])=>v)))),
  createReservation:(d)       => apiFetch('/api/reservations', { method:'POST', body: JSON.stringify(d) }),
  updateReservation:(id,d)    => apiFetch(`/api/reservations/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  deleteReservation:(id)      => apiFetch(`/api/reservations/${id}`, { method:'DELETE' }),
  sefReported:     (id)       => apiFetch(`/api/reservations/${id}/sef-reported`, { method:'PATCH' }),

  // Transactions
  getTransactions: (p={})     => apiFetch('/api/transactions?' + new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([,v])=>v)))),
  createTransaction:(d)       => apiFetch('/api/transactions', { method:'POST', body: JSON.stringify(d) }),
  deleteTransaction:(id)      => apiFetch(`/api/transactions/${id}`, { method:'DELETE' }),

  // Cleaning
  getCleaning:     (p={})     => apiFetch('/api/cleaning?' + new URLSearchParams(Object.fromEntries(Object.entries(p).filter(([,v])=>v)))),
  createCleaning:  (d)        => apiFetch('/api/cleaning', { method:'POST', body: JSON.stringify(d) }),
  updateCleaning:  (id,d)     => apiFetch(`/api/cleaning/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  toggleCleaning:  (id)       => apiFetch(`/api/cleaning/${id}/toggle`, { method:'PATCH' }),
  deleteCleaning:  (id)       => apiFetch(`/api/cleaning/${id}`, { method:'DELETE' }),
  clearDoneTasks:  ()         => apiFetch('/api/cleaning', { method:'DELETE' }),

  // Messages
  getMessages:     ()         => apiFetch('/api/messages'),
  createMessage:   (d)        => apiFetch('/api/messages', { method:'POST', body: JSON.stringify(d) }),
  updateMessage:   (id,d)     => apiFetch(`/api/messages/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  toggleMessage:   (id)       => apiFetch(`/api/messages/${id}/toggle`, { method:'PATCH' }),
  deleteMessage:   (id)       => apiFetch(`/api/messages/${id}`, { method:'DELETE' }),

  // OTA
  getOta:          ()         => apiFetch('/api/ota'),
  updateOta:       (id,d)     => apiFetch(`/api/ota/${id}`, { method:'PUT', body: JSON.stringify(d) }),
  syncOta:         (id,prop)  => apiFetch(`/api/ota/${id}/sync?prop_id=${prop}`, { method:'POST' }),
  importIcalUrl:   (p)        => apiFetch('/api/ota/import-ical?' + new URLSearchParams(p), { method:'POST' }),
  exportIcalUrl:   (propId)   => API_BASE + '/api/ota/export-ical' + (propId ? `?prop_id=${propId}` : ''),

  // Settings
  getSettings:     ()         => apiFetch('/api/settings'),
  updateSettings:  (d)        => apiFetch('/api/settings', { method:'PUT', body: JSON.stringify({ values: d }) }),
  getBackup:       ()         => apiFetch('/api/settings/backup'),
  restore:         (d)        => apiFetch('/api/settings/restore', { method:'POST', body: JSON.stringify(d) }),
};

// Shared state cache — reloaded on each section navigate
const cache = {
  properties: [],
  reservations: [],
  transactions: [],
  cleaning: [],
  messages: [],
  ota: [],
  settings: {},
};

async function loadCache() {
  const [props, res, txs, clean, msgs, ota, sett] = await Promise.all([
    api.getProperties(),
    api.getReservations(),
    api.getTransactions(),
    api.getCleaning(),
    api.getMessages(),
    api.getOta(),
    api.getSettings(),
  ]);
  cache.properties   = props   || [];
  cache.reservations = res     || [];
  cache.transactions = txs     || [];
  cache.cleaning     = clean   || [];
  cache.messages     = msgs    || [];
  cache.ota          = ota     || [];
  cache.settings     = sett    || {};
}

function getProp(id) { return cache.properties.find(p => p.id === id); }
