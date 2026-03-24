/**
 * schemas/Transaction.js
 * ============================================================
 * OOSE PATTERN: DAO (Data Access Object)
 * ============================================================
 * Transaction schema + DAO.  Every financial event (withdrawal,
 * deposit, transfer, check deposit) is immutably recorded here.
 *
 * OOSE Principle — Open/Closed:
 *  New transaction types can be added to the `type` enum without
 *  modifying the DAO interface — the DAO remains closed for
 *  modification but open for extension via the Factory pattern.
 */

'use strict';

const mongoose = require('mongoose');

/* ─────────────────────────────────────────────
   MONGOOSE SCHEMA
   ───────────────────────────────────────────── */

const TransactionSchema = new mongoose.Schema(
  {
    /** The card that initiated the transaction. */
    cardNumber: {
      type: String,
      required: [true, 'Card number is required for a transaction.'],
      index: true,
    },

    /**
     * Type discriminator used by TransactionFactory (business-logic.js)
     * to construct the correct transaction strategy object.
     */
    type: {
      type: String,
      enum: ['WITHDRAWAL', 'DEPOSIT', 'TRANSFER', 'CHECK_DEPOSIT'],
      required: [true, 'Transaction type is required.'],
    },

    /** Monetary amount involved in the transaction. Always positive. */
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required.'],
      min: [0.01, 'Transaction amount must be greater than zero.'],
    },

    /** Account balance immediately after this transaction completed. */
    balanceAfter: {
      type: Number,
      required: true,
    },

    /**
     * For TRANSFER type: the destination card number.
     * Null/undefined for all other types.
     */
    targetCardNumber: {
      type: String,
      default: null,
    },

    /**
     * PENDING — for check deposits awaiting clearance.
     * COMPLETED — transaction fully settled.
     * FAILED — transaction attempted but rejected.
     */
    status: {
      type: String,
      enum: ['COMPLETED', 'PENDING', 'FAILED'],
      default: 'COMPLETED',
    },

    /** Human-readable description or memo. */
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Index for fast mini-statement retrieval (last 10 transactions per card).
TransactionSchema.index({ cardNumber: 1, createdAt: -1 });

const TransactionModel = mongoose.model('Transaction', TransactionSchema);

/* ─────────────────────────────────────────────
   DAO CLASS
   ───────────────────────────────────────────── */

class TransactionDAO {
  /**
   * Records a new transaction document.
   * @param {Object} data - Transaction payload.
   * @returns {Promise<Object>}
   */
  static async create(data) {
    return TransactionModel.create(data);
  }

  /**
   * Retrieves the N most recent transactions for a given card.
   * Default limit of 10 for mini-statements.
   * @param {string} cardNumber
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  static async getMiniStatement(cardNumber, limit = 10) {
    return TransactionModel.find({ cardNumber })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-__v');
  }

  /**
   * Returns all pending transactions (e.g., uncleared check deposits).
   * @param {string} cardNumber
   * @returns {Promise<Array>}
   */
  static async getPendingTransactions(cardNumber) {
    return TransactionModel.find({ cardNumber, status: 'PENDING' });
  }

  /**
   * Returns aggregate statistics per card — used by admin health endpoint.
   * @returns {Promise<Array>}
   */
  static async getSystemStats() {
    return TransactionModel.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);
  }

  /**
   * Marks a pending transaction as completed (e.g., check cleared).
   * @param {string} transactionId
   * @returns {Promise<Object|null>}
   */
  static async clearPendingTransaction(transactionId) {
    return TransactionModel.findByIdAndUpdate(
      transactionId,
      { status: 'COMPLETED' },
      { new: true }
    );
  }

  /**
   * Returns recent system transactions for admin dashboards.
   * @param {number} limit
   * @param {number} skip
   * @returns {Promise<Array>}
   */
  static async getRecent(limit = 100, skip = 0) {
    return TransactionModel.find({})
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-__v');
  }

  /**
   * Deletes all transactions for a card.
   * @param {string} cardNumber
   * @returns {Promise<{deletedCount:number}>}
   */
  static async deleteByCardNumber(cardNumber) {
    return TransactionModel.deleteMany({ cardNumber });
  }
}

module.exports = { TransactionDAO, TransactionModel };
