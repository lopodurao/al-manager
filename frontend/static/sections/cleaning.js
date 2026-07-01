async function renderCleaning() {
  const pending = cache.cleaning.filter(t=>t.status==='pending').sort((a,b)=>a.date.localeCompare(b.date));
  const done    = cache.cleaning.filter(t=>t.status==='done').sort((a,b)=>b.date.localeCompare(a.date));
  return `
<div class="section-header"><h2>Limpezas &amp; Manutenção</h2><button class="btn btn-primary" onclick="openAddTask()">+ Nova Tarefa</button></div>
<div class="grid-2">
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="card-title">Pendentes <span class="badge badge-amber" style="margin-left:6px">${pending.length}</span></div>
    </div>
    ${pending.length===0?'<div class="empty-state"><p>Sem tarefas pendentes 🎉</p></div>':pending.map(taskCard).join('')}
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="card-title">Concluídas <span class="badge badge-green" style="margin-left:6px">${done.length}</span></div>
      ${done.length>0?`<button class="btn btn-sm btn-outline" onclick="doClearDone()">Limpar</button>`:''}
    </div>
    ${done.length===0?'<div class="empty-state"><p>Sem tarefas concluídas</p></div>':done.slice(0,8).map(taskCard).join('')}
  </div>
</div>
<div class="card mt-4">
  <div class="card-title" style="margin-bottom:12px">Todas as tarefas</div>
  <div class="table-wrap"><table>
    <thead><tr><th>Tipo</th><th>Propriedade</th><th>Data</th><th>Responsável</th><th>Prioridade</th><th>Notas</th><th>Estado</th><th></th></tr></thead>
    <tbody>${cache.cleaning.sort((a,b)=>a.date.localeCompare(b.date)).map(t=>{
      const p=getProp(t.prop_id);
      return`<tr>
        <td>${t.type==='limpeza'?'🧹 Limpeza':'🔧 Manutenção'}</td>
        <td>${p?p.name:'—'}</td><td>${fmtDate(t.date)}</td>
        <td>${escHtml(t.assignee)||'—'}</td>
        <td><div class="flex items-center gap-2"><div class="task-priority ${t.priority}"></div>${t.priority==='high'?'Alta':t.priority==='medium'?'Média':'Baixa'}</div></td>
        <td class="text-sm text-gray">${escHtml(t.notes)||'—'}</td>
        <td>${t.status==='done'?'<span class="badge badge-green">Concluída</span>':'<span class="badge badge-amber">Pendente</span>'}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-sm btn-${t.status==='pending'?'success':'outline'}" onclick="doToggleTask('${t.id}')">${t.status==='pending'?'✓ Feito':'↩ Reabrir'}</button>
          <button class="btn btn-sm btn-outline" onclick="editTask('${t.id}')">Editar</button>
          <button class="btn btn-sm btn-danger" onclick="doDeleteTask('${t.id}')">✕</button>
        </td></tr>`;
    }).join('')}</tbody>
  </table></div>
</div>`;
}

function taskCard(t) {
  const p=getProp(t.prop_id);
  return`<div class="task-item">
    <div class="task-check ${t.status==='done'?'done':''}" onclick="doToggleTask('${t.id}')"></div>
    <div class="task-info">
      <div class="task-name ${t.status==='done'?'done':''}">${t.type==='limpeza'?'🧹':'🔧'} ${escHtml(t.notes||'Tarefa')}</div>
      <div class="task-meta">${p?p.name:'?'} · ${fmtDate(t.date)}${t.assignee?` · ${escHtml(t.assignee)}`:''}</div>
    </div>
    <div class="task-priority ${t.priority}"></div>
    <button class="btn btn-sm btn-outline" onclick="editTask('${t.id}')">Editar</button>
  </div>`;
}

async function doToggleTask(id) {
  try { await api.toggleCleaning(id); await navigate('cleaning'); }
  catch(e) { toastMsg('Erro: '+e.message); }
}
async function doClearDone() {
  if (!confirm('Remover todas as tarefas concluídas?')) return;
  try { await api.clearDoneTasks(); await navigate('cleaning'); toastMsg('Limpas'); }
  catch(e) { toastMsg('Erro: '+e.message); }
}
async function doDeleteTask(id) {
  if (!confirm('Apagar esta tarefa?')) return;
  try { await api.deleteCleaning(id); await navigate('cleaning'); toastMsg('Tarefa apagada'); }
  catch(e) { toastMsg('Erro: '+e.message); }
}

function openAddTask() { openModal('Nova Tarefa', taskForm(null)); document.getElementById('save-task-btn').onclick=()=>doSaveTask(null); }
function editTask(id)  { const t=cache.cleaning.find(t=>t.id===id); openModal('Editar Tarefa', taskForm(t)); document.getElementById('save-task-btn').onclick=()=>doSaveTask(id); }

function taskForm(t) {
  return`
  <div class="form-row">
    <div class="form-group"><label>Tipo</label><select id="tf-type"><option value="limpeza" ${t?.type==='limpeza'?'selected':''}>🧹 Limpeza</option><option value="manutencao" ${t?.type==='manutencao'?'selected':''}>🔧 Manutenção</option></select></div>
    <div class="form-group"><label>Propriedade</label><select id="tf-prop">${propOptions(t?.prop_id)}</select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Data</label><input type="date" id="tf-date" value="${t?.date||today()}"></div>
    <div class="form-group"><label>Responsável</label><input id="tf-assignee" value="${escHtml(t?.assignee||'')}"></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label>Prioridade</label><select id="tf-priority"><option value="high" ${t?.priority==='high'?'selected':''}>Alta</option><option value="medium" ${t?.priority==='medium'?'selected':''}>Média</option><option value="low" ${t?.priority==='low'?'selected':''}>Baixa</option></select></div>
    <div class="form-group"><label>Estado</label><select id="tf-status"><option value="pending" ${t?.status==='pending'?'selected':''}>Pendente</option><option value="done" ${t?.status==='done'?'selected':''}>Concluída</option></select></div>
  </div>
  <div class="form-group"><label>Notas</label><textarea id="tf-notes">${escHtml(t?.notes||'')}</textarea></div>
  <div class="form-actions"><button class="btn btn-secondary" onclick="closeModal()">Cancelar</button><button class="btn btn-primary" id="save-task-btn">Guardar</button></div>`;
}

async function doSaveTask(id) {
  const d={ prop_id:document.getElementById('tf-prop').value, type:document.getElementById('tf-type').value, date:document.getElementById('tf-date').value, assignee:document.getElementById('tf-assignee').value.trim(), priority:document.getElementById('tf-priority').value, status:document.getElementById('tf-status').value, notes:document.getElementById('tf-notes').value.trim() };
  try {
    id ? await api.updateCleaning(id,d) : await api.createCleaning(d);
    closeModal(); await navigate('cleaning'); toastMsg(id?'Tarefa atualizada':'Tarefa criada');
  } catch(e) { toastMsg('Erro: '+e.message); }
}
