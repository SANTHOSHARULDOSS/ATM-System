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
  /** Shows the target view and hides all others. */
  show(viewId) {
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    const target = document.getElementById(`view-${viewId}`);
    if (target) target.classList.add('active');
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
  cardNumber:  null,
  holderName:  null,
  accountType: null,
  balance:     null,

  // Tracks which transaction type the amount view is handling.
  _currentAction: null,

  /* ── Initialisation ───────────────────────────────────── */
  init() {
    this._bindCardInput();
    this._bindPinKeypad();
    this._bindMenuButtons();
    this._bindAmountView();
    this._bindChangePinView();
    this._bindRegisterView();
    this._bindAdminView();
    this._bindStatementView();
    ViewManager.show('welcome');
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
    ViewManager.show('welcome');
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

    document.getElementById('btnGoAdmin').addEventListener('click', () => {
      ViewManager.show('admin');
    });
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
      ViewManager.show('welcome');
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
      btnExit:         () => { this.logout(); ToastManager.show('Card ejected. Thank you for banking with us.', 'success'); },
    };

    for (const [id, fn] of Object.entries(actions)) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { SessionTimer.reset(); fn(); });
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
      SessionTimer.reset();
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
        this._showResult('✓', 'Withdrawal Successful',
          `Amount Dispensed : $${amountRaw.toFixed(2)}\nNew Balance      : $${res.data.newBalance.toFixed(2)}\nTransaction ID   : ${res.data.transactionId}\n\nPlease collect your cash.`
        );

      } else if (action === 'DEPOSIT') {
        res = await APIClient.post('/transactions/deposit', { amount: amountRaw }, this.token);
        this.balance = res.data.newBalance;
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
        this._showResult('✓', 'Transfer Successful',
          `Amount Sent      : $${amountRaw.toFixed(2)}\nRecipient Card   : •••• •••• •••• ${targetRaw.slice(-4)}\nNew Balance      : $${res.data.newBalance.toFixed(2)}\nTransaction ID   : ${res.data.transactionId}`
        );

      } else if (action === 'CHECK_DEPOSIT') {
        const desc = document.getElementById('checkDescInput').value;
        res = await APIClient.post('/transactions/check-deposit',
          { amount: amountRaw, description: desc }, this.token);
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
      SessionTimer.reset();
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
      const pin         = document.getElementById('regPin').value;
      const accountType = document.getElementById('regAccountType').value;

      if (!holderName || !email || !pin) {
        ToastManager.show('All fields are required.', 'error');
        return;
      }

      try {
        const res = await APIClient.post('/auth/register', { email, pin, holderName, accountType });

        // Clear fields
        ['regName', 'regEmail', 'regPin'].forEach((id) => {
          document.getElementById(id).value = '';
        });

        this._showResult(
          '✓',
          'Account Created!',
          `Card Number  : ${res.data.cardNumber}\nEmail        : ${res.data.email}\nAccount Type : ${res.data.accountType}\nWelcome Credit: $${res.data.balance.toFixed(2)}\n\n⚠ Save your card number carefully.\nYou will need it to access this ATM.`
        );
      } catch (err) {
        ToastManager.show(err.message, 'error');
      }
    });

    document.getElementById('btnCancelRegister').addEventListener('click', () => {
      ViewManager.show('welcome');
    });
  },

  /* ── Result Buttons ───────────────────────────────────── */
  _bindResultButtons() {
    document.getElementById('btnResultBack').addEventListener('click', () =>
      ViewManager.show('menu'));
    document.getElementById('btnResultExit').addEventListener('click', () =>
      this.logout());
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
      ViewManager.show('welcome');
    });

    document.getElementById('btnAdminLogout').addEventListener('click', () => {
      this.adminToken = null;
      document.getElementById('adminLoginPanel').classList.remove('hidden');
      document.getElementById('adminDashboard').classList.add('hidden');
      document.getElementById('adminUser').value = '';
      document.getElementById('adminPass').value = '';
      ViewManager.show('welcome');
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
              <th>Card (last 4)</th><th>Name</th><th>Type</th><th>Balance</th><th>Status</th><th>Action</th>
            </tr></thead>
            <tbody>
              ${res.data.cards.map((c) => `
                <tr>
                  <td style="font-family:monospace">•••• ${c.cardNumber.slice(-4)}</td>
                  <td>${c.holderName}</td>
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
              await APIClient.put(`/admin/cards/${card}/${action}`, {}, this.adminToken);
              ToastManager.show(`Card ...${card.slice(-4)} ${action}ed.`, 'success');
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
  },
};

/* ═══════════════════════════════════════════════════════════
   BOOTSTRAP — Wire up remaining result buttons and start
   ═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
  ATMTerminal.init();

  // Result view back buttons (need to be after init)
  document.getElementById('btnResultBack').addEventListener('click', () => ViewManager.show('menu'));
  document.getElementById('btnResultExit').addEventListener('click', () => ATMTerminal.logout());
});
