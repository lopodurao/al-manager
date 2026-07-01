function renderFinancial() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + 1;
  const monthStr = `${y}-${String(m).padStart(2,'0')}`;

  const allIncome = state.transactions.filter(t => t.type === 'income');
  const allExpense = state.transactions.filter(t => t.type === 'expense');
  const mIncome = allIncome.filter(t => t.date.startsWith(monthStr)).reduce((s,t) => s + t.amount, 0);
  const mExpense = allExpense.filter(t => t.date.startsWith(monthStr)).reduce((s,t) => s + t.amount, 0);
  const mProfit = mIncome - mExpense;
  const ytdIncome = allIncome.filter(t => t.date.startsWith(`${y}-`)).reduce((s,t) => s + t.amount, 0);
  const ytdExpense = allExpense.filter(t => t.date.startsWith(`${y}-`)).reduce((s,t) => s + t.amount, 0);

  // By property
  const byProp = state.properties.map(p => ({
    ...p,
    income: allIncome.filter(t => t.propId === p.id && t.date.startsWith(monthStr)).reduce((s,t) => s + t.amount, 0),
    expense: allExpense.filter(t => t.propId === p.id && t.date.startsWith(monthStr)).reduce((s,t) => s + t.amount, 0),
  }));

  // Categories
  const cats = {};
  allExpense.filter(t => t.date.startsWith(`${y}-`)).forEach(t => { cats[t.category] = (cats[t.category] || 0) + t.amount; });

  return `
<div class="section-header">
  <h2>Financeiro</h2>
  <div style="display:flex;gap:8px">
    <button class="btn btn-outline" onclick="exportFinCsv()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      Exportar CSV
    </button>
    <button class="btn btn-primary" onclick="openAddTransaction()">+ Lançamento</button>
  </div>
</div>

<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-label">Receita este mês</div>
    <div class="stat-value" style="color:var(--success)">${fmtMoney(mIncome)}</div>
    <div class="stat-sub">YTD: ${fmtMoney(ytdIncome)}</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Despesas este mês</div>
    <div class="stat-value" style="color:var(--danger)">${fmtMoney(mExpense)}</div>
    <div class="stat-sub">YTD: ${fmtMoney(ytdExpense)}</div>
  </div>
  <div class="stat-card">
    <div class="stat-label">Lucro este mês</div>
    <div class="stat-value" style="color:${mProfit >= 0 ? 'var(--primary)' : 'var(--danger)'}">${fmtMoney(mProfit)}</div>
    <div class="stat-sub">YTD: ${fmtMoney(ytdIncome - ytdExpense)}</div>
  </div>
</div>

<div class="grid-2 mb-4">
  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Por propriedade (este mês)</div>
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <thead><tr><th style="text-align:left;padding:6px 0;border-bottom:1px solid var(--gray-200)">Propriedade</th><th>Receita</th><th>Despesa</th><th>Lucro</th></tr></thead>
      <tbody>
        ${byProp.map(p => `<tr style="border-bottom:1px solid var(--gray-100)">
          <td style="padding:8px 0">${p.name}</td>
          <td style="text-align:center;color:var(--success);font-weight:600">${fmtMoney(p.income)}</td>
          <td style="text-align:center;color:var(--danger);font-weight:600">${fmtMoney(p.expense)}</td>
          <td style="text-align:center;font-weight:700;color:${p.income-p.expense>=0?'var(--primary)':'var(--danger)'}">${fmtMoney(p.income-p.expense)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Despesas por categoria (${y})</div>
    ${Object.keys(cats).length === 0 ? '<div class="empty-state"><p>Sem despesas registadas</p></div>' :
      Object.entries(cats).sort((a,b) => b[1]-a[1]).map(([cat, val]) => {
        const pct = Math.round((val / ytdExpense) * 100);
        return `<div style="margin-bottom:10px">
          <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:3px">
            <span>${cat}</span><span class="fw-700">${fmtMoney(val)} (${pct}%)</span>
          </div>
          <div style="background:var(--gray-100);border-radius:999px;height:6px;overflow:hidden">
            <div style="background:var(--danger);height:100%;width:${pct}%;border-radius:999px"></div>
          </div>
        </div>`;
      }).join('')
    }
  </div>
</div>

<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <div class="card-title">Todos os lançamentos</div>
    <div style="display:flex;gap:8px">
      <select id="fin-type-filter" onchange="filterTransactions()" style="font-size:13px;padding:6px 10px;border:1px solid var(--gray-200);border-radius:6px">
        <option value="">Todos</option><option value="income">Receitas</option><option value="expense">Despesas</option>
      </select>
      <select id="fin-prop-filter" onchange="filterTransactions()" style="font-size:13px;padding:6px 10px;border:1px solid var(--gray-200);border-radius:6px">
        <option value="">Todas as prop.</option>
        ${state.properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="table-wrap">
    <table id="fin-table">
      <thead><tr><th>Data</th><th>Propriedade</th><th>Categoria</th><th>Descrição</th><th>Canal</th><th>Tipo</th><th class="text-right">Valor</th><th></th></tr></thead>
      <tbody>${renderTransRows(state.transactions)}</tbody>
    </table>
  </div>
</div>`;
}

function renderTransRows(list) {
  if (!list.length) return '<tr><td colspan="8" class="text-center text-gray" style="padding:24px">Sem lançamentos</td></tr>';
  return list.sort((a,b) => b.date.localeCompare(a.date)).map(t => {
    const p = getProp(t.propId);
    return `<tr>
      <td>${fmtDate(t.date)}</td>
      <td>${p ? p.name : '—'}</td>
      <td><span class="badge badge-gray">${escHtml(t.category)}</span></td>
      <td class="text-sm">${escHtml(t.desc)}</td>
      <td>${t.channel ? channelBadge(t.channel) : '—'}</td>
      <td>${t.type === 'income' ? '<span class="badge badge-green">Receita</span>' : '<span class="badge badge-red">Despesa</span>'}</td>
      <td class="text-right fw-700" style="color:${t.type==='income'?'var(--success)':'var(--danger)'}">${t.type==='income'?'+':'−'}${fmtMoney(t.amount)}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteTransaction('${t.id}')">✕</button></td>
    </tr>`;
  }).join('');
}

function filterTransactions() {
  const type = document.getElementById('fin-type-filter').value;
  const prop = document.getElementById('fin-prop-filter').value;
  let list = state.transactions;
  if (type) list = list.filter(t => t.type === type);
  if (prop) list = list.filter(t => t.propId === prop);
  document.querySelector('#fin-table tbody').innerHTML = renderTransRows(list);
}

function openAddTransaction() {
  openModal('Novo Lançamento', `
  <div class="form-row">
    <div class="form-group"><label>Tipo</label>
      <select id="tf2-type">
        <option value="income">Receita</option>
        <option value="expense">Despesa</option>
      </select>
    </div>
    <div class="form-group"><label>Propriedade</label><select id="tf2-prop">${propOptions()}</select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Data</label><input type="date" id="tf2-date" value="${today()}"></div>
    <div class="form-group"><label>Valor (€)</label><input type="number" id="tf2-amount" step="0.01" placeholder="0.00"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Categoria</label>
      <input id="tf2-cat" list="cat-list" placeholder="Alojamento, Limpeza…">
      <datalist id="cat-list">
        <option>Alojamento</option><option>Comissão OTA</option><option>Limpeza</option><option>Manutenção</option>
        <option>Água/Luz/Gás</option><option>Internet</option><option>Seguros</option><option>Contabilidade</option><option>Outros</option>
      </datalist>
    </div>
    <div class="form-group"><label>Canal</label>
      <select id="tf2-channel">
        <option value="">—</option>
        ${Object.entries(CHANNELS).map(([k,v]) => `<option value="${k}">${v}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="form-group"><label>Descrição</label><input id="tf2-desc" placeholder="Descrição do lançamento"></div>
  <div class="form-actions">
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" onclick="saveTransaction()">Guardar</button>
  </div>`);
}

function saveTransaction() {
  const obj = {
    id: genId('t'),
    propId: document.getElementById('tf2-prop').value,
    date: document.getElementById('tf2-date').value,
    type: document.getElementById('tf2-type').value,
    category: document.getElementById('tf2-cat').value.trim() || 'Outros',
    amount: parseFloat(document.getElementById('tf2-amount').value) || 0,
    channel: document.getElementById('tf2-channel').value,
    desc: document.getElementById('tf2-desc').value.trim(),
  };
  if (!obj.amount) { alert('Valor obrigatório'); return; }
  state.transactions.push(obj);
  saveState(); closeModal(); navigate('financial');
  toastMsg('Lançamento adicionado');
}

function deleteTransaction(id) {
  if (!confirm('Apagar este lançamento?')) return;
  state.transactions = state.transactions.filter(t => t.id !== id);
  saveState(); navigate('financial');
  toastMsg('Lançamento apagado');
}

function exportFinCsv() {
  const header = ['Data','Propriedade','Tipo','Categoria','Canal','Descrição','Valor'];
  const lines = [header.join(';'), ...state.transactions.sort((a,b) => b.date.localeCompare(a.date)).map(t => {
    const p = getProp(t.propId);
    return [t.date, p ? p.name : '', t.type === 'income' ? 'Receita' : 'Despesa', t.category, CHANNELS[t.channel]||'', t.desc, (t.type === 'income' ? '' : '-') + t.amount.toFixed(2)].join(';');
  })];
  downloadFile('﻿' + lines.join('\n'), `financeiro_${today()}.csv`, 'text/csv;charset=utf-8');
  toastMsg('CSV exportado');
}
