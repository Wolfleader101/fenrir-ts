import type { ILogger, LogMeta } from "./ILogger.ts";

export class ConsoleLogger implements ILogger {
  trace(message: string, meta?: LogMeta): void {
    meta
      ? console.debug(`[trace] ${message}`, meta)
      : console.debug(`[trace] ${message}`);
  }
  debug(message: string, meta?: LogMeta): void {
    meta
      ? console.debug(`[debug] ${message}`, meta)
      : console.debug(`[debug] ${message}`);
  }
  info(message: string, meta?: LogMeta): void {
    meta
      ? console.info(`[info] ${message}`, meta)
      : console.info(`[info] ${message}`);
  }
  warn(message: string, meta?: LogMeta): void {
    meta
      ? console.warn(`[warn] ${message}`, meta)
      : console.warn(`[warn] ${message}`);
  }
  error(message: string, meta?: LogMeta): void {
    meta
      ? console.error(`[error] ${message}`, meta)
      : console.error(`[error] ${message}`);
  }
}
