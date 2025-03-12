require("dotenv").config();
const express = require("express");
const winston = require("winston");
const fs = require("fs");

const app = express();
const port = 4000;

const logFilePath = "/Users/davidpark/Desktop/logingestion/logger/logs/app.log"; // Ensure Fluent Bit has read 

// Ensure the log file exists
if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, "", { flag: "a" });
}

// Create a Winston logger that logs to both file and console
const logger = winston.createLogger({
    level: "info",
    transports: [
        new winston.transports.File({
            filename: logFilePath, 
            format: winston.format.printf(({ message }) => message),
        }),
        new winston.transports.Console({  // Add console transport
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        }),
    ],
});

// Middleware to log every request
app.use((req, res, next) => {
    logRandomEvents("Request received: " + req.method + " " + req.url);
    next();
});

app.get("/", (req, res) => {
    res.send("Hello, Fluent Bit + Redis!");
    logRandomEvents("User visited home page");
});

// Function to log in various formats with random log levels
function logRandomEvents(message) {
  const logLevels = ["info", "warn", "error", "debug"];
  const randomLevel = logLevels[Math.floor(Math.random() * logLevels.length)];

  const formats = ["plainText", "commonLog", "apacheCombined", "syslog"];
  const randomFormat = formats[Math.floor(Math.random() * formats.length)];

  const timestamp = new Date().toISOString();
  const randomLogMessage = `${message} at ${timestamp}`;

  // Randomly select log level and format
  switch (randomLevel) {
    case "info":
      switch (randomFormat) {
        case "plainText":
          logger.info(`[INFO] ${randomLogMessage}`);
          break;
        case "commonLog":
          logger.info(`${"127.0.0.1"} - - [${timestamp}] "GET / HTTP/1.1" 200 2326`);
          break;
        case "apacheCombined":
          logger.info(`127.0.0.1 - - [${timestamp}] "GET / HTTP/1.1" 200 2326 "http://example.com" "Mozilla/5.0"`);
          break;
        case "syslog":
          logger.info(`${timestamp} myapp[12345]: INFO: ${randomLogMessage}`);
          break;
      }
      break;

    case "warn":
      switch (randomFormat) {
        case "plainText":
          logger.warn(`[WARN] ${randomLogMessage}`);
          break;
        case "commonLog":
          logger.warn(`${"127.0.0.1"} - - [${timestamp}] "GET /warn HTTP/1.1" 404 2326`);
          break;
        case "apacheCombined":
          logger.warn(`127.0.0.1 - - [${timestamp}] "GET /warn HTTP/1.1" 404 2326 "http://example.com" "Mozilla/5.0"`);
          break;
        case "syslog":
          logger.warn(`${timestamp} myapp[12345]: WARN: ${randomLogMessage}`);
          break;
      }
      break;

    case "error":
      switch (randomFormat) {
        case "plainText":
          logger.error(`[ERROR] ${randomLogMessage}`);
          break;
        case "commonLog":
          logger.error(`${"127.0.0.1"} - - [${timestamp}] "GET /error HTTP/1.1" 500 2326`);
          break;
        case "apacheCombined":
          logger.error(`127.0.0.1 - - [${timestamp}] "GET /error HTTP/1.1" 500 2326 "http://example.com" "Mozilla/5.0"`);
          break;
        case "syslog":
          logger.error(`${timestamp} myapp[12345]: ERROR: ${randomLogMessage}`);
          break;
      }
      break;

    case "debug":
      switch (randomFormat) {
        case "plainText":
          logger.debug(`[DEBUG] ${randomLogMessage}`);
          break;
        case "commonLog":
          logger.debug(`${"127.0.0.1"} - - [${timestamp}] "GET /debug HTTP/1.1" 200 2326`);
          break;
        case "apacheCombined":
          logger.debug(`127.0.0.1 - - [${timestamp}] "GET /debug HTTP/1.1" 200 2326 "http://example.com" "Mozilla/5.0"`);
          break;
        case "syslog":
          logger.debug(`${timestamp} myapp[12345]: DEBUG: ${randomLogMessage}`);
          break;
      }
      break;
  }
}

// Function to log continuously with random log levels and formats
setInterval(() => {
  logRandomEvents("Random event logged");
}, 2000);

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
  logger.info("Server started on port " + port);
});
