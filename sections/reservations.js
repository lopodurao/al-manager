let calYear, calMonth, calPropFilter = '';

function renderReservations() {
  const now = new Date();
  if (!calYear) { calYear = now.getFullYear(); calMonth = now.getMonth(); }

  return `
<div class="section-header">
  <h2>Reservas</h2>
  <div style="display:flex;gap:10px">
    <select id="res-prop-filter" onchange="calPropFilter=this.value;navigate('reservations')" style="width:160px">
      <option value="">Todas as prop.</option>
      ${state.properties.map(p => `<option value="${p.id}" ${calPropFilter===p.id?'selected':''}>${p.name}</option>`).join('')}
    </select>
    <button class="btn btn-primary" onclick="openAddReservation()">
      <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
      Nova Reserva
    </button>
  </div>
</div>

<div class="card mb-4">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
    <button class="btn btn-outline btn-sm" onclick="calMonth--;if(calMonth<0){calMonth=11;calYear--;}navigate('reservations')">‹ Anterior</button>
    <strong style="font-size:15px">${new Date(calYear, calMonth).toLocaleDateString('pt-PT',{month:'long',year:'numeric'})}</strong>
    <button class="btn btn-outline btn-sm" onclick="calMonth++;if(calMonth>11){calMonth=0;calYear++;}navigate('reservations')">Seguinte ›</button>
  </div>
  ${renderCalendar(calYear, calMonth, calPropFilter)}
</div>

<div class="card">
  <div class="card-title" style="margin-bottom:12px">Lista de Reservas</div>
  <div class="search-bar">
    <input id="res-search" placeholder="Pesquisar hóspede…" oninput="filterResTable(this.value)">
  </div>
  <div class="table-wrap">
    <table id="res-table">
      <thead><tr><th>Hóspede</th><th>Propriedade</th><th>Check-in</th><th>Check-out</th><th>Noites</th><th>Canal</th><th>Estado</th><th>Valor</th><th></th></tr></thead>
      <tbody>
        ${renderResRows(state.reservations)}
      </tbody>
    </table>
  </div>
</div>`;
}

function renderCalendar(y, m, propFilter) {
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const days = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const todayStr = today();
  const res = state.reservations.filter(r => r.status !== 'cancelled' && (!propFilter || r.propId === propFilter));

  let html = `<div class="calendar-grid">`;
  days.forEach(d => { html += `<div class="cal-day-header">${d}</div>`; });

  for (let i = 0; i < firstDay; i++) html += `<div class="cal-day other-month"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;
    const dayRes = res.filter(r => r.checkin <= dateStr && r.checkout > dateStr);
    html += `<div class="cal-day${isToday?' today':''}">
      <div class="cal-day-num">${d}</div>
      ${dayRes.map(r => `<div class="cal-event ${r.channel}" onclick="editReservation('${r.id}')" title="${escHtml(r.guestName)}">${escHtml(r.guestName.split(',')[0])}</div>`).join('')}
    </div>`;
  }
  html += `</div>`;
  return html;
}

function renderResRows(list) {
  if (!list.length) return '<tr><td colspan="9" class="text-center text-gray" style="padding:24px">Sem reservas</td></tr>';
  return list.sort((a,b) => b.checkin.localeCompare(a.checkin)).map(r => {
    const p = getProp(r.propId);
    return `<tr>
      <td>${FLAG[r.guestNationality]||''} <strong>${escHtml(r.guestName)}</strong><br><span class="text-sm text-gray">${escHtml(r.guestEmail)}</span></td>
      <td>${p ? p.name : '—'}</td>
      <td>${fmtDate(r.checkin)}</td>
      <td>${fmtDate(r.checkout)}</td>
      <td>${nights(r.checkin, r.checkout)}</td>
      <td>${channelBadge(r.channel)}</td>
      <td>${statusBadge(r.status)}</td>
      <td class="fw-700">${fmtMoney(r.price)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-sm btn-outline" onclick="editReservation('${r.id}')">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="deleteReservation('${r.id}')">✕</button>
      </td>
    </tr>`;
  }).join('');
}

function filterResTable(q) {
  const filtered = state.reservations.filter(r => r.guestName.toLowerCase().includes(q.toLowerCase()) || r.guestEmail.toLowerCase().includes(q.toLowerCase()));
  document.querySelector('#res-table tbody').innerHTML = renderResRows(filtered);
}

function openAddReservation() {
  openModal('Nova Reserva', reservationForm(null), true);
  document.getElementById('save-res-btn').onclick = () => saveReservation(null);
}

function editReservation(id) {
  const r = getRes(id);
  openModal('Editar Reserva', reservationForm(r), true);
  document.getElementById('save-res-btn').onclick = () => saveReservation(id);
}

function reservationForm(r) {
  return `
  <div class="form-row">
    <div class="form-group"><label>Propriedade *</label><select id="rf-prop">${propOptions(r?.propId)}</select></div>
    <div class="form-group"><label>Canal *</label>
      <select id="rf-channel">
        ${Object.entries(CHANNELS).map(([k,v]) => `<option value="${k}" ${r?.channel===k?'selected':''}>${v}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Nome do hóspede *</label><input id="rf-name" value="${escHtml(r?.guestName||'')}" placeholder="Apelido, Nome"></div>
    <div class="form-group"><label>Nacionalidade</label><select id="rf-nat">${countryOptions(r?.guestNationality||'PT')}</select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Email</label><input id="rf-email" type="email" value="${escHtml(r?.guestEmail||'')}"></div>
    <div class="form-group"><label>Telemóvel</label><input id="rf-phone" value="${escHtml(r?.guestPhone||'')}"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Nº Documento (passaporte/CC)</label><input id="rf-doc" value="${escHtml(r?.docId||'')}"></div>
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
    <div class="form-group"><label>Estado</label>
      <select id="rf-status">
        <option value="confirmed" ${r?.status==='confirmed'?'selected':''}>Confirmada</option>
        <option value="pending" ${r?.status==='pending'?'selected':''}>Pendente</option>
        <option value="checkedin" ${r?.status==='checkedin'?'selected':''}>Check-in feito</option>
        <option value="checkedout" ${r?.status==='checkedout'?'selected':''}>Check-out feito</option>
        <option value="cancelled" ${r?.status==='cancelled'?'selected':''}>Cancelada</option>
      </select>
    </div>
    <div class="form-group"><label>SEF comunicado?</label>
      <select id="rf-sef">
        <option value="" ${!r?.sefReported?'selected':''}>Não</option>
        <option value="1" ${r?.sefReported?'selected':''}>Sim</option>
      </select>
    </div>
  </div>
  <div class="form-group"><label>Notas internas</label><textarea id="rf-notes">${escHtml(r?.notes||'')}</textarea></div>
  <div class="form-actions">
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="save-res-btn">Guardar</button>
  </div>`;
}

function saveReservation(id) {
  const checkin = document.getElementById('rf-checkin').value;
  const checkout = document.getElementById('rf-checkout').value;
  const name = document.getElementById('rf-name').value.trim();
  const propId = document.getElementById('rf-prop').value;
  if (!name || !checkin || !checkout || !propId) { alert('Preenche os campos obrigatórios'); return; }
  if (checkout <= checkin) { alert('Check-out deve ser depois do check-in'); return; }

  const price = parseFloat(document.getElementById('rf-price').value) || 0;
  const commission = parseFloat(document.getElementById('rf-commission').value) || 0;

  const obj = {
    id: id || genId('r'),
    propId,
    guestName: name,
    guestEmail: document.getElementById('rf-email').value.trim(),
    guestPhone: document.getElementById('rf-phone').value.trim(),
    guestNationality: document.getElementById('rf-nat').value,
    docId: document.getElementById('rf-doc').value.trim(),
    guests: +document.getElementById('rf-guests').value,
    checkin, checkout,
    channel: document.getElementById('rf-channel').value,
    status: document.getElementById('rf-status').value,
    price, commission,
    sefReported: !!document.getElementById('rf-sef').value,
    notes: document.getElementById('rf-notes').value,
  };

  if (id) {
    const i = state.reservations.findIndex(r => r.id === id);
    state.reservations[i] = obj;
  } else {
    state.reservations.push(obj);
    // auto-create transactions
    if (price > 0) {
      state.transactions.push({ id: genId('t'), propId, resId: obj.id, date: checkin, type: 'income', category: 'Alojamento', amount: price, desc: `Reserva ${name}`, channel: obj.channel });
      if (commission > 0) {
        state.transactions.push({ id: genId('t'), propId, resId: obj.id, date: checkin, type: 'expense', category: 'Comissão OTA', amount: commission, desc: `Comissão ${CHANNELS[obj.channel]||''}`, channel: obj.channel });
      }
    }
    // auto-create cleaning task
    state.cleaningTasks.push({ id: genId('c'), propId, type: 'limpeza', assignee: '', date: checkout, status: 'pending', notes: `Check-out ${name}`, priority: 'high' });
  }
  saveState(); closeModal(); navigate('reservations');
  toastMsg(id ? 'Reserva atualizada' : 'Reserva criada');
}

function deleteReservation(id) {
  if (!confirm('Apagar esta reserva?')) return;
  state.reservations = state.reservations.filter(r => r.id !== id);
  saveState(); navigate('reservations');
  toastMsg('Reserva apagada');
}
