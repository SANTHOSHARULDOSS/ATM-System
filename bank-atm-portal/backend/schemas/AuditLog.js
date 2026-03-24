/**
 * schemas/AuditLog.js
 * ============================================================
 * OOSE PATTERN: DAO (Data Access Object) + OBSERVER TARGET
 * ============================================================
 * AuditLog documents are created exclusively by the
 * AuditLogObserver (in business-logic.js) whenever the
 * TransactionSubject notifies its subscribers.
 *
 * This decoupling (Observer → DAO) is the cornerstone of the
 * audit system — the controllers never directly write audit
 * logs; they simply fire events.
 *
 * Severity Levels:
 *  INFO     — Routine operation (balance enquiry, statement)
 *  WARNING  — Suspicious activity (wrong PIN, lock triggered)
 *  CRITICAL — Security breach or forced card lockout
 */

'use strict';

const mongoose = require('mongoose');

/* ─────────────────────────────────────────────
   MONGOOSE SCHEMA
   ───────────────────────────────────────────── */

const AuditLogSchema = new mongoose.Schema(
  {
    /**
     * Short event identifier. Examples:
     *   'USER_LOGIN', 'WITHDRAWAL', 'WRONG_PIN', 'CARD_LOCKED',
     *   'CARD_REGISTERED', 'TRANSFER', 'ADMIN_LOGIN'
     */
    event: {
      type: String,
      required: [true, 'Audit event type is required.'],
      uppercase: true,
      trim: true,
    },

    /** The card number associated with the event, if applicable. */
    cardNumber: {
      type: String,
      default: null,
      index: true,
    },

    /** Arbitrary details payload (amount, target card, reason, etc.). */
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /** Source IP address from the HTTP request. Aids in forensic analysis. */
    ipAddress: {
      type: String,
      default: 'UNKNOWN',
    },

    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'INFO',
    },
  },
  {
    timestamps: true,
    // Audit logs are append-only — no updates allowed.
    // Enforce this at the application layer via the DAO.
  }
);

// Index for efficient admin audit trail queries.
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ severity: 1 });

const AuditLogModel = mongoose.model('AuditLog', AuditLogSchema);

/* ─────────────────────────────────────────────
   DAO CLASS
   ───────────────────────────────────────────── */

class AuditLogDAO {
  /**
   * Appends a new audit entry. This is the ONLY write operation.
   * Audit records are immutable — no update or delete methods exposed.
   * @param {Object} data - AuditLog payload.
   * @returns {Promise<Object>}
   */
  static async create(data) {
    try {
      return await AuditLogModel.create(data);
    } catch (err) {
      // Audit logging must never crash the main application.
      console.error('[AuditLogDAO] Failed to write audit record:', err.message);
    }
  }

  /**
   * Returns the most recent audit logs, newest first.
   * Supports pagination via skip/limit.
   * @param {number} limit
   * @param {number} skip
   * @returns {Promise<Array>}
   */
  static async getAll(limit = 100, skip = 0) {
    return AuditLogModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');
  }

  /**
   * Filters audit logs for a specific card.
   * @param {string} cardNumber
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  static async getByCard(cardNumber, limit = 50) {
    return AuditLogModel.find({ cardNumber })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-__v');
  }

  /**
   * Returns only WARNING and CRITICAL events.
   * Used by the admin dashboard to surface security incidents.
   * @returns {Promise<Array>}
   */
  static async getSecurityAlerts() {
    return AuditLogModel.find({
      severity: { $in: ['WARNING', 'CRITICAL'] },
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .select('-__v');
  }

  /**
   * Deletes logs for a given card number.
   * @param {string} cardNumber
   * @returns {Promise<{deletedCount:number}>}
   */
  static async deleteByCard(cardNumber) {
    return AuditLogModel.deleteMany({ cardNumber });
  }
}

module.exports = { AuditLogDAO, AuditLogModel };
