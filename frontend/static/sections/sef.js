async function renderSef() {
  const todayStr = today();
  const foreign = cache.reservations.filter(r => r.guest_nationality!=='PT' && r.status!=='cancelled' && r.checkout>=todayStr);
  const pending  = foreign.filter(r => !r.sef_reported);
  const reported = foreign.filter(r => r.sef_reported);
  return `
<div class="section-header">
  <h2>SEF / SIBA — Comunicação de Hóspedes</h2>
  <div style="display:flex;gap:8px">
    <button class="btn btn-outline" onclick="exportSefCsv()">↓ Exportar CSV</button>
    <button class="btn btn-primary" onclick="openSefInfo()">ℹ Como comunicar</button>
  </div>
</div>
<div class="stats-grid" style="grid-template-columns:repeat(3,1fr)">
  <div class="stat-card">
    <div class="stat-icon ${pending.length>0?'red':'green'}"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg></div>
    <div class="stat-label">Pendentes comunicação</div>
    <div class="stat-value" style="color:${pending.length>0?'var(--danger)':'var(--success)'}">${pending.length}</div>
    <div class="stat-sub">Prazo: 3 dias úteis após check-in</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon green"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg></div>
    <div class="stat-label">Comunicados</div>
    <div class="stat-value">${reported.length}</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon indigo"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0z"/></svg></div>
    <div class="stat-label">Total estrangeiros</div>
    <div class="stat-value">${foreign.length}</div>
  </div>
</div>
${pending.length>0?`
<div class="card mb-4" style="border-left:4px solid var(--danger)">
  <div class="card-title" style="color:var(--danger);margin-bottom:12px">⚠ Pendentes — comunicar ao SEF/SIBA</div>
  <div class="table-wrap"><table>
    <thead><tr><th>Hóspede</th><th>País</th><th>Documento</th><th>Propriedade</th><th>Check-in</th><th>Prazo SEF</th><th>Ação</th></tr></thead>
    <tbody>${pending.map(r=>{
      const p=getProp(r.prop_id);
      const dl=new Date(r.checkin); dl.setDate(dl.getDate()+3);
      const dlStr=dl.toISOString().slice(0,10);
      const overdue=dlStr<todayStr&&r.checkin<=todayStr;
      return`<tr>
        <td><strong>${FLAG[r.guest_nationality]||''} ${escHtml(r.guest_name)}</strong></td>
        <td>${COUNTRIES[r.guest_nationality]||r.guest_nationality}</td>
        <td>${r.doc_id?escHtml(r.doc_id):'<span class="sef-required">⚠ Em falta</span>'}</td>
        <td>${p?p.name:'—'}</td><td>${fmtDate(r.checkin)}</td>
        <td class="${overdue?'sef-required':''}">${fmtDate(dlStr)}${overdue?' ⚠ ATRASADO':''}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-success" onclick="markSefReported('${r.id}')">✓ Comunicado</button>
          <button class="btn btn-sm btn-outline" onclick="editReservation('${r.id}')">Editar</button>
        </td></tr>`;
    }).join('')}</tbody>
  </table></div>
</div>`:`<div class="card mb-4" style="border-left:4px solid var(--success);padding:16px"><span style="color:var(--success);font-weight:700">✓ Todos os hóspedes estrangeiros estão comunicados ao SEF/SIBA!</span></div>`}
<div class="card">
  <div class="card-title" style="margin-bottom:12px">Histórico — Comunicados</div>
  <div class="table-wrap"><table>
    <thead><tr><th>Hóspede</th><th>País</th><th>Documento</th><th>Propriedade</th><th>Check-in</th><th>Check-out</th><th>Estado</th></tr></thead>
    <tbody>${reported.length===0?'<tr><td colspan="7" class="text-center text-gray" style="padding:24px">Sem registos</td></tr>':
      reported.map(r=>{const p=getProp(r.prop_id);return`<tr><td>${FLAG[r.guest_nationality]||''} ${escHtml(r.guest_name)}</td><td>${COUNTRIES[r.guest_nationality]||r.guest_nationality}</td><td class="text-sm">${escHtml(r.doc_id)||'—'}</td><td>${p?p.name:'—'}</td><td>${fmtDate(r.checkin)}</td><td>${fmtDate(r.checkout)}</td><td><span class="badge badge-green">✓ Comunicado</span></td></tr>`;}).join('')
    }</tbody>
  </table></div>
</div>`;
}

async function markSefReported(id) {
  try { await api.sefReported(id); await navigate('sef'); toastMsg('Marcado como comunicado ao SEF/SIBA'); }
  catch(e) { toastMsg('Erro: '+e.message); }
}

function exportSefCsv() {
  const todayStr=today();
  const rows=cache.reservations.filter(r=>r.guest_nationality!=='PT'&&r.status!=='cancelled'&&r.checkout>=todayStr);
  const lines=['Nome;Nacionalidade;Documento;Propriedade;Check-in;Check-out;Hóspedes;Comunicado SEF',...rows.map(r=>{const p=getProp(r.prop_id);return[r.guest_name,r.guest_nationality,r.doc_id||'',p?p.name:'',r.checkin,r.checkout,r.guests,r.sef_reported?'Sim':'Não'].join(';');})];
  downloadFile('﻿'+lines.join('\n'),`sef_comunicacao_${today()}.csv`,'text/csv;charset=utf-8');
  toastMsg('CSV exportado');
}

function openSefInfo() {
  openModal('Como comunicar ao SEF/SIBA',`
    <div style="line-height:1.8;font-size:13.5px">
      <p><strong>Prazo:</strong> 3 dias úteis após o check-in do hóspede estrangeiro.</p>
      <p style="margin-top:8px"><strong>Como comunicar via SIBA:</strong></p>
      <ol style="padding-left:20px;margin-top:4px">
        <li>Acede ao portal <strong>sef.pt → SIBA</strong></li>
        <li>Usa as credenciais configuradas em Configurações → SEF</li>
        <li>Seleciona "Comunicação de Hóspedes"</li>
        <li>Preenche os dados (nome, documento, nacionalidade, datas)</li>
        <li>Confirma e guarda o nº de comunicação</li>
      </ol>
      <p style="margin-top:12px;color:var(--danger);font-weight:600">⚠ A não comunicação pode resultar em coima de €500 a €2500.</p>
    </div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>
  `);
}
