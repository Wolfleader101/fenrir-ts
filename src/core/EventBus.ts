import { EventQueue, type EventType } from "./EventQueue";
import type { SystemCtx } from "./SystemCtx";

/**
 * An immediate listener: called synchronously inside `send`, with the payload and the context
 * of the run that is going. It may be async; the promise is not awaited, and a rejection is
 * logged like a throw.
 */
export type EventHandler<T> = (payload: T, ctx: SystemCtx) => void;

type Listener = { handler: EventHandler<any>; active: boolean; run: boolean };

/** Deeper than this, a listener is almost certainly sending the event that triggers it. */
const MAX_DEPTH = 32;

const eventName = (type: symbol) => type.description?.slice("event:".length);

/** The game's events: `ctx.events` and `game.events`. Buffers each event for two frames for readers, and calls immediate listeners inside `send`. */
export class EventBus {
  private queues = new Map<symbol, EventQueue<any>>();
  // Copy-on-write: `on` and `off` replace the array, so `send` iterates without copying and a
  // listener added during delivery does not receive the event being delivered.
  private listeners = new Map<symbol, readonly Listener[]>();
  private ctx?: SystemCtx;
  private depth = 0;

  private getQueue<T>(type: EventType<T>) {
    let q = this.queues.get(type) as EventQueue<T> | undefined;
    if (!q) {
      q = new EventQueue<T>();
      this.queues.set(type, q);
    }
    return q;
  }

  /**
   * Buffers the event for readers, then calls the immediate listeners in registration order.
   * Listeners are called only while a run is going; outside one the event is only buffered.
   */
  public send<T>(type: EventType<T>, ev: T) {
    this.getQueue(type).send(ev);

    const ctx = this.ctx;
    const listeners = this.listeners.get(type);
    if (!ctx || !listeners?.length) return;
    if (this.depth >= MAX_DEPTH) {
      ctx.logger.error(`Listeners of "${eventName(type)}" not called: events nested 32 deep. Break the loop of listeners sending events.`);
      return;
    }

    const fail = (error: unknown) => ctx.logger.error(`Listener for event "${eventName(type)}" failed`, { error });

    this.depth++;
    try {
      for (const listener of listeners) {
        if (!listener.active) continue;
        try {
          const result: unknown = listener.handler(ev, ctx);
          if (result instanceof Promise) result.catch(fail);
        } catch (error) {
          fail(error);
        }
      }
    } finally {
      this.depth--;
    }
  }

  /**
   * Calls `handler` at every `send` of `type` for the rest of the current run, and removes it
   * when the run stops. Call it from a system. Returns a function that removes it sooner.
   * For a listener that outlives a run, use `game.on`.
   */
  public on<T>(type: EventType<T>, handler: EventHandler<NoInfer<T>>): () => void {
    if (!this.ctx) {
      throw new Error("events.on needs a running game: call it from a system, or use game.on.");
    }
    return this.listen(type, handler, true);
  }

  private listen<T>(type: EventType<T>, handler: EventHandler<T>, run: boolean): () => void {
    const listener: Listener = { handler, active: true, run };
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
    return () => {
      if (!listener.active) return;
      listener.active = false;
      this.listeners.set(type, this.listeners.get(type)!.filter((l) => l !== listener));
    };
  }

  public read<T>(type: EventType<T>) {
    return this.getQueue(type).read();
  }

  public createReader<T>(type: EventType<T>) {
    return this.getQueue(type).createReader();
  }

  public update() {
    for (const q of this.queues.values()) q.update();
  }

  public clear() {
    for (const q of this.queues.values()) q.clearAll();
  }
}

// Internal: the engine and Game use these; they are not exported from the entry points.

/** Adds a listener that lasts until it is removed, across runs. Backs `game.on`. */
export function listenAcrossRuns<T>(bus: EventBus, type: EventType<T>, handler: EventHandler<T>): () => void {
  return bus["listen"](type, handler, false);
}

/** Starts delivering to listeners with `ctx`. The engine calls it once the run's context exists. */
export function beginEventRun(bus: EventBus, ctx: SystemCtx): void {
  bus["ctx"] = ctx;
}

/** Stops delivery and removes the listeners added with `events.on` during the run. */
export function endEventRun(bus: EventBus): void {
  bus["ctx"] = undefined;
  for (const [type, listeners] of bus["listeners"]) {
    for (const listener of listeners) if (listener.run) listener.active = false;
    bus["listeners"].set(type, listeners.filter((l) => !l.run));
  }
}
