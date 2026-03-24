/**
 * database.js
 * ============================================================
 * OOSE PATTERN: SINGLETON
 * ============================================================
 * Ensures only ONE instance of the MongoDB connection is ever
 * created across the entire application lifecycle. Subsequent
 * calls to `Database.getInstance()` return the same cached
 * connection, preventing resource exhaustion.
 *
 * Why Singleton here?
 *  - A database connection pool is expensive to create.
 *  - Multiple connection instances can cause concurrency bugs.
 *  - A single shared instance enforces a controlled access point.
 */

'use strict';

const mongoose = require('mongoose');

class Database {
  constructor() {
    // Guard clause: if an instance already exists, return it.
    // This is the core of the Singleton pattern in JavaScript.
    if (Database._instance) {
      return Database._instance;
    }

    /** @type {mongoose.Connection | null} */
    this._connection = null;
    this._isConnected = false;

    // Cache the single instance on the class itself.
    Database._instance = this;
  }

  /**
   * Static factory accessor — the canonical way to obtain the
   * Singleton instance.
   * @returns {Database}
   */
  static getInstance() {
    if (!Database._instance) {
      new Database();
    }
    return Database._instance;
  }

  /**
   * Opens the MongoDB connection if not already open.
   * Idempotent — safe to call multiple times.
   * @returns {Promise<mongoose.Connection>}
   */
  async connect() {
    if (this._isConnected) {
      console.log('[Database Singleton] Reusing existing connection.');
      return this._connection;
    }

    const primaryUri = process.env.MONGODB_URI;
    if (!primaryUri) {
      throw new Error('[Database Singleton] MONGODB_URI is not defined in .env');
    }

    const fallbackUri =
      process.env.MONGODB_URI_FALLBACK ||
      (process.env.ENABLE_LOCAL_FALLBACK === 'false' ? null : 'mongodb://127.0.0.1:27017/atm_system_db');

    const connectOptions = {
      maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE || '20', 10),
      minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE || '5', 10),
      serverSelectionTimeoutMS: parseInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS || '10000', 10),
      socketTimeoutMS: parseInt(process.env.MONGO_SOCKET_TIMEOUT_MS || '45000', 10),
    };

    if (process.env.MONGODB_DB_NAME) {
      connectOptions.dbName = process.env.MONGODB_DB_NAME;
    }

    const attachConnectionListeners = () => {
      mongoose.connection.on('error', (err) => {
        console.error('[Database Singleton] Runtime error:', err.message);
        this._isConnected = false;
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('[Database Singleton] MongoDB disconnected. Retrying...');
        this._isConnected = false;
      });

      mongoose.connection.on('connected', () => {
        this._isConnected = true;
      });
    };

    try {
      this._connection = await mongoose.connect(primaryUri, connectOptions);
      this._isConnected = true;
      attachConnectionListeners();
      console.log('[Database Singleton] MongoDB connected successfully (primary URI).');
      return this._connection;
    } catch (primaryError) {
      console.error('[Database Singleton] Primary connection failed:', primaryError.message);

      if (!fallbackUri) {
        process.exit(1);
      }

      try {
        this._connection = await mongoose.connect(fallbackUri, connectOptions);
        this._isConnected = true;
        attachConnectionListeners();
        console.log('[Database Singleton] MongoDB connected successfully (fallback URI).');
        return this._connection;
      } catch (fallbackError) {
        console.error('[Database Singleton] Fallback connection failed:', fallbackError.message);
        process.exit(1); // Fail fast — the app cannot run without a database.
      }
    }
  }

  /**
   * Returns the current Mongoose connection object.
   * Useful for health-check endpoints.
   * @returns {mongoose.Connection}
   */
  getConnection() {
    return mongoose.connection;
  }

  /**
   * Exposes the readyState of the MongoDB connection.
   * 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
   * @returns {number}
   */
  getReadyState() {
    return mongoose.connection.readyState;
  }
}

// Note: Object.freeze() is intentionally NOT used here because the instance
// must update mutable state (_connection, _isConnected) on connect().
// The Singleton guarantee is enforced by the static _instance guard instead.
const instance = Database.getInstance();

module.exports = instance;
