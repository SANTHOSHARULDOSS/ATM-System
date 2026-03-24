/**
 * index.js
 * ============================================================
 * APPLICATION ENTRY POINT — Express Server
 * ============================================================
 * Responsibilities:
 *  1. Bootstrap the Express application.
 *  2. Register global middleware (CORS, JSON parsing, rate-limiting).
 *  3. Mount all API route groups.
 *  4. Register the centralised error handler (LAST middleware).
 *  5. Establish the DB connection via the Singleton and listen.
 *
 * OOSE Principle — Separation of Concerns:
 *  This file ONLY wires things together. Business logic lives
 *  in business-logic.js, auth in authentication.js, and data
 *  access in the DAO classes within schemas/.
 */

'use strict';

require('dotenv').config();

const path       = require('path');
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

// Internal modules
const db         = require('./database');                 // Singleton DB
const { errorHandler, verifyToken, verifyAdmin, verifyMaintenance, validateInput } = require('./authentication');

// MVC Controllers
const {
  registerCard, loginWithPin, adminLogin,
  recoverCardNumber, resetPinWithPhone,
  requestOtpForRecovery, verifyOtpForRecovery,
  setupBiometric, verifyBiometric, disableBiometric,
  maintenanceLogin, maintenanceDiagnostics, maintenanceUpdateStatus, maintenanceToggleService, maintenanceErrorLogs,
  getBalance, getMiniStatement, changePin,
  processWithdrawal, processDeposit, processTransfer, processCheckDeposit,
  adminGetAllCards, adminGetAuditLogs, adminGetSecurityAlerts,
  adminGetTransactions, adminGetHealth, adminLockCard, adminUnlockCard,
  adminDeleteCustomer, adminSetAtmOutOfOrder, adminSetAtmOnline, adminRefillCash,
} = require('./business-logic');

/* ─────────────────────────────────────────────
   APP INITIALISATION
   ───────────────────────────────────────────── */

const app  = express();
const PORT = process.env.PORT || 3000;

/* ─────────────────────────────────────────────
   GLOBAL MIDDLEWARE
   ───────────────────────────────────────────── */

// Parse JSON request bodies.
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CORS — restricts origins in production; permissive in development.
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Serve the static frontend from /webapp.
app.use(express.static(path.join(__dirname, '..', 'webapp')));

/* ─────────────────────────────────────────────
   RATE LIMITING (Brute-Force Protection)
   ───────────────────────────────────────────── */

/**
 * OOSE PATTERN: MIDDLEWARE
 * Global limiter: 100 requests per 15 minutes per IP.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again shortly.' },
});

/**
 * Strict limiter for authentication endpoints.
 * 10 attempts per 15 minutes per IP prevents brute-force PIN attacks.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this device. Please wait 15 minutes.',
  },
});

app.use('/api/', globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/maintenance/login', authLimiter);

/* ─────────────────────────────────────────────
   ROUTE DEFINITIONS
   ───────────────────────────────────────────── */

const router = express.Router();

// ── Public Auth Routes ───────────────────────────────────────
/**
 * POST /api/auth/register
 * Body: { email, pin, holderName?, accountType?, phoneNumber }
 */
router.post(
  '/auth/register',
  validateInput({
    email:       (v) => /^\S+@\S+\.\S+$/.test(v),
    pin:         (v) => /^\d{4,6}$/.test(String(v)),
    phoneNumber: (v) => /^\d{10,15}$/.test(String(v).replace(/\D/g, '')),
  }),
  registerCard
);

/**
 * POST /api/auth/login
 * Body: { cardNumber, pin }
 * Returns: { token, data }
 */
router.post(
  '/auth/login',
  validateInput({
    cardNumber: (v) => /^\d{16}$/.test(String(v)),
    pin:        (v) => /^\d{4,6}$/.test(String(v)),
  }),
  loginWithPin
);

/**
 * POST /api/auth/recover-card
 * Body: { email, phoneNumber }
 * Recover forgotten card number using email and registered phone number.
 */
router.post(
  '/auth/recover-card',
  validateInput({
    email:       (v) => /^\S+@\S+\.\S+$/.test(v),
    phoneNumber: (v) => /^\d{10,15}$/.test(String(v).replace(/\D/g, '')),
  }),
  recoverCardNumber
);

/**
 * POST /api/auth/reset-pin
 * Body: { email, phoneNumber, newPin }
 * Reset forgotten PIN using email and registered phone number.
 */
router.post(
  '/auth/reset-pin',
  validateInput({
    email:       (v) => /^\S+@\S+\.\S+$/.test(v),
    phoneNumber: (v) => /^\d{10,15}$/.test(String(v).replace(/\D/g, '')),
    newPin:      (v) => /^\d{4,6}$/.test(String(v)),
  }),
  resetPinWithPhone
);

/**
 * POST /api/auth/otp/request
 * Body: { email, phoneNumber, purpose }
 * purpose: RECOVER_CARD | RESET_PIN
 */
router.post(
  '/auth/otp/request',
  validateInput({
    email:       (v) => /^\S+@\S+\.\S+$/.test(v),
    phoneNumber: (v) => /^\d{10,15}$/.test(String(v).replace(/\D/g, '')),
    purpose:     (v) => ['RECOVER_CARD', 'RESET_PIN'].includes(String(v).toUpperCase()),
  }),
  requestOtpForRecovery
);

/**
 * POST /api/auth/otp/verify
 * Body: { email, phoneNumber, purpose, otp, newPin? }
 */
router.post(
  '/auth/otp/verify',
  validateInput({
    email:       (v) => /^\S+@\S+\.\S+$/.test(v),
    phoneNumber: (v) => /^\d{10,15}$/.test(String(v).replace(/\D/g, '')),
    purpose:     (v) => ['RECOVER_CARD', 'RESET_PIN'].includes(String(v).toUpperCase()),
    otp:         (v) => /^\d{6}$/.test(String(v)),
  }),
  verifyOtpForRecovery
);

// ── Protected Account Routes (require JWT) ───────────────────
/**
 * GET /api/account/balance
 */
router.get('/account/balance', verifyToken, getBalance);

/**
 * GET /api/account/statement
 */
router.get('/account/statement', verifyToken, getMiniStatement);

/**
 * POST /api/account/change-pin
 * Body: { currentPin, newPin }
 */
router.post(
  '/account/change-pin',
  verifyToken,
  validateInput({
    currentPin: (v) => /^\d{4,6}$/.test(String(v)),
    newPin:     (v) => /^\d{4,6}$/.test(String(v)),
  }),
  changePin
);

// ── Protected Biometric Routes (require JWT) ────────────────
/**
 * POST /api/account/biometric/setup
 * Body: { biometricType } — 'FINGERPRINT' or 'FACE'
 */
router.post(
  '/account/biometric/setup',
  verifyToken,
  validateInput({
    biometricType: (v) => ['FINGERPRINT', 'FACE'].includes(String(v)),
  }),
  setupBiometric
);

/**
 * POST /api/account/biometric/verify
 * Body: { cardNumber, biometricToken }
 * Used during login or transaction verification.
 */
router.post(
  '/account/biometric/verify',
  validateInput({
    cardNumber:   (v) => /^\d{16}$/.test(String(v)),
    biometricToken: (v) => typeof v === 'string' && v.length > 0,
  }),
  verifyBiometric
);

/**
 * POST /api/account/biometric/disable
 * Disable biometric authentication for this card.
 */
router.post('/account/biometric/disable', verifyToken, disableBiometric);

// ── Protected Transaction Routes (require JWT) ───────────────
/**
 * POST /api/transactions/withdraw
 * Body: { amount }
 */
router.post(
  '/transactions/withdraw',
  verifyToken,
  validateInput({ amount: (v) => !isNaN(v) && parseFloat(v) > 0 }),
  processWithdrawal
);

/**
 * POST /api/transactions/deposit
 * Body: { amount }
 */
router.post(
  '/transactions/deposit',
  verifyToken,
  validateInput({ amount: (v) => !isNaN(v) && parseFloat(v) > 0 }),
  processDeposit
);

/**
 * POST /api/transactions/transfer
 * Body: { amount, targetCardNumber }
 */
router.post(
  '/transactions/transfer',
  verifyToken,
  validateInput({
    amount:           (v) => !isNaN(v) && parseFloat(v) > 0,
    targetCardNumber: (v) => /^\d{16}$/.test(String(v)),
  }),
  processTransfer
);

/**
 * POST /api/transactions/check-deposit
 * Body: { amount, description? }
 */
router.post(
  '/transactions/check-deposit',
  verifyToken,
  validateInput({ amount: (v) => !isNaN(v) && parseFloat(v) > 0 }),
  processCheckDeposit
);

// ── Admin Routes (require Admin JWT) ────────────────────────
/**
 * POST /api/admin/login
 * Body: { username, password }
 */
router.post(
  '/admin/login',
  validateInput({
    username: (v) => typeof v === 'string' && v.length > 0,
    password: (v) => typeof v === 'string' && v.length > 0,
  }),
  adminLogin
);

/** GET /api/admin/cards */
router.get('/admin/cards', verifyAdmin, adminGetAllCards);

/** GET /api/admin/audit-logs?limit=100&skip=0 */
router.get('/admin/audit-logs', verifyAdmin, adminGetAuditLogs);

/** GET /api/admin/security-alerts */
router.get('/admin/security-alerts', verifyAdmin, adminGetSecurityAlerts);

/** GET /api/admin/health */
router.get('/admin/health', verifyAdmin, adminGetHealth);

/** GET /api/admin/transactions?limit=100&skip=0 */
router.get('/admin/transactions', verifyAdmin, adminGetTransactions);

/** PUT /api/admin/cards/:cardNumber/lock */
router.put('/admin/cards/:cardNumber/lock', verifyAdmin, adminLockCard);

/** PUT /api/admin/cards/:cardNumber/unlock */
router.put('/admin/cards/:cardNumber/unlock', verifyAdmin, adminUnlockCard);

/** DELETE /api/admin/cards/:cardNumber */
router.delete('/admin/cards/:cardNumber', verifyAdmin, adminDeleteCustomer);

/** POST /api/admin/atm/out-of-order */
router.post('/admin/atm/out-of-order', verifyAdmin, adminSetAtmOutOfOrder);

/** POST /api/admin/atm/online */
router.post('/admin/atm/online', verifyAdmin, adminSetAtmOnline);

/** POST /api/admin/atm/refill */
router.post(
  '/admin/atm/refill',
  verifyAdmin,
  validateInput({ amount: (v) => !isNaN(v) && parseFloat(v) > 0 }),
  adminRefillCash
);

// ── Maintenance Routes (technician) ────────────────────────
router.post(
  '/maintenance/login',
  validateInput({
    username: (v) => typeof v === 'string' && v.length > 0,
    password: (v) => typeof v === 'string' && v.length > 0,
  }),
  maintenanceLogin
);

router.get('/maintenance/diagnostics', verifyMaintenance, maintenanceDiagnostics);
router.get('/maintenance/error-logs', verifyMaintenance, maintenanceErrorLogs);
router.post(
  '/maintenance/status',
  verifyMaintenance,
  validateInput({ online: (v) => typeof v === 'boolean' }),
  maintenanceUpdateStatus
);
router.post(
  '/maintenance/service-toggle',
  verifyMaintenance,
  validateInput({
    service: (v) => typeof v === 'string' && v.length > 0,
    enabled: (v) => typeof v === 'boolean',
  }),
  maintenanceToggleService
);

// Mount all routes under /api prefix.
app.use('/api', router);

/* ─────────────────────────────────────────────
   CATCH-ALL — SPA fallback
   Serves main.html for any unmatched GET routes.
   ───────────────────────────────────────────── */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'webapp', 'main.html'));
});

/* ─────────────────────────────────────────────
   CENTRALISED ERROR HANDLER
   Must be registered AFTER all routes.
   ───────────────────────────────────────────── */
app.use(errorHandler);

/* ─────────────────────────────────────────────
   SERVER BOOT
   ───────────────────────────────────────────── */
const startServer = async () => {
  try {
    // Connect via the Database Singleton.
    await db.connect();

    app.listen(PORT, () => {
      console.log('╔═══════════════════════════════════════════╗');
      console.log('║        ATM SYSTEM — SERVER STARTED        ║');
      console.log('╠═══════════════════════════════════════════╣');
      console.log(`║  URL    : http://localhost:${PORT}            ║`);
      console.log(`║  Mode   : ${process.env.NODE_ENV || 'development'}                    ║`);
      console.log('╚═══════════════════════════════════════════╝');
    });
  } catch (err) {
    console.error('[Server] Failed to start:', err.message);
    process.exit(1);
  }
};

startServer();

module.exports = app; // Export for testing frameworks (e.g., Jest/Supertest).
