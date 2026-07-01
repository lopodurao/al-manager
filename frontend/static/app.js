// AL Manager — main app controller

const SECTIONS = {
  dashboard:   { title:'Dashboard',            render: renderDashboard },
  properties:  { title:'Propriedades',          render: renderProperties },
  reservations:{ title:'Reservas',              render: renderReservations },
  guests:      { title:'Hóspedes',              render: renderGuests },
  sef:         { title:'SEF / SIBA',            render: renderSef },
  cleaning:    { title:'Limpezas & Manutenção', render: renderCleaning },
  financial:   { title:'Financeiro',            render: renderFinancial },
  messages:    { title:'Mensagens',             render: renderMessages },
  ota:         { title:'Canais OTA',            render: renderOta },
  erp:         { title:'Primavera ERP',         render: renderErp },
  settings:    { title:'Configurações',         render: renderSettings },
};

let currentSection = 'dashboard';

async function navigate(section) {
  if (!SECTIONS[section]) return;
  currentSection = section;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === section));
  document.getElementById('section-title').textContent = SECTIONS[section].title;
  document.getElementById('content').innerHTML = '<div class="loading">A carregar…</div>';
  try {
    await loadCache();
    const html = await SECTIONS[section].render();
    document.getElementById('content').innerHTML = html;
  } catch(e) {
    document.getElementById('content').innerHTML = `<div class="empty-state"><p>Erro ao carregar: ${escHtml(e.message)}</p></div>`;
  }
}

// ── AUTH ──
function showAuth(isSetup = false) {
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').classList.remove('hidden');
  renderAuthForm(isSetup);
}

function renderAuthForm(isSetup) {
  document.getElementById('auth-form-area').innerHTML = isSetup ? `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:6px">Criar conta</h2>
    <p style="font-size:13px;color:var(--gray-500);margin-bottom:20px">Configura o teu acesso ao AL Manager</p>
    <div class="form-group"><label>Username</label><input id="auth-username" placeholder="admin" autocomplete="username"></div>
    <div class="form-group"><label>Email</label><input type="email" id="auth-email" placeholder="email@exemplo.com"></div>
    <div class="form-group"><label>Password</label><input type="password" id="auth-password" placeholder="Mínimo 8 caracteres"></div>
    <button class="btn btn-primary w-full" style="margin-top:8px" onclick="doRegister()">Criar conta</button>
  ` : `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:6px">Entrar</h2>
    <p style="font-size:13px;color:var(--gray-500);margin-bottom:20px">AL Manager</p>
    <div class="form-group"><label>Username</label><input id="auth-username" placeholder="admin" autocomplete="username"></div>
    <div class="form-group"><label>Password</label><input type="password" id="auth-password" placeholder="A tua password" onkeydown="if(event.key==='Enter') doLogin()"></div>
    <div id="auth-error" style="color:var(--danger);font-size:13px;margin-bottom:10px;min-height:18px"></div>
    <button class="btn btn-primary w-full" onclick="doLogin()">Entrar</button>
  `;
}

async function doLogin() {
  const u = document.getElementById('auth-username').value.trim();
  const p = document.getElementById('auth-password').value;
  document.getElementById('auth-error').textContent = '';
  try {
    const data = await api.login(u, p);
    setToken(data.access_token);
    await showApp();
  } catch(e) {
    document.getElementById('auth-error').textContent = e.message || 'Credenciais inválidas';
  }
}

async function doRegister() {
  const username = document.getElementById('auth-username').value.trim();
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!username || !email || !password) { alert('Preenche todos os campos'); return; }
  if (password.length < 8) { alert('Password deve ter pelo menos 8 caracteres'); return; }
  try {
    await api.register({ username, email, password });
    const data = await api.login(username, password);
    setToken(data.access_token);
    await showApp();
  } catch(e) {
    alert('Erro: ' + e.message);
  }
}

async function showApp() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  try {
    const me = await api.me();
    document.getElementById('sidebar-user').textContent = me.username;
    document.getElementById('user-avatar').textContent = me.username[0].toUpperCase();
  } catch {}
  document.getElementById('today-date').textContent = new Date().toLocaleDateString('pt-PT', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
  await navigate('dashboard');
}

function logout() {
  setToken('');
  document.getElementById('app').classList.add('hidden');
  showAuth(false);
}

// ── INIT ──
async function init() {
  // Modal wiring
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === document.getElementById('modal-overlay')) closeModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); navigate(el.dataset.section); });
  });

  // Check if setup needed or already logged in
  try {
    const { setup_needed } = await api.setupNeeded();
    if (setup_needed) { showAuth(true); return; }
    if (_token) {
      try { await api.me(); await showApp(); return; }
      catch { setToken(''); }
    }
    showAuth(false);
  } catch {
    showAuth(false);
  }
}

init();
