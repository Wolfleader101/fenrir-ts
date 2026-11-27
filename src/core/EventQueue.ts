/** A typed event key, made by `defineEvent<T>(name)`. */
export type EventType<T> = symbol & { __eventType?: T };

/**
 * Defines an event type. As with components, the name is the identity: two
 * calls with the same name return the same type. Prefix names with a namespace
 * for your game or library. Names starting with `fenrir.` are reserved for the engine.
 *
 * @example
 * export const PlayerDied = defineEvent<{ entity: Entity }>("myGame.playerDied");
 */
/* @__NO_SIDE_EFFECTS__ */
export function defineEvent<T>(name: string): EventType<T> {
  return Symbol.for(`event:${name}`) as EventType<T>;
}

/** What `events.createReader(Type)` returns: `read()` gives the events it has not returned before. Create one per consumer, once. */
export type EventReader<T> = { read(): readonly T[] };

/** Internal storage for one event type. Games use `EventBus` (`ctx.events`) instead. */
export class EventQueue<T> {
  private nextSequence = 0;
  private current: T[] = [];
  private previous: T[] = [];

  // cached combined buffer
  private combined: T[] = [];
  private combinedDirty = true;

  public send(ev: T) {
    this.current.push(ev);
    this.nextSequence++;
    this.combinedDirty = true;
  }

  /** called once per frame, after all stages */
  public update() {
    // clear the buffer that is two frames old
    this.previous.length = 0;

    // swap current -> previous
    const tmp = this.previous;
    this.previous = this.current;
    this.current = tmp;

    this.combinedDirty = true;
  }

  /** returns stable array until next send/update */
  public read(): readonly T[] {
    if (this.combinedDirty) {
      this.combined.length = 0;
      // previous first, then current (same as your C++)
      this.combined.push(...this.previous, ...this.current);
      this.combinedDirty = false;
    }
    return this.combined;
  }

  /** A reader has its own cursor over the queue's two retained frame buffers. */
  public createReader(): EventReader<T> {
    let cursor = this.nextSequence - this.current.length - this.previous.length;
    return {
      read: () => {
        const oldest = this.nextSequence - this.current.length - this.previous.length;
        const offset = Math.max(0, cursor - oldest);
        cursor = this.nextSequence;
        return this.read().slice(offset);
      },
    };
  }

  public clearAll() {
    this.current.length = 0;
    this.previous.length = 0;
    this.combined.length = 0;
    this.combinedDirty = false;
  }
}
