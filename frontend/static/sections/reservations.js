let calYear, calMonth, calPropFilter = '';

async function renderReservations() {
  const now = new Date();
  if (!calYear) { calYear = now.getFullYear(); calMonth = now.getMonth(); }
  const res = cache.reservations;
  return `
<div class="section-header">
  <h2>Reservas</h2>
  <div style="display:flex;gap:10px">
    <select onchange="calPropFilter=this.value;navigate('reservations')" style="width:160px">
      <option value="">Todas as prop.</option>
      ${cache.properties.map(p=>`<option value="${p.id}" ${calPropFilter===p.id?'selected':''}>${p.name}</option>`).join('')}
    </select>
    <button class="btn btn-primary" onclick="openAddReservation()">+ Nova Reserva</button>
  </div>
</div>
<div class="card mb-4">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <button class="btn btn-outline btn-sm" onclick="calMonth--;if(calMonth<0){calMonth=11;calYear--;}navigate('reservations')">‹ Anterior</button>
    <strong style="font-size:15px">${new Date(calYear,calMonth).toLocaleDateString('pt-PT',{month:'long',year:'numeric'})}</strong>
    <button class="btn btn-outline btn-sm" onclick="calMonth++;if(calMonth>11){calMonth=0;calYear++;}navigate('reservations')">Seguinte ›</button>
  </div>
  ${renderCalendar(calYear, calMonth, calPropFilter, res)}
</div>
<div class="card">
  <div class="card-title" style="margin-bottom:12px">Lista de Reservas</div>
  <input style="margin-bottom:12px" placeholder="Pesquisar hóspede…" oninput="filterResTable(this.value)">
  <div class="table-wrap"><table id="res-table">
    <thead><tr><th>Hóspede</th><th>Propriedade</th><th>Check-in</th><th>Check-out</th><th>Noites</th><th>Canal</th><th>Estado</th><th>Valor</th><th></th></tr></thead>
    <tbody>${renderResRows(res)}</tbody>
  </table></div>
</div>`;
}

function renderCalendar(y, m, propFilter, res) {
  const firstDay = new Date(y,m,1).getDay();
  const daysInMonth = new Date(y,m+1,0).getDate();
  const todayStr = today();
  const filtered = res.filter(r => r.status!=='cancelled' && (!propFilter||r.prop_id===propFilter));
  let html = `<div class="calendar-grid">`;
  ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].forEach(d => { html+=`<div class="cal-day-header">${d}</div>`; });
  for(let i=0;i<firstDay;i++) html+=`<div class="cal-day other-month"></div>`;
  for(let d=1;d<=daysInMonth;d++) {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayRes = filtered.filter(r => r.checkin<=ds && r.checkout>ds);
    html+=`<div class="cal-day${ds===todayStr?' today':''}">
      <div class="cal-day-num">${d}</div>
      ${dayRes.map(r=>`<div class="cal-event ${r.channel}" onclick="editReservation('${r.id}')">${escHtml(r.guest_name.split(',')[0])}</div>`).join('')}
    </div>`;
  }
  return html + '</div>';
}

function renderResRows(list) {
  if (!list.length) return '<tr><td colspan="9" class="text-center text-gray" style="padding:24px">Sem reservas</td></tr>';
  return list.sort((a,b)=>b.checkin.localeCompare(a.checkin)).map(r => {
    const p = getProp(r.prop_id);
    return `<tr>
      <td>${FLAG[r.guest_nationality]||''} <strong>${escHtml(r.guest_name)}</strong><br><span class="text-sm text-gray">${escHtml(r.guest_email)}</span></td>
      <td>${p?p.name:'—'}</td><td>${fmtDate(r.checkin)}</td><td>${fmtDate(r.checkout)}</td>
      <td>${nights(r.checkin,r.checkout)}</td><td>${channelBadge(r.channel)}</td>
      <td>${statusBadge(r.status)}</td><td class="fw-700">${fmtMoney(r.price)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick="editReservation('${r.id}')">Editar</button>
        ${r.guest_email ? `<button class="btn btn-sm btn-success" onclick="openSendInvoice('${r.id}','${escHtml(r.guest_email)}','${escHtml(r.guest_name)}')">📄 Fatura</button>` : ''}
        ${r.status !== 'cancelled' ? `<button class="btn btn-sm btn-danger" onclick="cancelReservation('${r.id}','${escHtml(r.guest_name)}')">Cancelar</button>` : `<button class="btn btn-sm btn-outline" onclick="deleteReservation('${r.id}')" title="Eliminar permanentemente">✕</button>`}
      </td></tr>`;
  }).join('');
}

function filterResTable(q) {
  const lq = q.toLowerCase();
  const f = cache.reservations.filter(r => r.guest_name.toLowerCase().includes(lq)||r.guest_email.toLowerCase().includes(lq));
  document.querySelector('#res-table tbody').innerHTML = renderResRows(f);
}

function openAddReservation() {
  openModal('Nova Reserva', reservationForm(null), true);
  document.getElementById('save-res-btn').onclick = () => doSaveReservation(null);
}
function editReservation(id) {
  const r = cache.reservations.find(r=>r.id===id);
  openModal('Editar Reserva', reservationForm(r), true);
  document.getElementById('save-res-btn').onclick = () => doSaveReservation(id);
}
function reservationForm(r) {
  return `
  <div class="form-row">
    <div class="form-group"><label>Propriedade *</label><select id="rf-prop">${propOptions(r?.prop_id)}</select></div>
    <div class="form-group"><label>Canal *</label><select id="rf-channel">${Object.entries(CHANNELS).map(([k,v])=>`<option value="${k}" ${r?.channel===k?'selected':''}>${v}</option>`).join('')}</select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Nome do hóspede *</label><input id="rf-name" value="${escHtml(r?.guest_name||'')}" placeholder="Apelido, Nome"></div>
    <div class="form-group"><label>Nacionalidade</label><select id="rf-nat">${countryOptions(r?.guest_nationality||'PT')}</select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Email</label><input id="rf-email" type="email" value="${escHtml(r?.guest_email||'')}"></div>
    <div class="form-group"><label>Telemóvel</label><input id="rf-phone" value="${escHtml(r?.guest_phone||'')}"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Nº Documento</label><input id="rf-doc" value="${escHtml(r?.doc_id||'')}"></div>
    <div class="form-group"><label>Hóspedes</label><input type="number" id="rf-guests" value="${r?.guests||2}" min="1"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Check-in *</label><input type="date" id="rf-checkin" value="${r?.checkin||''}"></div>
    <div class="form-group"><label>Check-out *</label><input type="date" id="rf-checkout" value="${r?.checkout||''}"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Valor total (€)</label><input type="number" id="rf-price" value="${r?.price||''}" step="0.01"></div>
    <div class="form-group"><label>Comissão OTA (€)</label><input type="number" id="rf-commission" value="${r?.commission||0}" step="0.01"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Estado</label><select id="rf-status">
      ${[['confirmed','Confirmada'],['pending','Pendente'],['checkedin','Check-in feito'],['checkedout','Check-out feito'],['cancelled','Cancelada']].map(([v,l])=>`<option value="${v}" ${r?.status===v?'selected':''}>${l}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>SEF comunicado?</label><select id="rf-sef"><option value="">Não</option><option value="1" ${r?.sef_reported?'selected':''}>Sim</option></select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Quarto / Unidade</label>
      <input id="rf-room" list="room-list" value="${escHtml(r?.room||'')}" placeholder="ex: Quarto Verde">
      <datalist id="room-list">${_roomOptions()}</datalist>
    </div>
    <div class="form-group"></div>
  </div>
  <div class="form-group"><label>Notas</label><textarea id="rf-notes">${escHtml(r?.notes||'')}</textarea></div>
  <div id="res-form-error" style="display:none;color:#dc2626;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;font-size:13.5px;margin-bottom:4px"></div>
  <div class="form-actions">
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="save-res-btn">Guardar</button>
  </div>`;
}
function _roomOptions() {
  try {
    const mapping = JSON.parse(cache.settings.livvi_rooms || '{}');
    return Object.keys(mapping).map(r => `<option value="${escHtml(r)}">`).join('');
  } catch { return ''; }
}

async function doSaveReservation(id) {
  const checkin = document.getElementById('rf-checkin').value;
  const checkout = document.getElementById('rf-checkout').value;
  const name = document.getElementById('rf-name').value.trim();
  if (!name||!checkin||!checkout) { alert('Preenche os campos obrigatórios'); return; }
  if (checkout<=checkin) { alert('Check-out deve ser depois do check-in'); return; }
  const d = { prop_id:document.getElementById('rf-prop').value, guest_name:name, guest_email:document.getElementById('rf-email').value.trim(), guest_phone:document.getElementById('rf-phone').value.trim(), guest_nationality:document.getElementById('rf-nat').value, doc_id:document.getElementById('rf-doc').value.trim(), guests:+document.getElementById('rf-guests').value, checkin, checkout, channel:document.getElementById('rf-channel').value, status:document.getElementById('rf-status').value, price:parseFloat(document.getElementById('rf-price').value)||0, commission:parseFloat(document.getElementById('rf-commission').value)||0, sef_reported:!!document.getElementById('rf-sef').value, room:document.getElementById('rf-room').value.trim(), notes:document.getElementById('rf-notes').value };
  const btn = document.getElementById('save-res-btn');
  const isNew = !id && d.status === 'confirmed';
  const errBox = document.getElementById('res-form-error');
  if (errBox) { errBox.style.display = 'none'; errBox.textContent = ''; }
  btn.disabled = true;
  btn.textContent = '⏳ A guardar…';
  try {
    id ? await api.updateReservation(id,d) : await api.createReservation(d);
    closeModal(); await navigate('reservations');
    toastMsg(id ? 'Reserva atualizada' : `✓ Reserva criada${isNew ? ' — PIN Livvi e email a ser enviados em segundo plano' : ''}`);
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Guardar';
    console.error('Erro ao guardar reserva:', e);
    if (errBox) {
      errBox.textContent = '⚠ ' + e.message;
      errBox.style.display = 'block';
      errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      alert('⚠ ' + e.message);
    }
  }
}
async function cancelReservation(id, name) {
  if (!confirm(`Cancelar a reserva de ${name}?\n\nSe o hóspede tiver email, será enviada uma notificação de cancelamento.`)) return;
  const r = cache.reservations.find(r => r.id === id);
  if (!r) return;
  try {
    await api.updateReservation(id, { ...r, status: 'cancelled' });
    await navigate('reservations');
    toastMsg('Reserva cancelada' + (r.guest_email ? ' — email de cancelamento enviado' : ''));
  } catch(e) { toastMsg('Erro: ' + e.message); }
}

async function deleteReservation(id) {
  if (!confirm('Eliminar permanentemente esta reserva? Esta acção não pode ser desfeita.')) return;
  try { await api.deleteReservation(id); await navigate('reservations'); toastMsg('Reserva eliminada'); }
  catch(e) { toastMsg('Erro: '+e.message); }
}

function openSendInvoice(rid, email, guestName) {
  openModal('Enviar Fatura', `
    <div style="margin-bottom:16px;padding:12px 16px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0;font-size:13.5px">
      📧 Será enviado para <strong>${escHtml(email)}</strong> (${escHtml(guestName)})
    </div>
    <div class="form-group">
      <label>Ficheiro PDF da fatura (gerado no Primavera)</label>
      <input type="file" id="invoice-file" accept=".pdf,.PDF" style="padding:8px">
    </div>
    <div id="invoice-status" style="min-height:20px;font-size:13px;margin-bottom:8px"></div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="doSendInvoice('${rid}')">📤 Enviar fatura</button>
    </div>
  `);
}

async function doSendInvoice(rid) {
  const fileInput = document.getElementById('invoice-file');
  const status    = document.getElementById('invoice-status');
  if (!fileInput.files.length) { status.textContent = '⚠ Seleciona o ficheiro PDF primeiro.'; status.style.color = '#ef4444'; return; }
  const file = fileInput.files[0];
  if (file.size > 10 * 1024 * 1024) { status.textContent = '⚠ Ficheiro demasiado grande (máx. 10 MB).'; status.style.color = '#ef4444'; return; }
  status.textContent = 'A enviar…'; status.style.color = '#6b7280';
  const form = new FormData();
  form.append('file', file);
  try {
    const res = await fetch(`/api/reservations/${rid}/send-invoice`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${_token}` },
      body: form,
    });
    if (!res.ok) { const e = await res.json().catch(()=>({detail:'Erro desconhecido'})); throw new Error(e.detail); }
    const data = await res.json();
    closeModal();
    toastMsg(`✓ Fatura enviada para ${data.sent_to}`);
  } catch(e) {
    status.textContent = '✕ Erro: ' + e.message;
    status.style.color = '#ef4444';
  }
}
