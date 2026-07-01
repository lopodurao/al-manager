async function renderMessages() {
  return `
<div class="section-header"><h2>Mensagens Automáticas</h2><button class="btn btn-primary" onclick="openAddMessage()">+ Novo Template</button></div>
<div class="card mb-4" style="background:var(--primary-light);border:1px solid #c7d2fe">
  <div style="font-size:13.5px;color:var(--primary-dark)"><strong>Variáveis:</strong>
    ${['{{guest}}','{{property}}','{{checkin_time}}','{{checkout_time}}','{{access_code}}','{{key_location}}'].map(v=>`<code style="background:white;padding:1px 6px;border-radius:4px;margin:0 3px">${v}</code>`).join('')}
  </div>
</div>
<div style="display:flex;flex-direction:column;gap:16px">
  ${cache.messages.map(m=>`
  <div class="card" style="border-left:4px solid ${m.active?'var(--success)':'var(--gray-300)'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:15px;font-weight:700;margin-bottom:6px">${escHtml(m.name)}</div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <span class="badge ${m.active?'badge-green':'badge-gray'}">${m.active?'● Ativo':'○ Inativo'}</span>
          <span class="badge badge-blue">${triggerLabel(m.trigger)}</span>
          <span class="badge badge-gray">${m.channel==='all'?'Email+SMS':m.channel==='email'?'Email':'SMS'}</span>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--gray-700)">${escHtml(m.subject)}</div>
        <div style="font-size:12.5px;color:var(--gray-500);white-space:pre-line;max-height:50px;overflow:hidden;margin-top:4px">${escHtml(m.body)}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;margin-left:16px">
        <button class="btn btn-sm btn-outline" onclick="doToggleMessage('${m.id}')">${m.active?'Desativar':'Ativar'}</button>
        <button class="btn btn-sm btn-outline" onclick="editMessage('${m.id}')">Editar</button>
        <button class="btn btn-sm btn-outline" onclick="previewMessage('${m.id}')">Preview</button>
        <button class="btn btn-sm btn-danger" onclick="doDeleteMessage('${m.id}')">✕</button>
      </div>
    </div>
  </div>`).join('')}
  ${cache.messages.length===0?'<div class="empty-state"><p>Sem templates</p></div>':''}
</div>
<div class="card mt-4">
  <div class="card-title" style="margin-bottom:12px">Enviar mensagem manual</div>
  <div class="form-row">
    <div class="form-group"><label>Reserva</label><select id="manual-res"><option value="">Selecionar…</option>${cache.reservations.filter(r=>r.status!=='cancelled').map(r=>`<option value="${r.id}">${escHtml(r.guest_name)} — ${fmtDate(r.checkin)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Template</label><select id="manual-tpl"><option value="">Nenhum</option>${cache.messages.map(m=>`<option value="${m.id}">${escHtml(m.name)}</option>`).join('')}</select></div>
  </div>
  <div class="form-group"><label>Mensagem</label><textarea id="manual-msg" style="min-height:120px"></textarea></div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-outline" onclick="loadMsgTemplate()">Carregar template</button>
    <button class="btn btn-primary" onclick="copyManualMsg()">Copiar para clipboard</button>
  </div>
</div>`;
}

function triggerLabel(t) {
  return {'booking':'Na reserva','checkin-1d':'1 dia antes check-in','checkin-0d':'No check-in','checkout-1d':'1 dia antes check-out','checkout+1d':'1 dia após check-out'}[t]||t;
}

async function doToggleMessage(id) {
  try { await api.toggleMessage(id); await navigate('messages'); }
  catch(e){ toastMsg('Erro: '+e.message); }
}
async function doDeleteMessage(id) {
  if(!confirm('Apagar este template?')) return;
  try { await api.deleteMessage(id); await navigate('messages'); toastMsg('Template apagado'); }
  catch(e){ toastMsg('Erro: '+e.message); }
}
function openAddMessage() { openModal('Novo Template', msgForm(null), true); document.getElementById('save-msg-btn').onclick=()=>doSaveMessage(null); }
function editMessage(id)  { const m=cache.messages.find(m=>m.id===id); openModal('Editar Template', msgForm(m), true); document.getElementById('save-msg-btn').onclick=()=>doSaveMessage(id); }

function msgForm(m) {
  return`
  <div class="form-row">
    <div class="form-group"><label>Nome *</label><input id="mf-name" value="${escHtml(m?.name||'')}"></div>
    <div class="form-group"><label>Canal</label><select id="mf-ch"><option value="all" ${m?.channel==='all'?'selected':''}>Email+SMS</option><option value="email" ${m?.channel==='email'?'selected':''}>Email</option><option value="sms" ${m?.channel==='sms'?'selected':''}>SMS</option></select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Gatilho</label><select id="mf-trigger">${[['booking','Na reserva'],['checkin-1d','1 dia antes check-in'],['checkin-0d','No check-in'],['checkout-1d','1 dia antes check-out'],['checkout+1d','1 dia após check-out']].map(([v,l])=>`<option value="${v}" ${m?.trigger===v?'selected':''}>${l}</option>`).join('')}</select></div>
    <div class="form-group"><label>Ativo</label><select id="mf-active"><option value="1" ${m?.active!==false?'selected':''}>Sim</option><option value="0" ${m?.active===false?'selected':''}>Não</option></select></div>
  </div>
  <div class="form-group"><label>Assunto</label><input id="mf-subject" value="${escHtml(m?.subject||'')}"></div>
  <div class="form-group"><label>Corpo</label><textarea id="mf-body" style="min-height:150px">${escHtml(m?.body||'')}</textarea></div>
  <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="save-msg-btn">Guardar</button></div>`;
}

async function doSaveMessage(id) {
  const d={ name:document.getElementById('mf-name').value.trim(), channel:document.getElementById('mf-ch').value, trigger:document.getElementById('mf-trigger').value, active:document.getElementById('mf-active').value==='1', subject:document.getElementById('mf-subject').value.trim(), body:document.getElementById('mf-body').value };
  if(!d.name){ alert('Nome obrigatório'); return; }
  try { id?await api.updateMessage(id,d):await api.createMessage(d); closeModal(); await navigate('messages'); toastMsg(id?'Template atualizado':'Template criado'); }
  catch(e){ toastMsg('Erro: '+e.message); }
}

function previewMessage(id) {
  const m=cache.messages.find(m=>m.id===id); const s=cache.settings;
  const r=cache.reservations[0]; const p=r?getProp(r.prop_id):null;
  const body=(m.body||'').replace(/\{\{guest\}\}/g,r?.guest_name||'Hóspede').replace(/\{\{property\}\}/g,p?.name||'Propriedade').replace(/\{\{checkin_time\}\}/g,s.checkinTime||'15:00').replace(/\{\{checkout_time\}\}/g,s.checkoutTime||'11:00').replace(/\{\{access_code\}\}/g,s.accessCode||'1234').replace(/\{\{key_location\}\}/g,s.keyLocation||'');
  openModal(`Preview: ${m.name}`,`<div style="font-size:13px;margin-bottom:8px"><strong>Assunto:</strong> ${escHtml(m.subject)}</div><div style="background:var(--gray-50);border-radius:8px;padding:16px;white-space:pre-line;font-size:13.5px;line-height:1.7">${escHtml(body)}</div><div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>`);
}

function loadMsgTemplate() {
  const tplId=document.getElementById('manual-tpl').value; if(!tplId) return;
  const m=cache.messages.find(x=>x.id===tplId); const s=cache.settings;
  const r=cache.reservations.find(x=>x.id===document.getElementById('manual-res').value); const p=r?getProp(r.prop_id):null;
  let body=m.body||'';
  if(r) body=body.replace(/\{\{guest\}\}/g,r.guest_name).replace(/\{\{property\}\}/g,p?.name||'').replace(/\{\{checkin_time\}\}/g,s.checkinTime||'15:00').replace(/\{\{checkout_time\}\}/g,s.checkoutTime||'11:00').replace(/\{\{access_code\}\}/g,s.accessCode||'').replace(/\{\{key_location\}\}/g,s.keyLocation||'');
  document.getElementById('manual-msg').value=body;
}

function copyManualMsg() {
  const msg=document.getElementById('manual-msg').value;
  if(!msg){ alert('Mensagem vazia'); return; }
  navigator.clipboard.writeText(msg).then(()=>toastMsg('Mensagem copiada')).catch(()=>toastMsg('Erro ao copiar'));
}
