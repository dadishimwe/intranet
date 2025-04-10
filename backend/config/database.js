const { Pool } = require('pg');
const logger = require('../utils/logger');
const { config } = require('./config');

// Create a connection pool configured for Raspberry Pi's limited resources
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Connection pool settings optimized for Raspberry Pi
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
  connectionTimeoutMillis: 2000, // How long to wait for a connection
  // SSL configuration if needed
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false // Set to true in production with proper certs
  } : undefined
});

// Listen for connection events
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', err);
  process.exit(-1);
});

// Module methods
const db = {
  /**
   * Connect to the database
   * @returns {Promise} Connection result
   */
  connect: async () => {
    try {
      const client = await pool.connect();
      client.release();
      logger.info('Database connection test successful');
      return true;
    } catch (err) {
      logger.error('Database connection error:', err);
      throw err;
    }
  },

  /**
   * Execute a query
   * @param {string} text - Query text
   * @param {Array} params - Query parameters
   * @returns {Promise} Query result
   */
  query: async (text, params) => {
    const start = Date.now();
    try {
      const res = await pool.query(text, params);
      const duration = Date.now() - start;
      
      // Log slow queries for optimization
      if (duration > 1000) {
        logger.warn(`Slow query (${duration}ms): ${text}`);
      }
      
      return res;
    } catch (err) {
      logger.error(`Query error: ${text}`, err);
      throw err;
    }
  },

  /**
   * Get a client from the pool for transaction
   * @returns {Promise} Database client
   */
  getClient: async () => {
    const client = await pool.connect();
    const originalRelease = client.release;
    
    // Override release method to log
    client.release = () => {
      client.release = originalRelease;
      return client.release();
    };
    
    return client;
  },
  
  /**
   * Perform a database transaction
   * @param {Function} callback - Transaction function
   * @returns {Promise} Transaction result
   */
  transaction: async (callback) => {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
  
  /**
   * Close the database connection pool
   * @returns {Promise} Closure result
   */
  close: async () => {
    try {
      await pool.end();
      logger.info('Database connection pool closed');
      return true;
    } catch (err) {
      logger.error('Error closing database connection pool:', err);
      throw err;
    }
  }
};

module.exports = db;