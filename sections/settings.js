function renderSettings() {
  const s = state.settings;
  return `
<div class="section-header">
  <h2>Configurações</h2>
  <button class="btn btn-primary" onclick="saveSettings()">Guardar alterações</button>
</div>

<div class="grid-2">
  <div class="card mb-4">
    <div class="card-title" style="margin-bottom:16px">Dados do proprietário</div>
    <div class="form-group"><label>Nome</label><input id="s-name" value="${escHtml(s.ownerName||'')}"></div>
    <div class="form-group"><label>NIF</label><input id="s-nif" value="${escHtml(s.ownerNIF||'')}" placeholder="123456789"></div>
    <div class="form-group"><label>Email</label><input type="email" id="s-email" value="${escHtml(s.ownerEmail||'')}"></div>
    <div class="form-group"><label>Telemóvel</label><input id="s-phone" value="${escHtml(s.ownerPhone||'')}"></div>
    <div class="form-group"><label>Licença AL (global)</label><input id="s-al" value="${escHtml(s.alLicense||'')}" placeholder="AL/2020/0000"></div>
  </div>

  <div class="card mb-4">
    <div class="card-title" style="margin-bottom:16px">Operação</div>
    <div class="form-row">
      <div class="form-group"><label>Hora check-in</label><input type="time" id="s-checkin" value="${s.checkinTime||'15:00'}"></div>
      <div class="form-group"><label>Hora check-out</label><input type="time" id="s-checkout" value="${s.checkoutTime||'11:00'}"></div>
    </div>
    <div class="form-group"><label>Taxa de limpeza (€)</label><input type="number" id="s-cleaning" value="${s.cleaningFee||40}" step="0.50"></div>
    <div class="form-group"><label>Código de acesso / cofre</label><input id="s-code" value="${escHtml(s.accessCode||'')}" placeholder="Ex: 1234 ou A234B"></div>
    <div class="form-group"><label>Localização das chaves</label><input id="s-key" value="${escHtml(s.keyLocation||'')}" placeholder="Cofre na porta"></div>
  </div>
</div>

<div class="card mb-4">
  <div class="card-title" style="margin-bottom:16px">SEF — Credenciais SIBA</div>
  <div class="form-row">
    <div class="form-group"><label>Utilizador SIBA</label><input id="s-sefuser" value="${escHtml(s.sefUser||'')}"></div>
    <div class="form-group"><label>Password SIBA</label><input type="password" id="s-sefpass" value="${escHtml(s.sefPass||'')}"></div>
  </div>
  <div style="font-size:12.5px;color:var(--gray-500)">⚠ As credenciais são guardadas localmente no teu browser.</div>
</div>

<div class="card mb-4">
  <div class="card-title" style="margin-bottom:16px">Dados &amp; Backup</div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn btn-outline" onclick="exportBackup()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      Exportar backup JSON
    </button>
    <label class="btn btn-outline" style="cursor:pointer">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg>
      Importar backup
      <input type="file" accept=".json" style="display:none" onchange="importBackup(this)">
    </label>
    <button class="btn btn-danger" onclick="resetAllData()">Apagar todos os dados</button>
  </div>
</div>

<div class="card">
  <div class="card-title" style="margin-bottom:8px">Acerca do AL Manager</div>
  <div style="font-size:13px;color:var(--gray-500);line-height:1.8">
    <div>Versão: <strong>1.0.0</strong></div>
    <div>Dados guardados: localmente no browser (localStorage)</div>
    <div>Compatível com: Primavera ERP v10 Evolution, SEF/SIBA, Airbnb, Booking.com, Livvi</div>
    <div style="margin-top:8px">Propriedades: <strong>${state.properties.length}</strong> · Reservas: <strong>${state.reservations.length}</strong> · Lançamentos: <strong>${state.transactions.length}</strong></div>
  </div>
</div>`;
}

function saveSettings() {
  state.settings.ownerName = document.getElementById('s-name').value.trim();
  state.settings.ownerNIF = document.getElementById('s-nif').value.trim();
  state.settings.ownerEmail = document.getElementById('s-email').value.trim();
  state.settings.ownerPhone = document.getElementById('s-phone').value.trim();
  state.settings.alLicense = document.getElementById('s-al').value.trim();
  state.settings.checkinTime = document.getElementById('s-checkin').value;
  state.settings.checkoutTime = document.getElementById('s-checkout').value;
  state.settings.cleaningFee = +document.getElementById('s-cleaning').value;
  state.settings.accessCode = document.getElementById('s-code').value.trim();
  state.settings.keyLocation = document.getElementById('s-key').value.trim();
  state.settings.sefUser = document.getElementById('s-sefuser').value.trim();
  state.settings.sefPass = document.getElementById('s-sefpass').value;
  saveState(); toastMsg('Configurações guardadas');
}

function exportBackup() {
  downloadFile(JSON.stringify(state, null, 2), `al-manager-backup-${today()}.json`, 'application/json');
  toastMsg('Backup exportado');
}

function importBackup(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.properties || !data.reservations) { alert('Ficheiro inválido'); return; }
      if (!confirm('Isto irá substituir TODOS os dados atuais. Continuar?')) return;
      state = data;
      saveState(); navigate('dashboard');
      toastMsg('Backup importado com sucesso');
    } catch { alert('Erro ao ler o ficheiro JSON'); }
  };
  reader.readAsText(file);
}

function resetAllData() {
  if (!confirm('ATENÇÃO: Isto apaga TODOS os dados permanentemente. Tens a certeza?')) return;
  if (!confirm('Confirmas que queres apagar tudo?')) return;
  localStorage.removeItem('al_manager_v1');
  location.reload();
}
