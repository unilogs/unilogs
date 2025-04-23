export const apache_template = `# Parse the log line using Apache combined format
parsed, err = parse_apache_log(.message, "combined", "%Y-%m-%dT%H:%M:%S.%fZ")

# Handle errors (e.g., if the log line doesn't match the pattern)
if err != null {
  log("Failed to parse log line: " + string!(err), level: "error")
} else {
  # Merge the parsed fields into the event
  . = merge(., parsed)

  # Extract the "level" from the "path" field
  if .path == "/" {
    .level = "info"
  } else {
    .level = split(.path, "/")[1] ?? "unknown"
  }

  .unilogs_service_label = "[[service]]"
}`;

export const clf_template = `parsed, err = parse_common_log(.message)

# Handle errors (e.g., if the log line doesn't match the pattern)
if err != null {
  log("Failed to parse log line: " + string!(err), level: "error")
} else {
  # Merge the parsed fields into the event
  . = merge(., parsed)

  .unilogs_service_label = "[[service]]"
}`;

export const linux_authorization_template = `parsed, err = parse_linux_authorization(.message)

# Handle errors (e.g., if the log line doesn't match the pattern)
if err != null {
  log("Failed to parse log line: " + string!(err), level: "error")
} else {
  # Merge the parsed fields into the event
  . = merge(., parsed)
  .timestamp = format_timestamp!(.timestamp, "%Y-%m-%dT%H:%M:%S.%fZ")

  .unilogs_service_label = "[[service]]"
}`;

export const logfmt_template = `parsed, err = parse_logfmt(.message)

# Handle errors (e.g., if the log line doesn't match the pattern)
if err != null {
  log("Failed to parse log line: " + string!(err), level: "error")
} else {
  # Merge the parsed fields into the event
  . = merge(., parsed)

  .unilogs_service_label = "[[service]]"
}`;

export const syslog_template = `parsed, err = parse_syslog(.message)

# Handle errors (e.g., if the log line doesn't match the pattern)
if err != null {
  log("Failed to parse log line: " + string!(err), level: "error")
} else {
  # Merge the parsed fields into the event
  . = merge(., parsed)

  .unilogs_service_label = "[[service]]"
}`;