/**
 * utils/logger.js — Winston logger, now with error/warn persistence
 *
 * ADDED: a custom transport that writes error/warn-level entries into the
 * ErrorLog collection, on top of the existing console output (which is
 * untouched — you still see everything in your terminal exactly as
 * before). This is what makes an admin error-log VIEWER possible at all;
 * previously there was nothing to view once the terminal scrolled past.
 *
 * ErrorLog is require()'d lazily inside the transport's log() method
 * rather than at the top of this file — avoids any risk of a require
 * cycle if some model file ever ends up requiring logger.js during its
 * own module load.
 */
const { createLogger, format, transports } = require('winston');
const Transport = require('winston-transport');

class MongoErrorTransport extends Transport {
  constructor(opts) {
    super(opts);
  }

  log(info, callback) {
    setImmediate(() => this.emit('logged', info));

    if (info.level === 'error' || info.level === 'warn') {
      try {
        const ErrorLog = require('../models/ErrorLog');
        const { level, message, timestamp, stack, ...rest } = info;
        // Strip winston's internal Symbol keys and the fields we already
        // store as real columns, keep everything else as meta
        const meta = {};
        for (const key of Object.keys(rest)) {
          if (typeof key === 'string') meta[key] = rest[key];
        }
        ErrorLog.create({
          level,
          message: typeof message === 'string' ? message : JSON.stringify(message),
          stack: stack || info.error?.stack || null,
          meta,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
        }).catch(() => {
          // Never let a DB write failure here cascade into anything else —
          // this is a supplementary logging channel, not a critical path.
          // If Mongo is down, you still have console output.
        });
      } catch (err) {
        // Same principle — swallow, don't let logging infrastructure
        // itself become a source of crashes.
      }
    }

    callback();
  }
}

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    }),
    new MongoErrorTransport(),
  ],
});

module.exports = logger;
