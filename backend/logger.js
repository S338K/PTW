const pino = require('pino');

const level = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

const logger = pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime
});

module.exports = logger;
