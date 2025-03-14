CREATE DATABASE unilogs_preprod;

\c unilogs_preprod;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE IF NOT EXISTS logs (
  time TIMESTAMPTZ NOT NULL,
  body jsonb NOT NULL,
  original_log text NOT NULL,
  level varchar(10) NOT NULL
);

SELECT create_hypertable('logs', 'time');
-- CREATE UNIQUE INDEX idx_original_log_time ON logs(time, original_log);

-- HTTP Logs with /warn path (WARN level)
INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:14.071Z',
  '{"ip":"127.0.0.1","method":"GET","path":"/warn","protocol":"HTTP/1.1","status":404,"size":2326,"referrer":"http://example.com","user_agent":"Mozilla/5.0"}'::jsonb,
  '127.0.0.1 - - [2025-03-11T19:28:14.071Z] "GET /warn HTTP/1.1" 404 2326 "http://example.com" "Mozilla/5.0"',
  'WARN'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:16.071Z',
  '{"ip":"127.0.0.1","method":"GET","path":"/warn","protocol":"HTTP/1.1","status":404,"size":2326}'::jsonb,
  '127.0.0.1 - - [2025-03-11T19:28:16.071Z] "GET /warn HTTP/1.1" 404 2326',
  'WARN'
);

-- Application logs with explicit level in message
INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:18.073Z',
  '{"application":"myapp","pid":12345,"message":"Random event logged at 2025-03-11T19:28:18.073Z"}'::jsonb,
  '2025-03-11T19:28:18.073Z myapp[12345]: INFO: Random event logged at 2025-03-11T19:28:18.073Z',
  'INFO'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:22.076Z',
  '{"message":"Random event logged at 2025-03-11T19:28:22.076Z"}'::jsonb,
  '[INFO] Random event logged at 2025-03-11T19:28:22.076Z',
  'INFO'
);

-- HTTP Log with /error path (ERROR level)
INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:24.076Z',
  '{"ip":"127.0.0.1","method":"GET","path":"/error","protocol":"HTTP/1.1","status":500,"size":2326,"referrer":"http://example.com","user_agent":"Mozilla/5.0"}'::jsonb,
  '127.0.0.1 - - [2025-03-11T19:28:24.076Z] "GET /error HTTP/1.1" 500 2326 "http://example.com" "Mozilla/5.0"',
  'ERROR'
);

-- Additional application logs
INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:26.078Z',
  '{"application":"myapp","pid":12345,"message":"Random event logged at 2025-03-11T19:28:26.078Z"}'::jsonb,
  '2025-03-11T19:28:26.078Z myapp[12345]: INFO: Random event logged at 2025-03-11T19:28:26.078Z',
  'INFO'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:28.078Z',
  '{"application":"myapp","pid":12345,"message":"Random event logged at 2025-03-11T19:28:28.078Z"}'::jsonb,
  '2025-03-11T19:28:28.078Z myapp[12345]: WARN: Random event logged at 2025-03-11T19:28:28.078Z',
  'WARN'
);

-- HTTP Log without referrer/user-agent
INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:32.080Z',
  '{"ip":"127.0.0.1","method":"GET","path":"/warn","protocol":"HTTP/1.1","status":404,"size":2326}'::jsonb,
  '127.0.0.1 - - [2025-03-11T19:28:32.080Z] "GET /warn HTTP/1.1" 404 2326',
  'WARN'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:34.082Z',
  '{"application":"myapp","pid":12345,"message":"Random event logged at 2025-03-11T19:28:34.082Z"}'::jsonb,
  '2025-03-11T19:28:34.082Z myapp[12345]: WARN: Random event logged at 2025-03-11T19:28:34.082Z',
  'WARN'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:36.081Z',
  '{"message":"Random event logged at 2025-03-11T19:28:36.081Z"}'::jsonb,
  '[INFO] Random event logged at 2025-03-11T19:28:36.081Z',
  'INFO'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:38.082Z',
  '{"application":"myapp","pid":12345,"message":"Random event logged at 2025-03-11T19:28:38.082Z"}'::jsonb,
  '2025-03-11T19:28:38.082Z myapp[12345]: ERROR: Random event logged at 2025-03-11T19:28:38.082Z',
  'ERROR'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:40.084Z',
  '{"application":"myapp","pid":12345,"message":"Random event logged at 2025-03-11T19:28:40.084Z"}'::jsonb,
  '2025-03-11T19:28:40.084Z myapp[12345]: INFO: Random event logged at 2025-03-11T19:28:40.084Z',
  'INFO'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:44.085Z',
  '{"application":"myapp","pid":12345,"message":"Random event logged at 2025-03-11T19:28:44.085Z"}'::jsonb,
  '2025-03-11T19:28:44.085Z myapp[12345]: WARN: Random event logged at 2025-03-11T19:28:44.085Z',
  'WARN'
);

-- HTTP Logs with 200 status (INFO level)
INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:48.088Z',
  '{"ip":"127.0.0.1","method":"GET","path":"/","protocol":"HTTP/1.1","status":200,"size":2326}'::jsonb,
  '127.0.0.1 - - [2025-03-11T19:28:48.088Z] "GET / HTTP/1.1" 200 2326',
  'INFO'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:50.088Z',
  '{"ip":"127.0.0.1","method":"GET","path":"/error","protocol":"HTTP/1.1","status":500,"size":2326}'::jsonb,
  '127.0.0.1 - - [2025-03-11T19:28:50.088Z] "GET /error HTTP/1.1" 500 2326',
  'ERROR'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:54.090Z',
  '{"application":"myapp","pid":12345,"message":"Random event logged at 2025-03-11T19:28:54.090Z"}'::jsonb,
  '2025-03-11T19:28:54.090Z myapp[12345]: WARN: Random event logged at 2025-03-11T19:28:54.090Z',
  'WARN'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:28:58.093Z',
  '{"ip":"127.0.0.1","method":"GET","path":"/","protocol":"HTTP/1.1","status":200,"size":2326,"referrer":"http://example.com","user_agent":"Mozilla/5.0"}'::jsonb,
  '127.0.0.1 - - [2025-03-11T19:28:58.093Z] "GET / HTTP/1.1" 200 2326 "http://example.com" "Mozilla/5.0"',
  'INFO'
);

INSERT INTO logs (time, body, original_log, level) VALUES (
  '2025-03-11T19:29:02.094Z',
  '{"message":"Random event logged at 2025-03-11T19:29:02.094Z"}'::jsonb,
  '[WARN] Random event logged at 2025-03-11T19:29:02.094Z',
  'WARN'
);