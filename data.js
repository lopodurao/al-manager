// AL Manager — persistent data layer (localStorage)

const DB = {
  _key: 'al_manager_v1',

  defaults() {
    return {
      properties: [
        { id: 'p1', name: 'Casa da Ria', address: 'Rua do Mar 12, Aveiro', type: 'Apartamento', rooms: 2, beds: 3, baths: 1, maxGuests: 4, license: 'AL/2019/1234', notes: '', color: '#667eea' },
        { id: 'p2', name: 'Quinta do Pinheiro', address: 'Lugar do Pinheiro 5, Lousã', type: 'Moradia', rooms: 3, beds: 5, baths: 2, maxGuests: 6, license: 'AL/2020/5678', notes: '', color: '#f59e0b' },
      ],
      reservations: [
        { id: 'r1', propId: 'p1', guestName: 'Müller, Hans', guestEmail: 'hans@email.de', guestPhone: '+49 170 1234567', guestNationality: 'DE', checkin: '2026-07-01', checkout: '2026-07-07', guests: 2, channel: 'airbnb', status: 'confirmed', price: 420, commission: 63, notes: '', docId: 'DE12345678' },
        { id: 'r2', propId: 'p2', guestName: 'Silva, João', guestEmail: 'joao@email.pt', guestPhone: '+351 912 345 678', guestNationality: 'PT', checkin: '2026-07-10', checkout: '2026-07-14', guests: 4, channel: 'direct', status: 'confirmed', price: 280, commission: 0, notes: '', docId: 'PT123456' },
        { id: 'r3', propId: 'p1', guestName: 'Martin, Sophie', guestEmail: 'sophie@email.fr', guestPhone: '+33 6 12 34 56 78', guestNationality: 'FR', checkin: '2026-07-15', checkout: '2026-07-20', guests: 2, channel: 'booking', status: 'confirmed', price: 350, commission: 52.5, notes: '', docId: 'FR9876543' },
        { id: 'r4', propId: 'p2', guestName: 'Costa, Ana', guestEmail: 'ana@email.pt', guestPhone: '+351 966 789 012', guestNationality: 'PT', checkin: '2026-07-22', checkout: '2026-07-28', guests: 5, channel: 'livvi', status: 'pending', price: 480, commission: 48, notes: '', docId: 'PT654321' },
      ],
      guests: [],
      cleaningTasks: [
        { id: 'c1', propId: 'p1', type: 'limpeza', assignee: 'Maria F.', date: '2026-07-07', status: 'pending', notes: 'Check-out Müller', priority: 'high' },
        { id: 'c2', propId: 'p2', type: 'limpeza', assignee: 'Carla S.', date: '2026-07-14', status: 'pending', notes: 'Check-out Silva', priority: 'high' },
        { id: 'c3', propId: 'p1', type: 'manutencao', assignee: 'Técnico João', date: '2026-07-08', status: 'pending', notes: 'Verificar AC', priority: 'medium' },
      ],
      transactions: [
        { id: 't1', propId: 'p1', resId: 'r1', date: '2026-07-01', type: 'income', category: 'Alojamento', amount: 420, desc: 'Reserva Müller - Airbnb', channel: 'airbnb' },
        { id: 't2', propId: 'p1', resId: 'r1', date: '2026-07-01', type: 'expense', category: 'Comissão OTA', amount: 63, desc: 'Comissão Airbnb (15%)', channel: 'airbnb' },
        { id: 't3', propId: 'p2', resId: 'r2', date: '2026-07-10', type: 'income', category: 'Alojamento', amount: 280, desc: 'Reserva Silva - Direto', channel: 'direct' },
        { id: 't4', propId: 'p1', date: '2026-06-15', type: 'expense', category: 'Limpeza', amount: 45, desc: 'Serviço de limpeza', channel: '' },
        { id: 't5', propId: 'p2', date: '2026-06-20', type: 'expense', category: 'Manutenção', amount: 120, desc: 'Reparação canalização', channel: '' },
      ],
      messages: [
        { id: 'm1', name: 'Boas-vindas', trigger: 'checkin-1d', channel: 'all', subject: 'Boas-vindas ao {{property}}!', body: 'Olá {{guest}},\n\nEstamos muito felizes por receber-vos no {{property}}!\n\nO check-in é a partir das {{checkin_time}}h.\nO código de acesso é: {{access_code}}\n\nQualquer dúvida, estamos à disposição.\n\nBoas férias!', active: true },
        { id: 'm2', name: 'Pré check-out', trigger: 'checkout-1d', channel: 'all', subject: 'Informações de saída — {{property}}', body: 'Olá {{guest}},\n\nLembramos que o check-out é amanhã até às {{checkout_time}}h.\n\nPor favor deixe as chaves em {{key_location}}.\n\nObrigado pela vossa estadia!', active: true },
        { id: 'm3', name: 'Avaliação pós-estadia', trigger: 'checkout+1d', channel: 'email', subject: 'Como foi a vossa estadia em {{property}}?', body: 'Olá {{guest}},\n\nEsperamos que tenham tido uma excelente estadia!\n\nA vossa opinião é muito importante para nós. Podiam deixar uma avaliação?\n\nObrigado!', active: false },
      ],
      otaChannels: [
        { id: 'ota1', name: 'Airbnb', slug: 'airbnb', icalUrl: '', lastSync: null, active: false },
        { id: 'ota2', name: 'Booking.com', slug: 'booking', icalUrl: '', lastSync: null, active: false },
        { id: 'ota3', name: 'Livvi', slug: 'livvi', icalUrl: '', lastSync: null, active: false },
      ],
      settings: {
        ownerName: 'Proprietário AL',
        ownerNIF: '',
        ownerPhone: '',
        ownerEmail: '',
        alLicense: '',
        checkinTime: '15:00',
        checkoutTime: '11:00',
        keyLocation: 'Caixa de chaves na porta',
        accessCode: '',
        cleaningFee: 40,
        sefUser: '',
        sefPass: '',
        primaveraSeries: 'AL',
        primaveraVatRate: 6,
        currency: 'EUR',
      }
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this._key);
      if (!raw) return this.defaults();
      const saved = JSON.parse(raw);
      const def = this.defaults();
      // merge top-level keys
      return { ...def, ...saved, settings: { ...def.settings, ...(saved.settings || {}) } };
    } catch { return this.defaults(); }
  },

  save(data) {
    localStorage.setItem(this._key, JSON.stringify(data));
  }
};

// Global state
let state = DB.load();

function saveState() { DB.save(state); }

function genId(prefix = 'x') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function getProp(id) { return state.properties.find(p => p.id === id); }
function getRes(id) { return state.reservations.find(r => r.id === id); }

const CHANNELS = { airbnb: 'Airbnb', booking: 'Booking.com', livvi: 'Livvi', direct: 'Direto' };
const COUNTRIES = { PT: '🇵🇹 Portugal', DE: '🇩🇪 Alemanha', FR: '🇫🇷 França', ES: '🇪🇸 Espanha', GB: '🇬🇧 Reino Unido', US: '🇺🇸 EUA', BR: '🇧🇷 Brasil', IT: '🇮🇹 Itália', NL: '🇳🇱 Holanda', BE: '🇧🇪 Bélgica', CH: '🇨🇭 Suíça', AT: '🇦🇹 Áustria', PL: '🇵🇱 Polónia', SE: '🇸🇪 Suécia', DK: '🇩🇰 Dinamarca', NO: '🇳🇴 Noruega', FI: '🇫🇮 Finlândia', CZ: '🇨🇿 Chéquia', HU: '🇭🇺 Hungria', RO: '🇷🇴 Roménia' };
const FLAG = { PT:'🇵🇹',DE:'🇩🇪',FR:'🇫🇷',ES:'🇪🇸',GB:'🇬🇧',US:'🇺🇸',BR:'🇧🇷',IT:'🇮🇹',NL:'🇳🇱',BE:'🇧🇪',CH:'🇨🇭',AT:'🇦🇹',PL:'🇵🇱',SE:'🇸🇪',DK:'🇩🇰',NO:'🇳🇴',FI:'🇫🇮',CZ:'🇨🇿',HU:'🇭🇺',RO:'🇷🇴' };
