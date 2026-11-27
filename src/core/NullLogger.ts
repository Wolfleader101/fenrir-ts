import type { ILogger, LogMeta } from "./ILogger";

/** Drops every message. Extend it in tests to record what was logged. */
export class NullLogger implements ILogger {
  trace(_m: string, _meta?: LogMeta) {}
  debug(_m: string, _meta?: LogMeta) {}
  info(_m: string, _meta?: LogMeta) {}
  warn(_m: string, _meta?: LogMeta) {}
  error(_m: string, _meta?: LogMeta) {}
}
