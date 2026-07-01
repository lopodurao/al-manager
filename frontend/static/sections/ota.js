async function renderOta() {
  return `
<div class="section-header"><h2>Canais OTA</h2></div>
<div class="card mb-4" style="background:#fef3c7;border:1px solid #fcd34d">
  <div style="font-size:13.5px;color:#92400e"><strong>Sincronização iCal:</strong> Importa reservas via link iCal do Airbnb, Booking.com e Livvi. As reservas são criadas automaticamente.</div>
</div>
<div style="display:flex;flex-direction:column;gap:0">
  ${cache.ota.map(ch=>`
  <div class="ota-card">
    <div class="ota-logo ${ch.slug}">${ch.slug==='airbnb'?'AB':ch.slug==='booking'?'BK':'LV'}</div>
    <div class="ota-info">
      <div class="ota-name">${ch.name}</div>
      <div class="ota-status">${ch.active?'<span style="color:var(--success)">● Ativo</span>':'<span style="color:var(--gray-400)">○ Inativo</span>'}${ch.last_sync?` · Última sync: ${fmtDate(ch.last_sync)}`:''}</div>
      ${ch.ical_url?`<div style="font-size:11px;color:var(--gray-400);margin-top:2px">${escHtml(ch.ical_url.slice(0,60))}…</div>`:''}
    </div>
    <div class="ota-actions">
      <button class="btn btn-sm btn-outline" onclick="configOta('${ch.id}')">Configurar</button>
      ${ch.ical_url?`<button class="btn btn-sm btn-primary" onclick="openSyncOta('${ch.id}')">Sincronizar</button>`:''}
    </div>
  </div>`).join('')}
</div>
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
  <div class="card-title" style="margin-bottom:12px">Exportar Calendário (.ics)</div>
  <div class="form-row">
    <div class="form-group"><label>Propriedade</label><select id="ical-export-prop"><option value="">Todas</option>${cache.properties.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
    <div class="form-group" style="display:flex;align-items:flex-end"><a id="ical-export-link" class="btn btn-primary w-full" href="#" onclick="doExportIcal(event)">↓ Exportar .ics</a></div>
  </div>
</div>`;
}

function switchOtaTab(tab,el) {
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active')); el.classList.add('active');
  document.getElementById('ota-tab-url').style.display=tab==='url'?'':'none';
  document.getElementById('ota-tab-file').style.display=tab==='file'?'':'none';
}

function configOta(id) {
  const ch=cache.ota.find(c=>c.id===id);
  openModal(`Configurar ${ch.name}`,`
    <div class="form-group"><label>URL iCal</label><input id="ota-cfg-url" value="${escHtml(ch.ical_url||'')}" placeholder="https://…/calendar.ics">
    <div style="font-size:12px;color:var(--gray-500);margin-top:4px">${ch.slug==='airbnb'?'No Airbnb: Calendário → Exportar calendário':ch.slug==='booking'?'No Booking.com: Extranet → Calendário → iCal':'No Livvi: Configurações → Calendário → iCal URL'}</div></div>
    <div class="form-group"><label>Ativo</label><select id="ota-cfg-active"><option value="1" ${ch.active?'selected':''}>Sim</option><option value="0" ${!ch.active?'selected':''}>Não</option></select></div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="doSaveOta('${id}')">Guardar</button></div>`);
}

async function doSaveOta(id) {
  const d={ ical_url:document.getElementById('ota-cfg-url').value.trim(), active:document.getElementById('ota-cfg-active').value==='1' };
  try { await api.updateOta(id,d); closeModal(); await navigate('ota'); toastMsg('Canal atualizado'); }
  catch(e){ toastMsg('Erro: '+e.message); }
}

function openSyncOta(id) {
  const props=cache.properties;
  openModal('Sincronizar calendário',`
    <div class="form-group"><label>Propriedade destino</label><select id="sync-prop">${propOptions()}</select></div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="doSyncOta('${id}')">Sincronizar</button></div>`);
}

async function doSyncOta(id) {
  const propId=document.getElementById('sync-prop').value;
  try { const r=await api.syncOta(id,propId); closeModal(); await navigate('reservations'); toastMsg(`${r.imported} reserva(s) importada(s)`); }
  catch(e){ toastMsg('Erro: '+e.message); }
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

function doExportIcal(e) {
  e.preventDefault();
  const propId=document.getElementById('ical-export-prop').value;
  window.open(api.exportIcalUrl(propId),'_blank');
}
