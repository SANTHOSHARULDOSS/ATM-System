/**
 * schemas/Card.js
 * ============================================================
 * OOSE PATTERN: DAO (Data Access Object)
 * ============================================================
 * This file has two responsibilities:
 *  1. SCHEMA — defines the Mongoose data model (the "M" in MVC).
 *  2. DAO CLASS — provides a static abstraction layer over all
 *     database operations for Card documents, so that controllers
 *     (business-logic.js) NEVER import mongoose directly.
 *
 * OOSE Principle — Separation of Concerns:
 *  The CardDAO isolates persistence logic from business logic.
 *  If the database technology ever changes (e.g., PostgreSQL),
 *  only this file needs to change.
 */

'use strict';

const mongoose = require('mongoose');

/* ─────────────────────────────────────────────
   MONGOOSE SCHEMA (Model Layer)
   ───────────────────────────────────────────── */

const CardSchema = new mongoose.Schema(
  {
    /** 16-digit card number generated via the Luhn algorithm. */
    cardNumber: {
      type: String,
      unique: true,
      required: [true, 'Card number is required.'],
      trim: true,
    },

    /** Account owner's email address. Must be unique. */
    email: {
      type: String,
      unique: true,
      required: [true, 'Email is required.'],
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address.'],
    },

    /** bcryptjs hash of the 4–6 digit PIN. NEVER store plain PINs. */
    pinHash: {
      type: String,
      required: [true, 'PIN hash is required.'],
    },

    /** Current account balance. Default: $1,000 welcome credit. */
    balance: {
      type: Number,
      default: 1000.0,
      min: [0, 'Balance cannot be negative.'],
    },

    /**
     * Account classification.
     * Factory Pattern: AccountFactory uses this field to determine
     * which account-type object to construct (see business-logic.js).
     */
    accountType: {
      type: String,
      enum: ['SAVINGS', 'CHECKING', 'PREMIUM'],
      default: 'SAVINGS',
    },

    /** When true, all transactions are blocked (3-strike lockout or admin). */
    isLocked: {
      type: Boolean,
      default: false,
    },

    /** Consecutive failed PIN attempts. Resets on successful login. */
    failedAttempts: {
      type: Number,
      default: 0,
      max: 3,
    },

    /** Timestamp of the last successful authentication. */
    lastAccessed: {
      type: Date,
      default: null,
    },

    /** Name of the account holder (optional, for display). */
    holderName: {
      type: String,
      trim: true,
      default: 'Account Holder',
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt automatically.
    toJSON: {
      // Never expose the PIN hash when serialising to JSON.
      transform: (doc, ret) => {
        delete ret.pinHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const CardModel = mongoose.model('Card', CardSchema);

/* ─────────────────────────────────────────────
   DAO CLASS — Data Access Object
   Static methods abstract ALL DB operations.
   ───────────────────────────────────────────── */

class CardDAO {
  /**
   * Creates and persists a new card document.
   * @param {Object} data - Card creation payload.
   * @returns {Promise<Object>} The newly created card document.
   */
  static async create(data) {
    return CardModel.create(data);
  }

  /**
   * Finds a single card by its 16-digit number.
   * @param {string} cardNumber
   * @returns {Promise<Object|null>}
   */
  static async findByCardNumber(cardNumber) {
    return CardModel.findOne({ cardNumber });
  }

  /**
   * Finds a card by email. Used during registration to prevent duplicates.
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  static async findByEmail(email) {
    return CardModel.findOne({ email: email.toLowerCase() });
  }

  /**
   * Applies a partial update to a card document atomically.
   * Returns the updated document.
   * @param {string} cardNumber
   * @param {Object} updates - Fields to update.
   * @returns {Promise<Object|null>}
   */
  static async update(cardNumber, updates) {
    return CardModel.findOneAndUpdate({ cardNumber }, updates, { new: true });
  }

  /**
   * Returns all cards, EXCLUDING the pinHash for security.
   * Used by the admin portal.
   * @returns {Promise<Array>}
   */
  static async findAll() {
    return CardModel.find({}).select('-pinHash -__v');
  }

  /**
   * Checks whether a card number already exists.
   * Used during Luhn-based card generation to prevent collisions.
   * @param {string} cardNumber
   * @returns {Promise<boolean>}
   */
  static async exists(cardNumber) {
    const count = await CardModel.countDocuments({ cardNumber });
    return count > 0;
  }
}

module.exports = { CardDAO, CardModel };
