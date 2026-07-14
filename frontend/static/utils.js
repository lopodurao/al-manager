const CHANNELS = { airbnb:'Airbnb', booking:'Booking.com', livvi:'Livvi', direct:'Direto', website:'Site' };
const COUNTRIES = { PT:'🇵🇹 Portugal',DE:'🇩🇪 Alemanha',FR:'🇫🇷 França',ES:'🇪🇸 Espanha',GB:'🇬🇧 Reino Unido',US:'🇺🇸 EUA',BR:'🇧🇷 Brasil',IT:'🇮🇹 Itália',NL:'🇳🇱 Holanda',BE:'🇧🇪 Bélgica',CH:'🇨🇭 Suíça',AT:'🇦🇹 Áustria',PL:'🇵🇱 Polónia',SE:'🇸🇪 Suécia',DK:'🇩🇰 Dinamarca',NO:'🇳🇴 Noruega',FI:'🇫🇮 Finlândia' };
const FLAG = { PT:'🇵🇹',DE:'🇩🇪',FR:'🇫🇷',ES:'🇪🇸',GB:'🇬🇧',US:'🇺🇸',BR:'🇧🇷',IT:'🇮🇹',NL:'🇳🇱',BE:'🇧🇪',CH:'🇨🇭',AT:'🇦🇹',PL:'🇵🇱',SE:'🇸🇪',DK:'🇩🇰',NO:'🇳🇴',FI:'🇫🇮' };

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function fmtMoney(v) {
  return new Intl.NumberFormat('pt-PT', { style:'currency', currency:'EUR' }).format(v || 0);
}
function fmtDateShort(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-PT', { day:'2-digit', month:'short' });
}
function nights(ci, co) { return Math.round((new Date(co) - new Date(ci)) / 86400000); }
function today() { return new Date().toISOString().slice(0,10); }
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function toastMsg(msg, dur=3000) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastMsg._t);
  toastMsg._t = setTimeout(() => t.classList.add('hidden'), dur);
}

function openModal(title, bodyHtml, wide=false) {
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
  const m = { airbnb:'badge-red', booking:'badge-blue', livvi:'badge-purple', direct:'badge-green', website:'badge-teal' };
  return `<span class="badge ${m[ch]||'badge-gray'}">${CHANNELS[ch]||ch}</span>`;
}
function statusBadge(s) {
  const m = { confirmed:['badge-green','Confirmada'], pending:['badge-amber','Pendente'], cancelled:['badge-red','Cancelada'], checkedin:['badge-blue','Check-in'], checkedout:['badge-gray','Check-out'] };
  const [cls,lbl] = m[s]||['badge-gray',s];
  return `<span class="badge ${cls}">${lbl}</span>`;
}
function countryOptions(sel='') {
  return Object.entries(COUNTRIES).map(([k,v]) => `<option value="${k}" ${k===sel?'selected':''}>${v}</option>`).join('');
}
function propOptions(sel='') {
  return cache.properties.map(p => `<option value="${p.id}" ${p.id===sel?'selected':''}>${escHtml(p.name)}</option>`).join('');
}
function downloadFile(content, filename, mime='text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type:mime }));
  a.download = filename; a.click();
}
