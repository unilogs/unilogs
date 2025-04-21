require('dotenv').config();
const winston = require('winston');

const logFilePath = process.env.LOG_FILE_PATH;

function logRandomEvents() {
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

  const hostname = 'localhost';
  const users = ['root', 'eng', 'admin', 'tester'];
  const ips = ['10.1.1.1', '192.168.1.10', '172.16.0.5', '203.0.113.55'];
  const ports = [22, 2222, 8888, 4444];
  const pids = [1111, 2222, 3333, 4444, 5555];
  const algos = ['RSA', 'ECDSA', 'ED25519'];
  const fingerprints = ['SHA256:foobar', 'SHA256:xyz123', 'SHA256:abc456'];
  const ttys = ['pts/0', 'pts/1', 'tty1'];

  const now = new Date(Date.now() - 1.8 * 0.1 * 10 ** 6);
  const logTimestamp = now
    .toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    .replace(',', '');

  const user = users[Math.floor(Math.random() * users.length)];
  const ip = ips[Math.floor(Math.random() * ips.length)];
  const port = ports[Math.floor(Math.random() * ports.length)];
  const pid = pids[Math.floor(Math.random() * pids.length)];
  const algo = algos[Math.floor(Math.random() * algos.length)];
  const fingerprint =
    fingerprints[Math.floor(Math.random() * fingerprints.length)];
  const tty = ttys[Math.floor(Math.random() * ttys.length)];

  const messages = [
    `sshd[${pid}]: Accepted publickey for ${user} from ${ip} port ${port} ssh2: ${algo} ${fingerprint}`,
    `sshd[${pid}]: Failed password for invalid user guest from ${ip} port ${port} ssh2`,
    `sudo[${pid}]: ${user} : TTY=${tty} ; PWD=/home/${user} ; USER=root ; COMMAND=/bin/systemctl restart nginx`,
    `sshd[${pid}]: pam_unix(sshd:auth): authentication failure; logname= uid=0 euid=0 tty=${tty} ruser= rhost=${ip}`,
    `sshd[${pid}]: Connection closed by authenticating user ${user} ${ip} port ${port}`,
    `systemd-logind[${pid}]: New session ${Math.floor(
      Math.random() * 100
    )} of user ${user}.`,
    `sshd[${pid}]: Invalid user admin from ${ip} port ${port}`,
    `sshd[${pid}]: Connection reset by ${ip} port ${port}`,
    `login[${pid}]: LOGIN FAILURE FROM ${ip} FOR ${user}, Authentication failure`,
    `sshd[${pid}]: Received disconnect from ${ip} port ${port}:11: Bye Bye [preauth]`,
  ];

  const selectedMessage = messages[Math.floor(Math.random() * messages.length)];

  logger.info(`${logTimestamp} ${hostname} ${selectedMessage}`);
  logger.end();
}

setInterval(() => {
  logRandomEvents();
}, 20);
