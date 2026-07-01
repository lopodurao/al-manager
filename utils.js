// Utility functions

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function fmtMoney(v) {
  return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(v || 0);
}

function fmtDateShort(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

function nights(checkin, checkout) {
  const a = new Date(checkin), b = new Date(checkout);
  return Math.round((b - a) / 86400000);
}

function today() { return new Date().toISOString().slice(0, 10); }

function toastMsg(msg, dur = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastMsg._timer);
  toastMsg._timer = setTimeout(() => t.classList.add('hidden'), dur);
}

function openModal(title, bodyHtml, wide = false) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-box').style.maxWidth = wide ? '780px' : '580px';
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

function channelBadge(ch) {
  const map = { airbnb: 'badge-red', booking: 'badge-blue', livvi: 'badge-purple', direct: 'badge-green' };
  return `<span class="badge ${map[ch] || 'badge-gray'}">${CHANNELS[ch] || ch}</span>`;
}

function statusBadge(s) {
  const map = { confirmed: ['badge-green', 'Confirmada'], pending: ['badge-amber', 'Pendente'], cancelled: ['badge-red', 'Cancelada'], checkedin: ['badge-blue', 'Check-in'], checkedout: ['badge-gray', 'Check-out'] };
  const [cls, label] = map[s] || ['badge-gray', s];
  return `<span class="badge ${cls}">${label}</span>`;
}

function countryOptions(sel = '') {
  return Object.entries(COUNTRIES).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');
}

function propOptions(sel = '') {
  return state.properties.map(p => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${p.name}</option>`).join('');
}

function resOccupancyRate(propId, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let occupied = 0;
  state.reservations.filter(r => r.propId === propId && r.status !== 'cancelled').forEach(r => {
    const ci = new Date(r.checkin), co = new Date(r.checkout);
    for (let d = new Date(year, month - 1, 1); d <= new Date(year, month - 1, daysInMonth); d.setDate(d.getDate() + 1)) {
      if (d >= ci && d < co) occupied++;
    }
  });
  return Math.round((occupied / daysInMonth) * 100);
}

function downloadFile(content, filename, mime = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
}

function escHtml(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
