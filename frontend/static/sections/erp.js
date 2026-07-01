async function renderErp() {
  const s=cache.settings;
  const now=new Date(); const y=now.getFullYear(), m=now.getMonth()+1;
  const periodOpts=[];
  for(let i=0;i<12;i++){ const d=new Date(y,m-1-i,1); const v=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; periodOpts.push(`<option value="${v}">${d.toLocaleDateString('pt-PT',{month:'long',year:'numeric'})}</option>`); }
  const ACCS={'Alojamento':{i:'72100',e:'62100'},'Comissão OTA':{i:'72900',e:'62231'},'Limpeza':{i:'72900',e:'62220'},'Manutenção':{i:'72900',e:'62260'},'Água/Luz/Gás':{i:'72900',e:'62210'},'Internet':{i:'72900',e:'62243'},'Seguros':{i:'72900',e:'63700'},'Contabilidade':{i:'72900',e:'62221'}};
  return `
<div class="section-header"><h2>Primavera ERP v10 Evolution</h2></div>
<div class="card mb-4" style="background:#f0fdf4;border:1px solid #86efac">
  <div style="font-size:13.5px;color:#166534">Exporta lançamentos no formato compatível com o módulo de Contabilidade/Tesouraria do Primavera ERP v10 Evolution.</div>
</div>
<div class="grid-2 mb-4">
  <div class="card">
    <div class="card-title" style="margin-bottom:16px">Configuração Primavera</div>
    <div class="form-group"><label>Série de documentos</label><input id="erp-series" value="${escHtml(s.primaveraSeries||'AL')}" placeholder="AL"></div>
    <div class="form-group"><label>Taxa IVA AL (%)</label><select id="erp-vat">${[6,13,23,0].map(r=>`<option value="${r}" ${s.primaveraVatRate==r?'selected':''}>${r===0?'Isento':r+'%'}</option>`).join('')}</select></div>
    <div class="form-group"><label>NIF Proprietário</label><input id="erp-nif" value="${escHtml(s.ownerNIF||'')}" placeholder="123456789"></div>
    <button class="btn btn-primary" onclick="saveErpConfig()">Guardar configuração</button>
  </div>
  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Mapeamento de contas</div>
    ${Object.entries(ACCS).map(([cat,[i,e]])=>`<div class="erp-field-map"><div style="font-size:12.5px;background:var(--gray-100);padding:5px 10px;border-radius:6px">${cat}</div><div style="color:var(--gray-400);text-align:center">→</div><div style="font-size:12px;color:var(--gray-600)">${ACCS[cat]?.i||'72900'} / ${ACCS[cat]?.e||'62900'}</div></div>`).join('')}
  </div>
</div>
<div class="card mb-4">
  <div class="card-title" style="margin-bottom:16px">Exportar</div>
  <div class="form-row">
    <div class="form-group"><label>Período</label><select id="erp-period">${periodOpts.join('')}</select></div>
    <div class="form-group"><label>Propriedade</label><select id="erp-prop"><option value="">Todas</option>${cache.properties.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
  </div>
  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn btn-primary" onclick="doExportPrimavera('csv')">↓ CSV Primavera</button>
    <button class="btn btn-outline" onclick="doExportPrimavera('xml')">↓ XML Primavera</button>
    <button class="btn btn-outline" onclick="doExportPrimavera('saft')">↓ SAF-T PT</button>
    <button class="btn btn-outline" onclick="previewErp()">Pré-visualizar</button>
  </div>
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:12px">Pré-visualização</div>
  <div id="erp-preview"><div class="empty-state"><p>Clica em "Pré-visualizar" para ver os lançamentos do período</p></div></div>
</div>`;
}

async function saveErpConfig() {
  await api.updateSettings({ primaveraSeries:document.getElementById('erp-series').value.trim()||'AL', primaveraVatRate:document.getElementById('erp-vat').value, ownerNIF:document.getElementById('erp-nif').value.trim() });
  cache.settings.primaveraSeries=document.getElementById('erp-series').value.trim()||'AL';
  cache.settings.primaveraVatRate=document.getElementById('erp-vat').value;
  toastMsg('Configuração guardada');
}

const PRIMAVERA_ACCOUNTS={'Alojamento':{i:'72100',e:'62100'},'Comissão OTA':{i:'72900',e:'62231'},'Limpeza':{i:'72900',e:'62220'},'Manutenção':{i:'72900',e:'62260'},'Água/Luz/Gás':{i:'72900',e:'62210'},'Internet':{i:'72900',e:'62243'},'Seguros':{i:'72900',e:'63700'},'Contabilidade':{i:'72900',e:'62221'}};

function getErpTxs() {
  const period=document.getElementById('erp-period').value, propId=document.getElementById('erp-prop').value;
  let txs=cache.transactions.filter(t=>t.date.startsWith(period));
  if(propId) txs=txs.filter(t=>t.prop_id===propId);
  return txs;
}

function doExportPrimavera(fmt) {
  const txs=getErpTxs(); if(!txs.length){ toastMsg('Sem lançamentos no período'); return; }
  const period=document.getElementById('erp-period').value;
  const s=cache.settings; const vat=(parseFloat(s.primaveraVatRate)||6)/100; const serie=s.primaveraSeries||'AL';
  if(fmt==='csv') {
    const lines=['Série;Tipo Doc.;Data;Conta;Descrição;Valor s/IVA;Taxa IVA;Valor IVA;Valor Total;D/C',...txs.map(t=>{const p=getProp(t.prop_id),acc=PRIMAVERA_ACCOUNTS[t.category]||{i:'72900',e:'62900'},conta=t.type==='income'?acc.i:acc.e,vatAmt=t.type==='income'?+(t.amount*vat/(1+vat)).toFixed(2):0,net=+(t.amount-vatAmt).toFixed(2);return[serie,t.type==='income'?'FT':'FC',t.date,conta,`${t.desc}${p?' — '+p.name:''}`,net.toFixed(2).replace('.',','),Math.round(vat*100)+'%',vatAmt.toFixed(2).replace('.',','),t.amount.toFixed(2).replace('.',','),t.type==='income'?'C':'D'].join(';');})];
    downloadFile('﻿'+lines.join('\n'),`primavera_${period}.csv`,'text/csv;charset=utf-8');
    toastMsg('CSV exportado');
  } else if(fmt==='xml') {
    const lines=['<?xml version="1.0" encoding="UTF-8"?>','<PrimaveraImport>',`  <Serie>${escHtml(serie)}</Serie>`,`  <NIF>${escHtml(s.ownerNIF||'')}</NIF>`,`  <Periodo>${period}</Periodo>`,'  <Lancamentos>'];
    txs.forEach(t=>{const p=getProp(t.prop_id),acc=PRIMAVERA_ACCOUNTS[t.category]||{i:'72900',e:'62900'},conta=t.type==='income'?acc.i:acc.e,vatAmt=t.type==='income'?+(t.amount*vat/(1+vat)).toFixed(2):0;lines.push(`    <Lancamento><Tipo>${t.type==='income'?'FT':'FC'}</Tipo><Data>${t.date}</Data><Conta>${conta}</Conta><Descricao>${escHtml(t.desc)}${p?' — '+escHtml(p.name):''}</Descricao><ValorSemIVA>${(t.amount-vatAmt).toFixed(2)}</ValorSemIVA><TaxaIVA>${Math.round(vat*100)}</TaxaIVA><ValorIVA>${vatAmt.toFixed(2)}</ValorIVA><ValorTotal>${t.amount.toFixed(2)}</ValorTotal><DebitoCredito>${t.type==='income'?'C':'D'}</DebitoCredito></Lancamento>`);});
    lines.push('  </Lancamentos>','</PrimaveraImport>');
    downloadFile(lines.join('\n'),`primavera_${period}.xml`,'application/xml');
    toastMsg('XML exportado');
  } else { // SAF-T
    const [y,m2]=period.split('-'); const daysInM=new Date(+y,+m2,0).getDate();
    const incTxs=txs.filter(t=>t.type==='income');
    const xml=`<?xml version="1.0" encoding="UTF-8"?>\n<AuditFile xmlns="urn:OECD:Standard:SAF-T:1.00:PT">\n  <Header>\n    <AuditFileVersion>1.04_01</AuditFileVersion>\n    <CompanyID>${escHtml(s.ownerNIF||'')}</CompanyID>\n    <TaxRegistrationNumber>${escHtml(s.ownerNIF||'')}</TaxRegistrationNumber>\n    <TaxAccountingBasis>O</TaxAccountingBasis>\n    <CompanyName>${escHtml(s.ownerName||'')}</CompanyName>\n    <FiscalYear>${y}</FiscalYear>\n    <StartDate>${period}-01</StartDate>\n    <EndDate>${period}-${daysInM}</EndDate>\n    <CurrencyCode>EUR</CurrencyCode>\n    <DateCreated>${today()}</DateCreated>\n    <ProductID>AL Manager</ProductID>\n    <ProductVersion>1.0</ProductVersion>\n  </Header>\n</AuditFile>`;
    downloadFile(xml,`saft_${period}.xml`,'application/xml');
    toastMsg('SAF-T PT exportado');
  }
}

function previewErp() {
  const txs=getErpTxs(); const div=document.getElementById('erp-preview');
  if(!txs.length){ div.innerHTML='<div class="empty-state"><p>Sem lançamentos no período selecionado</p></div>'; return; }
  const s=cache.settings; const vat=(parseFloat(s.primaveraVatRate)||6)/100;
  let totInc=0,totExp=0;
  div.innerHTML=`<div class="table-wrap"><table>
    <thead><tr><th>Data</th><th>Tipo</th><th>Conta</th><th>Descrição</th><th>Valor s/IVA</th><th>IVA</th><th>Total</th><th>D/C</th></tr></thead>
    <tbody>${txs.map(t=>{const p=getProp(t.prop_id),acc=PRIMAVERA_ACCOUNTS[t.category]||{i:'72900',e:'62900'},conta=t.type==='income'?acc.i:acc.e,vatAmt=t.type==='income'?+(t.amount*vat/(1+vat)).toFixed(2):0,net=+(t.amount-vatAmt).toFixed(2);if(t.type==='income')totInc+=t.amount;else totExp+=t.amount;return`<tr><td>${fmtDate(t.date)}</td><td><span class="badge ${t.type==='income'?'badge-green':'badge-red'}">${t.type==='income'?'FT':'FC'}</span></td><td><code>${conta}</code></td><td class="text-sm">${escHtml(t.desc)}${p?` — ${p.name}`:''}</td><td>${fmtMoney(net)}</td><td class="text-sm">${fmtMoney(vatAmt)}</td><td class="fw-700">${fmtMoney(t.amount)}</td><td>${t.type==='income'?'C':'D'}</td></tr>`;}).join('')}</tbody>
    <tfoot><tr style="font-weight:700;border-top:2px solid var(--gray-300)"><td colspan="6" style="text-align:right;padding:10px">Receitas: <span style="color:var(--success)">${fmtMoney(totInc)}</span> | Despesas: <span style="color:var(--danger)">${fmtMoney(totExp)}</span></td><td colspan="2">Saldo: <span style="color:${totInc-totExp>=0?'var(--primary)':'var(--danger)'}">${fmtMoney(totInc-totExp)}</span></td></tr></tfoot>
  </table></div>`;
}
