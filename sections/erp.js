function renderErp() {
  const s = state.settings;
  return `
<div class="section-header">
  <h2>Primavera ERP v10 Evolution</h2>
</div>

<div class="card mb-4" style="background:#f0fdf4;border:1px solid #86efac">
  <div style="font-size:13.5px;color:#166534">
    <strong>Integração com Primavera ERP v10 Evolution</strong> — Exporta receitas e despesas em formato compatível para importação no módulo de Contabilidade/Tesouraria do Primavera.
  </div>
</div>

<div class="grid-2 mb-4">
  <div class="card">
    <div class="card-title" style="margin-bottom:16px">Configuração Primavera</div>
    <div class="form-group"><label>Série de documentos (ex: AL)</label><input id="erp-series" value="${escHtml(s.primaveraSeries||'AL')}" placeholder="AL"></div>
    <div class="form-group"><label>Taxa IVA AL (%)</label>
      <select id="erp-vat">
        <option value="6" ${s.primaveraVatRate==6?'selected':''}>6% (AL)</option>
        <option value="13" ${s.primaveraVatRate==13?'selected':''}>13%</option>
        <option value="23" ${s.primaveraVatRate==23?'selected':''}>23%</option>
        <option value="0" ${s.primaveraVatRate==0?'selected':''}>Isento</option>
      </select>
    </div>
    <div class="form-group"><label>NIF Proprietário</label><input id="erp-nif" value="${escHtml(s.ownerNIF||'')}" placeholder="123456789"></div>
    <button class="btn btn-primary" onclick="saveErpConfig()">Guardar configuração</button>
  </div>

  <div class="card">
    <div class="card-title" style="margin-bottom:12px">Mapeamento de contas</div>
    <div style="font-size:12px;color:var(--gray-500);margin-bottom:12px">Categoria AL Manager → Conta Primavera</div>
    ${[
      ['Alojamento', '72100 — Prestações de serviços'],
      ['Comissão OTA', '62231 — Comissões e honorários'],
      ['Limpeza', '62220 — Trabalhos especializados'],
      ['Manutenção', '62260 — Conservação e reparação'],
      ['Água/Luz/Gás', '62210 — Subcontratos'],
      ['Internet', '62243 — Comunicações'],
      ['Seguros', '63700 — Seguros'],
      ['Contabilidade', '62221 — Assessoria técnica'],
    ].map(([cat, conta]) => `
      <div class="erp-field-map">
        <div style="font-size:12.5px;background:var(--gray-100);padding:5px 10px;border-radius:6px">${cat}</div>
        <div class="erp-arrow">→</div>
        <div style="font-size:12.5px;color:var(--gray-600)">${conta}</div>
      </div>`).join('')}
  </div>
</div>

<div class="card mb-4">
  <div class="card-title" style="margin-bottom:16px">Exportar para Primavera ERP</div>
  <div class="form-row">
    <div class="form-group">
      <label>Período</label>
      <select id="erp-period">
        ${(() => {
          const now = new Date(); const opts = [];
          for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            const label = d.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
            opts.push(`<option value="${val}">${label}</option>`);
          }
          return opts.join('');
        })()}
      </select>
    </div>
    <div class="form-group">
      <label>Propriedade</label>
      <select id="erp-prop">
        <option value="">Todas</option>
        ${state.properties.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
      </select>
    </div>
  </div>

  <div style="display:flex;gap:10px;flex-wrap:wrap">
    <button class="btn btn-primary" onclick="exportPrimaveraCsv()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
      Exportar CSV (Primavera)
    </button>
    <button class="btn btn-outline" onclick="exportPrimaveraXml()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633z" clip-rule="evenodd"/></svg>
      Exportar XML (Primavera)
    </button>
    <button class="btn btn-outline" onclick="exportSaft()">Exportar SAF-T PT</button>
  </div>
</div>

<div class="card">
  <div class="card-title" style="margin-bottom:12px">Pré-visualização — Lançamentos do período</div>
  <div id="erp-preview">
    <div class="empty-state"><p>Seleciona o período e carrega para pré-visualizar</p></div>
  </div>
  <div class="form-actions" style="margin-top:12px">
    <button class="btn btn-outline" onclick="previewErpExport()">Pré-visualizar</button>
  </div>
</div>`;
}

function saveErpConfig() {
  state.settings.primaveraSeries = document.getElementById('erp-series').value.trim() || 'AL';
  state.settings.primaveraVatRate = +document.getElementById('erp-vat').value;
  state.settings.ownerNIF = document.getElementById('erp-nif').value.trim();
  saveState(); toastMsg('Configuração guardada');
}

function getErpTransactions() {
  const period = document.getElementById('erp-period').value;
  const propId = document.getElementById('erp-prop').value;
  let txs = state.transactions.filter(t => t.date.startsWith(period));
  if (propId) txs = txs.filter(t => t.propId === propId);
  return txs;
}

const PRIMAVERA_ACCOUNTS = {
  'Alojamento': { income: '72100', expense: '62100' },
  'Comissão OTA': { income: '72900', expense: '62231' },
  'Limpeza': { income: '72900', expense: '62220' },
  'Manutenção': { income: '72900', expense: '62260' },
  'Água/Luz/Gás': { income: '72900', expense: '62210' },
  'Internet': { income: '72900', expense: '62243' },
  'Seguros': { income: '72900', expense: '63700' },
  'Contabilidade': { income: '72900', expense: '62221' },
};

function txToPrimaveraCsv(txs) {
  const s = state.settings;
  const vatRate = s.primaveraVatRate / 100;
  const header = ['Série','Tipo Documento','Data','Conta','Descrição','Valor s/ IVA','Taxa IVA','Valor IVA','Valor Total','Débito/Crédito'];
  const rows = txs.map(t => {
    const p = getProp(t.propId);
    const acc = PRIMAVERA_ACCOUNTS[t.category] || { income: '72900', expense: '62900' };
    const conta = t.type === 'income' ? acc.income : acc.expense;
    const vatAmt = t.type === 'income' ? +(t.amount * vatRate / (1 + vatRate)).toFixed(2) : 0;
    const netAmt = +(t.amount - vatAmt).toFixed(2);
    return [
      s.primaveraSeries,
      t.type === 'income' ? 'FT' : 'FC',
      t.date,
      conta,
      `${t.desc}${p ? ' — ' + p.name : ''}`,
      netAmt.toFixed(2).replace('.',','),
      s.primaveraVatRate + '%',
      vatAmt.toFixed(2).replace('.',','),
      t.amount.toFixed(2).replace('.',','),
      t.type === 'income' ? 'C' : 'D',
    ].join(';');
  });
  return [header.join(';'), ...rows].join('\n');
}

function exportPrimaveraCsv() {
  const txs = getErpTransactions();
  if (!txs.length) { toastMsg('Sem lançamentos no período selecionado'); return; }
  const period = document.getElementById('erp-period').value;
  downloadFile('﻿' + txToPrimaveraCsv(txs), `primavera_${period}.csv`, 'text/csv;charset=utf-8');
  toastMsg(`CSV exportado — ${txs.length} lançamento(s)`);
}

function exportPrimaveraXml() {
  const txs = getErpTransactions();
  if (!txs.length) { toastMsg('Sem lançamentos no período selecionado'); return; }
  const period = document.getElementById('erp-period').value;
  const s = state.settings;
  const vatRate = s.primaveraVatRate / 100;
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>','<PrimaveraImport>',`  <Serie>${escHtml(s.primaveraSeries)}</Serie>`,`  <NIF>${escHtml(s.ownerNIF)}</NIF>`,`  <Periodo>${period}</Periodo>`, '  <Lancamentos>'];
  txs.forEach(t => {
    const p = getProp(t.propId);
    const acc = PRIMAVERA_ACCOUNTS[t.category] || { income: '72900', expense: '62900' };
    const conta = t.type === 'income' ? acc.income : acc.expense;
    const vatAmt = t.type === 'income' ? +(t.amount * vatRate / (1 + vatRate)).toFixed(2) : 0;
    lines.push(`    <Lancamento>`);
    lines.push(`      <Tipo>${t.type === 'income' ? 'FT' : 'FC'}</Tipo>`);
    lines.push(`      <Data>${t.date}</Data>`);
    lines.push(`      <Conta>${conta}</Conta>`);
    lines.push(`      <Descricao>${escHtml(t.desc)}${p ? ' — ' + escHtml(p.name) : ''}</Descricao>`);
    lines.push(`      <ValorSemIVA>${(t.amount - vatAmt).toFixed(2)}</ValorSemIVA>`);
    lines.push(`      <TaxaIVA>${s.primaveraVatRate}</TaxaIVA>`);
    lines.push(`      <ValorIVA>${vatAmt.toFixed(2)}</ValorIVA>`);
    lines.push(`      <ValorTotal>${t.amount.toFixed(2)}</ValorTotal>`);
    lines.push(`      <DebitoCredito>${t.type === 'income' ? 'C' : 'D'}</DebitoCredito>`);
    lines.push(`    </Lancamento>`);
  });
  lines.push('  </Lancamentos>', '</PrimaveraImport>');
  downloadFile(lines.join('\n'), `primavera_${period}.xml`, 'application/xml');
  toastMsg(`XML exportado — ${txs.length} lançamento(s)`);
}

function exportSaft() {
  const period = document.getElementById('erp-period').value;
  const [y, m] = period.split('-');
  const s = state.settings;
  const txs = getErpTransactions();
  // Simplified SAF-T PT structure
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:Standard:SAF-T:1.00:PT" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Header>
    <AuditFileVersion>1.04_01</AuditFileVersion>
    <CompanyID>${escHtml(s.ownerNIF)}</CompanyID>
    <TaxRegistrationNumber>${escHtml(s.ownerNIF)}</TaxRegistrationNumber>
    <TaxAccountingBasis>O</TaxAccountingBasis>
    <CompanyName>${escHtml(s.ownerName)}</CompanyName>
    <FiscalYear>${y}</FiscalYear>
    <StartDate>${period}-01</StartDate>
    <EndDate>${period}-${new Date(+y, +m, 0).getDate()}</EndDate>
    <CurrencyCode>EUR</CurrencyCode>
    <DateCreated>${today()}</DateCreated>
    <SoftwareCertificateNumber>0</SoftwareCertificateNumber>
    <ProductID>AL Manager</ProductID>
    <ProductVersion>1.0</ProductVersion>
  </Header>
  <SourceDocuments>
    <SalesInvoices>
      <NumberOfEntries>${txs.filter(t => t.type === 'income').length}</NumberOfEntries>
      <TotalDebit>0.00</TotalDebit>
      <TotalCredit>${txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0).toFixed(2)}</TotalCredit>
      ${txs.filter(t => t.type === 'income').map((t, i) => {
        const p = getProp(t.propId);
        const vatRate = s.primaveraVatRate / 100;
        const vatAmt = +(t.amount * vatRate / (1 + vatRate)).toFixed(2);
        return `<Invoice>
        <InvoiceNo>${s.primaveraSeries}/${String(i+1).padStart(4,'0')}</InvoiceNo>
        <InvoiceDate>${t.date}</InvoiceDate>
        <InvoiceType>FT</InvoiceType>
        <Description>${escHtml(t.desc)}</Description>
        <Line>
          <LineNumber>1</LineNumber>
          <Description>${escHtml(p ? p.name : 'AL')}</Description>
          <UnitPrice>${(t.amount - vatAmt).toFixed(2)}</UnitPrice>
          <Quantity>1</Quantity>
          <Tax><TaxType>IVA</TaxType><TaxCountryRegion>PT</TaxCountryRegion><TaxCode>RED</TaxCode><TaxPercentage>${s.primaveraVatRate}</TaxPercentage></Tax>
          <CreditAmount>${t.amount.toFixed(2)}</CreditAmount>
        </Line>
        <DocumentTotals>
          <TaxPayable>${vatAmt.toFixed(2)}</TaxPayable>
          <NetTotal>${(t.amount - vatAmt).toFixed(2)}</NetTotal>
          <GrossTotal>${t.amount.toFixed(2)}</GrossTotal>
        </DocumentTotals>
      </Invoice>`;
      }).join('\n')}
    </SalesInvoices>
  </SourceDocuments>
</AuditFile>`;
  downloadFile(xml, `saft_${period}.xml`, 'application/xml');
  toastMsg('SAF-T PT exportado');
}

function previewErpExport() {
  const txs = getErpTransactions();
  const div = document.getElementById('erp-preview');
  if (!txs.length) { div.innerHTML = '<div class="empty-state"><p>Sem lançamentos no período selecionado</p></div>'; return; }
  const s = state.settings;
  const vatRate = s.primaveraVatRate / 100;
  let totalInc = 0, totalExp = 0;
  div.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Data</th><th>Tipo Doc.</th><th>Conta</th><th>Descrição</th><th>Valor s/ IVA</th><th>IVA</th><th>Total</th><th>D/C</th></tr></thead>
        <tbody>
          ${txs.map(t => {
            const p = getProp(t.propId);
            const acc = PRIMAVERA_ACCOUNTS[t.category] || { income: '72900', expense: '62900' };
            const conta = t.type === 'income' ? acc.income : acc.expense;
            const vatAmt = t.type === 'income' ? +(t.amount * vatRate / (1 + vatRate)).toFixed(2) : 0;
            const net = +(t.amount - vatAmt).toFixed(2);
            if (t.type === 'income') totalInc += t.amount; else totalExp += t.amount;
            return `<tr>
              <td>${fmtDate(t.date)}</td>
              <td><span class="badge ${t.type==='income'?'badge-green':'badge-red'}">${t.type==='income'?'FT':'FC'}</span></td>
              <td><code>${conta}</code></td>
              <td class="text-sm">${escHtml(t.desc)}${p?` — ${p.name}`:''}</td>
              <td>${fmtMoney(net)}</td>
              <td class="text-sm">${fmtMoney(vatAmt)} (${s.primaveraVatRate}%)</td>
              <td class="fw-700">${fmtMoney(t.amount)}</td>
              <td>${t.type==='income'?'C':'D'}</td>
            </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="font-weight:700;border-top:2px solid var(--gray-300)">
            <td colspan="6" style="text-align:right">Total receitas: <span style="color:var(--success)">${fmtMoney(totalInc)}</span> | Total despesas: <span style="color:var(--danger)">${fmtMoney(totalExp)}</span></td>
            <td colspan="2">Saldo: <span style="color:${totalInc-totalExp>=0?'var(--primary)':'var(--danger)'}">${fmtMoney(totalInc-totalExp)}</span></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
}
