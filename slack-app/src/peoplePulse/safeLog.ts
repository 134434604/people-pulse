export type SafeLogValue = string | number | boolean | null;
export type SafeLogFields = Record<string, SafeLogValue>;

const PROHIBITED_KEYS = new Set([
  "message",
  "messagebody",
  "body",
  "prompt",
  "email",
  "employee",
  "employeename",
  "username",
  "fullname",
  "slackuserid",
  "secret",
  "token",
  "apikey"
]);

export interface SafeLogger {
  info(event: string, fields?: SafeLogFields): void;
  warn(event: string, fields?: SafeLogFields): void;
  error(event: string, fields?: SafeLogFields): void;
}

export function createSafeLogger(write: (line: string) => void = console.log): SafeLogger {
  const log = (level: "info" | "warn" | "error", event: string, fields: SafeLogFields = {}): void => {
    const safeFields = Object.fromEntries(
      Object.entries(fields).map(([key, value]) => {
        const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
        if (PROHIBITED_KEYS.has(normalizedKey)) throw new Error(`Unsafe People Pulse log field: ${key}`);
        return [key, value];
      })
    );
    write(JSON.stringify({ level, event, ...safeFields }));
  };
  return {
    info: (event, fields) => log("info", event, fields),
    warn: (event, fields) => log("warn", event, fields),
    error: (event, fields) => log("error", event, fields)
  };
}
