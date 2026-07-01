async function renderProperties() {
  const now = new Date(); const m = now.getMonth()+1, y = now.getFullYear();
  const monthStr = `${y}-${String(m).padStart(2,'0')}`;
  return `
<div class="section-header">
  <h2>Propriedades</h2>
  <button class="btn btn-primary" onclick="openAddProperty()">+ Nova Propriedade</button>
</div>
<div class="property-cards">
  ${cache.properties.map(p => {
    const res = cache.reservations.filter(r => r.prop_id===p.id && r.status!=='cancelled');
    const active = res.filter(r => r.checkin<=today() && r.checkout>today());
    const daysInMonth = new Date(y,m,0).getDate();
    let occ=0;
    res.forEach(r => {
      for(let d=new Date(y,m-1,1); d<=new Date(y,m-1,daysInMonth); d.setDate(d.getDate()+1))
        if(d>=new Date(r.checkin) && d<new Date(r.checkout)) occ++;
    });
    const occPct = Math.round((occ/daysInMonth)*100);
    const rev = cache.transactions.filter(t=>t.prop_id===p.id&&t.type==='income'&&t.date.startsWith(monthStr)).reduce((s,t)=>s+t.amount,0);
    return `<div class="prop-card">
      <div class="prop-img" style="background:linear-gradient(135deg,${p.color||'#667eea'} 0%,${p.color||'#764ba2'} 100%)">
        <svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/></svg>
        <div class="prop-platform-badge">${active.length>0?'Ocupado':'Disponível'}</div>
      </div>
      <div class="prop-body">
        <div class="prop-name">${escHtml(p.name)}</div>
        <div class="prop-addr">📍 ${escHtml(p.address)}</div>
        <div class="prop-meta"><span>🛏 ${p.beds}</span><span>🚿 ${p.baths}</span><span>👥 ${p.max_guests} máx.</span></div>
        <div style="margin-top:12px">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--gray-500);margin-bottom:4px"><span>Ocupação este mês</span><span>${occPct}%</span></div>
          <div style="background:var(--gray-100);border-radius:999px;height:6px;overflow:hidden"><div style="background:var(--primary);height:100%;width:${occPct}%;border-radius:999px"></div></div>
        </div>
      </div>
      <div class="prop-footer">
        <div><div style="font-size:11px;color:var(--gray-500)">Receita este mês</div><div style="font-size:15px;font-weight:700;color:var(--success)">${fmtMoney(rev)}</div></div>
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
  document.getElementById('save-prop-btn').onclick = () => doSaveProperty(null);
}
function editProperty(id) {
  const p = getProp(id);
  openModal('Editar Propriedade', propertyForm(p));
  document.getElementById('save-prop-btn').onclick = () => doSaveProperty(id);
}
function propertyForm(p) {
  return `
  <div class="form-row">
    <div class="form-group"><label>Nome *</label><input id="pf-name" value="${escHtml(p?.name||'')}"></div>
    <div class="form-group"><label>Tipo</label><select id="pf-type">
      ${['Apartamento','Moradia','Quarto','Villa'].map(t=>`<option ${p?.type===t?'selected':''}>${t}</option>`).join('')}
    </select></div>
  </div>
  <div class="form-group"><label>Morada</label><input id="pf-addr" value="${escHtml(p?.address||'')}"></div>
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
    <div class="form-group"><label>Hóspedes máx.</label><input type="number" id="pf-guests" value="${p?.max_guests||4}" min="1"></div>
  </div>
  <div class="form-group"><label>Notas</label><textarea id="pf-notes">${escHtml(p?.notes||'')}</textarea></div>
  <div class="form-actions">
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="save-prop-btn">Guardar</button>
  </div>`;
}
async function doSaveProperty(id) {
  const d = { name:document.getElementById('pf-name').value.trim(), address:document.getElementById('pf-addr').value.trim(), type:document.getElementById('pf-type').value, license:document.getElementById('pf-license').value.trim(), color:document.getElementById('pf-color').value, rooms:+document.getElementById('pf-rooms').value, beds:+document.getElementById('pf-beds').value, baths:+document.getElementById('pf-baths').value, max_guests:+document.getElementById('pf-guests').value, notes:document.getElementById('pf-notes').value };
  if (!d.name) { alert('Nome obrigatório'); return; }
  try {
    id ? await api.updateProperty(id, d) : await api.createProperty(d);
    closeModal(); await navigate('properties'); toastMsg(id?'Propriedade atualizada':'Propriedade criada');
  } catch(e) { toastMsg('Erro: '+e.message); }
}
async function deleteProperty(id) {
  if (!confirm('Apagar esta propriedade e todas as reservas associadas?')) return;
  try { await api.deleteProperty(id); await navigate('properties'); toastMsg('Propriedade apagada'); }
  catch(e) { toastMsg('Erro: '+e.message); }
}
