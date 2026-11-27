export type LogMeta = Record<string, unknown>;

/** The logger: `ctx.logger` and `game.logger`. Pass one to `createGame({ logger })` to route engine messages. */
export interface ILogger {
  trace(message: string, meta?: LogMeta): void;
  debug(message: string, meta?: LogMeta): void;
  info(message: string, meta?: LogMeta): void;
  warn(message: string, meta?: LogMeta): void;
  error(message: string, meta?: LogMeta): void;
}
