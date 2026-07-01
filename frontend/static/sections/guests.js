async function renderGuests() {
  const gm = {};
  cache.reservations.forEach(r => {
    const k = r.guest_email||r.guest_name;
    if (!gm[k]) gm[k]={ name:r.guest_name, email:r.guest_email, phone:r.guest_phone, nationality:r.guest_nationality, doc_id:r.doc_id, stays:[], total:0 };
    gm[k].stays.push(r); gm[k].total += r.price||0;
  });
  const guests = Object.values(gm);
  return `
<div class="section-header"><h2>Hóspedes</h2><span class="text-gray text-sm">${guests.length} hóspedes</span></div>
<input style="margin-bottom:12px;width:100%" placeholder="Pesquisar por nome, email, país…" oninput="filterGuests(this.value)">
<div class="card"><div class="table-wrap"><table id="guest-table">
  <thead><tr><th>Hóspede</th><th>Contacto</th><th>Documento</th><th>Estadias</th><th>Total gasto</th><th>Última estadia</th><th></th></tr></thead>
  <tbody>${renderGuestRows(guests)}</tbody>
</table></div></div>`;
}

function renderGuestRows(guests) {
  if (!guests.length) return '<tr><td colspan="7" class="text-center text-gray" style="padding:24px">Sem hóspedes</td></tr>';
  return guests.sort((a,b) => {
    const la = a.stays.reduce((m,r)=>r.checkin>m?r.checkin:m,'');
    const lb = b.stays.reduce((m,r)=>r.checkin>m?r.checkin:m,'');
    return lb.localeCompare(la);
  }).map(g => {
    const last = g.stays.sort((a,b)=>b.checkin.localeCompare(a.checkin))[0];
    const p = getProp(last.prop_id);
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:var(--primary-light);color:var(--primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;flex-shrink:0">${(g.name||'?')[0].toUpperCase()}</div>
        <div><div class="fw-700">${FLAG[g.nationality]||''} ${escHtml(g.name)}</div><div class="text-sm text-gray">${COUNTRIES[g.nationality]||'—'}</div></div>
      </div></td>
      <td><div class="text-sm">${escHtml(g.email)||'—'}</div><div class="text-sm text-gray">${escHtml(g.phone)||'—'}</div></td>
      <td class="text-sm">${escHtml(g.doc_id)||'—'}</td>
      <td>${g.stays.length} estadias</td>
      <td class="fw-700" style="color:var(--success)">${fmtMoney(g.total)}</td>
      <td>${fmtDate(last.checkin)} — ${fmtDate(last.checkout)}</td>
      <td><button class="btn btn-sm btn-outline" onclick="viewGuestHistory('${escHtml(g.email||g.name)}')">Histórico</button></td>
    </tr>`;
  }).join('');
}

function filterGuests(q) {
  const gm={};
  cache.reservations.forEach(r => {
    const k=r.guest_email||r.guest_name;
    if(!gm[k]) gm[k]={name:r.guest_name,email:r.guest_email,phone:r.guest_phone,nationality:r.guest_nationality,doc_id:r.doc_id,stays:[],total:0};
    gm[k].stays.push(r); gm[k].total+=r.price||0;
  });
  const lq=q.toLowerCase();
  const f=Object.values(gm).filter(g=>g.name.toLowerCase().includes(lq)||(g.email||'').toLowerCase().includes(lq)||(COUNTRIES[g.nationality]||'').toLowerCase().includes(lq));
  document.querySelector('#guest-table tbody').innerHTML=renderGuestRows(f);
}

function viewGuestHistory(key) {
  const res = cache.reservations.filter(r=>(r.guest_email||r.guest_name)===key);
  if (!res.length) return;
  const g = res[0];
  openModal(`Histórico — ${escHtml(g.guest_name)}`,`
    <div style="margin-bottom:16px;line-height:1.8;font-size:13.5px">
      <div><strong>Email:</strong> ${escHtml(g.guest_email)||'—'}</div>
      <div><strong>Telemóvel:</strong> ${escHtml(g.guest_phone)||'—'}</div>
      <div><strong>Documento:</strong> ${escHtml(g.doc_id)||'—'}</div>
      <div><strong>País:</strong> ${COUNTRIES[g.guest_nationality]||'—'}</div>
    </div>
    <table style="width:100%;font-size:13px;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid var(--gray-200)"><th style="padding:8px 0;text-align:left">Propriedade</th><th>Check-in</th><th>Check-out</th><th>Canal</th><th>Valor</th></tr></thead>
      <tbody>${res.map(r=>{const p=getProp(r.prop_id);return`<tr style="border-bottom:1px solid var(--gray-100)"><td style="padding:8px 0">${p?p.name:'—'}</td><td>${fmtDate(r.checkin)}</td><td>${fmtDate(r.checkout)}</td><td>${channelBadge(r.channel)}</td><td class="fw-700">${fmtMoney(r.price)}</td></tr>`;}).join('')}</tbody>
    </table>
    <div style="margin-top:12px;text-align:right;font-size:14px"><strong>Total gasto: ${fmtMoney(res.reduce((s,r)=>s+r.price,0))}</strong></div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>
  `);
}
