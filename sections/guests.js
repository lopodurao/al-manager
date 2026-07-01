function renderGuests() {
  // Build guest list from reservations
  const guestMap = {};
  state.reservations.forEach(r => {
    if (!guestMap[r.guestEmail || r.guestName]) {
      guestMap[r.guestEmail || r.guestName] = { name: r.guestName, email: r.guestEmail, phone: r.guestPhone, nationality: r.guestNationality, docId: r.docId, stays: [], totalSpent: 0 };
    }
    guestMap[r.guestEmail || r.guestName].stays.push(r);
    guestMap[r.guestEmail || r.guestName].totalSpent += r.price || 0;
  });
  const guests = Object.values(guestMap);

  return `
<div class="section-header">
  <h2>Hóspedes</h2>
  <span class="text-gray text-sm">${guests.length} hóspedes registados</span>
</div>
<div class="search-bar">
  <input id="guest-search" placeholder="Pesquisar por nome, email, país…" oninput="filterGuests(this.value)">
</div>
<div class="card">
  <div class="table-wrap">
    <table id="guest-table">
      <thead><tr><th>Hóspede</th><th>Contacto</th><th>Documento</th><th>Estadias</th><th>Total gasto</th><th>Última estadia</th><th></th></tr></thead>
      <tbody>
        ${renderGuestRows(guests)}
      </tbody>
    </table>
  </div>
</div>`;
}

function renderGuestRows(guests) {
  if (!guests.length) return '<tr><td colspan="7" class="text-center text-gray" style="padding:24px">Sem hóspedes</td></tr>';
  return guests.sort((a,b) => {
    const la = a.stays.reduce((m,r) => r.checkin > m ? r.checkin : m, '');
    const lb = b.stays.reduce((m,r) => r.checkin > m ? r.checkin : m, '');
    return lb.localeCompare(la);
  }).map(g => {
    const lastStay = g.stays.sort((a,b) => b.checkin.localeCompare(a.checkin))[0];
    const p = getProp(lastStay.propId);
    return `<tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">
            ${(g.name||'?')[0].toUpperCase()}
          </div>
          <div>
            <div class="fw-700">${FLAG[g.nationality]||''} ${escHtml(g.name)}</div>
            <div class="text-sm text-gray">${COUNTRIES[g.nationality]||g.nationality||'—'}</div>
          </div>
        </div>
      </td>
      <td>
        <div class="text-sm">${escHtml(g.email)||'—'}</div>
        <div class="text-sm text-gray">${escHtml(g.phone)||'—'}</div>
      </td>
      <td class="text-sm">${escHtml(g.docId)||'—'}</td>
      <td>${g.stays.length} × <span class="text-gray text-sm">${g.stays.map(r => p ? p.name : '?').join(', ')}</span></td>
      <td class="fw-700" style="color:var(--success)">${fmtMoney(g.totalSpent)}</td>
      <td>${fmtDate(lastStay.checkin)} — ${fmtDate(lastStay.checkout)}</td>
      <td>
        <button class="btn btn-sm btn-outline" onclick="viewGuestHistory('${escHtml(g.email||g.name)}')">Histórico</button>
      </td>
    </tr>`;
  }).join('');
}

function filterGuests(q) {
  const guestMap = {};
  state.reservations.forEach(r => {
    const key = r.guestEmail || r.guestName;
    if (!guestMap[key]) guestMap[key] = { name: r.guestName, email: r.guestEmail, phone: r.guestPhone, nationality: r.guestNationality, docId: r.docId, stays: [], totalSpent: 0 };
    guestMap[key].stays.push(r);
    guestMap[key].totalSpent += r.price || 0;
  });
  const all = Object.values(guestMap);
  const lq = q.toLowerCase();
  const filtered = all.filter(g => g.name.toLowerCase().includes(lq) || (g.email||'').toLowerCase().includes(lq) || (COUNTRIES[g.nationality]||'').toLowerCase().includes(lq));
  document.querySelector('#guest-table tbody').innerHTML = renderGuestRows(filtered);
}

function viewGuestHistory(emailOrName) {
  const res = state.reservations.filter(r => (r.guestEmail || r.guestName) === emailOrName);
  const g = res[0];
  openModal(`Histórico — ${escHtml(g.guestName)}`,`
    <div style="margin-bottom:16px">
      <div><strong>Email:</strong> ${escHtml(g.guestEmail)||'—'}</div>
      <div><strong>Telemóvel:</strong> ${escHtml(g.guestPhone)||'—'}</div>
      <div><strong>Documento:</strong> ${escHtml(g.docId)||'—'}</div>
      <div><strong>País:</strong> ${COUNTRIES[g.guestNationality]||'—'}</div>
    </div>
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid var(--gray-200)"><th style="padding:8px 0;text-align:left">Propriedade</th><th>Check-in</th><th>Check-out</th><th>Canal</th><th>Valor</th></tr></thead>
      <tbody>
        ${res.map(r => {
          const p = getProp(r.propId);
          return `<tr style="border-bottom:1px solid var(--gray-100)">
            <td style="padding:8px 0">${p ? p.name : '—'}</td>
            <td>${fmtDate(r.checkin)}</td>
            <td>${fmtDate(r.checkout)}</td>
            <td>${channelBadge(r.channel)}</td>
            <td class="fw-700">${fmtMoney(r.price)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    <div style="margin-top:12px;text-align:right;font-size:14px"><strong>Total gasto: ${fmtMoney(res.reduce((s,r) => s + r.price, 0))}</strong></div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>
  `);
}
