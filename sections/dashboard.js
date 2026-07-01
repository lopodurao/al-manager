function renderDashboard() {
  const now = new Date();
  const todayStr = today();
  const res = state.reservations;

  // Active/upcoming reservations
  const active = res.filter(r => r.status !== 'cancelled' && r.checkin <= todayStr && r.checkout > todayStr);
  const upcoming = res.filter(r => r.status !== 'cancelled' && r.checkin > todayStr);
  const checkinsToday = res.filter(r => r.checkin === todayStr && r.status !== 'cancelled');
  const checkoutsToday = res.filter(r => r.checkout === todayStr && r.status !== 'cancelled');

  // Revenue this month
  const m = now.getMonth() + 1, y = now.getFullYear();
  const monthStr = `${y}-${String(m).padStart(2,'0')}`;
  const monthIncome = state.transactions.filter(t => t.type === 'income' && t.date.startsWith(monthStr)).reduce((s, t) => s + t.amount, 0);
  const monthExpense = state.transactions.filter(t => t.type === 'expense' && t.date.startsWith(monthStr)).reduce((s, t) => s + t.amount, 0);

  // Pending tasks
  const pendingTasks = state.cleaningTasks.filter(t => t.status === 'pending').length;

  // SEF pending (non-PT guests with future reservations)
  const sefPending = res.filter(r => r.guestNationality !== 'PT' && r.checkin >= todayStr && r.status === 'confirmed' && !r.sefReported).length;

  // Upcoming 7 days
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7);
  const in7str = in7.toISOString().slice(0, 10);
  const upcoming7 = res.filter(r => r.status !== 'cancelled' && r.checkin >= todayStr && r.checkin <= in7str);

  // Bar chart data (last 6 months)
  const barData = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}`;
    const val = state.transactions.filter(t => t.type === 'income' && t.date.startsWith(mKey)).reduce((s, t) => s + t.amount, 0);
    barData.push({ label: d.toLocaleDateString('pt-PT', { month: 'short' }), val });
  }
  const maxBar = Math.max(...barData.map(b => b.val), 1);

  return `
<div class="stats-grid">
  <div class="stat-card">
    <div class="stat-icon indigo"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"/></svg></div>
    <div class="stat-label">Ocupação Hoje</div>
    <div class="stat-value">${active.length}</div>
    <div class="stat-sub">${state.properties.length} propriedades</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon green"><svg viewBox="0 0 20 20" fill="currentColor"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.077 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.077-2.354-1.253V5z" clip-rule="evenodd"/></svg></div>
    <div class="stat-label">Receita este mês</div>
    <div class="stat-value">${fmtMoney(monthIncome)}</div>
    <div class="stat-sub">Lucro: ${fmtMoney(monthIncome - monthExpense)}</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon amber"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"/></svg></div>
    <div class="stat-label">Check-ins hoje</div>
    <div class="stat-value">${checkinsToday.length}</div>
    <div class="stat-sub">Check-outs: ${checkoutsToday.length}</div>
  </div>
  <div class="stat-card">
    <div class="stat-icon ${sefPending > 0 ? 'red' : 'green'}"><svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg></div>
    <div class="stat-label">SEF pendente</div>
    <div class="stat-value">${sefPending}</div>
    <div class="stat-sub">${pendingTasks} limpezas pendentes</div>
  </div>
</div>

<div class="grid-2">
  <div class="card">
    <div class="card-title" style="margin-bottom:16px">Próximas reservas (7 dias)</div>
    ${upcoming7.length === 0 ? '<div class="empty-state"><p>Sem reservas nos próximos 7 dias</p></div>' : `
    <div class="timeline">
      ${upcoming7.sort((a,b) => a.checkin.localeCompare(b.checkin)).map(r => {
        const p = getProp(r.propId);
        return `<div class="tl-item">
          <div class="tl-dot ${r.channel === 'direct' ? 'green' : r.channel === 'airbnb' ? 'red' : r.channel === 'booking' ? 'blue' : 'amber'}"></div>
          <div class="tl-label">${fmtDate(r.checkin)} → ${fmtDate(r.checkout)} · ${nights(r.checkin, r.checkout)} noites</div>
          <div class="tl-text">${escHtml(r.guestName)} ${FLAG[r.guestNationality] || ''} — ${p ? p.name : '?'} ${channelBadge(r.channel)}</div>
        </div>`;
      }).join('')}
    </div>`}
  </div>

  <div class="card">
    <div class="card-title" style="margin-bottom:16px">Receita mensal (€)</div>
    <div class="bar-chart">
      ${barData.map(b => `
        <div class="bar-wrap">
          <div class="bar-val">${b.val > 0 ? Math.round(b.val) : ''}</div>
          <div class="bar" style="height:${Math.round((b.val/maxBar)*90)}px"></div>
          <div class="bar-label">${b.label}</div>
        </div>`).join('')}
    </div>
  </div>
</div>

${checkinsToday.length > 0 || checkoutsToday.length > 0 ? `
<div class="card mt-4">
  <div class="card-title" style="margin-bottom:12px">Movimento de hoje</div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Hóspede</th><th>Propriedade</th><th>Movimento</th><th>Canal</th><th>Noites</th><th>Valor</th></tr></thead>
      <tbody>
        ${[...checkinsToday.map(r => ({...r, mv:'checkin'})), ...checkoutsToday.map(r => ({...r, mv:'checkout'}))].map(r => {
          const p = getProp(r.propId);
          return `<tr>
            <td>${FLAG[r.guestNationality] || ''} <strong>${escHtml(r.guestName)}</strong></td>
            <td>${p ? p.name : '?'}</td>
            <td><span class="badge ${r.mv === 'checkin' ? 'badge-green' : 'badge-amber'}">${r.mv === 'checkin' ? '→ Check-in' : '← Check-out'}</span></td>
            <td>${channelBadge(r.channel)}</td>
            <td>${nights(r.checkin, r.checkout)}</td>
            <td class="fw-700">${fmtMoney(r.price)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>
</div>` : ''}
`;
}
