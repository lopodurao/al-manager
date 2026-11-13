/**
 * Motor de reservas Casa da Penha
 * Uso: <script src="https://al-manager.onrender.com/static/booking-widget.js" data-api="https://al-manager.onrender.com"></script>
 * Opcional: data-prop="<prop_id>" para pré-selecionar um quarto
 */
(function () {
  const SCRIPT = document.currentScript;
  const API = (SCRIPT?.dataset?.api || 'https://al-manager.onrender.com').replace(/\/$/, '');
  const PRESET_PROP = SCRIPT?.dataset?.prop || '';
  const LANG = (SCRIPT?.dataset?.lang || 'pt').toLowerCase().startsWith('en') ? 'en' : 'pt';
  const I18N = {
    pt: {
      book:'Reservar', chooseRoomDates:'Escolha o quarto e as datas', loading:'A carregar…', next:'Continuar →',
      changeRoom:'← Alterar quarto', chooseDates:'Escolha as datas', clickDates:'Clique no check-in e depois no check-out',
      checkin:'Check-in', checkout:'Check-out', nights:'Noites', changeDates:'← Alterar datas', yourDetails:'Os seus dados',
      fillDetails:'Preencha os dados para confirmar o pedido de reserva', fullName:'Nome completo *', email:'Email *',
      phone:'Telefone', guests:'N.º hóspedes', message:'Mensagem (opcional)', messagePh:'Chegada prevista, pedidos especiais…',
      send:'Enviar pedido de reserva', sending:'A enviar…', sentTitle:'Pedido enviado!',
      sentBody:'Recebemos o seu pedido de reserva. Entraremos em contacto brevemente para confirmar a disponibilidade.<br><br>Enviámos também um email de confirmação para o endereço indicado.',
      errRooms:'Erro ao carregar quartos. Tente novamente.', noRooms:'Não há quartos disponíveis para reserva online de momento.',
      bed:n=>`${n} cama${n!==1?'s':''}`, bath:'wc', maxGuests:n=>`Máx. ${n}`, minNights:n=>`Mín. ${n} noites`,
      askPrice:'Consultar preço', perNight:'/ noite', minStay:n=>`⚠ Estadia mínima de ${n} noite${n!==1?'s':''}`,
      nightsX:(n,r,t)=>`${n} noite${n!==1?'s':''} × ${r} € = ${t} € (total)`,
      needName:'Por favor indique o seu nome.', needEmail:'Por favor indique o seu email.', errUnknown:'Erro desconhecido', errSend:'Erro ao enviar pedido. Tente novamente.',
      months:['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
      days:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'], namePh:'João Silva', phonePh:'+351 912 345 678'
    },
    en: {
      book:'Book', chooseRoomDates:'Choose your room and dates', loading:'Loading…', next:'Continue →',
      changeRoom:'← Change room', chooseDates:'Choose your dates', clickDates:'Click your check-in date, then your check-out date',
      checkin:'Check-in', checkout:'Check-out', nights:'Nights', changeDates:'← Change dates', yourDetails:'Your details',
      fillDetails:'Please fill in your details to submit your booking request', fullName:'Full name *', email:'Email *',
      phone:'Phone', guests:'No. of guests', message:'Message (optional)', messagePh:'Expected arrival time, special requests…',
      send:'Send booking request', sending:'Sending…', sentTitle:'Request sent!',
      sentBody:'We have received your booking request. We will contact you shortly to confirm availability.<br><br>We have also sent a confirmation email to the address you provided.',
      errRooms:'Could not load rooms. Please try again.', noRooms:'There are no rooms available for online booking at the moment.',
      bed:n=>`${n} bed${n!==1?'s':''}`, bath:'bath', maxGuests:n=>`Max. ${n}`, minNights:n=>`Min. ${n} nights`,
      askPrice:'Price on request', perNight:'/ night', minStay:n=>`⚠ Minimum stay of ${n} night${n!==1?'s':''}`,
      nightsX:(n,r,t)=>`${n} night${n!==1?'s':''} × ${r} € = ${t} € (total)`,
      needName:'Please enter your name.', needEmail:'Please enter your email.', errUnknown:'Unknown error', errSend:'Could not send your request. Please try again.',
      months:['January','February','March','April','May','June','July','August','September','October','November','December'],
      days:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], namePh:'John Smith', phonePh:'+351 912 345 678'
    }
  };
  const T = I18N[LANG];

  /* ── Estilos ─────────────────────────────────────────────────────────── */
  const CSS = `
  .cdp-widget{font-family:'Segoe UI',Arial,sans-serif;color:#1f2937;max-width:720px;margin:0 auto;padding:0 12px;box-sizing:border-box}
  .cdp-widget *{box-sizing:border-box}
  .cdp-step{display:none}.cdp-step.active{display:block}
  .cdp-title{font-size:22px;font-weight:800;margin:0 0 6px;color:#111827}
  .cdp-subtitle{font-size:14px;color:#6b7280;margin:0 0 24px}
  .cdp-rooms{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;margin-bottom:24px}
  .cdp-room{border:2px solid #e5e7eb;border-radius:14px;padding:20px;cursor:pointer;transition:.18s}
  .cdp-room:hover{border-color:#667eea;box-shadow:0 4px 16px rgba(102,126,234,.15)}
  .cdp-room.selected{border-color:#667eea;background:#f0f2ff}
  .cdp-room-name{font-size:16px;font-weight:700;margin:0 0 6px}
  .cdp-room-desc{font-size:13px;color:#4b5563;margin:0 0 12px;line-height:1.5}
  .cdp-room-meta{display:flex;gap:10px;flex-wrap:wrap;font-size:12px;color:#6b7280}
  .cdp-room-rate{font-size:17px;font-weight:800;color:#667eea;margin-top:10px}
  .cdp-calendar-wrap{margin-bottom:20px}
  .cdp-cal-nav{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
  .cdp-cal-nav button{background:none;border:1px solid #e5e7eb;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:18px;color:#374151}
  .cdp-cal-nav button:hover{background:#f3f4f6}
  .cdp-cal-month{font-size:16px;font-weight:700;color:#111827}
  .cdp-cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}
  .cdp-cal-dow{text-align:center;font-size:11px;font-weight:600;color:#9ca3af;padding:4px 0}
  .cdp-cal-day{text-align:center;padding:8px 2px;border-radius:8px;font-size:13px;cursor:pointer;transition:.12s;user-select:none}
  .cdp-cal-day:hover:not(.blocked):not(.empty){background:#f3f4f6}
  .cdp-cal-day.empty{cursor:default}
  .cdp-cal-day.blocked{color:#d1d5db;cursor:not-allowed;text-decoration:line-through}
  .cdp-cal-day.past{color:#d1d5db;cursor:not-allowed}
  .cdp-cal-day.checkin{background:#667eea;color:#fff;border-radius:8px 0 0 8px}
  .cdp-cal-day.checkout{background:#667eea;color:#fff;border-radius:0 8px 8px 0}
  .cdp-cal-day.inrange{background:#e0e7ff;border-radius:0}
  .cdp-cal-day.checkin.checkout{border-radius:8px}
  .cdp-dates-display{background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;gap:24px;flex-wrap:wrap;align-items:center}
  .cdp-dates-display .cdp-dt{flex:1;min-width:120px}
  .cdp-dates-display .cdp-dt label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#9ca3af;font-weight:600}
  .cdp-dates-display .cdp-dt span{display:block;font-size:16px;font-weight:700;color:#111827;margin-top:2px}
  .cdp-price-preview{background:#eef2ff;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:600;color:#4338ca;margin-bottom:20px}
  .cdp-form{display:grid;gap:14px}
  .cdp-field label{display:block;font-size:12px;font-weight:600;color:#374151;margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em}
  .cdp-field input,.cdp-field textarea,.cdp-field select{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#111827;background:#fff;outline:none;transition:.15s}
  .cdp-field input:focus,.cdp-field textarea:focus{border-color:#667eea;box-shadow:0 0 0 3px rgba(102,126,234,.15)}
  .cdp-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  .cdp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 24px;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;transition:.15s}
  .cdp-btn-primary{background:linear-gradient(135deg,#667eea,#764ba2);color:#fff;width:100%}
  .cdp-btn-primary:hover{opacity:.92;transform:translateY(-1px)}
  .cdp-btn-primary:disabled{opacity:.5;cursor:not-allowed;transform:none}
  .cdp-btn-back{background:none;border:1px solid #e5e7eb;color:#374151;padding:10px 18px;border-radius:8px;font-size:14px;cursor:pointer;margin-bottom:16px}
  .cdp-btn-back:hover{background:#f3f4f6}
  .cdp-error{background:#fef2f2;border:1px solid #fecaca;color:#991b1b;border-radius:10px;padding:12px 14px;font-size:14px;margin-bottom:14px;display:none}
  .cdp-success{text-align:center;padding:32px 16px}
  .cdp-success .cdp-check{font-size:56px;display:block;margin-bottom:16px}
  .cdp-success h3{font-size:22px;font-weight:800;color:#065f46;margin:0 0 10px}
  .cdp-success p{font-size:15px;color:#4b5563;line-height:1.7;margin:0}
  `;

  /* ── HTML ────────────────────────────────────────────────────────────── */
  const HTML = `
  <div class="cdp-widget" id="cdp-widget">
    <!-- Passo 1: Escolha do quarto -->
    <div class="cdp-step active" id="cdp-step1">
      <h2 class="cdp-title">${T.book}</h2>
      <p class="cdp-subtitle">${T.chooseRoomDates}</p>
      <div class="cdp-rooms" id="cdp-rooms">
        <div style="color:#9ca3af;font-size:14px">${T.loading}</div>
      </div>
      <button class="cdp-btn cdp-btn-primary" id="cdp-btn-next1" disabled onclick="cdpNext1()">${T.next}</button>
    </div>

    <!-- Passo 2: Calendário -->
    <div class="cdp-step" id="cdp-step2">
      <button class="cdp-btn-back" onclick="cdpBack(1)">${T.changeRoom}</button>
      <h2 class="cdp-title">${T.chooseDates}</h2>
      <p class="cdp-subtitle">${T.clickDates}</p>
      <div class="cdp-calendar-wrap">
        <div class="cdp-cal-nav">
          <button onclick="cdpCalPrev()">&#8249;</button>
          <span class="cdp-cal-month" id="cdp-cal-month"></span>
          <button onclick="cdpCalNext()">&#8250;</button>
        </div>
        <div class="cdp-cal-grid" id="cdp-cal"></div>
      </div>
      <div class="cdp-dates-display" id="cdp-dates-display">
        <div class="cdp-dt"><label>${T.checkin}</label><span id="cdp-d-checkin">—</span></div>
        <div class="cdp-dt"><label>${T.checkout}</label><span id="cdp-d-checkout">—</span></div>
        <div class="cdp-dt"><label>${T.nights}</label><span id="cdp-d-nights">—</span></div>
      </div>
      <div class="cdp-price-preview" id="cdp-price-preview" style="display:none"></div>
      <button class="cdp-btn cdp-btn-primary" id="cdp-btn-next2" disabled onclick="cdpNext2()">${T.next}</button>
    </div>

    <!-- Passo 3: Dados do hóspede -->
    <div class="cdp-step" id="cdp-step3">
      <button class="cdp-btn-back" onclick="cdpBack(2)">${T.changeDates}</button>
      <h2 class="cdp-title">${T.yourDetails}</h2>
      <p class="cdp-subtitle">${T.fillDetails}</p>
      <div class="cdp-error" id="cdp-err"></div>
      <div class="cdp-form">
        <div class="cdp-row">
          <div class="cdp-field"><label>${T.fullName}</label><input id="cdp-name" autocomplete="name" placeholder="${T.namePh}"></div>
          <div class="cdp-field"><label>${T.email}</label><input type="email" id="cdp-email" autocomplete="email" placeholder="joao@email.com"></div>
        </div>
        <div class="cdp-row">
          <div class="cdp-field"><label>${T.phone}</label><input type="tel" id="cdp-phone" autocomplete="tel" placeholder="${T.phonePh}"></div>
          <div class="cdp-field"><label>${T.guests}</label><input type="number" id="cdp-guests" value="2" min="1"></div>
        </div>
        <div class="cdp-field"><label>${T.message}</label><textarea id="cdp-notes" rows="3" placeholder="${T.messagePh}"></textarea></div>
        <!-- honeypot - must stay empty -->
        <div style="display:none"><input id="cdp-hp" tabindex="-1" autocomplete="off"></div>
        <button class="cdp-btn cdp-btn-primary" id="cdp-btn-submit" onclick="cdpSubmit()">${T.send}</button>
      </div>
    </div>

    <!-- Passo 4: Sucesso -->
    <div class="cdp-step" id="cdp-step4">
      <div class="cdp-success">
        <span class="cdp-check">✅</span>
        <h3>${T.sentTitle}</h3>
        <p>${T.sentBody}</p>
      </div>
    </div>
  </div>
  `;

  /* ── State ───────────────────────────────────────────────────────────── */
  const S = {
    rooms: [],
    blockedRanges: {},   // prop_id → [{checkin, checkout}]
    selectedProp: null,
    calYear: 0, calMonth: 0,
    checkin: null, checkout: null,
    picking: 'checkin',
  };

  /* ── Boot ────────────────────────────────────────────────────────────── */
  function init() {
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const mount = document.getElementById('cdp-mount') || document.body;
    const wrap = document.createElement('div');
    wrap.innerHTML = HTML;
    mount.appendChild(wrap);

    const today = new Date();
    S.calYear = today.getFullYear();
    S.calMonth = today.getMonth();

    loadRooms();
  }

  async function loadRooms() {
    try {
      const res = await fetch(`${API}/api/public/rooms`);
      S.rooms = await res.json();
      renderRooms();
      if (PRESET_PROP) {
        const match = S.rooms.find(r => r.id === PRESET_PROP);
        if (match) selectRoom(match.id);
      }
    } catch (e) {
      document.getElementById('cdp-rooms').innerHTML = `<div style="color:#ef4444;font-size:14px">${T.errRooms}</div>`;
    }
  }

  function renderRooms() {
    const container = document.getElementById('cdp-rooms');
    if (!S.rooms.length) {
      container.innerHTML = `<div style="color:#6b7280;font-size:14px">${T.noRooms}</div>`;
      return;
    }
    container.innerHTML = S.rooms.map(r => `
      <div class="cdp-room${S.selectedProp === r.id ? ' selected' : ''}" id="cdp-room-${r.id}" onclick="cdpSelectRoom('${r.id}')">
        <div class="cdp-room-name">${esc(r.name)}</div>
        ${r.description ? `<div class="cdp-room-desc">${esc(r.description)}</div>` : ''}
        <div class="cdp-room-meta">
          <span>🛏 ${T.bed(r.beds)}</span>
          <span>🚿 ${r.baths} ${T.bath}</span>
          <span>👥 ${T.maxGuests(r.max_guests)}</span>
          ${r.min_nights > 1 ? `<span>📅 ${T.minNights(r.min_nights)}</span>` : ''}
        </div>
        <div class="cdp-room-rate">${r.nightly_rate > 0 ? `${r.nightly_rate.toFixed(2)} € ${T.perNight}` : T.askPrice}</div>
      </div>
    `).join('');
  }

  window.cdpSelectRoom = function (id) {
    selectRoom(id);
  };

  function selectRoom(id) {
    S.selectedProp = id;
    renderRooms();
    document.getElementById('cdp-btn-next1').disabled = false;
    loadBlocked(id);
  }

  async function loadBlocked(propId) {
    if (S.blockedRanges[propId]) return;
    try {
      const res = await fetch(`${API}/api/public/availability?prop_id=${propId}`);
      S.blockedRanges[propId] = await res.json();
    } catch (_) {
      S.blockedRanges[propId] = [];
    }
  }

  /* ── Navigation ──────────────────────────────────────────────────────── */
  window.cdpNext1 = function () { if (!S.selectedProp) return; cdpGo(2); renderCal(); };
  window.cdpNext2 = function () { if (!S.checkin || !S.checkout) return; cdpGo(3); };
  window.cdpBack  = function (n) { cdpGo(n); };

  function cdpGo(n) {
    document.querySelectorAll('.cdp-step').forEach(s => s.classList.remove('active'));
    document.getElementById('cdp-step' + n).classList.add('active');
    document.getElementById('cdp-widget').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Calendar ────────────────────────────────────────────────────────── */
  const MONTHS_PT = T.months;
  const DAYS_PT   = T.days;

  window.cdpCalPrev = function () { S.calMonth--; if (S.calMonth < 0) { S.calMonth = 11; S.calYear--; } renderCal(); };
  window.cdpCalNext = function () { S.calMonth++; if (S.calMonth > 11) { S.calMonth = 0; S.calYear++; } renderCal(); };

  function renderCal() {
    document.getElementById('cdp-cal-month').textContent = `${MONTHS_PT[S.calMonth]} ${S.calYear}`;
    const grid = document.getElementById('cdp-cal');
    const today = new Date(); today.setHours(0,0,0,0);
    const firstDay = new Date(S.calYear, S.calMonth, 1).getDay();
    const daysInMonth = new Date(S.calYear, S.calMonth + 1, 0).getDate();
    const blocked = S.blockedRanges[S.selectedProp] || [];

    let html = DAYS_PT.map(d => `<div class="cdp-cal-dow">${d}</div>`).join('');
    for (let i = 0; i < firstDay; i++) html += '<div class="cdp-cal-day empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(S.calYear, S.calMonth, d);
      const iso  = dateIso(date);
      const isPast = date < today;
      const isBlocked = isBlockedDate(iso, blocked);

      let cls = 'cdp-cal-day';
      if (isPast)      cls += ' past';
      else if (isBlocked) cls += ' blocked';
      else {
        if (iso === S.checkin)  cls += ' checkin';
        if (iso === S.checkout) cls += ' checkout';
        if (S.checkin && S.checkout && iso > S.checkin && iso < S.checkout) cls += ' inrange';
      }
      const clickable = !isPast && !isBlocked;
      html += `<div class="${cls}"${clickable ? ` onclick="cdpPickDay('${iso}')"` : ''}>${d}</div>`;
    }
    grid.innerHTML = html;
  }

  function isBlockedDate(iso, blocked) {
    return blocked.some(r => iso >= r.checkin && iso < r.checkout);
  }

  window.cdpPickDay = function (iso) {
    if (S.picking === 'checkin' || (S.checkin && S.checkout)) {
      S.checkin = iso; S.checkout = null; S.picking = 'checkout';
    } else {
      if (iso <= S.checkin) { S.checkin = iso; S.checkout = null; return; }
      // check no blocked dates in between
      const blocked = S.blockedRanges[S.selectedProp] || [];
      if (blocked.some(r => r.checkin > S.checkin && r.checkin < iso)) {
        S.checkin = iso; S.checkout = null; return;
      }
      S.checkout = iso; S.picking = 'checkin';
    }
    updateDatesDisplay();
    renderCal();
  };

  function updateDatesDisplay() {
    document.getElementById('cdp-d-checkin').textContent  = S.checkin  ? fmtDate(S.checkin)  : '—';
    document.getElementById('cdp-d-checkout').textContent = S.checkout ? fmtDate(S.checkout) : '—';

    if (S.checkin && S.checkout) {
      const nights = daysBetween(S.checkin, S.checkout);
      document.getElementById('cdp-d-nights').textContent = nights;
      const room = S.rooms.find(r => r.id === S.selectedProp);
      const minN = room?.min_nights || 1;
      const btn  = document.getElementById('cdp-btn-next2');
      const prev = document.getElementById('cdp-price-preview');
      if (nights < minN) {
        prev.style.display = 'block';
        prev.textContent = T.minStay(minN);
        prev.style.background = '#fef3c7'; prev.style.color = '#92400e';
        btn.disabled = true;
      } else if (room?.nightly_rate > 0) {
        const total = (nights * room.nightly_rate).toFixed(2);
        prev.style.display = 'block';
        prev.textContent = T.nightsX(nights, room.nightly_rate.toFixed(2), total);
        prev.style.background = '#eef2ff'; prev.style.color = '#4338ca';
        btn.disabled = false;
      } else {
        prev.style.display = 'none';
        btn.disabled = false;
      }
    } else {
      document.getElementById('cdp-d-nights').textContent = '—';
      document.getElementById('cdp-price-preview').style.display = 'none';
      document.getElementById('cdp-btn-next2').disabled = true;
    }
  }

  /* ── Submit ──────────────────────────────────────────────────────────── */
  window.cdpSubmit = async function () {
    const name  = document.getElementById('cdp-name').value.trim();
    const email = document.getElementById('cdp-email').value.trim();
    const phone = document.getElementById('cdp-phone').value.trim();
    const guests = +document.getElementById('cdp-guests').value || 2;
    const notes = document.getElementById('cdp-notes').value.trim();
    const hp    = document.getElementById('cdp-hp').value;
    const err   = document.getElementById('cdp-err');

    err.style.display = 'none';
    if (!name)  { showErr(T.needName); return; }
    if (!email) { showErr(T.needEmail); return; }

    const btn = document.getElementById('cdp-btn-submit');
    btn.disabled = true; btn.textContent = T.sending;

    try {
      const res = await fetch(`${API}/api/public/booking-requests`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          prop_id: S.selectedProp,
          checkin: S.checkin,
          checkout: S.checkout,
          guest_name: name,
          guest_email: email,
          guest_phone: phone,
          guests,
          notes,
          hp,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || T.errUnknown);
      cdpGo(4);
    } catch (e) {
      showErr(e.message || T.errSend);
      btn.disabled = false; btn.textContent = T.send;
    }
  };

  function showErr(msg) {
    const el = document.getElementById('cdp-err');
    el.textContent = msg; el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ── Helpers ─────────────────────────────────────────────────────────── */
  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function dateIso(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function fmtDate(iso) {
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  /* ── Run ─────────────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
