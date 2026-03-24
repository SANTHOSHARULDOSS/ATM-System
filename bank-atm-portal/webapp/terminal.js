/**
 * terminal.js
 * ============================================================
 * ATM FRONTEND CONTROLLER (The "C" in MVC from the client side)
 * ============================================================
 * Handles all user interactions, view transitions, API
 * communication, and client-side state management.
 *
 * Architecture:
 *  - ATMTerminal: Client-side Singleton that mirrors the backend
 *    ATMMachine Singleton. Manages session state and JWT tokens.
 *  - APIClient: Encapsulates all fetch() calls to the backend.
 *  - ViewManager: Controls which "screen" is visible.
 *  - SessionTimer: Counts down the 2-minute session timeout and
 *    auto-logs out the user when it expires.
 *
 * OOSE Principles applied on the frontend:
 *  - Encapsulation: ATMTerminal hides internal state.
 *  - Separation of Concerns: API calls, UI logic, and state are
 *    separated into distinct classes.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   API CLIENT — Centralised Fetch Wrapper
   ═══════════════════════════════════════════════════════════ */

const API_BASE = '/api';

const I18N = {
  EN: {
    welcomeTitle: 'Welcome',
    welcomeSubtitle: 'Please enter your 16-digit card number to begin.',
    insertCard: 'Insert Card',
    register: 'New Customer? Register Here',
    admin: 'Admin Portal',
    maintenance: 'Maintenance',
    menuTitle: 'How can we help you today?',
    balance: 'Check Balance',
    withdraw: 'Withdraw',
    deposit: 'Deposit Cash',
    transfer: 'Transfer',
    statement: 'Mini Statement',
    checkDeposit: 'Check Deposit',
    changePin: 'Change PIN',
    biometric: 'Biometric Security',
    exit: 'Exit / Eject Card',
    changeLanguage: 'Change Language',
    chooseLanguage: 'Choose Language',
    chooseLanguageHint: 'Please select your preferred language.',
    voiceOn: 'Voice ON',
    voiceOff: 'Voice OFF',
    welcomeVoice: 'Welcome to SANTHOSH BANK ATM. Please enter your sixteen-digit card number.',
    menuVoice: 'Main menu loaded. Choose your banking service.',
  },
  TA: {
    welcomeTitle: 'வரவேற்கிறோம்',
    welcomeSubtitle: 'தொடர 16 இலக்க அட்டை எண்ணை உள்ளிடவும்.',
    insertCard: 'அட்டையை செலுத்தவும்',
    register: 'புதிய வாடிக்கையாளர்? பதிவு செய்யவும்',
    admin: 'நிர்வாகப் பகுதி',
    maintenance: 'பராமரிப்பு',
    menuTitle: 'இன்று எப்படி உதவலாம்?',
    balance: 'இருப்பை பார்க்க',
    withdraw: 'பணம் எடுக்க',
    deposit: 'பணம் வைப்பு',
    transfer: 'பரிமாற்றம்',
    statement: 'மினி ஸ்டேட்மெண்ட்',
    checkDeposit: 'காசோலை வைப்பு',
    changePin: 'PIN மாற்றம்',
    biometric: 'பயோமெட்ரிக் பாதுகாப்பு',
    exit: 'வெளியேறு / அட்டை எடு',
    changeLanguage: 'மொழியை மாற்று',
    chooseLanguage: 'மொழியைத் தேர்வு செய்க',
    chooseLanguageHint: 'தயவுசெய்து உங்கள் மொழியை தேர்வு செய்யவும்.',
    voiceOn: 'ஒலி செயல்படுத்தப்பட்டது',
    voiceOff: 'ஒலி நிறுத்தப்பட்டது',
    welcomeVoice: 'சந்தோஷ் வங்கி ஏடிஎம்-க்கு வரவேற்கிறோம். உங்கள் பதினாறு இலக்க அட்டை எண்ணை உள்ளிடவும்.',
    menuVoice: 'முதன்மை மெனு தயார். வங்கி சேவையை தேர்வு செய்யவும்.',
  },
  HI: {
    welcomeTitle: 'स्वागत है',
    welcomeSubtitle: 'शुरू करने के लिए 16 अंकों का कार्ड नंबर दर्ज करें।',
    insertCard: 'कार्ड डालें',
    register: 'नया ग्राहक? यहाँ पंजीकरण करें',
    admin: 'एडमिन पोर्टल',
    maintenance: 'मेंटेनेंस',
    menuTitle: 'आज आपकी कैसे सहायता करें?',
    balance: 'बैलेंस देखें',
    withdraw: 'निकासी',
    deposit: 'जमा करें',
    transfer: 'ट्रांसफर',
    statement: 'मिनी स्टेटमेंट',
    checkDeposit: 'चेक जमा',
    changePin: 'PIN बदलें',
    biometric: 'बायोमेट्रिक सुरक्षा',
    exit: 'बाहर निकलें / कार्ड निकालें',
    changeLanguage: 'भाषा बदलें',
    chooseLanguage: 'भाषा चुनें',
    chooseLanguageHint: 'कृपया अपनी पसंदीदा भाषा चुनें।',
    voiceOn: 'आवाज चालू',
    voiceOff: 'आवाज बंद',
    welcomeVoice: 'संतोष बैंक एटीएम में आपका स्वागत है। कृपया अपना 16 अंकों का कार्ड नंबर दर्ज करें।',
    menuVoice: 'मुख्य मेनू तैयार है। अपनी बैंकिंग सेवा चुनें।',
  },
};

const APIClient = {
  /**
   * Makes an authenticated or unauthenticated HTTP request.
   * @param {string} endpoint - e.g. '/auth/login'
   * @param {string} method   - HTTP verb
   * @param {Object|null} body  - JSON body
   * @param {string|null} token - Bearer JWT (null for public routes)
   * @returns {Promise<Object>}
   */
  async request(endpoint, method = 'GET', body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    // Surface HTTP errors as thrown objects for caller to handle.
    if (!response.ok) {
      const err = new Error(data.message || 'Request failed.');
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  },

  // Convenience methods
  get:  (ep, token)       => APIClient.request(ep, 'GET',    null, token),
  post: (ep, body, token) => APIClient.request(ep, 'POST',   body, token),
  put:  (ep, body, token) => APIClient.request(ep, 'PUT',    body, token),
};

/* ═══════════════════════════════════════════════════════════
   VIEW MANAGER — Screen Transition Controller
   ═══════════════════════════════════════════════════════════ */

const ViewManager = {
  _history: ['language'],

  /** Shows the target view and hides all others. */
  show(viewId, options = {}) {
    const { pushHistory = true } = options;
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.add('active');

    if (pushHistory) {
      const current = this._history[this._history.length - 1];
      if (current !== viewId) this._history.push(viewId);
    }
    this._syncBackButton();

    if (typeof ATMTerminal !== 'undefined' && ATMTerminal && typeof ATMTerminal._announceView === 'function') {
      ATMTerminal._announceView(viewId);
    }
  },

  reset(viewId = 'language') {
    this._history = [viewId];
    this.show(viewId, { pushHistory: false });
  },

  goBack() {
    if (this._history.length <= 1) return;
    this._history.pop();
    const previous = this._history[this._history.length - 1] || 'language';
    this.show(previous, { pushHistory: false });
  },

  _syncBackButton() {
    const btn = document.getElementById('btnGlobalBack');
    if (!btn) return;

    const active = document.querySelector('.view.active');
    const activeId = active ? active.id : '';
    const rootViews = new Set(['view-language', 'view-welcome']);
    const shouldHide = rootViews.has(activeId) || this._history.length <= 1;

    btn.classList.toggle('hidden', shouldHide);
  },
};

/* ═══════════════════════════════════════════════════════════
   SESSION TIMER
   ═══════════════════════════════════════════════════════════
   Counts down from 2 minutes (matching JWT exp).
   Warns user at 30 seconds, then auto-logs out.
   ─────────────────────────────────────────────────────────── */

const SessionTimer = {
  _interval: null,
  _seconds: 120,

  start(seconds = 120) {
    this.clear();
    this._seconds = seconds;
    const timerEl   = document.getElementById('sessionTimer');
    const displayEl = document.getElementById('timerDisplay');
    timerEl.classList.remove('hidden');

    this._interval = setInterval(() => {
      this._seconds--;
      const mins = String(Math.floor(this._seconds / 60)).padStart(2, '0');
      const secs = String(this._seconds % 60).padStart(2, '0');
      displayEl.textContent = `${mins}:${secs}`;

      if (this._seconds === 30) {
        ToastManager.show('Session expiring in 30 seconds. Please complete your transaction.', 'warn');
      }

      if (this._seconds <= 0) {
        this.clear();
        ToastManager.show('Session expired due to inactivity.', 'error');
        ATMTerminal.logout();
      }
    }, 1000);
  },

  /** Resets the timer on each user action. */
  reset() {
    if (this._interval) this.start(120);
  },

  addSeconds(extra = 60) {
    if (!this._interval) return;
    this._seconds += Math.max(0, parseInt(extra, 10) || 0);
  },

  clear() {
    if (this._interval) { clearInterval(this._interval); this._interval = null; }
    const timerEl = document.getElementById('sessionTimer');
    if (timerEl) timerEl.classList.add('hidden');
  },
};

/* ═══════════════════════════════════════════════════════════
   TOAST NOTIFICATION MANAGER
   ═══════════════════════════════════════════════════════════ */

const ToastManager = {
  _timeout: null,

  show(message, type = 'info') {
    const toast = document.getElementById('toast');
    const msg   = document.getElementById('toastMsg');

    if (this._timeout) clearTimeout(this._timeout);

    toast.className = 'toast';
    if (type === 'success') toast.classList.add('toast-success');
    if (type === 'error')   toast.classList.add('toast-error');
    if (type === 'warn')    toast.classList.add('toast-warn');

    msg.textContent = message;
    toast.classList.remove('hidden');

    this._timeout = setTimeout(() => toast.classList.add('hidden'), 3500);
  },
};

/* ═══════════════════════════════════════════════════════════
   ATMTerminal — CLIENT-SIDE SINGLETON
   ═══════════════════════════════════════════════════════════
   Manages all session state: token, card number, current action.
   ─────────────────────────────────────────────────────────── */

const ATMTerminal = {
  // Session state
  token:       null,
  adminToken:  null,
  maintenanceToken: null,
  cardNumber:  null,
  holderName:  null,
  accountType: null,
  balance:     null,
  language: null,
  voiceEnabled: localStorage.getItem('atmVoiceAssist') === 'on',
  theme: localStorage.getItem('atmTheme') || 'dark',
  layoutMode: localStorage.getItem('atmLayoutMode') || 'tile',
  uiZoom: parseInt(localStorage.getItem('atmUiZoom') || '100', 10),
  _indiaClockInterval: null,
  _adsInterval: null,
  _adsIndex: 0,
  _voices: [],
  _ads: [
    'SANTHOSH BANK ATM - Safe Banking, Smart Future.',
    'Gold Rate Today: 24K Rs. 7,420/g | 22K Rs. 6,805/g.',
    'Festival Offer: Zero charges on first 3 transfers this month.',
    'Fixed Deposit Special: Up to 8.10% p.a. for senior citizens.',
    'Home Loan Week: Interest rates starting at 8.35% p.a.',
    'Use Biometric Security for safer ATM transactions.',
  ],

  // Tracks which transaction type the amount view is handling.
  _currentAction: null,

  /* ── Initialisation ───────────────────────────────────── */
  init() {
    this._bindThemeSwitcher();
    this._applyTheme(this.theme);
    this._bindLayoutZoomControls();
    this._applyMenuLayout(this.layoutMode);
    this._applyZoom(this.uiZoom);
    this._bindGlobalNavigation();
    this._bindVoiceAssist();
    this._refreshVoiceButton();
    this._bindLanguagePicker();
    this._applyLayoutMode();
    this._startIndiaClock();
    this._startAdRotation();
    this._startOffersTicker();
    window.addEventListener('resize', () => this._applyLayoutMode());

    this._bindCardInput();
    this._bindForgotView();
    this._bindPinKeypad();
    this._bindMenuButtons();
    this._bindAmountView();
    this._bindChangePinView();
    this._bindBiometricSetup();
    this._bindBiometricVerify();
    this._bindRegisterView();
    this._bindAdminView();
    this._bindMaintenanceView();
    this._bindStatementView();
    this._bindResultButtons();

    ViewManager.reset('language');
  },

  _bindGlobalNavigation() {
    const btn = document.getElementById('btnGlobalBack');
    if (!btn) return;
    btn.addEventListener('click', () => ViewManager.goBack());
    ViewManager._syncBackButton();
  },

  _bindVoiceAssist() {
    const btn = document.getElementById('btnVoiceAssist');
    if (!btn) return;

    this._voices = window.speechSynthesis ? window.speechSynthesis.getVoices() : [];
    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => {
        this._voices = window.speechSynthesis.getVoices();
      };
    }

    btn.addEventListener('click', () => {
      this.voiceEnabled = !this.voiceEnabled;
      localStorage.setItem('atmVoiceAssist', this.voiceEnabled ? 'on' : 'off');
      this._refreshVoiceButton();

      const t = I18N[this.language] || I18N.EN;
      const msg = this.voiceEnabled ? t.voiceOn : t.voiceOff;
      ToastManager.show(msg, this.voiceEnabled ? 'success' : 'warn');
      if (this.voiceEnabled) this._speak(msg);
    });
  },

  _refreshVoiceButton() {
    const btn = document.getElementById('btnVoiceAssist');
    if (!btn) return;
    const t = I18N[this.language] || I18N.EN;
    btn.textContent = this.voiceEnabled ? t.voiceOn : t.voiceOff;
    btn.classList.toggle('active', this.voiceEnabled);
  },

  _bindLayoutZoomControls() {
    const layoutSelect = document.getElementById('layoutModeSelect');
    const tileBtn = document.getElementById('btnMenuTile');
    const gridBtn = document.getElementById('btnMenuGrid');
    const zoomOutBtn = document.getElementById('btnZoomOut');
    const zoomInBtn = document.getElementById('btnZoomIn');

    if (layoutSelect) {
      layoutSelect.value = this.layoutMode;
      layoutSelect.addEventListener('change', (e) => {
        this._applyMenuLayout(e.target.value);
      });
    }

    if (tileBtn) {
      tileBtn.addEventListener('click', () => this._applyMenuLayout('tile'));
    }

    if (gridBtn) {
      gridBtn.addEventListener('click', () => this._applyMenuLayout('grid'));
    }

    if (zoomOutBtn) {
      zoomOutBtn.addEventListener('click', () => {
        this._applyZoom(this.uiZoom - 5);
      });
    }

    if (zoomInBtn) {
      zoomInBtn.addEventListener('click', () => {
        this._applyZoom(this.uiZoom + 5);
      });
    }
  },

  _applyMenuLayout(mode) {
    const normalized = mode === 'grid' ? 'grid' : 'tile';
    this.layoutMode = normalized;
    localStorage.setItem('atmLayoutMode', normalized);

    const grid = document.querySelector('#view-menu .menu-grid');
    if (grid) {
      grid.classList.remove('layout-grid', 'layout-tile');
      grid.classList.add(normalized === 'grid' ? 'layout-grid' : 'layout-tile');
    }

    const layoutSelect = document.getElementById('layoutModeSelect');
    if (layoutSelect && layoutSelect.value !== normalized) layoutSelect.value = normalized;

    const tileBtn = document.getElementById('btnMenuTile');
    const gridBtn = document.getElementById('btnMenuGrid');
    if (tileBtn) tileBtn.classList.toggle('active', normalized === 'tile');
    if (gridBtn) gridBtn.classList.toggle('active', normalized === 'grid');
  },

  _applyZoom(value) {
    const clamped = Math.max(80, Math.min(130, parseInt(value, 10) || 100));
    this.uiZoom = clamped;
    localStorage.setItem('atmUiZoom', String(clamped));
    document.documentElement.style.setProperty('--ui-scale', String(clamped / 100));

    const zoomLabel = document.getElementById('zoomLevel');
    if (zoomLabel) zoomLabel.textContent = `${clamped}%`;
  },

  _bindThemeSwitcher() {
    const btn = document.getElementById('btnThemeToggle');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = this.theme === 'dark' ? 'light' : 'dark';
      this._applyTheme(next);
    });
  },

  _applyTheme(theme) {
    this.theme = theme;
    localStorage.setItem('atmTheme', theme);
    document.body.classList.toggle('theme-light', theme === 'light');
    const btn = document.getElementById('btnThemeToggle');
    if (btn) btn.textContent = theme === 'light' ? '☀️' : '🌙';
  },

  _applyLayoutMode() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ratio = w / h;
    document.body.classList.remove('layout-square', 'layout-portrait', 'layout-landscape');

    if (ratio > 0.9 && ratio < 1.1) {
      document.body.classList.add('layout-square');
    } else if (ratio <= 0.9) {
      document.body.classList.add('layout-portrait');
    } else {
      document.body.classList.add('layout-landscape');
    }
  },

  _bindLanguagePicker() {
    const bind = (id, lang) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', () => {
        this._setLanguage(lang);
        ViewManager.show('welcome');
        const t = I18N[lang] || I18N.EN;
        this._speak(t.welcomeVoice);
      });
    };
    bind('btnLangEnglish', 'EN');
    bind('btnLangTamil', 'TA');
    bind('btnLangHindi', 'HI');
  },

  _setLanguage(lang) {
    this.language = lang;
    const t = I18N[lang] || I18N.EN;

    const setText = (selector, value) => {
      const el = document.querySelector(selector);
      if (el) el.textContent = value;
    };

    setText('#view-language .screen-title', t.chooseLanguage);
    setText('#view-language .screen-subtitle', t.chooseLanguageHint);
    setText('#view-welcome .screen-title', t.welcomeTitle);
    setText('#view-welcome .screen-subtitle', t.welcomeSubtitle);
    setText('#btnInsertCard', t.insertCard);
    setText('#btnGoRegister', t.register);
    setText('#btnGoAdmin', t.admin);
    setText('#btnGoMaintenance', t.maintenance);
    setText('#view-menu .menu-title', t.menuTitle);
    setText('#btnBalance span:last-child', t.balance);
    setText('#btnWithdraw span:last-child', t.withdraw);
    setText('#btnDeposit span:last-child', t.deposit);
    setText('#btnTransfer span:last-child', t.transfer);
    setText('#btnStatement span:last-child', t.statement);
    setText('#btnCheckDeposit span:last-child', t.checkDeposit);
    setText('#btnChangePin span:last-child', t.changePin);
    setText('#btnBiometric span:last-child', t.biometric);
    setText('#btnMenuLanguage span:last-child', t.changeLanguage);
    setText('#btnExit span:last-child', t.exit);
    this._refreshVoiceButton();
  },

  _goToLanguageSelection() {
    this.token = null;
    this.cardNumber = null;
    this._pinValue = '';
    this._updatePinDots(0);
    ViewManager.reset('language');
  },

  _announceView(viewId) {
    if (!this.voiceEnabled) return;
    const t = I18N[this.language] || I18N.EN;

    if (viewId === 'menu') this._speak(t.menuVoice);
    if (viewId === 'welcome') this._speak(t.welcomeVoice);
    if (viewId === 'language') this._speak(t.chooseLanguageHint);
  },

  _speak(text) {
    if (!this.voiceEnabled || !text || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.pitch = 1;

      if (this.language === 'TA') utterance.lang = 'ta-IN';
      else if (this.language === 'HI') utterance.lang = 'hi-IN';
      else utterance.lang = 'en-IN';

      const voices = this._voices.length ? this._voices : window.speechSynthesis.getVoices();
      const desiredToken = this.language === 'TA' ? 'ta' : this.language === 'HI' ? 'hi' : 'en';
      const languageVoice = voices.find((v) => (v.lang || '').toLowerCase().includes(desiredToken));
      const nameVoice = voices.find((v) => (v.name || '').toLowerCase().includes(desiredToken));
      utterance.voice = languageVoice || nameVoice || null;

      window.speechSynthesis.speak(utterance);
    } catch (_) {
      // Voice support can vary by browser/platform, so fail silently.
    }
  },

  _startIndiaClock() {
    const clockEl = document.getElementById('indiaDateTime');
    if (!clockEl) return;

    const updateClock = () => {
      const now = new Date();
      const dateText = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);

      const timeText = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).format(now);

      clockEl.textContent = `India Time (IST): ${dateText} ${timeText}`;
    };

    updateClock();
    if (this._indiaClockInterval) clearInterval(this._indiaClockInterval);
    this._indiaClockInterval = setInterval(updateClock, 1000);
  },

  _startAdRotation() {
    const adEl = document.getElementById('bankAd');
    if (!adEl) return;

    const rotate = () => {
      adEl.textContent = this._ads[this._adsIndex % this._ads.length];
      this._adsIndex += 1;
    };

    rotate();
    if (this._adsInterval) clearInterval(this._adsInterval);
    this._adsInterval = setInterval(rotate, 5000);
  },

  _startOffersTicker() {
    const banner = document.getElementById('loginOffersBanner');
    if (!banner) return;
    banner.scrollLeft = 0;

    setInterval(() => {
      if (banner.scrollWidth <= banner.clientWidth) return;
      const next = banner.scrollLeft + 110;
      const max = banner.scrollWidth - banner.clientWidth;
      banner.scrollTo({ left: next >= max ? 0 : next, behavior: 'smooth' });
    }, 3200);
  },

  /* ── Session Management ───────────────────────────────── */
  setSession(data, token) {
    this.token       = token;
    this.cardNumber  = data.cardNumber;
    this.holderName  = data.holderName;
    this.accountType = data.accountType;
    this.balance     = data.balance;

    document.getElementById('holderName').textContent = data.holderName;
    const badge = document.getElementById('accountTypeBadge');
    badge.textContent = data.accountType;
    badge.className = `account-type-badge ${data.accountType}`;

    SessionTimer.start(120);
    ViewManager.show('menu');
    this._playTonePattern([880, 1100]);
    this._speak('Login successful. Welcome to SANTHOSH BANK ATM.');
  },

  logout() {
    this.token       = null;
    this.cardNumber  = null;
    this.holderName  = null;
    this.accountType = null;
    this.balance     = null;
    this._currentAction = null;

    SessionTimer.clear();
    document.getElementById('cardInput').value = '';
    this._goToLanguageSelection();
  },

  /* ── Card Input / Insert Card ─────────────────────────── */
  _bindCardInput() {
    const cardInput = document.getElementById('cardInput');

    // Format card number with spaces: 4444 4444 4444 4444
    cardInput.addEventListener('input', (e) => {
      let raw = e.target.value.replace(/\D/g, '').slice(0, 16);
      e.target.value = raw.replace(/(.{4})/g, '$1 ').trim();
    });

    document.getElementById('btnInsertCard').addEventListener('click', () => {
      const raw = cardInput.value.replace(/\s/g, '');
      if (raw.length !== 16 || !/^\d+$/.test(raw)) {
        ToastManager.show('Please enter a valid 16-digit card number.', 'error');
        return;
      }
      this.cardNumber = raw;
      document.getElementById('pinSubtitle').textContent =
        `Card: •••• •••• •••• ${raw.slice(-4)}. Enter your PIN.`;
      document.getElementById('pinInput').value = '';
      this._updatePinDots(0);
      ViewManager.show('pin');
    });

    document.getElementById('btnGoRegister').addEventListener('click', () => {
      ViewManager.show('register');
    });

    const forgotBtn = document.getElementById('btnForgotAccess');
    if (forgotBtn) {
      forgotBtn.addEventListener('click', () => {
        ViewManager.show('forgot');
      });
    }

    const changeLangBtn = document.getElementById('btnChangeLanguage');
    if (changeLangBtn) {
      changeLangBtn.addEventListener('click', () => this._goToLanguageSelection());
    }

    document.getElementById('btnGoAdmin').addEventListener('click', () => {
      ViewManager.show('admin');
    });

    const maintenanceBtn = document.getElementById('btnGoMaintenance');
    if (maintenanceBtn) {
      maintenanceBtn.addEventListener('click', () => {
        ViewManager.show('maintenance');
      });
    }
  },

  /* ── PIN Keypad ───────────────────────────────────────── */
  _pinValue: '',

  _bindPinKeypad() {
    const pinInput = document.getElementById('pinInput');

    document.getElementById('keypad').addEventListener('click', (e) => {
      const key = e.target.closest('.key');
      if (!key) return;
      const val = key.dataset.val;

      if (val === 'clear') {
        this._pinValue = '';
      } else if (val === 'enter') {
        this._submitPin();
        return;
      } else if (this._pinValue.length < 6) {
        this._pinValue += val;
      }

      this._updatePinDots(this._pinValue.length);
    });

    // Also allow keyboard entry
    document.addEventListener('keydown', (e) => {
      const view = document.getElementById('view-pin');
      if (!view.classList.contains('active')) return;

      if (e.key >= '0' && e.key <= '9' && this._pinValue.length < 6) {
        this._pinValue += e.key;
        this._updatePinDots(this._pinValue.length);
      } else if (e.key === 'Backspace') {
        this._pinValue = this._pinValue.slice(0, -1);
        this._updatePinDots(this._pinValue.length);
      } else if (e.key === 'Enter') {
        this._submitPin();
      }
    });

    document.getElementById('btnBackFromPin').addEventListener('click', () => {
      this._pinValue = '';
      this._updatePinDots(0);
      this.cardNumber = null;
      this._goToLanguageSelection();
    });
  },

  _updatePinDots(filledCount) {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < filledCount);
    });
  },

  async _submitPin() {
    if (this._pinValue.length < 4) {
      ToastManager.show('PIN must be at least 4 digits.', 'error');
      return;
    }

    try {
      const res = await APIClient.post('/auth/login', {
        cardNumber: this.cardNumber,
        pin: this._pinValue,
      });

      this._pinValue = '';
      this._updatePinDots(0);
      this.setSession(res.data, res.token);
      ToastManager.show(`Welcome back, ${res.data.holderName}!`, 'success');
    } catch (err) {
      this._pinValue = '';
      this._updatePinDots(0);
      ToastManager.show(err.message, 'error');

      if (err.status === 403) {
        // Card locked — return to welcome
        setTimeout(() => ViewManager.show('welcome'), 2000);
      }
    }
  },

  /* ── Main Menu Buttons ────────────────────────────────── */
  _bindMenuButtons() {
    const actions = {
      btnBalance:      () => this._doBalance(),
      btnWithdraw:     () => this._openAmountView('WITHDRAWAL', 'Withdraw Cash', 'Enter the amount to withdraw.', true),
      btnDeposit:      () => this._openAmountView('DEPOSIT', 'Deposit Cash', 'Enter the amount to deposit.', false),
      btnTransfer:     () => this._openAmountView('TRANSFER', 'Transfer Funds', 'Enter the amount and recipient card.', false),
      btnStatement:    () => this._doStatement(),
      btnCheckDeposit: () => this._openAmountView('CHECK_DEPOSIT', 'Check Deposit', 'Enter the check amount.', false),
      btnChangePin:    () => ViewManager.show('changepin'),
      btnBiometric:    () => ViewManager.show('biometric-setup'),
      btnMenuLanguage: () => this._goToLanguageSelection(),
      btnExit:         () => { this.logout(); ToastManager.show('Card ejected. Thank you for banking with us.', 'success'); },
    };

    for (const [id, fn] of Object.entries(actions)) {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => {
          if (this.token && id !== 'btnExit') SessionTimer.addSeconds(60);
          fn();
        });
      }
    }
  },

  _bindForgotView() {
    const purposeSelect = document.getElementById('forgotPurpose');
    const newPinGroup = document.getElementById('forgotNewPinGroup');
    const requestBtn = document.getElementById('btnRequestOtp');
    const verifyBtn = document.getElementById('btnVerifyOtp');
    const cancelBtn = document.getElementById('btnCancelForgot');

    if (purposeSelect && newPinGroup) {
      const togglePin = () => {
        newPinGroup.classList.toggle('hidden', purposeSelect.value !== 'RESET_PIN');
      };
      purposeSelect.addEventListener('change', togglePin);
      togglePin();
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => ViewManager.show('welcome'));
    }

    if (requestBtn) {
      requestBtn.addEventListener('click', async () => {
        const email = document.getElementById('forgotEmail').value.trim();
        const phoneNumber = document.getElementById('forgotPhone').value.trim();
        const purpose = document.getElementById('forgotPurpose').value;

        if (!email || !phoneNumber) {
          ToastManager.show('Email and phone number are required.', 'error');
          return;
        }

        try {
          const res = await APIClient.post('/auth/otp/request', { email, phoneNumber, purpose });
          const demoOtp = res.data?.demoOtp ? ` Demo OTP: ${res.data.demoOtp}` : '';
          ToastManager.show(`${res.message}.${demoOtp}`, 'success');
        } catch (err) {
          ToastManager.show(err.message, 'error');
        }
      });
    }

    if (verifyBtn) {
      verifyBtn.addEventListener('click', async () => {
        const email = document.getElementById('forgotEmail').value.trim();
        const phoneNumber = document.getElementById('forgotPhone').value.trim();
        const purpose = document.getElementById('forgotPurpose').value;
        const otp = document.getElementById('forgotOtp').value.trim();
        const newPin = document.getElementById('forgotNewPin')?.value;

        if (!email || !phoneNumber || !otp) {
          ToastManager.show('Email, phone number and OTP are required.', 'error');
          return;
        }

        if (purpose === 'RESET_PIN' && !/^\d{4,6}$/.test(String(newPin || ''))) {
          ToastManager.show('Enter a valid new PIN (4 to 6 digits).', 'error');
          return;
        }

        try {
          const payload = { email, phoneNumber, purpose, otp };
          if (purpose === 'RESET_PIN') payload.newPin = newPin;

          const res = await APIClient.post('/auth/otp/verify', payload);
          if (purpose === 'RECOVER_CARD') {
            this._showResult('✓', 'Card Recovered',
              `Card Number  : ${res.data.cardNumber}\nHolder Name : ${res.data.holderName}\nAccount Type: ${res.data.accountType}`
            );
          } else {
            this._showResult('✓', 'PIN Reset Complete',
              `Card Number  : ${res.data.cardNumber}\nStatus       : PIN updated successfully.\n\nPlease login using your new PIN.`
            );
          }
        } catch (err) {
          ToastManager.show(err.message, 'error');
        }
      });
    }
  },

  /* ── Balance ──────────────────────────────────────────── */
  async _doBalance() {
    try {
      const res = await APIClient.get('/account/balance', this.token);
      const { balance, accountInfo, holderName } = res.data;
      this.balance = balance;
      this._showResult(
        '✓',
        'Account Balance',
        `Holder        : ${holderName}\nAccount Type  : ${accountInfo.type}\nBalance       : $${balance.toFixed(2)}\n` +
        (accountInfo.interestRate ? `Interest Rate : ${accountInfo.interestRate}\n` : '') +
        (accountInfo.dailyWithdrawLimit ? `Daily Limit   : ${accountInfo.dailyWithdrawLimit}` : '')
      );
    } catch (err) {
      this._showError(err.message);
    }
  },

  /* ── Amount Entry View ────────────────────────────────── */
  _openAmountView(action, title, subtitle, showQuick) {
    this._currentAction = action;
    document.getElementById('amountTitle').textContent    = title;
    document.getElementById('amountSubtitle').textContent = subtitle;
    document.getElementById('amountInput').value          = '';

    // Toggle quick amounts (withdrawals only)
    document.getElementById('quickAmounts').classList.toggle('hidden', !showQuick);
    // Toggle target card field (transfers only)
    document.getElementById('targetCardGroup').classList.toggle('hidden', action !== 'TRANSFER');
    document.getElementById('targetCardInput').value = '';
    // Toggle check description (check deposits only)
    document.getElementById('checkDescGroup').classList.toggle('hidden', action !== 'CHECK_DEPOSIT');
    document.getElementById('checkDescInput').value = '';

    ViewManager.show('amount');
  },

  _bindAmountView() {
    // Quick amount buttons
    document.querySelectorAll('.quick-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.getElementById('amountInput').value = btn.dataset.amount;
      });
    });

    // Format target card with spaces
    const targetInput = document.getElementById('targetCardInput');
    targetInput.addEventListener('input', (e) => {
      let raw = e.target.value.replace(/\D/g, '').slice(0, 16);
      e.target.value = raw.replace(/(.{4})/g, '$1 ').trim();
    });

    document.getElementById('btnConfirmAmount').addEventListener('click', () => {
      this._processTransaction();
    });

    document.getElementById('btnCancelAmount').addEventListener('click', () => {
      ViewManager.show('menu');
    });
  },

  async _processTransaction() {
    const amountRaw = parseFloat(document.getElementById('amountInput').value);

    if (isNaN(amountRaw) || amountRaw <= 0) {
      ToastManager.show('Please enter a valid amount.', 'error');
      return;
    }

    const action = this._currentAction;

    try {
      let res;

      if (action === 'WITHDRAWAL') {
        res = await APIClient.post('/transactions/withdraw', { amount: amountRaw }, this.token);
        this.balance = res.data.newBalance;
        this._playTonePattern([1200, 1000, 800]);
        this._speak('Transaction successful. Please collect your cash and card.');
        this._showResult('✓', 'Withdrawal Successful',
          `Amount Dispensed : $${amountRaw.toFixed(2)}\nNew Balance      : $${res.data.newBalance.toFixed(2)}\nTransaction ID   : ${res.data.transactionId}\n\nPlease collect your cash.`
        );

      } else if (action === 'DEPOSIT') {
        res = await APIClient.post('/transactions/deposit', { amount: amountRaw }, this.token);
        this.balance = res.data.newBalance;
        this._playTonePattern([900, 1100]);
        this._speak('Transaction successful. Please collect your card.');
        this._showResult('✓', 'Deposit Successful',
          `Amount Deposited : $${amountRaw.toFixed(2)}\nNew Balance      : $${res.data.newBalance.toFixed(2)}\nTransaction ID   : ${res.data.transactionId}`
        );

      } else if (action === 'TRANSFER') {
        const targetRaw = document.getElementById('targetCardInput').value.replace(/\s/g, '');
        if (targetRaw.length !== 16) {
          ToastManager.show('Please enter a valid 16-digit recipient card number.', 'error');
          return;
        }
        res = await APIClient.post('/transactions/transfer',
          { amount: amountRaw, targetCardNumber: targetRaw }, this.token);
        this.balance = res.data.newBalance;
        this._playTonePattern([900, 1100]);
        this._speak('Transfer successful. Please collect your card.');
        this._showResult('✓', 'Transfer Successful',
          `Amount Sent      : $${amountRaw.toFixed(2)}\nRecipient Card   : •••• •••• •••• ${targetRaw.slice(-4)}\nNew Balance      : $${res.data.newBalance.toFixed(2)}\nTransaction ID   : ${res.data.transactionId}`
        );

      } else if (action === 'CHECK_DEPOSIT') {
        const desc = document.getElementById('checkDescInput').value;
        res = await APIClient.post('/transactions/check-deposit',
          { amount: amountRaw, description: desc }, this.token);
        this._playTonePattern([900, 1100]);
        this._speak('Check submitted successfully. Please collect your card.');
        this._showResult('⏳', 'Check Submitted (Pending)',
          `Check Amount     : $${amountRaw.toFixed(2)}\nStatus           : PENDING CLEARANCE\nTransaction ID   : ${res.data.transactionId}\n\nFunds available within 1-2 business days.`
        );
      }

    } catch (err) {
      this._showError(err.message);
    }
  },

  /* ── Mini Statement ───────────────────────────────────── */
  async _doStatement() {
    ViewManager.show('statement');
    const list = document.getElementById('statementList');
    list.innerHTML = '<p class="loading-text">Loading transactions...</p>';

    try {
      const res = await APIClient.get('/account/statement', this.token);
      const { transactions, pendingCount } = res.data;

      if (!transactions.length) {
        list.innerHTML = '<p class="loading-text">No transactions found.</p>';
        return;
      }

      list.innerHTML = transactions.map((t) => {
        const isDebit   = t.type === 'WITHDRAWAL' || t.type === 'TRANSFER';
        const isPending = t.status === 'PENDING';
        const amtClass  = isPending ? 'pending' : (isDebit ? 'debit' : 'credit');
        const sign      = isDebit ? '-' : '+';
        const date      = new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
        const time      = new Date(t.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        return `
          <div class="txn-row">
            <div class="txn-type">
              <span class="txn-badge badge-${isPending ? 'PENDING' : t.type}">${t.type.replace('_', ' ')}</span>
              <span class="txn-date">${date} ${time}</span>
            </div>
            <span class="txn-amt ${amtClass}">${isPending ? '' : sign}$${t.amount.toFixed(2)}</span>
          </div>`;
      }).join('');

      if (pendingCount > 0) {
        ToastManager.show(`${pendingCount} pending transaction(s) awaiting clearance.`, 'warn');
      }
    } catch (err) {
      list.innerHTML = `<p class="loading-text" style="color:var(--clr-danger)">${err.message}</p>`;
    }
  },

  _bindStatementView() {
    document.getElementById('btnStatementBack').addEventListener('click', () => {
      ViewManager.show('menu');
    });
  },

  /* ── Change PIN View ──────────────────────────────────── */
  _bindChangePinView() {
    document.getElementById('btnConfirmPin').addEventListener('click', async () => {
      const currentPin = document.getElementById('currentPinInput').value;
      const newPin     = document.getElementById('newPinInput').value;
      const confirmPin = document.getElementById('confirmPinInput').value;

      if (newPin !== confirmPin) {
        ToastManager.show('New PINs do not match.', 'error');
        return;
      }

      if (!/^\d{4,6}$/.test(newPin)) {
        ToastManager.show('PIN must be 4 to 6 digits.', 'error');
        return;
      }

      try {
        const res = await APIClient.post('/account/change-pin',
          { currentPin, newPin }, this.token);

        // Clear fields
        document.getElementById('currentPinInput').value = '';
        document.getElementById('newPinInput').value = '';
        document.getElementById('confirmPinInput').value = '';

        this._showResult('✓', 'PIN Changed', res.message);
      } catch (err) {
        ToastManager.show(err.message, 'error');
      }
    });

    document.getElementById('btnCancelPin').addEventListener('click', () => ViewManager.show('menu'));
  },

  /* ── Result View ──────────────────────────────────────── */
  _showResult(icon, title, body, isError = false) {
    const iconEl  = document.getElementById('resultIcon');
    iconEl.textContent = icon;
    iconEl.className   = `result-icon${isError ? ' error' : ''}`;
    document.getElementById('resultTitle').textContent = title;
    document.getElementById('resultBody').textContent  = body;
    ViewManager.show('result');
  },

  _showError(message) {
    this._showResult('✗', 'Transaction Failed', message, true);
  },

  /* ── Register View ────────────────────────────────────── */
  _bindRegisterView() {
    document.getElementById('btnRegisterSubmit').addEventListener('click', async () => {
      const holderName  = document.getElementById('regName').value.trim();
      const email       = document.getElementById('regEmail').value.trim();
      const phoneNumber = document.getElementById('regPhone').value.trim();
      const pin         = document.getElementById('regPin').value;
      const accountType = document.getElementById('regAccountType').value;

      if (!holderName || !email || !phoneNumber || !pin) {
        ToastManager.show('All fields are required.', 'error');
        return;
      }

      if (!/^\d{10,15}$/.test(phoneNumber.replace(/\D/g, ''))) {
        ToastManager.show('Please enter a valid phone number (10-15 digits).', 'error');
        return;
      }

      try {
        const res = await APIClient.post('/auth/register', { email, pin, holderName, accountType, phoneNumber });

        // Clear fields
        ['regName', 'regEmail', 'regPhone', 'regPin'].forEach((id) => {
          document.getElementById(id).value = '';
        });

        this._showResult(
          '✓',
          'Account Created!',
          `Card Number  : ${res.data.cardNumber}\nEmail        : ${res.data.email}\nPhone        : ${res.data.phoneNumber}\nAccount Type : ${res.data.accountType}\nWelcome Credit: $${res.data.balance.toFixed(2)}\n\n⚠ Save your card number carefully.\nYou will need it to access this ATM.`
        );
      } catch (err) {
        ToastManager.show(err.message, 'error');
      }
    });

    document.getElementById('btnCancelRegister').addEventListener('click', () => {
      ViewManager.show('welcome');
    });
  },

  /* ── Biometric Setup ──────────────────────────────────── */
  _bindBiometricSetup() {
    const fingerprintBtn = document.getElementById('btnFingerprint');
    const faceBtn = document.getElementById('btnFaceRecognition');
    const skipBtn = document.getElementById('btnSkipBiometric');

    if (fingerprintBtn) {
      fingerprintBtn.addEventListener('click', async () => {
        await this._setupBiometric('FINGERPRINT');
      });
    }

    if (faceBtn) {
      faceBtn.addEventListener('click', async () => {
        await this._setupBiometric('FACE');
      });
    }

    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        ViewManager.show('menu');
        ToastManager.show('You can enable biometric security later from the menu.', 'info');
      });
    }
  },

  async _setupBiometric(type) {
    if (!this.token) {
      ToastManager.show('You must be logged in to setup biometric.', 'error');
      return;
    }

    try {
      // Show biometric verification screen with scanner animation
      ViewManager.show('biometric-verify');
      document.getElementById('bioVerifyTitle').textContent = `Enroll Your ${type}`;
      
      // Simulate biometric enrollment process (2.5 seconds)
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Call backend API to save biometric
      const res = await APIClient.post(
        '/account/biometric/setup',
        { biometricType: type },
        this.token
      );

      if (res.success) {
        ToastManager.show(`✓ ${type} enrollment successful!`, 'success');
        ViewManager.show('menu');
      } else {
        ToastManager.show(res.message || 'Biometric setup failed.', 'error');
        ViewManager.show('menu');
      }
    } catch (err) {
      ToastManager.show(`Biometric setup failed: ${err.message}`, 'error');
      ViewManager.show('menu');
    }
  },

  /* ── Biometric Verification ───────────────────────────── */
  _bindBiometricVerify() {
    const btnContinue = document.getElementById('btnBioContinue');
    const btnCancel = document.getElementById('btnBioCancel');

    if (btnContinue) {
      btnContinue.addEventListener('click', () => {
        ViewManager.show('menu');
        ToastManager.show('✓ Biometric verified successfully!', 'success');
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        ViewManager.show('menu');
        ToastManager.show('Biometric verification cancelled.', 'warn');
      });
    }
  },

  async _showBiometricVerification(biometricType) {
    ViewManager.show('biometric-verify');
    document.getElementById('bioVerifyTitle').textContent = `Verify Your ${biometricType}`;
    
    // Simulate biometric verification with progress
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 2000);
    });
  },

  /* ── Result Buttons ───────────────────────────────────── */
  _bindResultButtons() {
    document.getElementById('btnResultBack').addEventListener('click', () =>
      ViewManager.show('menu'));
    document.getElementById('btnResultExit').addEventListener('click', () => {
      this._playTonePattern([700, 500]);
      this._speak('Thank you for banking with SANTHOSH BANK ATM. Please collect your card.');
      this.logout();
    });
  },

  _playTonePattern(freqs) {
    if (!Array.isArray(freqs) || !freqs.length) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      let start = ctx.currentTime;

      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.001, start);
        gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.13);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.14);
        start += 0.16;
      });
    } catch (_) {
      // Ignore audio errors on unsupported devices.
    }
  },

  /* ── Admin Portal ─────────────────────────────────────── */
  _bindAdminView() {
    document.getElementById('btnAdminLogin').addEventListener('click', async () => {
      const username = document.getElementById('adminUser').value;
      const password = document.getElementById('adminPass').value;

      try {
        const res = await APIClient.post('/admin/login', { username, password });
        this.adminToken = res.token;

        document.getElementById('adminLoginPanel').classList.add('hidden');
        document.getElementById('adminDashboard').classList.remove('hidden');
        ToastManager.show('Admin session started.', 'success');
      } catch (err) {
        ToastManager.show(err.message, 'error');
      }
    });

    document.getElementById('btnCancelAdmin').addEventListener('click', () => {
      this._goToLanguageSelection();
    });

    document.getElementById('btnAdminLogout').addEventListener('click', () => {
      this.adminToken = null;
      document.getElementById('adminLoginPanel').classList.remove('hidden');
      document.getElementById('adminDashboard').classList.add('hidden');
      document.getElementById('adminUser').value = '';
      document.getElementById('adminPass').value = '';
      this._goToLanguageSelection();
    });

    // Tab switching
    document.querySelectorAll('.admin-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');

        const panels = ['cards', 'audit', 'alerts', 'health'];
        panels.forEach((p) => {
          document.getElementById(`admin${p.charAt(0).toUpperCase() + p.slice(1)}`).classList.add('hidden');
        });
        document.getElementById(`admin${tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1)}`).classList.remove('hidden');
      });
    });

    // Load cards
    document.getElementById('btnLoadCards').addEventListener('click', async () => {
      const wrap = document.getElementById('cardsTable');
      wrap.innerHTML = '<p class="loading-text">Loading...</p>';
      try {
        const res = await APIClient.get('/admin/cards', this.adminToken);
        if (!res.data.cards.length) { wrap.innerHTML = '<p class="loading-text">No cards found.</p>'; return; }

        wrap.innerHTML = `
          <table class="admin-table">
            <thead><tr>
              <th>Card (last 4)</th><th>Name</th><th>ATM</th><th>Type</th><th>Balance</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
              ${res.data.cards.map((c) => `
                <tr>
                  <td style="font-family:monospace">•••• ${c.cardNumber.slice(-4)}</td>
                  <td>${c.holderName}</td>
                  <td>${c.atmMachineNumber || 'ATM-001'}</td>
                  <td>${c.accountType}</td>
                  <td>$${parseFloat(c.balance).toFixed(2)}</td>
                  <td style="color:${c.isLocked ? 'var(--clr-danger)' : 'var(--clr-success)'}">
                    ${c.isLocked ? 'LOCKED' : 'ACTIVE'}
                  </td>
                  <td>
                    <button class="lock-btn ${c.isLocked ? 'unlock' : 'lock'}"
                      data-card="${c.cardNumber}" data-action="${c.isLocked ? 'unlock' : 'lock'}">
                      ${c.isLocked ? 'Unlock' : 'Lock'}
                    </button>
                    <button class="lock-btn delete" data-card="${c.cardNumber}" data-action="delete">Delete</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>`;

        // Bind lock/unlock actions
        wrap.querySelectorAll('.lock-btn').forEach((btn) => {
          btn.addEventListener('click', async () => {
            const card   = btn.dataset.card;
            const action = btn.dataset.action;
            try {
              if (action === 'delete') {
                if (!confirm(`Delete account ending in ${card.slice(-4)}? This cannot be undone.`)) return;
                await APIClient.request(`/admin/cards/${card}`, 'DELETE', null, this.adminToken);
                ToastManager.show(`Card ...${card.slice(-4)} deleted.`, 'success');
              } else {
                await APIClient.put(`/admin/cards/${card}/${action}`, {}, this.adminToken);
                ToastManager.show(`Card ...${card.slice(-4)} ${action}ed.`, 'success');
              }
              document.getElementById('btnLoadCards').click(); // Refresh table
            } catch (err) {
              ToastManager.show(err.message, 'error');
            }
          });
        });

      } catch (err) {
        wrap.innerHTML = `<p class="loading-text" style="color:var(--clr-danger)">${err.message}</p>`;
      }
    });

    // Load audit logs
    document.getElementById('btnLoadAudit').addEventListener('click', async () => {
      const wrap = document.getElementById('auditTable');
      wrap.innerHTML = '<p class="loading-text">Loading...</p>';
      try {
        const res = await APIClient.get('/admin/audit-logs?limit=50', this.adminToken);
        if (!res.data.logs.length) { wrap.innerHTML = '<p class="loading-text">No logs found.</p>'; return; }

        wrap.innerHTML = `
          <table class="admin-table">
            <thead><tr><th>Event</th><th>Card</th><th>Severity</th><th>Time</th></tr></thead>
            <tbody>
              ${res.data.logs.map((l) => `
                <tr>
                  <td>${l.event}</td>
                  <td style="font-family:monospace">${l.cardNumber ? '•••• ' + l.cardNumber.slice(-4) : '—'}</td>
                  <td style="color:${l.severity === 'CRITICAL' ? 'var(--clr-danger)' : l.severity === 'WARNING' ? 'var(--clr-warning)' : 'var(--clr-text-dim)'}">
                    ${l.severity}
                  </td>
                  <td>${new Date(l.createdAt).toLocaleString()}</td>
                </tr>`).join('')}
            </tbody>
          </table>`;
      } catch (err) {
        wrap.innerHTML = `<p class="loading-text" style="color:var(--clr-danger)">${err.message}</p>`;
      }
    });

    // Load security alerts
    document.getElementById('btnLoadAlerts').addEventListener('click', async () => {
      const wrap = document.getElementById('alertsTable');
      wrap.innerHTML = '<p class="loading-text">Loading...</p>';
      try {
        const res = await APIClient.get('/admin/security-alerts', this.adminToken);
        if (!res.data.alerts.length) { wrap.innerHTML = '<p class="loading-text">No security alerts.</p>'; return; }

        wrap.innerHTML = `
          <table class="admin-table">
            <thead><tr><th>Event</th><th>Card</th><th>Details</th><th>Time</th></tr></thead>
            <tbody>
              ${res.data.alerts.map((a) => `
                <tr>
                  <td style="color:${a.severity === 'CRITICAL' ? 'var(--clr-danger)' : 'var(--clr-warning)'}">${a.event}</td>
                  <td style="font-family:monospace">${a.cardNumber ? '•••• ' + a.cardNumber.slice(-4) : '—'}</td>
                  <td style="color:var(--clr-text-dim);font-size:0.65rem">${JSON.stringify(a.details || {}).slice(0, 60)}</td>
                  <td>${new Date(a.createdAt).toLocaleString()}</td>
                </tr>`).join('')}
            </tbody>
          </table>`;
      } catch (err) {
        wrap.innerHTML = `<p class="loading-text" style="color:var(--clr-danger)">${err.message}</p>`;
      }
    });

    // Load health
    document.getElementById('btnLoadHealth').addEventListener('click', async () => {
      const wrap = document.getElementById('healthData');
      wrap.innerHTML = '<p class="loading-text">Loading...</p>';
      try {
        const res = await APIClient.get('/admin/health', this.adminToken);
        const { atm, transactions } = res.data;

        const cards = [
          { label: 'ATM Status',       value: atm.isOnline ? 'ONLINE' : 'OFFLINE' },
          { label: 'Cash Available',   value: `$${parseFloat(atm.cashAvailable).toLocaleString()}` },
          { label: 'Transactions',     value: atm.sessionTransactionCount },
          { label: 'Memory (MB)',      value: atm.memoryUsageMB },
          { label: 'Uptime (s)',        value: Math.floor(atm.uptime) },
          { label: 'Boot Time',        value: new Date(atm.bootTime).toLocaleTimeString() },
        ];

        wrap.innerHTML = cards.map((c) => `
          <div class="health-card">
            <div class="health-label">${c.label}</div>
            <div class="health-value">${c.value}</div>
          </div>`).join('');

        if (transactions.length) {
          const txnHtml = transactions.map((t) =>
            `<div class="health-card"><div class="health-label">${t._id}</div><div class="health-value">${t.count} txns · $${parseFloat(t.totalAmount).toFixed(0)}</div></div>`
          ).join('');
          wrap.innerHTML += txnHtml;
        }

      } catch (err) {
        wrap.innerHTML = `<p class="loading-text" style="color:var(--clr-danger)">${err.message}</p>`;
      }
    });

    document.getElementById('btnAdminSetOutOfOrder').addEventListener('click', async () => {
      try {
        await APIClient.post('/admin/atm/out-of-order', { reason: 'Marked by admin panel.' }, this.adminToken);
        ToastManager.show('ATM set to OUT OF ORDER.', 'warn');
        document.getElementById('btnLoadHealth').click();
      } catch (err) {
        ToastManager.show(err.message, 'error');
      }
    });

    document.getElementById('btnAdminSetOnline').addEventListener('click', async () => {
      try {
        await APIClient.post('/admin/atm/online', {}, this.adminToken);
        ToastManager.show('ATM set to ONLINE.', 'success');
        document.getElementById('btnLoadHealth').click();
      } catch (err) {
        ToastManager.show(err.message, 'error');
      }
    });

    document.getElementById('btnAdminRefill').addEventListener('click', async () => {
      try {
        const amount = parseFloat(document.getElementById('adminRefillAmount').value);
        if (isNaN(amount) || amount <= 0) {
          ToastManager.show('Enter a valid refill amount.', 'error');
          return;
        }
        await APIClient.post('/admin/atm/refill', { amount }, this.adminToken);
        ToastManager.show(`Cash refilled by $${amount.toFixed(2)}.`, 'success');
        document.getElementById('btnLoadHealth').click();
      } catch (err) {
        ToastManager.show(err.message, 'error');
      }
    });

    document.getElementById('btnLoadAdminTxns').addEventListener('click', async () => {
      const wrap = document.getElementById('healthData');
      wrap.innerHTML = '<p class="loading-text">Loading transactions...</p>';
      try {
        const res = await APIClient.get('/admin/transactions?limit=30', this.adminToken);
        const rows = res.data.transactions || [];
        if (!rows.length) {
          wrap.innerHTML = '<p class="loading-text">No transactions found.</p>';
          return;
        }
        wrap.innerHTML = rows.map((t) => `
          <div class="health-card">
            <div class="health-label">${t.type} · ${new Date(t.createdAt).toLocaleString()}</div>
            <div class="health-value">$${parseFloat(t.amount).toFixed(2)} · ....${t.cardNumber.slice(-4)} · ${t.status}</div>
          </div>`).join('');
      } catch (err) {
        wrap.innerHTML = `<p class="loading-text" style="color:var(--clr-danger)">${err.message}</p>`;
      }
    });
  },

  _bindMaintenanceView() {
    const loginBtn = document.getElementById('btnTechLogin');
    const cancelBtn = document.getElementById('btnCancelMaintenance');
    const logoutBtn = document.getElementById('btnMaintenanceLogout');

    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('techUser').value;
        const password = document.getElementById('techPass').value;
        try {
          const res = await APIClient.post('/maintenance/login', { username, password });
          this.maintenanceToken = res.token;
          document.getElementById('maintenanceLoginPanel').classList.add('hidden');
          document.getElementById('maintenanceDashboard').classList.remove('hidden');
          ToastManager.show('Maintenance session started.', 'success');
        } catch (err) {
          ToastManager.show(err.message, 'error');
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this._goToLanguageSelection());
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.maintenanceToken = null;
        document.getElementById('maintenanceLoginPanel').classList.remove('hidden');
        document.getElementById('maintenanceDashboard').classList.add('hidden');
        this._goToLanguageSelection();
      });
    }

    const withTechToken = async (fn) => {
      if (!this.maintenanceToken) {
        ToastManager.show('Maintenance login required.', 'error');
        return;
      }
      try {
        await fn();
      } catch (err) {
        ToastManager.show(err.message, 'error');
      }
    };

    const output = document.getElementById('maintenanceData');

    document.getElementById('btnRunDiagnostics')?.addEventListener('click', () => withTechToken(async () => {
      const res = await APIClient.get('/maintenance/diagnostics', this.maintenanceToken);
      output.innerHTML = `<pre class="result-body">${JSON.stringify(res.data, null, 2)}</pre>`;
    }));

    document.getElementById('btnSetOutOfOrder')?.addEventListener('click', () => withTechToken(async () => {
      await APIClient.post('/maintenance/status', { online: false, reason: 'Technician maintenance mode.' }, this.maintenanceToken);
      ToastManager.show('ATM status updated to OUT OF ORDER.', 'warn');
    }));

    document.getElementById('btnSetOnline')?.addEventListener('click', () => withTechToken(async () => {
      await APIClient.post('/maintenance/status', { online: true }, this.maintenanceToken);
      ToastManager.show('ATM status updated to ONLINE.', 'success');
    }));

    document.getElementById('btnLoadErrorLogs')?.addEventListener('click', () => withTechToken(async () => {
      const res = await APIClient.get('/maintenance/error-logs', this.maintenanceToken);
      output.innerHTML = `<pre class="result-body">${JSON.stringify(res.data.logs || [], null, 2)}</pre>`;
    }));

    document.getElementById('btnEnableService')?.addEventListener('click', () => withTechToken(async () => {
      const service = document.getElementById('serviceSelect').value;
      await APIClient.post('/maintenance/service-toggle', { service, enabled: true }, this.maintenanceToken);
      ToastManager.show(`${service} enabled.`, 'success');
    }));

    document.getElementById('btnDisableService')?.addEventListener('click', () => withTechToken(async () => {
      const service = document.getElementById('serviceSelect').value;
      await APIClient.post('/maintenance/service-toggle', { service, enabled: false }, this.maintenanceToken);
      ToastManager.show(`${service} disabled.`, 'warn');
    }));
  },
};

/* ═══════════════════════════════════════════════════════════
   BOOTSTRAP — Wire up remaining result buttons and start
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  ATMTerminal.init();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Service worker registration failed:', err.message);
    });
  }
});
