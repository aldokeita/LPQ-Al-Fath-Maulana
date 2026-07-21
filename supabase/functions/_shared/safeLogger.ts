type LogFields = Record<string, string | number | boolean | null | undefined>;

const sensitiveKeys = [
  "password",
  "token",
  "refresh_token",
  "access_token",
  "service_role",
  "signed_url",
  "internal_email",
];

export function requestId(): string {
  return crypto.randomUUID();
}

export function maskIdentifier(value: string): string {
  if (value.length <= 4) return "****";
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

export function logSafe(level: "info" | "warn" | "error", event: string, fields: LogFields = {}) {
  const sanitized: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = "[redacted]";
    } else {
      sanitized[key] = value;
    }
  }

  const payload = JSON.stringify({ event, ...sanitized });
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}
