async function renderFinancial() {
  const now=new Date(); const y=now.getFullYear(), m=now.getMonth()+1;
  const ms=`${y}-${String(m).padStart(2,'0')}`;
  const mInc=cache.transactions.filter(t=>t.type==='income'&&t.date.startsWith(ms)).reduce((s,t)=>s+t.amount,0);
  const mExp=cache.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(ms)).reduce((s,t)=>s+t.amount,0);
  const yInc=cache.transactions.filter(t=>t.type==='income'&&t.date.startsWith(`${y}-`)).reduce((s,t)=>s+t.amount,0);
  const yExp=cache.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(`${y}-`)).reduce((s,t)=>s+t.amount,0);
  const cats={};
  cache.transactions.filter(t=>t.type==='expense'&&t.date.startsWith(`${y}-`)).forEach(t=>{ cats[t.category]=(cats[t.category]||0)+t.amount; });
  return `
<div class="section-header"><h2>Financeiro</h2>
  <div style="display:flex;gap:8px">
    <button class="btn btn-outline" onclick="exportFinCsv()">↓ Exportar CSV</button>
    <button class="btn btn-primary" onclick="openAddTransaction()">+ Lançamento</button>
  </div>
</div>
<div class="stats-grid">
  <div class="stat-card"><div class="stat-label">Receita este mês</div><div class="stat-value" style="color:var(--success)">${fmtMoney(mInc)}</div><div class="stat-sub">YTD: ${fmtMoney(yInc)}</div></div>
  <div class="stat-card"><div class="stat-label">Despesas este mês</div><div class="stat-value" style="color:var(--danger)">${fmtMoney(mExp)}</div><div class="stat-sub">YTD: ${fmtMoney(yExp)}</div></div>
  <div class="stat-card"><div class="stat-label">Lucro este mês</div><div class="stat-value" style="color:${mInc-mExp>=0?'var(--primary)':'var(--danger)'}">${fmtMoney(mInc-mExp)}</div><div class="stat-sub">YTD: ${fmtMoney(yInc-yExp)}</div></div>
</div>
<div class="grid-2 mb-4">
  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Por propriedade (este mês)</div>
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <thead><tr><th style="text-align:left;padding:6px 0;border-bottom:1px solid var(--gray-200)">Propriedade</th><th>Receita</th><th>Despesa</th><th>Lucro</th></tr></thead>
      <tbody>${cache.properties.map(p=>{
        const inc=cache.transactions.filter(t=>t.prop_id===p.id&&t.type==='income'&&t.date.startsWith(ms)).reduce((s,t)=>s+t.amount,0);
        const exp=cache.transactions.filter(t=>t.prop_id===p.id&&t.type==='expense'&&t.date.startsWith(ms)).reduce((s,t)=>s+t.amount,0);
        return`<tr style="border-bottom:1px solid var(--gray-100)"><td style="padding:8px 0">${p.name}</td><td style="text-align:center;color:var(--success);font-weight:600">${fmtMoney(inc)}</td><td style="text-align:center;color:var(--danger);font-weight:600">${fmtMoney(exp)}</td><td style="text-align:center;font-weight:700;color:${inc-exp>=0?'var(--primary)':'var(--danger)'}">${fmtMoney(inc-exp)}</td></tr>`;
      }).join('')}</tbody>
    </table>
  </div>
  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Despesas por categoria (${y})</div>
    ${Object.keys(cats).length===0?'<div class="empty-state"><p>Sem despesas</p></div>':
      Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,val])=>{const pct=Math.round((val/yExp)*100);return`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px"><span>${cat}</span><span class="fw-700">${fmtMoney(val)} (${pct}%)</span></div><div style="background:var(--gray-100);border-radius:999px;height:6px;overflow:hidden"><div style="background:var(--danger);height:100%;width:${pct}%;border-radius:999px"></div></div></div>`;}).join('')
    }
  </div>
</div>
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div class="card-title">Todos os lançamentos</div>
    <div style="display:flex;gap:8px">
      <select id="fin-type-f" onchange="filterTx()" style="font-size:13px;padding:6px 10px;border:1px solid var(--gray-200);border-radius:6px"><option value="">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option></select>
      <select id="fin-prop-f" onchange="filterTx()" style="font-size:13px;padding:6px 10px;border:1px solid var(--gray-200);border-radius:6px"><option value="">Todas as prop.</option>${cache.properties.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select>
    </div>
  </div>
  <div class="table-wrap"><table id="fin-table">
    <thead><tr><th>Data</th><th>Propriedade</th><th>Categoria</th><th>Descrição</th><th>Canal</th><th>Tipo</th><th class="text-right">Valor</th><th></th></tr></thead>
    <tbody>${renderTxRows(cache.transactions)}</tbody>
  </table></div>
</div>`;
}

function renderTxRows(list) {
  if(!list.length) return '<tr><td colspan="8" class="text-center text-gray" style="padding:24px">Sem lançamentos</td></tr>';
  return list.sort((a,b)=>b.date.localeCompare(a.date)).map(t=>{
    const p=getProp(t.prop_id);
    return`<tr><td>${fmtDate(t.date)}</td><td>${p?p.name:'—'}</td><td><span class="badge badge-gray">${escHtml(t.category)}</span></td><td class="text-sm">${escHtml(t.desc)}</td><td>${t.channel?channelBadge(t.channel):'—'}</td><td>${t.type==='income'?'<span class="badge badge-green">Receita</span>':'<span class="badge badge-red">Despesa</span>'}</td><td class="text-right fw-700" style="color:${t.type==='income'?'var(--success)':'var(--danger)'}">${t.type==='income'?'+':'−'}${fmtMoney(t.amount)}</td><td><button class="btn btn-sm btn-danger" onclick="doDeleteTx('${t.id}')">✕</button></td></tr>`;
  }).join('');
}

function filterTx() {
  const type=document.getElementById('fin-type-f').value, prop=document.getElementById('fin-prop-f').value;
  let l=cache.transactions;
  if(type) l=l.filter(t=>t.type===type);
  if(prop) l=l.filter(t=>t.prop_id===prop);
  document.querySelector('#fin-table tbody').innerHTML=renderTxRows(l);
}

function openAddTransaction() {
  openModal('Novo Lançamento',`
  <div class="form-row">
    <div class="form-group"><label>Tipo</label><select id="tf2-type"><option value="income">Receita</option><option value="expense">Despesa</option></select></div>
    <div class="form-group"><label>Propriedade</label><select id="tf2-prop">${propOptions()}</select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Data</label><input type="date" id="tf2-date" value="${today()}"></div>
    <div class="form-group"><label>Valor (€)</label><input type="number" id="tf2-amount" step="0.01" placeholder="0.00"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Categoria</label><input id="tf2-cat" list="cat-list" placeholder="Alojamento, Limpeza…"><datalist id="cat-list"><option>Alojamento</option><option>Comissão OTA</option><option>Limpeza</option><option>Manutenção</option><option>Água/Luz/Gás</option><option>Internet</option><option>Seguros</option><option>Contabilidade</option><option>Outros</option></datalist></div>
    <div class="form-group"><label>Canal</label><select id="tf2-channel"><option value="">—</option>${Object.entries(CHANNELS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></div>
  </div>
  <div class="form-group"><label>Descrição</label><input id="tf2-desc" placeholder="Descrição do lançamento"></div>
  <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" onclick="doSaveTx()">Guardar</button></div>`);
}

async function doSaveTx() {
  const d={ prop_id:document.getElementById('tf2-prop').value, date:document.getElementById('tf2-date').value, type:document.getElementById('tf2-type').value, category:document.getElementById('tf2-cat').value.trim()||'Outros', amount:parseFloat(document.getElementById('tf2-amount').value)||0, channel:document.getElementById('tf2-channel').value, desc:document.getElementById('tf2-desc').value.trim() };
  if(!d.amount){ alert('Valor obrigatório'); return; }
  try { await api.createTransaction(d); closeModal(); await navigate('financial'); toastMsg('Lançamento adicionado'); }
  catch(e){ toastMsg('Erro: '+e.message); }
}

async function doDeleteTx(id) {
  if(!confirm('Apagar este lançamento?')) return;
  try { await api.deleteTransaction(id); await navigate('financial'); toastMsg('Lançamento apagado'); }
  catch(e){ toastMsg('Erro: '+e.message); }
}

function exportFinCsv() {
  const lines=['Data;Propriedade;Tipo;Categoria;Canal;Descrição;Valor',...cache.transactions.sort((a,b)=>b.date.localeCompare(a.date)).map(t=>{const p=getProp(t.prop_id);return[t.date,p?p.name:'',t.type==='income'?'Receita':'Despesa',t.category,CHANNELS[t.channel]||'',t.desc,(t.type==='income'?'':'-')+t.amount.toFixed(2)].join(';');})];
  downloadFile('﻿'+lines.join('\n'),`financeiro_${today()}.csv`,'text/csv;charset=utf-8');
  toastMsg('CSV exportado');
}
