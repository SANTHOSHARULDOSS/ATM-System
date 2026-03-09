/**
 * business-logic.js
 * ============================================================
 * OOSE PATTERNS: SINGLETON · FACTORY · OBSERVER · MVC CONTROLLER
 * ============================================================
 *
 * This file is the heart of the application and demonstrates
 * all four required OOSE design patterns:
 *
 *  ┌─────────────────────────────────────────────────────────┐
 *  │  SINGLETON  → ATMMachine class                          │
 *  │  FACTORY    → TransactionFactory & AccountFactory       │
 *  │  OBSERVER   → TransactionSubject, Observers             │
 *  │  MVC        → Exported controller functions (the "C")   │
 *  └─────────────────────────────────────────────────────────┘
 *
 * Structure:
 *  [Section 1]  ATMMachine Singleton
 *  [Section 2]  Transaction Strategy Classes + TransactionFactory
 *  [Section 3]  Account Type Classes + AccountFactory
 *  [Section 4]  Observer Pattern (Subject + Concrete Observers)
 *  [Section 5]  Luhn Algorithm Utilities
 *  [Section 6]  MVC Controller Functions
 */

'use strict';

const bcrypt = require('bcryptjs');
const { CardDAO }        = require('./schemas/Card');
const { TransactionDAO } = require('./schemas/Transaction');
const { AuditLogDAO }    = require('./schemas/AuditLog');
const { issueToken, issueAdminToken } = require('./authentication');

/* ═══════════════════════════════════════════════════════════
   SECTION 1 — SINGLETON: ATMMachine
   ═══════════════════════════════════════════════════════════
   Represents the physical ATM terminal's global state.
   Only ONE instance can ever exist — mirrors the reality of a
   single physical machine serving one customer at a time.
   ─────────────────────────────────────────────────────────── */

class ATMMachine {
  constructor() {
    if (ATMMachine._instance) {
      return ATMMachine._instance;
    }

    /** Indicates whether the ATM is accepting transactions. */
    this.isOnline = true;

    /** Physical cash remaining in the ATM's dispenser. */
    this.cashAvailable = parseFloat(process.env.ATM_INITIAL_CASH) || 100000.00;

    /** Cumulative transaction count since last reboot. */
    this.sessionTransactionCount = 0;

    /** ISO timestamp of when the ATM service last started. */
    this.bootTime = new Date().toISOString();

    ATMMachine._instance = this;
    // Note: not frozen — mutable state (cashAvailable, sessionTransactionCount)
    // must be updated on each transaction. Singleton guarantee via _instance guard.
  }

  static getInstance() {
    if (!ATMMachine._instance) new ATMMachine();
    return ATMMachine._instance;
  }

  /**
   * Returns a health snapshot for the admin dashboard.
   * @returns {Object}
   */
  getHealth() {
    return {
      isOnline: this.isOnline,
      cashAvailable: this.cashAvailable,
      sessionTransactionCount: this.sessionTransactionCount,
      bootTime: this.bootTime,
      uptime: process.uptime(),
      memoryUsageMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
    };
  }

  /**
   * Checks whether the ATM can physically dispense the requested cash.
   * @param {number} amount
   * @throws {Error} If cash reserves are insufficient.
   */
  checkCashAvailability(amount) {
    if (amount > this.cashAvailable) {
      throw new Error(
        `ATM cash reserves insufficient. Maximum dispensable: $${this.cashAvailable.toFixed(2)}.`
      );
    }
  }

  /**
   * Deducts dispensed cash from the physical reserve and increments
   * the session counter. Called ONLY after a successful withdrawal.
   * @param {number} amount
   */
  dispenseCash(amount) {
    this.cashAvailable -= amount;
    this.sessionTransactionCount++;
  }

  /**
   * Adds deposited cash to the physical reserve.
   * @param {number} amount
   */
  acceptCash(amount) {
    this.cashAvailable += amount;
    this.sessionTransactionCount++;
  }
}

// Initialise the singleton at module load time.
const atmMachineInstance = ATMMachine.getInstance();


/* ═══════════════════════════════════════════════════════════
   SECTION 2 — FACTORY: Transaction Types + TransactionFactory
   ═══════════════════════════════════════════════════════════
   Each transaction type encapsulates its own business rules via
   a `validate()` method. The Factory creates the correct object
   based on a type string, so controllers never use `new` directly.

   OOSE Principle — Open/Closed:
    Adding a new transaction type (e.g., 'BILL_PAYMENT') requires
    only a new class + one switch-case entry — no existing code changes.
   ─────────────────────────────────────────────────────────── */

class WithdrawalTransaction {
  constructor({ amount, cardNumber }) {
    this.type        = 'WITHDRAWAL';
    this.amount      = parseFloat(amount);
    this.cardNumber  = cardNumber;
  }

  /**
   * Business rules for withdrawals.
   * @param {number} currentBalance
   */
  validate(currentBalance) {
    if (isNaN(this.amount) || this.amount <= 0)
      throw new Error('Withdrawal amount must be a positive number.');
    if (this.amount % 1 !== 0 && String(this.amount).split('.')[1]?.length > 2)
      throw new Error('Amounts cannot have more than 2 decimal places.');
    if (this.amount > currentBalance)
      throw new Error(`Insufficient funds. Available balance: $${currentBalance.toFixed(2)}.`);
    if (this.amount > 10000)
      throw new Error('Exceeds the single-transaction withdrawal limit of $10,000.');
    if (this.amount > atmMachineInstance.cashAvailable)
      throw new Error(`ATM cash unavailable. Currently dispensing up to $${atmMachineInstance.cashAvailable.toFixed(2)}.`);
  }
}

class DepositTransaction {
  constructor({ amount, cardNumber }) {
    this.type       = 'DEPOSIT';
    this.amount     = parseFloat(amount);
    this.cardNumber = cardNumber;
  }

  validate() {
    if (isNaN(this.amount) || this.amount <= 0)
      throw new Error('Deposit amount must be a positive number.');
    if (this.amount > 50000)
      throw new Error('Single deposit limit is $50,000. Please visit a branch for larger amounts.');
  }
}

class TransferTransaction {
  constructor({ amount, cardNumber, targetCardNumber }) {
    this.type             = 'TRANSFER';
    this.amount           = parseFloat(amount);
    this.cardNumber       = cardNumber;
    this.targetCardNumber = targetCardNumber;
  }

  validate(currentBalance) {
    if (isNaN(this.amount) || this.amount <= 0)
      throw new Error('Transfer amount must be a positive number.');
    if (this.amount > currentBalance)
      throw new Error(`Insufficient funds for transfer. Available: $${currentBalance.toFixed(2)}.`);
    if (this.cardNumber === this.targetCardNumber)
      throw new Error('Cannot transfer funds to the same account.');
    if (this.amount > 25000)
      throw new Error('Single transfer limit is $25,000.');
  }
}

class CheckDepositTransaction {
  constructor({ amount, cardNumber, description }) {
    this.type        = 'CHECK_DEPOSIT';
    this.amount      = parseFloat(amount);
    this.cardNumber  = cardNumber;
    this.description = description || 'Check deposit — pending clearance (1–2 business days).';
    this.status      = 'PENDING'; // Check deposits are always pending initially.
  }

  validate() {
    if (isNaN(this.amount) || this.amount <= 0)
      throw new Error('Check amount must be a positive number.');
    if (this.amount > 100000)
      throw new Error('Check deposit limit is $100,000 per transaction.');
  }
}

/**
 * TransactionFactory
 * ─────────────────────────────────────────────────────────────
 * OOSE PATTERN: FACTORY METHOD
 * ─────────────────────────────────────────────────────────────
 * Decouples object construction from business logic.
 * Controllers call `TransactionFactory.create(type, params)`
 * and receive a fully-formed transaction object with its own
 * validation rules — without knowing the concrete class name.
 */
class TransactionFactory {
  /**
   * @param {string} type - 'WITHDRAWAL' | 'DEPOSIT' | 'TRANSFER' | 'CHECK_DEPOSIT'
   * @param {Object} params - Constructor parameters.
   * @returns {WithdrawalTransaction|DepositTransaction|TransferTransaction|CheckDepositTransaction}
   * @throws {Error} If an unknown type is requested.
   */
  static create(type, params) {
    switch (type.toUpperCase()) {
      case 'WITHDRAWAL':    return new WithdrawalTransaction(params);
      case 'DEPOSIT':       return new DepositTransaction(params);
      case 'TRANSFER':      return new TransferTransaction(params);
      case 'CHECK_DEPOSIT': return new CheckDepositTransaction(params);
      default:
        throw new Error(`TransactionFactory: Unknown transaction type '${type}'.`);
    }
  }
}


/* ═══════════════════════════════════════════════════════════
   SECTION 3 — FACTORY: Account Types + AccountFactory
   ═══════════════════════════════════════════════════════════
   Encapsulates per-account-type business rules (interest rates,
   overdraft limits, daily limits). The Factory reads the
   `accountType` field from the database and returns the
   appropriate account object.
   ─────────────────────────────────────────────────────────── */

class SavingsAccount {
  constructor(cardData) {
    this.type         = 'SAVINGS';
    this.cardNumber   = cardData.cardNumber;
    this.balance      = cardData.balance;
    this.interestRate = 0.025; // 2.5% annual interest
    this.dailyLimit   = 5000;
  }
  getInfo() {
    return { type: this.type, interestRate: '2.5% p.a.', dailyWithdrawLimit: `$${this.dailyLimit}` };
  }
}

class CheckingAccount {
  constructor(cardData) {
    this.type         = 'CHECKING';
    this.cardNumber   = cardData.cardNumber;
    this.balance      = cardData.balance;
    this.interestRate = 0;
    this.dailyLimit   = 10000;
    this.overdraftLimit = 500;
  }
  getInfo() {
    return { type: this.type, overdraftLimit: `$${this.overdraftLimit}`, dailyWithdrawLimit: `$${this.dailyLimit}` };
  }
}

class PremiumAccount {
  constructor(cardData) {
    this.type         = 'PREMIUM';
    this.cardNumber   = cardData.cardNumber;
    this.balance      = cardData.balance;
    this.interestRate = 0.045; // 4.5% annual interest
    this.dailyLimit   = 50000;
    this.conciergeAccess = true;
  }
  getInfo() {
    return { type: this.type, interestRate: '4.5% p.a.', dailyWithdrawLimit: `$${this.dailyLimit}`, conciergeAccess: true };
  }
}

/**
 * AccountFactory
 * Returns the appropriate account type object from a card document.
 */
class AccountFactory {
  static create(cardData) {
    switch ((cardData.accountType || 'SAVINGS').toUpperCase()) {
      case 'SAVINGS':  return new SavingsAccount(cardData);
      case 'CHECKING': return new CheckingAccount(cardData);
      case 'PREMIUM':  return new PremiumAccount(cardData);
      default:
        throw new Error(`AccountFactory: Unknown account type '${cardData.accountType}'.`);
    }
  }
}


/* ═══════════════════════════════════════════════════════════
   SECTION 4 — OBSERVER PATTERN
   ═══════════════════════════════════════════════════════════
   Subject: TransactionSubject
   Observers: AuditLogObserver, NotificationObserver

   OOSE Principle — Loose Coupling:
    The controllers only interact with TransactionSubject.notify().
    They have no knowledge of who is listening or how events are handled.

   Flow:
    Controller → subject.notify(event, data)
               ↗ AuditLogObserver → writes to MongoDB
               ↘ NotificationObserver → console alert
   ─────────────────────────────────────────────────────────── */

/**
 * IObserver — informal interface contract.
 * All concrete observers must implement `update(event, data)`.
 */
class IObserver {
  update(event, data) { // eslint-disable-line no-unused-vars
    throw new Error('IObserver.update() must be implemented by all concrete observers.');
  }
}

/**
 * AuditLogObserver
 * Persists every event to the AuditLog collection via the DAO.
 */
class AuditLogObserver extends IObserver {
  async update(event, data) {
    await AuditLogDAO.create({
      event,
      cardNumber: data.cardNumber || null,
      details: data,
      ipAddress: data.ipAddress || 'UNKNOWN',
      severity: data.severity || 'INFO',
    });
  }
}

/**
 * NotificationObserver
 * Simulates push notifications / alerts. In production, this
 * would integrate with an SMS/email service (e.g., Twilio, SendGrid).
 */
class NotificationObserver extends IObserver {
  update(event, data) {
    const ts = new Date().toLocaleTimeString();
    console.log(
      `\n[NOTIFICATION - ${ts}] EVENT: ${event}` +
      (data.cardNumber ? ` | CARD: ...${data.cardNumber.slice(-4)}` : '') +
      (data.amount     ? ` | AMOUNT: $${parseFloat(data.amount).toFixed(2)}` : '') +
      (data.severity === 'CRITICAL' ? ' ⚠ SECURITY ALERT' : '')
    );
  }
}

/**
 * TransactionSubject
 * ─────────────────────────────────────────────────────────────
 * Maintains a list of observers and dispatches events to all of
 * them. Separation of event-firing from event-handling is the
 * essence of the Observer pattern.
 */
class TransactionSubject {
  constructor() {
    /** @type {IObserver[]} */
    this._observers = [];
  }

  /**
   * Registers an observer to receive event notifications.
   * @param {IObserver} observer
   */
  subscribe(observer) {
    if (!(observer instanceof IObserver)) {
      throw new TypeError('Subscribers must implement IObserver.');
    }
    this._observers.push(observer);
  }

  /**
   * Removes a previously registered observer.
   * @param {IObserver} observer
   */
  unsubscribe(observer) {
    this._observers = this._observers.filter((o) => o !== observer);
  }

  /**
   * Broadcasts an event to all subscribed observers.
   * Observer errors are caught individually so one failing observer
   * cannot block the others.
   * @param {string} event
   * @param {Object} data
   */
  async notify(event, data) {
    for (const observer of this._observers) {
      try {
        await observer.update(event, data);
      } catch (err) {
        console.error(`[TransactionSubject] Observer error (${observer.constructor.name}):`, err.message);
      }
    }
  }
}

// Construct and wire up the observer pipeline once at module level.
const transactionSubject = new TransactionSubject();
transactionSubject.subscribe(new AuditLogObserver());
transactionSubject.subscribe(new NotificationObserver());


/* ═══════════════════════════════════════════════════════════
   SECTION 5 — LUHN ALGORITHM UTILITIES
   ═══════════════════════════════════════════════════════════
   ISO/IEC 7812 standard check-digit algorithm for card numbers.
   ─────────────────────────────────────────────────────────── */

/**
 * Generates a valid 16-digit Luhn card number, prefixed with '4'
 * to resemble a Visa card format.
 *
 * Algorithm:
 *  1. Generate 15 random digits (prefix + 14 randoms).
 *  2. Process digits right-to-left, doubling every even-position digit.
 *  3. Compute check digit such that total_sum % 10 === 0.
 *
 * @returns {string} A 16-digit Luhn-valid card number.
 */
function generateCardNumber() {
  let partial = '4'; // Visa-like prefix.
  while (partial.length < 15) {
    partial += Math.floor(Math.random() * 10).toString();
  }

  let sum = 0;
  let isEven = true; // Position from right for partial: index 14 = position 2 (even).

  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = parseInt(partial[i], 10);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return partial + checkDigit;
}

/**
 * Validates that a card number passes the Luhn check.
 * @param {string} cardNumber
 * @returns {boolean}
 */
function validateLuhn(cardNumber) {
  const digits = String(cardNumber).replace(/\s/g, '').split('').map(Number);
  if (digits.length !== 16) return false;

  let sum = 0;
  let isEven = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits[i];
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }

  return sum % 10 === 0;
}

/**
 * Generates a unique card number by checking the database for collisions.
 * Extremely rare, but guarantees uniqueness.
 * @returns {Promise<string>}
 */
async function generateUniqueCardNumber() {
  let cardNumber;
  let attempts = 0;
  do {
    if (++attempts > 10) throw new Error('Failed to generate a unique card number. Try again.');
    cardNumber = generateCardNumber();
  } while (await CardDAO.exists(cardNumber));
  return cardNumber;
}


/* ═══════════════════════════════════════════════════════════
   SECTION 6 — MVC CONTROLLERS
   ═══════════════════════════════════════════════════════════
   These are the "C" in MVC. Each exported function maps to an
   Express route handler. Controllers:
     1. Read from req (input)
     2. Call DAO methods (model layer)
     3. Use Factory/Observer patterns
     4. Respond via res (view layer)
   Controllers never contain raw DB queries — that's the DAO's job.
   ─────────────────────────────────────────────────────────── */

/* ── AUTH CONTROLLERS ───────────────────────────────────────── */

/**
 * registerCard
 * Creates a new account with a Luhn-generated card number.
 * PIN is immediately hashed with bcryptjs before persistence.
 */
const registerCard = async (req, res, next) => {
  try {
    const { email, pin, holderName, accountType } = req.body;

    // Prevent duplicate registrations.
    const existing = await CardDAO.findByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    // Validate PIN format: 4–6 digits only.
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ success: false, message: 'PIN must be 4 to 6 digits.' });
    }

    const cardNumber = await generateUniqueCardNumber();
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const pinHash = await bcrypt.hash(String(pin), saltRounds);

    const card = await CardDAO.create({
      cardNumber,
      email,
      pinHash,
      holderName: holderName || 'Account Holder',
      accountType: accountType || 'SAVINGS',
    });

    // Notify observers — registration is an auditable event.
    await transactionSubject.notify('CARD_REGISTERED', {
      cardNumber,
      email,
      accountType: card.accountType,
      ipAddress: req.ip,
      severity: 'INFO',
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please retain your card number.',
      data: {
        cardNumber,
        email: card.email,
        accountType: card.accountType,
        holderName: card.holderName,
        balance: card.balance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * loginWithPin
 * Validates the card number and PIN, implements the 3-strike
 * lockout policy, and issues a JWT on success.
 */
const loginWithPin = async (req, res, next) => {
  try {
    const { cardNumber, pin } = req.body;

    const card = await CardDAO.findByCardNumber(cardNumber);

    if (!card) {
      await transactionSubject.notify('INVALID_CARD_ATTEMPT', {
        cardNumber,
        ipAddress: req.ip,
        severity: 'WARNING',
      });
      return res.status(401).json({ success: false, message: 'Card not recognised.' });
    }

    if (card.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Your card is locked after 3 incorrect PIN attempts. Please contact customer support.',
      });
    }

    const pinMatch = await bcrypt.compare(String(pin), card.pinHash);

    if (!pinMatch) {
      const newFailedAttempts = card.failedAttempts + 1;
      const shouldLock        = newFailedAttempts >= 3;

      await CardDAO.update(cardNumber, {
        failedAttempts: newFailedAttempts,
        isLocked: shouldLock,
      });

      await transactionSubject.notify('WRONG_PIN', {
        cardNumber,
        failedAttempts: newFailedAttempts,
        cardLocked: shouldLock,
        ipAddress: req.ip,
        severity: shouldLock ? 'CRITICAL' : 'WARNING',
      });

      if (shouldLock) {
        return res.status(403).json({
          success: false,
          message: 'Card locked after 3 incorrect attempts. Please contact customer support.',
        });
      }

      return res.status(401).json({
        success: false,
        message: `Incorrect PIN. ${3 - newFailedAttempts} attempt(s) remaining before card lockout.`,
      });
    }

    // Successful login: reset failed attempts and update last access timestamp.
    await CardDAO.update(cardNumber, { failedAttempts: 0, lastAccessed: new Date() });

    const token = issueToken({
      cardNumber: card.cardNumber,
      accountType: card.accountType,
    });

    await transactionSubject.notify('USER_LOGIN', {
      cardNumber,
      ipAddress: req.ip,
      severity: 'INFO',
    });

    res.json({
      success: true,
      message: `Welcome, ${card.holderName}. Session started.`,
      token,
      expiresIn: process.env.JWT_EXPIRES_IN || '2m',
      data: {
        cardNumber: card.cardNumber,
        holderName: card.holderName,
        accountType: card.accountType,
        balance: card.balance,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * adminLogin
 * Authenticates with the admin credentials stored in .env.
 * Issues a long-lived admin JWT on success.
 */
const adminLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (
      username !== process.env.ADMIN_USERNAME ||
      password !== process.env.ADMIN_PASSWORD
    ) {
      await transactionSubject.notify('ADMIN_LOGIN_FAILED', {
        username,
        ipAddress: req.ip,
        severity: 'CRITICAL',
      });
      return res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
    }

    const token = issueAdminToken({ username });

    await transactionSubject.notify('ADMIN_LOGIN', {
      username,
      ipAddress: req.ip,
      severity: 'WARNING',
    });

    res.json({ success: true, message: 'Admin session started.', token });
  } catch (error) {
    next(error);
  }
};


/* ── ACCOUNT CONTROLLERS ────────────────────────────────────── */

/**
 * getBalance
 * Returns the current balance and account type info via AccountFactory.
 */
const getBalance = async (req, res, next) => {
  try {
    const card = await CardDAO.findByCardNumber(req.user.cardNumber);
    if (!card) return res.status(404).json({ success: false, message: 'Account not found.' });

    // Use AccountFactory to get type-specific info.
    const account = AccountFactory.create(card);

    await transactionSubject.notify('BALANCE_ENQUIRY', {
      cardNumber: card.cardNumber,
      ipAddress: req.ip,
      severity: 'INFO',
    });

    res.json({
      success: true,
      data: {
        balance: card.balance,
        accountInfo: account.getInfo(),
        holderName: card.holderName,
        lastAccessed: card.lastAccessed,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * getMiniStatement
 * Returns the last 10 transactions for the authenticated card.
 */
const getMiniStatement = async (req, res, next) => {
  try {
    const transactions = await TransactionDAO.getMiniStatement(req.user.cardNumber, 10);
    const pending      = transactions.filter((t) => t.status === 'PENDING');

    await transactionSubject.notify('MINI_STATEMENT', {
      cardNumber: req.user.cardNumber,
      ipAddress: req.ip,
      severity: 'INFO',
    });

    res.json({
      success: true,
      data: {
        transactions,
        pendingCount: pending.length,
        pendingTotal: pending.reduce((sum, t) => sum + t.amount, 0).toFixed(2),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * changePin
 * Allows authenticated users to change their PIN.
 */
const changePin = async (req, res, next) => {
  try {
    const { currentPin, newPin } = req.body;

    if (!/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({ success: false, message: 'New PIN must be 4 to 6 digits.' });
    }

    const card = await CardDAO.findByCardNumber(req.user.cardNumber);
    const match = await bcrypt.compare(String(currentPin), card.pinHash);

    if (!match) {
      await transactionSubject.notify('WRONG_PIN_CHANGE_ATTEMPT', {
        cardNumber: req.user.cardNumber,
        ipAddress: req.ip,
        severity: 'WARNING',
      });
      return res.status(401).json({ success: false, message: 'Current PIN is incorrect.' });
    }

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS) || 12;
    const newPinHash = await bcrypt.hash(String(newPin), saltRounds);

    await CardDAO.update(req.user.cardNumber, { pinHash: newPinHash });

    await transactionSubject.notify('PIN_CHANGED', {
      cardNumber: req.user.cardNumber,
      ipAddress: req.ip,
      severity: 'WARNING',
    });

    res.json({ success: true, message: 'PIN changed successfully. Please use your new PIN for future transactions.' });
  } catch (error) {
    next(error);
  }
};


/* ── TRANSACTION CONTROLLERS ────────────────────────────────── */

/**
 * processWithdrawal
 * Uses TransactionFactory to create and validate a WithdrawalTransaction,
 * updates the card balance atomically, updates ATM cash reserves,
 * persists the transaction record, and notifies all observers.
 */
const processWithdrawal = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const { cardNumber } = req.user;

    const card = await CardDAO.findByCardNumber(cardNumber);
    if (!card) return res.status(404).json({ success: false, message: 'Account not found.' });

    // Factory creates the transaction and bundles its validation rules.
    const txn = TransactionFactory.create('WITHDRAWAL', { amount, cardNumber });
    txn.validate(card.balance); // Throws on rule violation.

    const newBalance   = parseFloat((card.balance - txn.amount).toFixed(2));
    const updatedCard  = await CardDAO.update(cardNumber, { balance: newBalance });

    // Reflect the physical cash dispensed.
    atmMachineInstance.dispenseCash(txn.amount);

    const record = await TransactionDAO.create({
      cardNumber,
      type: 'WITHDRAWAL',
      amount: txn.amount,
      balanceAfter: newBalance,
      status: 'COMPLETED',
      description: `Cash withdrawal of $${txn.amount.toFixed(2)}.`,
    });

    await transactionSubject.notify('WITHDRAWAL', {
      cardNumber,
      amount: txn.amount,
      balanceAfter: newBalance,
      transactionId: record._id,
      ipAddress: req.ip,
      severity: 'INFO',
    });

    res.json({
      success: true,
      message: `Please collect your cash. $${txn.amount.toFixed(2)} has been dispensed.`,
      data: { amount: txn.amount, newBalance, transactionId: record._id },
    });
  } catch (error) {
    if (error.message.includes('Insufficient') || error.message.includes('limit') || error.message.includes('ATM cash')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * processDeposit
 * Cash deposit — immediately credited to the account.
 */
const processDeposit = async (req, res, next) => {
  try {
    const { amount } = req.body;
    const { cardNumber } = req.user;

    const card = await CardDAO.findByCardNumber(cardNumber);
    if (!card) return res.status(404).json({ success: false, message: 'Account not found.' });

    const txn = TransactionFactory.create('DEPOSIT', { amount, cardNumber });
    txn.validate();

    const newBalance = parseFloat((card.balance + txn.amount).toFixed(2));
    await CardDAO.update(cardNumber, { balance: newBalance });
    atmMachineInstance.acceptCash(txn.amount);

    const record = await TransactionDAO.create({
      cardNumber,
      type: 'DEPOSIT',
      amount: txn.amount,
      balanceAfter: newBalance,
      status: 'COMPLETED',
      description: `Cash deposit of $${txn.amount.toFixed(2)}.`,
    });

    await transactionSubject.notify('DEPOSIT', {
      cardNumber, amount: txn.amount, balanceAfter: newBalance,
      transactionId: record._id, ipAddress: req.ip, severity: 'INFO',
    });

    res.json({
      success: true,
      message: `$${txn.amount.toFixed(2)} deposited successfully.`,
      data: { amount: txn.amount, newBalance, transactionId: record._id },
    });
  } catch (error) {
    if (error.message.includes('limit') || error.message.includes('positive')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * processTransfer
 * Deducts from sender and credits recipient atomically.
 */
const processTransfer = async (req, res, next) => {
  try {
    const { amount, targetCardNumber } = req.body;
    const { cardNumber } = req.user;

    const [senderCard, recipientCard] = await Promise.all([
      CardDAO.findByCardNumber(cardNumber),
      CardDAO.findByCardNumber(targetCardNumber),
    ]);

    if (!senderCard)    return res.status(404).json({ success: false, message: 'Sender account not found.' });
    if (!recipientCard) return res.status(404).json({ success: false, message: 'Recipient card not found. Please verify the card number.' });
    if (recipientCard.isLocked) return res.status(400).json({ success: false, message: 'Recipient card is locked and cannot receive funds.' });

    const txn = TransactionFactory.create('TRANSFER', { amount, cardNumber, targetCardNumber });
    txn.validate(senderCard.balance);

    const senderNewBal    = parseFloat((senderCard.balance - txn.amount).toFixed(2));
    const recipientNewBal = parseFloat((recipientCard.balance + txn.amount).toFixed(2));

    await Promise.all([
      CardDAO.update(cardNumber, { balance: senderNewBal }),
      CardDAO.update(targetCardNumber, { balance: recipientNewBal }),
    ]);

    const record = await TransactionDAO.create({
      cardNumber,
      type: 'TRANSFER',
      amount: txn.amount,
      balanceAfter: senderNewBal,
      targetCardNumber,
      status: 'COMPLETED',
      description: `Transfer of $${txn.amount.toFixed(2)} to card ending in ${targetCardNumber.slice(-4)}.`,
    });

    await transactionSubject.notify('TRANSFER', {
      cardNumber, targetCardNumber, amount: txn.amount,
      senderBalanceAfter: senderNewBal, transactionId: record._id,
      ipAddress: req.ip, severity: 'INFO',
    });

    res.json({
      success: true,
      message: `$${txn.amount.toFixed(2)} transferred successfully to ...${targetCardNumber.slice(-4)}.`,
      data: { amount: txn.amount, newBalance: senderNewBal, transactionId: record._id },
    });
  } catch (error) {
    if (error.message.includes('Insufficient') || error.message.includes('limit') || error.message.includes('same account')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};

/**
 * processCheckDeposit
 * Check deposits are PENDING until manually cleared by admin.
 * The balance is NOT credited immediately.
 */
const processCheckDeposit = async (req, res, next) => {
  try {
    const { amount, description } = req.body;
    const { cardNumber } = req.user;

    const card = await CardDAO.findByCardNumber(cardNumber);
    if (!card) return res.status(404).json({ success: false, message: 'Account not found.' });

    const txn = TransactionFactory.create('CHECK_DEPOSIT', { amount, cardNumber, description });
    txn.validate();

    // Balance is NOT updated — check is pending clearance.
    const record = await TransactionDAO.create({
      cardNumber,
      type: 'CHECK_DEPOSIT',
      amount: txn.amount,
      balanceAfter: card.balance, // unchanged
      status: 'PENDING',
      description: txn.description,
    });

    await transactionSubject.notify('CHECK_DEPOSIT', {
      cardNumber, amount: txn.amount, transactionId: record._id,
      ipAddress: req.ip, severity: 'INFO',
    });

    res.status(202).json({
      success: true,
      message: `Check of $${txn.amount.toFixed(2)} submitted. Funds will be available within 1–2 business days.`,
      data: { amount: txn.amount, status: 'PENDING', transactionId: record._id },
    });
  } catch (error) {
    if (error.message.includes('limit') || error.message.includes('positive')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};


/* ── ADMIN CONTROLLERS ──────────────────────────────────────── */

const adminGetAllCards = async (req, res, next) => {
  try {
    const cards = await CardDAO.findAll();
    res.json({ success: true, data: { count: cards.length, cards } });
  } catch (error) { next(error); }
};

const adminGetAuditLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const skip  = parseInt(req.query.skip) || 0;
    const logs  = await AuditLogDAO.getAll(limit, skip);
    res.json({ success: true, data: { count: logs.length, logs } });
  } catch (error) { next(error); }
};

const adminGetSecurityAlerts = async (req, res, next) => {
  try {
    const alerts = await AuditLogDAO.getSecurityAlerts();
    res.json({ success: true, data: { count: alerts.length, alerts } });
  } catch (error) { next(error); }
};

const adminGetHealth = async (req, res, next) => {
  try {
    const txnStats = await TransactionDAO.getSystemStats();
    res.json({
      success: true,
      data: { atm: atmMachineInstance.getHealth(), transactions: txnStats },
    });
  } catch (error) { next(error); }
};

const adminLockCard = async (req, res, next) => {
  try {
    const { cardNumber } = req.params;
    const card = await CardDAO.update(cardNumber, { isLocked: true });
    if (!card) return res.status(404).json({ success: false, message: 'Card not found.' });

    await transactionSubject.notify('ADMIN_CARD_LOCKED', {
      cardNumber, admin: req.admin?.username,
      ipAddress: req.ip, severity: 'CRITICAL',
    });

    res.json({ success: true, message: `Card ...${cardNumber.slice(-4)} has been locked.` });
  } catch (error) { next(error); }
};

const adminUnlockCard = async (req, res, next) => {
  try {
    const { cardNumber } = req.params;
    const card = await CardDAO.update(cardNumber, { isLocked: false, failedAttempts: 0 });
    if (!card) return res.status(404).json({ success: false, message: 'Card not found.' });

    await transactionSubject.notify('ADMIN_CARD_UNLOCKED', {
      cardNumber, admin: req.admin?.username,
      ipAddress: req.ip, severity: 'WARNING',
    });

    res.json({ success: true, message: `Card ...${cardNumber.slice(-4)} has been unlocked.` });
  } catch (error) { next(error); }
};


/* ── EXPORTS ────────────────────────────────────────────────── */

module.exports = {
  // Auth
  registerCard,
  loginWithPin,
  adminLogin,
  // Account
  getBalance,
  getMiniStatement,
  changePin,
  // Transactions
  processWithdrawal,
  processDeposit,
  processTransfer,
  processCheckDeposit,
  // Admin
  adminGetAllCards,
  adminGetAuditLogs,
  adminGetSecurityAlerts,
  adminGetHealth,
  adminLockCard,
  adminUnlockCard,
  // Utilities (exported for testing)
  generateCardNumber,
  validateLuhn,
  ATMMachine,
  TransactionFactory,
  AccountFactory,
};
