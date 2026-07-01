function renderSef() {
  const todayStr = today();
  const foreignRes = state.reservations.filter(r =>
    r.guestNationality !== 'PT' &&
    r.status !== 'cancelled' &&
    r.checkout >= todayStr
  );
  const pending = foreignRes.filter(r => !r.sefReported);
  const reported = foreignRes.filter(r => r.sefReported);

  return `
<div class="section-header">
  <h2>SEF / SIBA — Comunicação de Hóspedes</h2>
  <div style="display:flex;gap:8px">
    <button class="btn btn-outline" onclick="exportSefCsv()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      Exportar CSV
    </button>
    <button class="btn btn-primary" onclick="openSefInfo()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
      Como comunicar
    </button>
  </div>
</div>

<div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
  <div class="stat-card">
    <div class="stat-icon ${pending.length > 0 ? 'red' : 'green'}">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>
    </div>
    <div class="stat-label">Pendentes comunicação</div>
    <div class="stat-value" style="color:${pending.length > 0 ? 'var(--danger)' : 'var(--success)'}">${pending.length}</div>
    <div class="stat-sub">Prazo: 3 dias úteis após check-in</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon green">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
    </div>
    <div class="stat-label">Comunicados</div>
    <div class="stat-value">${reported.length}</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon indigo">
      <svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
    </div>
    <div class="stat-label">Total estrangeiros</div>
    <div class="stat-value">${foreignRes.length}</div>
  </div>
</div>

${pending.length > 0 ? `
<div class="card mb-4" style="border-left:4px solid var(--danger)">
  <div class="card-title" style="color:var(--danger);margin-bottom:12px">⚠ Pendentes — comunicar ao SEF/SIBA</div>
  <div class="table-wrap">
    <table class="sef-table">
      <thead><tr><th>Hóspede</th><th>País</th><th>Documento</th><th>Propriedade</th><th>Check-in</th><th>Check-out</th><th>Canal</th><th>Prazo SEF</th><th>Ação</th></tr></thead>
      <tbody>
        ${pending.map(r => {
          const p = getProp(r.propId);
          const checkinDate = new Date(r.checkin);
          const deadline = new Date(checkinDate);
          deadline.setDate(deadline.getDate() + 3);
          const deadlineStr = deadline.toISOString().slice(0,10);
          const isOverdue = deadlineStr < today() && r.checkin <= today();
          return `<tr>
            <td><strong>${FLAG[r.guestNationality]||''} ${escHtml(r.guestName)}</strong></td>
            <td>${COUNTRIES[r.guestNationality]||r.guestNationality}</td>
            <td>${r.docId ? `<span class="text-sm">${escHtml(r.docId)}</span>` : '<span class="required">⚠ Em falta</span>'}</td>
            <td>${p ? p.name : '—'}</td>
            <td>${fmtDate(r.checkin)}</td>
            <td>${fmtDate(r.checkout)}</td>
            <td>${channelBadge(r.channel)}</td>
            <td class="${isOverdue ? 'required' : ''}">${fmtDate(deadlineStr)}${isOverdue ? ' ⚠ ATRASADO' : ''}</td>
            <td>
              <button class="btn btn-sm btn-success" onclick="markSefReported('${r.id}')">✓ Comunicado</button>
              <button class="btn btn-sm btn-outline" onclick="editReservation('${r.id}')">Editar</button>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
</div>` : `<div class="card mb-4" style="border-left:4px solid var(--success);padding:16px">
  <span style="color:var(--success);font-weight:700">✓ Todos os hóspedes estrangeiros estão comunicados ao SEF/SIBA!</span>
</div>`}

<div class="card">
  <div class="card-title" style="margin-bottom:12px">Histórico — Comunicados</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Hóspede</th><th>País</th><th>Documento</th><th>Propriedade</th><th>Check-in</th><th>Check-out</th><th>Estado</th></tr></thead>
      <tbody>
        ${reported.length === 0 ? '<tr><td colspan="7" class="text-center text-gray" style="padding:24px">Sem registos</td></tr>' :
          reported.map(r => {
            const p = getProp(r.propId);
            return `<tr>
              <td>${FLAG[r.guestNationality]||''} ${escHtml(r.guestName)}</td>
              <td>${COUNTRIES[r.guestNationality]||r.guestNationality}</td>
              <td class="text-sm">${escHtml(r.docId)||'—'}</td>
              <td>${p ? p.name : '—'}</td>
              <td>${fmtDate(r.checkin)}</td>
              <td>${fmtDate(r.checkout)}</td>
              <td><span class="badge badge-green">✓ Comunicado</span></td>
            </tr>`;
          }).join('')
        }
      </tbody>
    </table>
  </div>
</div>`;
}

function markSefReported(id) {
  const i = state.reservations.findIndex(r => r.id === id);
  if (i >= 0) {
    state.reservations[i].sefReported = true;
    saveState();
    navigate('sef');
    toastMsg('Marcado como comunicado ao SEF/SIBA');
  }
}

function exportSefCsv() {
  const todayStr = today();
  const rows = state.reservations.filter(r => r.guestNationality !== 'PT' && r.status !== 'cancelled' && r.checkout >= todayStr);
  const header = ['Nome','Nacionalidade','Documento','Propriedade','Check-in','Check-out','Hóspedes','Comunicado SEF'];
  const lines = [header.join(';'), ...rows.map(r => {
    const p = getProp(r.propId);
    return [r.guestName, r.guestNationality, r.docId||'', p ? p.name : '', r.checkin, r.checkout, r.guests, r.sefReported ? 'Sim' : 'Não'].join(';');
  })];
  downloadFile('﻿' + lines.join('\n'), `sef_comunicacao_${today()}.csv`, 'text/csv;charset=utf-8');
  toastMsg('CSV exportado');
}

function openSefInfo() {
  openModal('Como comunicar ao SEF/SIBA', `
    <div style="line-height:1.7;font-size:13.5px">
      <h4 style="margin-bottom:8px">Obrigação legal (Art. 16.º DL 78/2001)</h4>
      <p>Os proprietários de AL são obrigados a comunicar ao SEF (Serviço de Estrangeiros e Fronteiras) os dados de <strong>hóspedes estrangeiros</strong> no prazo de <strong>3 dias úteis</strong> após o check-in.</p>
      <br>
      <h4 style="margin-bottom:8px">Como comunicar via SIBA</h4>
      <ol style="padding-left:20px">
        <li>Aceda ao portal <strong>sef.pt/siba</strong></li>
        <li>Use as credenciais configuradas em <em>Configurações → SEF</em></li>
        <li>Selecione "Comunicação de Hóspedes"</li>
        <li>Preencha os dados do hóspede (nome, nº documento, nacionalidade, datas)</li>
        <li>Confirme e guarde o número de comunicação</li>
      </ol>
      <br>
      <h4 style="margin-bottom:8px">Dados necessários por hóspede</h4>
      <ul style="padding-left:20px">
        <li>Nome completo</li>
        <li>Número de passaporte ou documento de identidade</li>
        <li>Nacionalidade</li>
        <li>Data de nascimento</li>
        <li>Datas de check-in e check-out</li>
        <li>Morada do estabelecimento</li>
      </ul>
      <br>
      <p style="color:var(--danger);font-weight:600">⚠ A não comunicação pode resultar em coima de €500 a €2500.</p>
    </div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>
  `);
}
