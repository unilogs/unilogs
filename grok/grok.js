const grok = require('grok-js');

// Define multiple Grok patterns for different log formats
const patterns = {
  applicationLog: '%{TIMESTAMP_ISO8601:timestamp} %{DATA:app_name}\\[%{NUMBER:pid}\\]: %{LOGLEVEL:level}: %{GREEDYDATA:message}',
  bracketedLog: '\\[%{LOGLEVEL:level}\\] %{GREEDYDATA:message} at %{TIMESTAMP_ISO8601:timestamp}',
  accessLog: '%{IPV4:client_ip} - - \\[%{TIMESTAMP_ISO8601:timestamp}\\] "%{WORD:method} %{URIPATHPARAM:request_path} HTTP/%{NUMBER:http_version}" %{NUMBER:response_code} %{NUMBER:response_size}(?: "%{DATA:referrer}")?(?: "%{DATA:user_agent}")?',
};

// Sample logs
const logs = [
  '2025-03-11T19:24:19.946Z myapp[12345]: INFO: Random event logged at 2025-03-11T19:24:19.946Z',
  '[ERROR] Random event logged at 2025-03-11T19:24:23.948Z',
  '127.0.0.1 - - [2025-03-11T19:24:27.949Z] "GET /warn HTTP/1.1" 404 2326',
];

// Function to parse logs with different patterns
async function parseLog(log) {
  try {
    const grokPatterns = grok.loadDefaultSync();

    for (const [type, pattern] of Object.entries(patterns)) {
      const compiledPattern = grokPatterns.createPattern(pattern);
      const parsedData = compiledPattern.parseSync(log);
      if (parsedData) {
        console.log(`✅ Matched ${type}:`, parsedData);
        return parsedData; // Return first successful match
      }
    }

    console.log('❌ No pattern matched:', log);
  } catch (err) {
    console.error('Error parsing log:', err);
  }
}

// Process logs
logs.forEach(log => parseLog(log));
