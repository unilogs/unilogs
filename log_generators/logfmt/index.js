require('dotenv').config();
const winston = require('winston');

const logFilePath = process.env.LOG_FILE_PATH;

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function logRandomEvents(message) {
  const logger = winston.createLogger({
    level: 'debug',
    transports: [
      new winston.transports.File({
        filename: logFilePath,
        format: winston.format.printf(({ message }) => message),
        options: { flags: 'a', highWaterMark: 1 },
      }),
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
      }),
    ],
  });

  const levels = ['info', 'warn', 'error', 'debug'];
  const level = getRandomElement(levels);
  const services = ['auth', 'api', 'db', 'web', 'payment', 'notification'];
  const service = getRandomElement(services);
  const timestamp = new Date(Date.now() - 1.8 * 10 ** 6).toISOString();

  let logLine = '';

  switch (level) {
    case 'info':
      logLine = `time="${timestamp}" level=info service=${service} message="${message}" status=200 latency=${getRandomInt(
        50,
        150
      )}ms`;
      break;
    case 'warn':
      logLine = `time="${timestamp}" level=warn service=${service} endpoint="/warn" method=GET status=404 retry=${
        Math.random() > 0.5
      }`;
      break;
    case 'error':
      logLine = `time="${timestamp}" level=error service=${service} error="operation failed" duration=${getRandomInt(
        10,
        100
      )}ms`;
      break;
    case 'debug':
      logLine = `time="${timestamp}" level=debug service=${service} debug_id=${getRandomInt(
        1000,
        9999
      )} message="${message}"`;
      break;
  }

  logger.log({ level, message: logLine });
}

setInterval(() => {
  logRandomEvents('Random event logged');
}, 20);
