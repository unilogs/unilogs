require('dotenv').config();
const winston = require('winston');

const logFilePath = process.env.LOG_FILE_PATH;

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomIP() {
  return Array.from({ length: 4 }, () => getRandomInt(0, 255)).join('.');
}

function formatCLFDate(date) {
  const pad = (n) => (n < 10 ? '0' + n : n);
  const day = pad(date.getDate());
  const month = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ][date.getMonth()];
  const year = date.getFullYear();
  const hour = pad(date.getHours());
  const min = pad(date.getMinutes());
  const sec = pad(date.getSeconds());

  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
  const offsetMinutes = pad(Math.abs(offset) % 60);

  return `${day}/${month}/${year}:${hour}:${min}:${sec} ${sign}${offsetHours}${offsetMinutes}`;
}

function logCLF() {
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

  const ip = getRandomIP();
  const ident = getRandomElement(['-', 'bob', 'sally', 'john']);
  const authuser = getRandomElement(['-', 'frank', 'alice', 'doe']);
  const date = formatCLFDate(new Date());
  const method = getRandomElement(['GET', 'POST', 'PUT', 'DELETE']);
  const resource = getRandomElement([
    '/index.html',
    '/api/data',
    '/login',
    '/logout',
    '/img/logo.png',
  ]);
  const protocol = 'HTTP/1.0';
  const status = getRandomElement([200, 201, 301, 400, 403, 404, 500]);
  const size = getRandomInt(100, 5000);

  const logLine = `${ip} ${ident} ${authuser} [${date}] "${method} ${resource} ${protocol}" ${status} ${size}`;

  logger.log({ level: 'info', message: logLine });
}

setInterval(() => {
  logCLF();
}, 1000);
