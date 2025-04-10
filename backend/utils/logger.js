const winston = require('winston');
const fs = require('fs');
const path = require('path');
const { config } = require('../config/config');

// Create logs directory if it doesn't exist
const logDir = config.logging.filePath;
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length 
      ? `\n${JSON.stringify(meta, null, 2)}` 
      : '';
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
  })
);

// Create a custom logger with specified settings
const logger = winston.createLogger({
  level: config.logging.level,
  format: logFormat,
  defaultMeta: { service: 'corporate-intranet' },
  transports: [
    // Console output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    // Error log file
    new winston.transports.File({ 
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({ 
      filename: path.join(logDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  ],
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  ],
  // Handle unhandled rejections
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 3,
    })
  ]
});

// Create a simple logger for development that doesn't write to files
if (process.env.NODE_ENV === 'development') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Reduced logging for tests
if (process.env.NODE_ENV === 'test') {
  logger.level = 'error';
}

// Utility wrapper for memory-efficient logging
const wrap = (fn) => (...args) => {
  // Skip debug logs in production for better performance
  if (fn === logger.debug && process.env.NODE_ENV === 'production') {
    return;
  }
  return fn.call(logger, ...args);
};

// Export wrapped logger functions
module.exports = {
  error: wrap(logger.error),
  warn: wrap(logger.warn),
  info: wrap(logger.info),
  http: wrap(logger.http),
  verbose: wrap(logger.verbose),
  debug: wrap(logger.debug),
  silly: wrap(logger.silly),
  
  // Stream for use with morgan
  stream: {
    write: (message) => {
      logger.http(message.trim());
    }
  }
};