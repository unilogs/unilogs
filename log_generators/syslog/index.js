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
  const timestamp = new Date(Date.now() - 1.8 * 10 ** 6).toISOString();
  const service = getRandomElement([
    'dynamicwireless.name',
    'device.api',
    'sensor.system',
  ]);
  const eventSource = getRandomElement(['Application', 'Network', 'Hardware']);
  const eventID = getRandomInt(1000, 9999);
  const messageID = getRandomInt(1000, 9999);
  const status = getRandomElement([200, 404, 500]);
  const additionalInfo = getRandomElement([
    'Override the THX port, maybe it will reboot the neural interface!',
    'Network issues detected, retrying the connection.',
    'Critical system error, requires immediate attention.',
    'Processing completed successfully, awaiting further instructions.',
  ]);

  const randomNum = Math.floor(Math.random() * 15);

  let logLine = `<${randomNum}> ${timestamp} ${service} non ${messageID} ID${eventID} [exampleSDID@32473 iut="3" eventSource="${eventSource}" eventID="${eventID}"] ${additionalInfo}`;

  logger.log({ level, message: logLine });
}

setInterval(() => {
  logRandomEvents('Random event logged');
}, 20);
