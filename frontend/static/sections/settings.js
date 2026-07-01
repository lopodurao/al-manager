async function renderSettings() {
  const s=cache.settings;
  return `
<div class="section-header"><h2>Configurações</h2><button class="btn btn-primary" onclick="doSaveSettings()">Guardar alterações</button></div>
<div class="grid-2">
  <div class="card mb-4">
    <div class="card-title" style="margin-bottom:16px">Dados do proprietário</div>
    <div class="form-group"><label>Nome</label><input id="s-name" value="${escHtml(s.ownerName||'')}"></div>
    <div class="form-group"><label>NIF</label><input id="s-nif" value="${escHtml(s.ownerNIF||'')}" placeholder="123456789"></div>
    <div class="form-group"><label>Email</label><input type="email" id="s-email" value="${escHtml(s.ownerEmail||'')}"></div>
    <div class="form-group"><label>Telemóvel</label><input id="s-phone" value="${escHtml(s.ownerPhone||'')}"></div>
    <div class="form-group"><label>Licença AL global</label><input id="s-al" value="${escHtml(s.alLicense||'')}" placeholder="AL/2020/0000"></div>
  </div>
  <div class="card mb-4">
    <div class="card-title" style="margin-bottom:16px">Operação</div>
    <div class="form-row">
      <div class="form-group"><label>Hora check-in</label><input type="time" id="s-checkin" value="${s.checkinTime||'15:00'}"></div>
      <div class="form-group"><label>Hora check-out</label><input type="time" id="s-checkout" value="${s.checkoutTime||'11:00'}"></div>
    </div>
    <div class="form-group"><label>Taxa de limpeza (€)</label><input type="number" id="s-cleaning" value="${s.cleaningFee||40}" step="0.5"></div>
    <div class="form-group"><label>Código de acesso</label><input id="s-code" value="${escHtml(s.accessCode||'')}" placeholder="1234"></div>
    <div class="form-group"><label>Localização das chaves</label><input id="s-key" value="${escHtml(s.keyLocation||'')}" placeholder="Cofre na porta"></div>
  </div>
</div>
<div class="card mb-4">
  <div class="card-title" style="margin-bottom:16px">🔒 Livvi — Mapeamento Quartos → Portas</div>
  <p style="font-size:13px;color:var(--gray-500);margin-bottom:12px">
    Define quais as portas Livvi que cada quarto/unidade dá acesso. O PIN gerado será específico para essas portas.<br>
    IDs das tuas portas: <strong>27461</strong> Entrada Principal · <strong>27462</strong> Quarto Verde · <strong>27463</strong> Quarto Vermelho · <strong>27464</strong> Kitchennet
  </p>
  <div id="livvi-rooms-list">${_renderLivviRooms(s.livvi_rooms||'{}')}</div>
  <button class="btn btn-outline btn-sm" style="margin-top:8px" onclick="addLivviRoom()">+ Adicionar quarto</button>
</div>
<div class="card mb-4">
  <div class="card-title" style="margin-bottom:16px">SEF — Credenciais SIBA</div>
  <div class="form-row">
    <div class="form-group"><label>Utilizador SIBA</label><input id="s-sefuser" value="${escHtml(s.sefUser||'')}"></div>
    <div class="form-group"><label>Password SIBA</label><input type="password" id="s-sefpass" value="${escHtml(s.sefPass||'')}"></div>
  </div>
  <div style="font-size:12.5px;color:var(--gray-500)">⚠ Guardado de forma encriptada no servidor.</div>
</div>
<div class="card mb-4">
  <div class="card-title" style="margin-bottom:16px">Dados &amp; Backup</div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn btn-outline" onclick="doExportBackup()">↓ Exportar backup JSON</button>
    <label class="btn btn-outline" style="cursor:pointer">↑ Importar backup<input type="file" accept=".json" style="display:none" onchange="doImportBackup(this)"></label>
    <button class="btn btn-danger" onclick="doResetData()">Apagar todos os dados</button>
  </div>
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:8px">Acerca do AL Manager</div>
  <div style="font-size:13px;color:var(--gray-500);line-height:1.8">
    <div>Versão: <strong>2.0.0</strong> (FastAPI + SQLite)</div>
    <div>Propriedades: <strong>${cache.properties.length}</strong> · Reservas: <strong>${cache.reservations.length}</strong> · Lançamentos: <strong>${cache.transactions.length}</strong></div>
    <div>Compatível com: Primavera ERP v10 Evolution, SEF/SIBA, Airbnb, Booking.com, Livvi</div>
  </div>
</div>`;
}

function _renderLivviRooms(json) {
  let mapping = {};
  try { mapping = JSON.parse(json); } catch {}
  const rows = Object.entries(mapping).map(([room, doors], i) => `
    <div class="form-row" id="livvi-row-${i}" style="align-items:center;gap:8px;margin-bottom:8px">
      <div class="form-group" style="margin:0;flex:1"><input placeholder="Nome do quarto (ex: Quarto Verde)" value="${escHtml(room)}" class="livvi-room-name" data-i="${i}"></div>
      <div style="font-size:18px;color:var(--gray-400)">→</div>
      <div class="form-group" style="margin:0;flex:1"><input placeholder="IDs das portas separados por vírgula (ex: 27462,27461)" value="${escHtml(doors)}" class="livvi-room-doors" data-i="${i}"></div>
      <button class="btn btn-sm btn-danger" onclick="removeLivviRoom(${i})" style="flex-shrink:0">✕</button>
    </div>`).join('');
  return rows || '<div style="font-size:13px;color:var(--gray-400);padding:8px 0">Nenhum quarto configurado ainda.</div>';
}

function addLivviRoom() {
  const list = document.getElementById('livvi-rooms-list');
  const i = list.querySelectorAll('.form-row').length;
  const div = document.createElement('div');
  div.className = 'form-row';
  div.id = `livvi-row-${i}`;
  div.style.cssText = 'align-items:center;gap:8px;margin-bottom:8px';
  div.innerHTML = `
    <div class="form-group" style="margin:0;flex:1"><input placeholder="Nome do quarto (ex: Quarto Vermelho)" class="livvi-room-name" data-i="${i}"></div>
    <div style="font-size:18px;color:var(--gray-400)">→</div>
    <div class="form-group" style="margin:0;flex:1"><input placeholder="IDs das portas (ex: 27463,27461)" class="livvi-room-doors" data-i="${i}"></div>
    <button class="btn btn-sm btn-danger" onclick="this.closest('.form-row').remove()" style="flex-shrink:0">✕</button>`;
  list.appendChild(div);
}

function removeLivviRoom(i) {
  document.getElementById(`livvi-row-${i}`)?.remove();
}

function _collectLivviRooms() {
  const names = document.querySelectorAll('.livvi-room-name');
  const doors = document.querySelectorAll('.livvi-room-doors');
  const mapping = {};
  names.forEach((n, i) => {
    const name = n.value.trim();
    const door = doors[i]?.value.trim();
    if (name && door) mapping[name] = door;
  });
  return JSON.stringify(mapping);
}

async function doSaveSettings() {
  const d={ ownerName:document.getElementById('s-name').value.trim(), ownerNIF:document.getElementById('s-nif').value.trim(), ownerEmail:document.getElementById('s-email').value.trim(), ownerPhone:document.getElementById('s-phone').value.trim(), alLicense:document.getElementById('s-al').value.trim(), checkinTime:document.getElementById('s-checkin').value, checkoutTime:document.getElementById('s-checkout').value, cleaningFee:document.getElementById('s-cleaning').value, accessCode:document.getElementById('s-code').value.trim(), keyLocation:document.getElementById('s-key').value.trim(), sefUser:document.getElementById('s-sefuser').value.trim(), sefPass:document.getElementById('s-sefpass').value, livvi_rooms:_collectLivviRooms() };
  try { await api.updateSettings(d); Object.assign(cache.settings,d); toastMsg('Configurações guardadas'); }
  catch(e){ toastMsg('Erro: '+e.message); }
}

async function doExportBackup() {
  try { const data=await api.getBackup(); downloadFile(JSON.stringify(data,null,2),`al-manager-backup-${today()}.json`,'application/json'); toastMsg('Backup exportado'); }
  catch(e){ toastMsg('Erro: '+e.message); }
}

function doImportBackup(input) {
  const file=input.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=async(e)=>{
    try {
      const data=JSON.parse(e.target.result);
      if(!data.properties||!data.reservations){ alert('Ficheiro inválido'); return; }
      if(!confirm('Isto substitui TODOS os dados. Continuar?')) return;
      await api.restore(data); await loadCache(); await navigate('dashboard'); toastMsg('Backup importado');
    } catch(err){ alert('Erro: '+err.message); }
  };
  reader.readAsText(file);
}

async function doResetData() {
  if(!confirm('ATENÇÃO: Apaga TODOS os dados permanentemente. Tens a certeza?')) return;
  if(!confirm('Confirmas que queres apagar tudo?')) return;
  try { await api.restore({properties:[],reservations:[],transactions:[],cleaning_tasks:[],message_templates:[],ota_channels:[],settings:{}}); await loadCache(); await navigate('dashboard'); toastMsg('Dados apagados'); }
  catch(e){ toastMsg('Erro: '+e.message); }
}
