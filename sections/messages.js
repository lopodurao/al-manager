function renderMessages() {
  return `
<div class="section-header">
  <h2>Mensagens Automáticas</h2>
  <button class="btn btn-primary" onclick="openAddMessage()">+ Novo Template</button>
</div>

<div class="card mb-4" style="background:var(--primary-light);border:1px solid #c7d2fe">
  <div style="font-size:13.5px;color:var(--primary-dark)">
    <strong>Variáveis disponíveis:</strong>
    <code style="background:white;padding:1px 5px;border-radius:4px;margin:0 4px">{{guest}}</code>
    <code style="background:white;padding:1px 5px;border-radius:4px;margin:0 4px">{{property}}</code>
    <code style="background:white;padding:1px 5px;border-radius:4px;margin:0 4px">{{checkin_time}}</code>
    <code style="background:white;padding:1px 5px;border-radius:4px;margin:0 4px">{{checkout_time}}</code>
    <code style="background:white;padding:1px 5px;border-radius:4px;margin:0 4px">{{access_code}}</code>
    <code style="background:white;padding:1px 5px;border-radius:4px;margin:0 4px">{{key_location}}</code>
  </div>
</div>

<div style="display:flex;flex-direction:column;gap:16px">
  ${state.messages.map(m => `
  <div class="card" style="border-left:4px solid ${m.active ? 'var(--success)' : 'var(--gray-300)'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:15px;font-weight:700;margin-bottom:4px">${escHtml(m.name)}</div>
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <span class="badge ${m.active ? 'badge-green' : 'badge-gray'}">${m.active ? '● Ativo' : '○ Inativo'}</span>
          <span class="badge badge-blue">${triggerLabel(m.trigger)}</span>
          <span class="badge badge-gray">${m.channel === 'all' ? 'Email + SMS' : m.channel === 'email' ? 'Email' : 'SMS'}</span>
        </div>
        <div style="font-size:13px;font-weight:600;color:var(--gray-700);margin-bottom:4px">${escHtml(m.subject)}</div>
        <div style="font-size:12.5px;color:var(--gray-500);white-space:pre-line;max-height:60px;overflow:hidden">${escHtml(m.body)}</div>
      </div>
      <div style="display:flex;gap:6px;flex-shrink:0;margin-left:16px">
        <button class="btn btn-sm btn-outline" onclick="toggleMessage('${m.id}')">${m.active ? 'Desativar' : 'Ativar'}</button>
        <button class="btn btn-sm btn-outline" onclick="editMessage('${m.id}')">Editar</button>
        <button class="btn btn-sm btn-outline" onclick="previewMessage('${m.id}')">Preview</button>
        <button class="btn btn-sm btn-danger" onclick="deleteMessage('${m.id}')">✕</button>
      </div>
    </div>
  </div>`).join('')}
</div>

${state.messages.length === 0 ? '<div class="empty-state"><p>Sem templates de mensagens</p></div>' : ''}

<div class="card mt-4">
  <div class="card-title" style="margin-bottom:12px">Enviar mensagem manual</div>
  <div class="form-row">
    <div class="form-group"><label>Reserva</label>
      <select id="manual-res">
        <option value="">Selecionar…</option>
        ${state.reservations.filter(r => r.status !== 'cancelled').map(r => `<option value="${r.id}">${escHtml(r.guestName)} — ${fmtDate(r.checkin)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Template</label>
      <select id="manual-tpl">
        <option value="">Nenhum (livre)</option>
        ${state.messages.map(m => `<option value="${m.id}">${escHtml(m.name)}</option>`).join('')}
      </select>
    </div>
  </div>
  <div class="form-group"><label>Mensagem</label><textarea id="manual-msg" style="min-height:120px" placeholder="Escreve a mensagem aqui…"></textarea></div>
  <div style="display:flex;gap:8px">
    <button class="btn btn-outline" onclick="loadTemplate()">Carregar template</button>
    <button class="btn btn-primary" onclick="sendManualMessage()">Copiar para clipboard</button>
  </div>
</div>`;
}

function triggerLabel(t) {
  const map = { 'checkin-1d':'1 dia antes check-in', 'checkin-0d':'No check-in', 'checkout-1d':'1 dia antes check-out', 'checkout+1d':'1 dia após check-out', 'booking':'Na reserva' };
  return map[t] || t;
}

function toggleMessage(id) {
  const i = state.messages.findIndex(m => m.id === id);
  if (i >= 0) { state.messages[i].active = !state.messages[i].active; saveState(); navigate('messages'); }
}

function openAddMessage() {
  openModal('Novo Template', messageForm(null), true);
  document.getElementById('save-msg-btn').onclick = () => saveMessage(null);
}

function editMessage(id) {
  const m = state.messages.find(m => m.id === id);
  openModal('Editar Template', messageForm(m), true);
  document.getElementById('save-msg-btn').onclick = () => saveMessage(id);
}

function messageForm(m) {
  return `
  <div class="form-row">
    <div class="form-group"><label>Nome do template</label><input id="mf-name" value="${escHtml(m?.name||'')}" placeholder="Ex: Boas-vindas"></div>
    <div class="form-group"><label>Canal</label>
      <select id="mf-channel">
        <option value="all" ${m?.channel==='all'?'selected':''}>Email + SMS</option>
        <option value="email" ${m?.channel==='email'?'selected':''}>Email</option>
        <option value="sms" ${m?.channel==='sms'?'selected':''}>SMS</option>
      </select>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Gatilho</label>
      <select id="mf-trigger">
        <option value="booking" ${m?.trigger==='booking'?'selected':''}>Na reserva</option>
        <option value="checkin-1d" ${m?.trigger==='checkin-1d'?'selected':''}>1 dia antes check-in</option>
        <option value="checkin-0d" ${m?.trigger==='checkin-0d'?'selected':''}>No dia do check-in</option>
        <option value="checkout-1d" ${m?.trigger==='checkout-1d'?'selected':''}>1 dia antes check-out</option>
        <option value="checkout+1d" ${m?.trigger==='checkout+1d'?'selected':''}>1 dia após check-out</option>
      </select>
    </div>
    <div class="form-group"><label>Ativo</label>
      <select id="mf-active">
        <option value="1" ${m?.active!==false?'selected':''}>Sim</option>
        <option value="0" ${m?.active===false?'selected':''}>Não</option>
      </select>
    </div>
  </div>
  <div class="form-group"><label>Assunto (email)</label><input id="mf-subject" value="${escHtml(m?.subject||'')}" placeholder="Assunto do email"></div>
  <div class="form-group"><label>Corpo da mensagem</label><textarea id="mf-body" style="min-height:150px">${escHtml(m?.body||'')}</textarea></div>
  <div class="form-actions">
    <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
    <button class="btn btn-primary" id="save-msg-btn">Guardar</button>
  </div>`;
}

function saveMessage(id) {
  const obj = {
    id: id || genId('m'),
    name: document.getElementById('mf-name').value.trim(),
    channel: document.getElementById('mf-channel').value,
    trigger: document.getElementById('mf-trigger').value,
    active: document.getElementById('mf-active').value === '1',
    subject: document.getElementById('mf-subject').value.trim(),
    body: document.getElementById('mf-body').value,
  };
  if (!obj.name) { alert('Nome obrigatório'); return; }
  if (id) { const i = state.messages.findIndex(m => m.id === id); state.messages[i] = obj; }
  else state.messages.push(obj);
  saveState(); closeModal(); navigate('messages');
  toastMsg(id ? 'Template atualizado' : 'Template criado');
}

function deleteMessage(id) {
  if (!confirm('Apagar este template?')) return;
  state.messages = state.messages.filter(m => m.id !== id);
  saveState(); navigate('messages');
}

function previewMessage(id) {
  const m = state.messages.find(m => m.id === id);
  const s = state.settings;
  const sampleRes = state.reservations[0];
  const sampleProp = sampleRes ? getProp(sampleRes.propId) : null;
  const filled = (m.body || '')
    .replace(/\{\{guest\}\}/g, sampleRes?.guestName || 'Hóspede')
    .replace(/\{\{property\}\}/g, sampleProp?.name || 'Propriedade')
    .replace(/\{\{checkin_time\}\}/g, s.checkinTime)
    .replace(/\{\{checkout_time\}\}/g, s.checkoutTime)
    .replace(/\{\{access_code\}\}/g, s.accessCode || '1234')
    .replace(/\{\{key_location\}\}/g, s.keyLocation);
  openModal(`Preview: ${m.name}`, `
    <div style="font-size:13px;margin-bottom:8px"><strong>Assunto:</strong> ${escHtml(m.subject)}</div>
    <div style="background:var(--gray-50);border-radius:8px;padding:16px;white-space:pre-line;font-size:13.5px;line-height:1.7">${escHtml(filled)}</div>
    <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Fechar</button></div>
  `);
}

function loadTemplate() {
  const tplId = document.getElementById('manual-tpl').value;
  const resId = document.getElementById('manual-res').value;
  if (!tplId) return;
  const m = state.messages.find(x => x.id === tplId);
  const r = state.reservations.find(x => x.id === resId);
  const p = r ? getProp(r.propId) : null;
  const s = state.settings;
  let body = m.body || '';
  if (r) {
    body = body
      .replace(/\{\{guest\}\}/g, r.guestName)
      .replace(/\{\{property\}\}/g, p?.name || '')
      .replace(/\{\{checkin_time\}\}/g, s.checkinTime)
      .replace(/\{\{checkout_time\}\}/g, s.checkoutTime)
      .replace(/\{\{access_code\}\}/g, s.accessCode || '')
      .replace(/\{\{key_location\}\}/g, s.keyLocation);
  }
  document.getElementById('manual-msg').value = body;
}

function sendManualMessage() {
  const msg = document.getElementById('manual-msg').value;
  if (!msg) { alert('Mensagem vazia'); return; }
  navigator.clipboard.writeText(msg).then(() => toastMsg('Mensagem copiada para o clipboard')).catch(() => toastMsg('Não foi possível copiar'));
}
