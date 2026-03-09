/**
 * authentication.js
 * ============================================================
 * OOSE PATTERN: MIDDLEWARE
 * ============================================================
 * This module exports a collection of Express middleware
 * functions that form the application's security pipeline.
 *
 * Middleware chain for protected routes:
 *   [Request] → verifyToken → validateInput → [Controller]
 *
 * Responsibilities:
 *  1. verifyToken   — JWT authentication guard.
 *  2. validateInput — Schema-based request body validation.
 *  3. errorHandler  — Centralised error response formatter.
 *  4. verifyAdmin   — Admin-only access guard.
 *
 * OOSE Principle — Single Responsibility:
 *  Each middleware function has exactly one job. Business logic
 *  is never mixed into authentication concerns.
 */

'use strict';

const jwt = require('jsonwebtoken');
const { CardDAO } = require('./schemas/Card');

/* ─────────────────────────────────────────────
   1. JWT AUTHENTICATION MIDDLEWARE
   ───────────────────────────────────────────── */

/**
 * verifyToken
 * Validates the Bearer JWT from the Authorization header.
 * Attaches the decoded payload to `req.user` for downstream use.
 *
 * Session Timeout: Tokens are issued with a 2-minute expiry
 * (configurable via JWT_EXPIRES_IN in .env), enforcing ATM-style
 * session timeouts automatically via JWT's own exp claim.
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please insert your card and enter your PIN.',
      });
    }

    const token = authHeader.split(' ')[1];

    // jwt.verify throws if the token is expired, malformed, or tampered with.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Cross-reference the card in the database to catch deactivated sessions.
    const card = await CardDAO.findByCardNumber(decoded.cardNumber);

    if (!card) {
      return res.status(401).json({
        success: false,
        message: 'Card not recognised. Session terminated.',
      });
    }

    if (card.isLocked) {
      return res.status(403).json({
        success: false,
        message: 'Your card has been locked. Please contact customer support.',
      });
    }

    // Attach user context to the request object for use in controllers.
    req.user = {
      cardNumber: decoded.cardNumber,
      accountType: decoded.accountType,
    };

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Session expired due to inactivity. Please re-authenticate.',
        code: 'SESSION_EXPIRED',
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid session token. Access denied.',
      });
    }

    next(error); // Forward unexpected errors to the centralised error handler.
  }
};

/* ─────────────────────────────────────────────
   2. ADMIN AUTHENTICATION MIDDLEWARE
   ───────────────────────────────────────────── */

/**
 * verifyAdmin
 * Validates the admin JWT and checks that the decoded role is 'ADMIN'.
 * Applied exclusively to /api/admin/* routes.
 */
const verifyAdmin = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required.',
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Access forbidden. Administrator privileges required.',
      });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Admin session expired.' });
    }
    return res.status(401).json({ success: false, message: 'Invalid admin token.' });
  }
};

/* ─────────────────────────────────────────────
   3. INPUT VALIDATION MIDDLEWARE
   ───────────────────────────────────────────── */

/**
 * Factory function that returns a validation middleware.
 * Takes a rules object mapping field names to validator functions.
 *
 * Usage:
 *   router.post('/withdraw', validateInput({
 *     amount: (v) => typeof v === 'number' && v > 0
 *   }), controller);
 *
 * @param {Object} rules - { fieldName: validatorFn }
 * @returns {Function} Express middleware
 */
const validateInput = (rules) => {
  return (req, res, next) => {
    const errors = [];

    for (const [field, validator] of Object.entries(rules)) {
      const value = req.body[field];

      if (value === undefined || value === null || value === '') {
        errors.push(`Field '${field}' is required.`);
        continue;
      }

      if (typeof validator === 'function' && !validator(value)) {
        errors.push(`Field '${field}' has an invalid value.`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Input validation failed.',
        errors,
      });
    }

    next();
  };
};

/* ─────────────────────────────────────────────
   4. CENTRALIZED ERROR HANDLER MIDDLEWARE
   ───────────────────────────────────────────── */

/**
 * errorHandler
 * Must be registered as the LAST middleware in Express.
 * Catches all errors forwarded via next(error) from any route
 * or middleware, and returns a consistent JSON error envelope.
 *
 * OOSE Principle — DRY (Don't Repeat Yourself):
 *  Without this, every controller would replicate try/catch
 *  error-formatting logic. Centralising it here eliminates that
 *  duplication entirely.
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[Error Handler] Unhandled error:', err.stack || err.message);

  // Mongoose validation errors → 400
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation error.',
      errors: messages,
    });
  }

  // MongoDB duplicate key → 409 Conflict
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists.`,
    });
  }

  // Default: 500 Internal Server Error
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'An unexpected internal error occurred. Please try again.',
  });
};

/* ─────────────────────────────────────────────
   JWT HELPER UTILITIES
   ───────────────────────────────────────────── */

/**
 * Issues a signed JWT for a cardholder session.
 * Expiry is set by JWT_EXPIRES_IN in .env (default: '2m').
 * @param {Object} payload - Data to encode in the token.
 * @returns {string} Signed JWT string.
 */
const issueToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2m',
  });
};

/**
 * Issues a long-lived admin JWT (4-hour expiry).
 * @param {Object} payload
 * @returns {string}
 */
const issueAdminToken = (payload) => {
  return jwt.sign({ ...payload, role: 'ADMIN' }, process.env.JWT_SECRET, {
    expiresIn: '4h',
  });
};

module.exports = {
  verifyToken,
  verifyAdmin,
  validateInput,
  errorHandler,
  issueToken,
  issueAdminToken,
};
