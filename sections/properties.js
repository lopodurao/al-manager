function renderProperties() {
  const now = new Date();
  const m = now.getMonth() + 1, y = now.getFullYear();

  return `
<div class="section-header">
  <h2>Propriedades</h2>
  <button class="btn btn-primary" onclick="openAddProperty()">
    <svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
    Nova Propriedade
  </button>
</div>
<div class="property-cards">
  ${state.properties.map(p => {
    const occ = resOccupancyRate(p.id, y, m);
    const activeRes = state.reservations.filter(r => r.propId === p.id && r.status !== 'cancelled' && r.checkin <= today() && r.checkout > today());
    const monthRev = state.transactions.filter(t => t.propId === p.id && t.type === 'income' && t.date.startsWith(`${y}-${String(m).padStart(2,'0')}`)).reduce((s,t) => s + t.amount, 0);
    return `
    <div class="prop-card">
      <div class="prop-img" style="background:linear-gradient(135deg, ${p.color || '#667eea'} 0%, ${p.color || '#764ba2'} 100%)">
        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
        <div class="prop-platform-badge">${activeRes.length > 0 ? 'Ocupado' : 'Disponível'}</div>
      </div>
      <div class="prop-body">
        <div class="prop-name">${escHtml(p.name)}</div>
        <div class="prop-addr">📍 ${escHtml(p.address)}</div>
        <div class="prop-meta">
          <span>🛏 ${p.beds} camas</span>
          <span>🚿 ${p.baths} WC</span>
          <span>👥 ${p.maxGuests} hósp. max.</span>
        </div>
        <div style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-500);margin-bottom:4px">
            <span>Ocupação este mês</span><span>${occ}%</span>
          </div>
          <div style="background:var(--gray-100);border-radius:999px;height:6px;overflow:hidden">
            <div style="background:var(--primary);height:100%;width:${occ}%;border-radius:999px;transition:width .4s"></div>
          </div>
        </div>
      </div>
      <div class="prop-footer">
        <div>
          <div style="font-size:11px;color:var(--gray-500)">Receita este mês</div>
          <div style="font-size:15px;font-weight:700;color:var(--success)">${fmtMoney(monthRev)}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm btn-outline" onclick="editProperty('${p.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="deleteProperty('${p.id}')">Apagar</button>
        </div>
      </div>
    </div>`;
  }).join('')}
</div>`;
}

function openAddProperty() {
  openModal('Nova Propriedade', propertyForm(null));
  document.getElementById('save-prop-btn').onclick = () => saveProperty(null);
}

function editProperty(id) {
  const p = getProp(id);
  openModal('Editar Propriedade', propertyForm(p));
  document.getElementById('save-prop-btn').onclick = () => saveProperty(id);
}

function propertyForm(p) {
  return `
  <div class="form-row">
    <div class="form-group"><label>Nome</label><input id="pf-name" value="${escHtml(p?.name||'')}" placeholder="Casa da Ria"></div>
    <div class="form-group"><label>Tipo</label><select id="pf-type"><option ${p?.type==='Apartamento'?'selected':''}>Apartamento</option><option ${p?.type==='Moradia'?'selected':''}>Moradia</option><option ${p?.type==='Quarto'?'selected':''}>Quarto</option><option ${p?.type==='Villa'?'selected':''}>Villa</option></select></div>
  </div>
  <div class="form-group"><label>Morada</label><input id="pf-addr" value="${escHtml(p?.address||'')}" placeholder="Rua, Nº, Cidade"></div>
  <div class="form-row">
    <div class="form-group"><label>Licença AL</label><input id="pf-license" value="${escHtml(p?.license||'')}" placeholder="AL/2020/0000"></div>
    <div class="form-group"><label>Cor</label><input type="color" id="pf-color" value="${p?.color||'#667eea'}" style="height:42px;padding:4px 8px"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Quartos</label><input type="number" id="pf-rooms" value="${p?.rooms||1}" min="1"></div>
    <div class="form-group"><label>Camas</label><input type="number" id="pf-beds" value="${p?.beds||2}" min="1"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>WC</label><input type="number" id="pf-baths" value="${p?.baths||1}" min="1"></div>
    <div class="form-group"><label>Hóspedes max.</label><input type="number" id="pf-guests" value="${p?.maxGuests||4}" min="1"></div>
  </div>
  <div class="form-group"><label>Notas</label><textarea id="pf-notes">${escHtml(p?.notes||'')}</textarea></div>
  <div class="form-actions">
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="save-prop-btn">Guardar</button>
  </div>`;
}

function saveProperty(id) {
  const obj = {
    id: id || genId('p'),
    name: document.getElementById('pf-name').value.trim(),
    address: document.getElementById('pf-addr').value.trim(),
    type: document.getElementById('pf-type').value,
    license: document.getElementById('pf-license').value.trim(),
    color: document.getElementById('pf-color').value,
    rooms: +document.getElementById('pf-rooms').value,
    beds: +document.getElementById('pf-beds').value,
    baths: +document.getElementById('pf-baths').value,
    maxGuests: +document.getElementById('pf-guests').value,
    notes: document.getElementById('pf-notes').value,
  };
  if (!obj.name) { alert('Nome obrigatório'); return; }
  if (id) {
    const i = state.properties.findIndex(p => p.id === id);
    state.properties[i] = obj;
  } else {
    state.properties.push(obj);
  }
  saveState(); closeModal();
  navigate('properties');
  toastMsg(id ? 'Propriedade atualizada' : 'Propriedade adicionada');
}

function deleteProperty(id) {
  if (!confirm('Apagar esta propriedade? Todas as reservas associadas serão também removidas.')) return;
  state.properties = state.properties.filter(p => p.id !== id);
  state.reservations = state.reservations.filter(r => r.propId !== id);
  state.transactions = state.transactions.filter(t => t.propId !== id);
  state.cleaningTasks = state.cleaningTasks.filter(t => t.propId !== id);
  saveState(); navigate('properties');
  toastMsg('Propriedade apagada');
}
