require('dotenv').config();
const winston = require('winston');

const logFilePath = process.env.LOG_FILE_PATH;

function logRandomEvents(message) {
  const logger = winston.createLogger({
    level: 'info',
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

  const logLevels = ['info', 'warn', 'error', 'debug'];
  const randomLevel = logLevels[Math.floor(Math.random() * logLevels.length)];

  // const formats = ['plainText', 'commonLog', 'apacheCombined', 'syslog'];
  const formats = ['plainText'];
  const randomFormat = formats[Math.floor(Math.random() * formats.length)];

  // uncomment to test 25-year old logs
  // const time = Date.now() - 7.889 * 10 ** 11;
  // const timestamp = new Date(time).toISOString();
  const timestamp = new Date().toISOString();
  const randomLogMessage = `${message} at ${timestamp}`;

  switch (randomLevel) {
    case 'info':
      switch (randomFormat) {
        case 'plainText':
          logger.info(`[INFO] ${randomLogMessage}`);
          break;
        case 'commonLog':
          logger.info(
            `${'127.0.0.1'} - - [${timestamp}] "GET / HTTP/1.1" 200 2326`
          );
          break;
        case 'apacheCombined':
          logger.info(
            `127.0.0.1 - - [${timestamp}] "GET / HTTP/1.1" 200 2326 "http://example.com" "Mozilla/5.0"`
          );
          break;
        case 'syslog':
          logger.info(`${timestamp} myapp[12345]: INFO: ${randomLogMessage}`);
          break;
      }
      break;

    case 'warn':
      switch (randomFormat) {
        case 'plainText':
          logger.warn(`[WARN] ${randomLogMessage}`);
          break;
        case 'commonLog':
          logger.warn(
            `${'127.0.0.1'} - - [${timestamp}] "GET /warn HTTP/1.1" 404 2326`
          );
          break;
        case 'apacheCombined':
          logger.warn(
            `127.0.0.1 - - [${timestamp}] "GET /warn HTTP/1.1" 404 2326 "http://example.com" "Mozilla/5.0"`
          );
          break;
        case 'syslog':
          logger.warn(`${timestamp} myapp[12345]: WARN: ${randomLogMessage}`);
          break;
      }
      break;

    case 'error':
      switch (randomFormat) {
        case 'plainText':
          logger.error(`[ERROR] ${randomLogMessage}`);
          break;
        case 'commonLog':
          logger.error(
            `${'127.0.0.1'} - - [${timestamp}] "GET /error HTTP/1.1" 500 2326`
          );
          break;
        case 'apacheCombined':
          logger.error(
            `127.0.0.1 - - [${timestamp}] "GET /error HTTP/1.1" 500 2326 "http://example.com" "Mozilla/5.0"`
          );
          break;
        case 'syslog':
          logger.error(`${timestamp} myapp[12345]: ERROR: ${randomLogMessage}`);
          break;
      }
      break;

    case 'debug':
      switch (randomFormat) {
        case 'plainText':
          logger.debug(`[DEBUG] ${randomLogMessage}`);
          break;
        case 'commonLog':
          logger.debug(
            `${'127.0.0.1'} - - [${timestamp}] "GET /debug HTTP/1.1" 200 2326`
          );
          break;
        case 'apacheCombined':
          logger.debug(
            `127.0.0.1 - - [${timestamp}] "GET /debug HTTP/1.1" 200 2326 "http://example.com" "Mozilla/5.0"`
          );
          break;
        case 'syslog':
          logger.debug(`${timestamp} myapp[12345]: DEBUG: ${randomLogMessage}`);
          break;
      }
      break;
  }
  logger.end();
}

setInterval(() => {
  logRandomEvents('Random event logged');
}, 2000);
