const OTA_CHANNELS = {airbnb:'Airbnb', booking:'Booking.com', livvi:'Livvi', direct:'Direto'};

async function renderOta() {
  const links = cache.otaLinks;
  const props = cache.properties;
  return `
<div class="section-header">
  <h2>Canais OTA</h2>
  <button class="btn btn-primary" onclick="openAddOtaLink()">+ Ligar canal</button>
</div>
<div class="card mb-4" style="background:#eff6ff;border:1px solid #bfdbfe">
  <div style="font-size:13.5px;color:#1e40af">
    <strong>Como funciona:</strong> Para cada propriedade e cada plataforma (Airbnb, Booking.com…),
    adiciona um link. O sistema vai buscar as reservas automaticamente de 30 em 30 minutos
    e o calendário de disponibilidade é partilhado via link público abaixo.
  </div>
</div>
${props.length === 0 ? '<div class="card" style="color:var(--gray-500);text-align:center;padding:32px">Cria primeiro uma propriedade antes de ligar canais OTA.</div>' : ''}
${props.map(prop => {
  const propLinks = links.filter(l => l.prop_id === prop.id);
  return `<div class="card mb-3">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-weight:700;font-size:15px">🏠 ${escHtml(prop.name)}</div>
      <button class="btn btn-sm btn-outline" onclick="openAddOtaLink('${prop.id}')">+ Canal</button>
    </div>
    ${propLinks.length === 0
      ? '<div style="font-size:13px;color:var(--gray-400);padding:8px 0">Nenhum canal configurado. Clica em "+ Canal" para ligar o Airbnb ou Booking.com.</div>'
      : propLinks.map(l => `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--gray-100)">
          <div style="width:36px;height:36px;border-radius:8px;background:${l.channel==='airbnb'?'#ff5a5f':l.channel==='booking'?'#003580':'#667eea'};display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;flex-shrink:0">${l.channel==='airbnb'?'AB':l.channel==='booking'?'BK':l.channel==='livvi'?'LV':'DT'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:13px">${OTA_CHANNELS[l.channel]||l.channel}</div>
            <div style="font-size:11px;color:var(--gray-400);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.ical_url?escHtml(l.ical_url.slice(0,55))+'…':'Sem URL configurado'}</div>
            ${l.last_sync?`<div style="font-size:11px;color:var(--success)">✓ Última sync: ${fmtDate(l.last_sync)}</div>`:''}
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0">
            ${l.ical_url?`<button class="btn btn-sm btn-primary" onclick="doSyncLink('${l.id}')">Sync</button>`:''}
            <button class="btn btn-sm btn-outline" onclick="openEditOtaLink('${l.id}')">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="deleteOtaLink('${l.id}')">✕</button>
          </div>
        </div>`).join('')
    }
  </div>`;
}).join('')}
<div class="card mt-4">
  <div class="card-title" style="margin-bottom:12px">Importar iCal</div>
  <div class="tabs">
    <div class="tab active" onclick="switchOtaTab('url',this)">Por URL</div>
    <div class="tab" onclick="switchOtaTab('file',this)">Por ficheiro .ics</div>
  </div>
  <div id="ota-tab-url">
    <div class="form-group"><label>URL iCal</label><input id="ical-url" placeholder="https://www.airbnb.com/calendar/ical/…"></div>
    <div class="form-row">
      <div class="form-group"><label>Propriedade</label><select id="ical-prop">${propOptions()}</select></div>
      <div class="form-group"><label>Canal</label><select id="ical-channel">${Object.entries(CHANNELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
    </div>
    <div class="form-actions"><button class="btn btn-primary" onclick="doImportUrl()">Importar</button></div>
  </div>
  <div id="ota-tab-file" style="display:none">
    <div class="form-group"><label>Ficheiro .ics</label><input type="file" id="ical-file" accept=".ics"></div>
    <div class="form-row">
      <div class="form-group"><label>Propriedade</label><select id="ical-file-prop">${propOptions()}</select></div>
      <div class="form-group"><label>Canal</label><select id="ical-file-ch">${Object.entries(CHANNELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
    </div>
    <div class="form-actions"><button class="btn btn-primary" onclick="doImportFile()">Importar ficheiro</button></div>
  </div>
</div>
<div class="card mt-4">
  <div class="card-title" style="margin-bottom:4px">Exportar / Partilhar Calendário (.ics)</div>
  <div style="font-size:12.5px;color:var(--gray-500);margin-bottom:14px">Usa o link público para ligar ao Airbnb, Booking.com, Google Calendar, etc. Não requer login.</div>
  <div class="form-group"><label>Propriedade</label>
    <select id="ical-export-prop" onchange="refreshIcalLink()">
      <option value="">Todas as propriedades</option>
      ${cache.properties.map(p=>`<option value="${p.id}">${escHtml(p.name)}</option>`).join('')}
    </select>
  </div>
  <div class="form-group">
    <label>Link público (para Airbnb / Booking.com)</label>
    <div style="display:flex;gap:8px">
      <input id="ical-public-url" readonly style="flex:1;background:#f9fafb;font-size:12px;cursor:text" value="${_buildIcalUrl(cache.settings.icalToken||'')}">
      <button class="btn btn-outline" onclick="copyIcalLink()" style="white-space:nowrap">Copiar</button>
    </div>
    <div style="font-size:12px;color:var(--gray-500);margin-top:4px">No Airbnb: Calendário → Ligar outro calendário → cola este link</div>
  </div>
  <div class="form-actions" style="margin-top:8px">
    <button class="btn btn-outline" onclick="doExportIcal(event)">↓ Descarregar .ics</button>
  </div>
</div>`;
}

function _otaLinkForm(l, defaultPropId) {
  const propSel = cache.properties.map(p=>`<option value="${p.id}" ${(l?.prop_id||defaultPropId)===p.id?'selected':''}>${escHtml(p.name)}</option>`).join('');
  const chSel = Object.entries(OTA_CHANNELS).map(([k,v])=>`<option value="${k}" ${l?.channel===k?'selected':''}>${v}</option>`).join('');
  const hint = {
    airbnb: 'Airbnb → Calendário → Exportar calendário → copia o link .ics',
    booking: 'Booking.com → Extranet → Calendário → Sincronizar → copia URL iCal',
    livvi: 'Livvi → Configurações → Calendário → iCal URL',
  };
  return `
    <div class="form-group"><label>Propriedade</label><select id="ol-prop">${propSel}</select></div>
    <div class="form-group"><label>Canal</label><select id="ol-channel" onchange="document.getElementById('ol-hint').textContent=({airbnb:'${hint.airbnb}',booking:'${hint.booking}',livvi:'${hint.livvi}'})[this.value]||''">${chSel}</select></div>
    <div class="form-group"><label>URL iCal (do canal para importar)</label>
      <input id="ol-url" value="${escHtml(l?.ical_url||'')}" placeholder="https://www.airbnb.com/calendar/ical/…">
      <div id="ol-hint" style="font-size:12px;color:var(--gray-500);margin-top:4px">${hint[l?.channel||'airbnb']||hint.airbnb}</div>
    </div>
    <div class="form-group"><label>Ativo</label><select id="ol-active"><option value="1" ${(l?.active??true)?'selected':''}>Sim — sincroniza automaticamente</option><option value="0" ${l?.active===false?'selected':''}>Não</option></select></div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="ol-save-btn">Guardar</button></div>`;
}

function openAddOtaLink(propId) {
  openModal('Novo link OTA', _otaLinkForm(null, propId||cache.properties[0]?.id), true);
  document.getElementById('ol-save-btn').onclick = () => doSaveOtaLink(null);
}

function openEditOtaLink(id) {
  const l = cache.otaLinks.find(l=>l.id===id);
  openModal('Editar link OTA', _otaLinkForm(l), true);
  document.getElementById('ol-save-btn').onclick = () => doSaveOtaLink(id);
}

async function doSaveOtaLink(id) {
  const d = { prop_id: document.getElementById('ol-prop').value, channel: document.getElementById('ol-channel').value, ical_url: document.getElementById('ol-url').value.trim(), active: document.getElementById('ol-active').value === '1' };
  try {
    id ? await api.updateOtaLink(id, d) : await api.createOtaLink(d);
    closeModal(); await navigate('ota'); toastMsg('Link guardado');
  } catch(e) { toastMsg('Erro: '+e.message); }
}

async function deleteOtaLink(id) {
  if (!confirm('Remover este link OTA?')) return;
  try { await api.deleteOtaLink(id); await navigate('ota'); toastMsg('Link removido'); }
  catch(e) { toastMsg('Erro: '+e.message); }
}

async function doSyncLink(id) {
  const l = cache.otaLinks.find(l=>l.id===id);
  const prop = cache.properties.find(p=>p.id===l?.prop_id);
  toastMsg(`A sincronizar ${OTA_CHANNELS[l?.channel]||''}…`);
  try {
    const r = await api.syncOtaLink(id);
    await navigate('ota');
    toastMsg(`${r.imported} reserva(s) importada(s) — ${prop?.name||''}`);
  } catch(e) { toastMsg('Erro: '+e.message); }
}

function switchOtaTab(tab,el) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  document.getElementById('ota-tab-url').style.display=tab==='url'?'':'none';
  document.getElementById('ota-tab-file').style.display=tab==='file'?'':'none';
}

async function doImportUrl() {
  const url=document.getElementById('ical-url').value.trim(), propId=document.getElementById('ical-prop').value, channel=document.getElementById('ical-channel').value;
  if(!url){ alert('Introduz um URL'); return; }
  try { const r=await api.importIcalUrl({url,prop_id:propId,channel}); await navigate('reservations'); toastMsg(`${r.imported} reserva(s) importada(s)`); }
  catch(e){ toastMsg('Erro ao importar: '+e.message); }
}

function doImportFile() {
  const file=document.getElementById('ical-file').files[0];
  if(!file){ alert('Seleciona um ficheiro'); return; }
  const reader=new FileReader();
  reader.onload=async (e)=>{
    // Parse locally and batch-create
    const text=e.target.result, propId=document.getElementById('ical-file-prop').value, channel=document.getElementById('ical-file-ch').value;
    const events=text.split('BEGIN:VEVENT').slice(1); let n=0;
    for(const ev of events){
      const get=k=>{const m=ev.match(new RegExp(`${k}[^:]*:([^\\r\\n]+)`));return m?m[1].trim():'';};
      const ci=get('DTSTART').replace(/T.*/,''); const co=get('DTEND').replace(/T.*/,'');
      if(ci.length<8) continue;
      const fmt=d=>`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
      try{ await api.createReservation({prop_id:propId,guest_name:get('SUMMARY')||'Reserva iCal',checkin:fmt(ci),checkout:fmt(co),channel,status:'confirmed',ical_uid:get('UID'),notes:'Importado via iCal'}); n++; }catch(_){}
    }
    await navigate('reservations'); toastMsg(`${n} reserva(s) importada(s)`);
  };
  reader.readAsText(file);
}

function _buildIcalUrl(token, propId) {
  const base = window.location.origin;
  const prop = propId || document.getElementById('ical-export-prop')?.value || '';
  return base + '/api/ota/calendar/' + (token || '???') + (prop ? '?prop_id=' + prop : '');
}

function refreshIcalLink() {
  const el = document.getElementById('ical-public-url');
  if (el) el.value = _buildIcalUrl(cache.settings.icalToken || '');
}

function copyIcalLink() {
  const el = document.getElementById('ical-public-url');
  if (!el) return;
  navigator.clipboard.writeText(el.value).then(() => toastMsg('Link copiado!')).catch(() => {
    el.select(); document.execCommand('copy'); toastMsg('Link copiado!');
  });
}

function doExportIcal(e) {
  if (e) e.preventDefault();
  const propId = document.getElementById('ical-export-prop')?.value || '';
  window.open(api.exportIcalUrl(propId), '_blank');
}
