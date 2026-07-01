// AL Manager — main router & event wiring

const SECTIONS = {
  dashboard:   { title: 'Dashboard',           render: renderDashboard },
  properties:  { title: 'Propriedades',         render: renderProperties },
  reservations:{ title: 'Reservas',             render: renderReservations },
  guests:      { title: 'Hóspedes',             render: renderGuests },
  sef:         { title: 'SEF / SIBA',           render: renderSef },
  cleaning:    { title: 'Limpezas & Manutenção',render: renderCleaning },
  financial:   { title: 'Financeiro',           render: renderFinancial },
  messages:    { title: 'Mensagens',            render: renderMessages },
  ota:         { title: 'Canais OTA',           render: renderOta },
  erp:         { title: 'Primavera ERP',        render: renderErp },
  settings:    { title: 'Configurações',        render: renderSettings },
};

let currentSection = 'dashboard';

function navigate(section) {
  if (!SECTIONS[section]) return;
  currentSection = section;

  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Update title
  document.getElementById('section-title').textContent = SECTIONS[section].title;

  // Render content
  document.getElementById('content').innerHTML = SECTIONS[section].render();
}

// Nav clicks
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    navigate(el.dataset.section);
  });
});

// Modal close
document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// Today date in topbar
document.getElementById('today-date').textContent = new Date().toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// Initial render
navigate('dashboard');

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});
