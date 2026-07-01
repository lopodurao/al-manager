function renderOta() {
  return `
<div class="section-header">
  <h2>Canais OTA</h2>
</div>

<div class="card mb-4" style="background:#fef3c7;border:1px solid #fcd34d">
  <div style="font-size:13.5px;color:#92400e">
    <strong>Sincronização iCal:</strong> Importa reservas dos canais OTA através de links iCal (Airbnb, Booking.com, Livvi).
    O sistema lê o ficheiro iCal e cria as reservas automaticamente.
  </div>
</div>

<div style="display:flex;flex-direction:column;gap:0">
  ${state.otaChannels.map(ch => `
  <div class="ota-card">
    <div class="ota-logo ${ch.slug}">
      ${ch.slug === 'airbnb' ? 'AB' : ch.slug === 'booking' ? 'BK' : 'LV'}
    </div>
    <div class="ota-info">
      <div class="ota-name">${ch.name}</div>
      <div class="ota-status">
        ${ch.active ? `<span style="color:var(--success)">● Ativo</span>` : '<span style="color:var(--gray-400)">○ Inativo</span>'}
        ${ch.lastSync ? ` · Última sync: ${fmtDate(ch.lastSync)}` : ''}
      </div>
      ${ch.icalUrl ? `<div style="font-size:11px;color:var(--gray-400);margin-top:2px;word-break:break-all">${escHtml(ch.icalUrl.slice(0,60))}…</div>` : ''}
    </div>
    <div class="ota-actions">
      <button class="btn btn-sm btn-outline" onclick="configOta('${ch.id}')">Configurar</button>
      ${ch.icalUrl ? `<button class="btn btn-sm btn-primary" onclick="syncOta('${ch.id}')">Sincronizar</button>` : ''}
    </div>
  </div>`).join('')}
</div>

<div class="card mt-4">
  <div class="card-title" style="margin-bottom:12px">Exportar Calendário (iCal)</div>
  <p style="font-size:13.5px;color:var(--gray-600);margin-bottom:12px">Gera um ficheiro .ics com todas as tuas reservas para partilhar com outros sistemas ou calendários.</p>
  <div class="form-row">
    <div class="form-group">
      <label>Propriedade</label>
      <select id="ical-export-prop">
        <option value="">Todas</option>
        ${state.properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group" style="display:flex;align-items:flex-end">
      <button class="btn btn-primary w-full" onclick="exportIcal()">
        <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        Exportar .ics
      </button>
    </div>
  </div>
</div>

<div class="card mt-4">
  <div class="card-title" style="margin-bottom:12px">Importar iCal (URL ou ficheiro)</div>
  <div class="tabs">
    <div class="tab active" onclick="switchOtaTab('url',this)">Por URL</div>
    <div class="tab" onclick="switchOtaTab('file',this)">Por ficheiro .ics</div>
  </div>
  <div id="ota-tab-url">
    <div class="form-group"><label>URL do calendário iCal</label><input id="ical-import-url" placeholder="https://www.airbnb.com/calendar/ical/…"></div>
    <div class="form-group"><label>Propriedade destino</label><select id="ical-import-prop">${propOptions()}</select></div>
    <div class="form-group"><label>Canal</label>
      <select id="ical-import-channel">
        ${Object.entries(CHANNELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="importIcalUrl()">Importar</button>
    </div>
  </div>
  <div id="ota-tab-file" style="display:none">
    <div class="form-group"><label>Ficheiro .ics</label><input type="file" id="ical-file" accept=".ics"></div>
    <div class="form-group"><label>Propriedade destino</label><select id="ical-file-prop">${propOptions()}</select></div>
    <div class="form-group"><label>Canal</label>
      <select id="ical-file-channel">
        ${Object.entries(CHANNELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
    </div>
    <div class="form-actions">
      <button class="btn btn-primary" onclick="importIcalFile()">Importar ficheiro</button>
    </div>
  </div>
</div>`;
}

function switchOtaTab(tab, el) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('ota-tab-url').style.display = tab === 'url' ? '' : 'none';
  document.getElementById('ota-tab-file').style.display = tab === 'file' ? '' : 'none';
}

function configOta(id) {
  const ch = state.otaChannels.find(c => c.id === id);
  openModal(`Configurar ${ch.name}`, `
    <div class="form-group"><label>URL iCal (do ${ch.name})</label>
      <input id="ota-url" value="${escHtml(ch.icalUrl||'')}" placeholder="https://…/calendar.ics">
      <div style="font-size:12px;color:var(--gray-500);margin-top:4px">
        ${ch.slug === 'airbnb' ? 'No Airbnb: Calendário → Exportar calendário' :
          ch.slug === 'booking' ? 'No Booking.com: Extranet → Calendário → iCal' :
          'No Livvi: Configurações → Calendário → iCal URL'}
      </div>
    </div>
    <div class="form-group"><label>Ativo</label>
      <select id="ota-active">
        <option value="1" ${ch.active?'selected':''}>Sim</option>
        <option value="0" ${!ch.active?'selected':''}>Não</option>
      </select>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveOtaConfig('${id}')">Guardar</button>
    </div>
  `);
}

function saveOtaConfig(id) {
  const i = state.otaChannels.findIndex(c => c.id === id);
  state.otaChannels[i].icalUrl = document.getElementById('ota-url').value.trim();
  state.otaChannels[i].active = document.getElementById('ota-active').value === '1';
  saveState(); closeModal(); navigate('ota');
  toastMsg('Canal atualizado');
}

function syncOta(id) {
  const ch = state.otaChannels.find(c => c.id === id);
  toastMsg(`A sincronizar ${ch.name}… (use "Importar por URL" abaixo com o URL configurado)`);
}

function parseIcal(text, propId, channel) {
  const events = text.split('BEGIN:VEVENT').slice(1);
  let imported = 0;
  events.forEach(ev => {
    const get = (key) => { const m = ev.match(new RegExp(`${key}[^:]*:([^\r\n]+)`)); return m ? m[1].trim() : ''; };
    const dtstart = get('DTSTART');
    const dtend = get('DTEND');
    const summary = get('SUMMARY');
    const uid = get('UID');
    if (!dtstart || !dtend) return;
    const fmt = (d) => d.length >= 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : '';
    const checkin = fmt(dtstart.replace(/T.*/,''));
    const checkout = fmt(dtend.replace(/T.*/,''));
    if (!checkin || !checkout) return;
    if (state.reservations.find(r => r.icalUid === uid)) return; // skip duplicates
    state.reservations.push({
      id: genId('r'), propId, guestName: summary || 'Reserva importada', guestEmail: '',
      guestPhone: '', guestNationality: '', docId: '', guests: 2,
      checkin, checkout, channel, status: 'confirmed', price: 0, commission: 0,
      notes: 'Importado via iCal', sefReported: false, icalUid: uid,
    });
    imported++;
  });
  return imported;
}

function importIcalUrl() {
  const url = document.getElementById('ical-import-url').value.trim();
  const propId = document.getElementById('ical-import-prop').value;
  const channel = document.getElementById('ical-import-channel').value;
  if (!url) { alert('Introduz um URL'); return; }
  // Use a CORS proxy for demo — in production use a backend
  const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
  fetch(proxy)
    .then(r => r.text())
    .then(text => {
      const n = parseIcal(text, propId, channel);
      saveState(); navigate('reservations');
      toastMsg(`${n} reserva(s) importada(s) com sucesso`);
    })
    .catch(() => toastMsg('Erro ao importar — verifica o URL e tenta novamente'));
}

function importIcalFile() {
  const file = document.getElementById('ical-file').files[0];
  const propId = document.getElementById('ical-file-prop').value;
  const channel = document.getElementById('ical-file-channel').value;
  if (!file) { alert('Seleciona um ficheiro .ics'); return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const n = parseIcal(e.target.result, propId, channel);
    saveState(); navigate('reservations');
    toastMsg(`${n} reserva(s) importada(s) com sucesso`);
  };
  reader.readAsText(file);
}

function exportIcal() {
  const propId = document.getElementById('ical-export-prop').value;
  let res = state.reservations.filter(r => r.status !== 'cancelled');
  if (propId) res = res.filter(r => r.propId === propId);
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AL Manager//PT','CALSCALE:GREGORIAN'];
  res.forEach(r => {
    const p = getProp(r.propId);
    const dtFmt = (d) => d.replace(/-/g,'');
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${r.id}@al-manager`);
    lines.push(`DTSTART;VALUE=DATE:${dtFmt(r.checkin)}`);
    lines.push(`DTEND;VALUE=DATE:${dtFmt(r.checkout)}`);
    lines.push(`SUMMARY:${r.guestName}`);
    lines.push(`DESCRIPTION:${r.guestName} | ${CHANNELS[r.channel]||r.channel} | ${p ? p.name : ''}`);
    lines.push('END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  downloadFile(lines.join('\r\n'), `al-manager-${today()}.ics`, 'text/calendar');
  toastMsg('Calendário exportado');
}
