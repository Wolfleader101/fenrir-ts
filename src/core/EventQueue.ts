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

/**
 * What `events.createReader(Type)` returns: `read()` gives the events it has not returned before.
 * Create one per consumer, once.
 *
 * A reader read in a per-frame stage (`PreUpdate`, `Update`, `PostUpdate`) sees the last two
 * frames of events, so one that skips a frame still gets them and one that skips two loses them.
 * A reader read in `Tick` also gets every event sent since the last tick began, however many
 * frames ran no tick in between: an event sent in `PreUpdate` or `Update` reaches the next
 * `Tick` even when the frame rate is several times the tick rate. A frame that runs several
 * ticks returns each event once, to the first `Tick` read after it was sent.
 */
export type EventReader<T> = { read(): readonly T[] };

/**
 * Internal: what the bus shares with its queues. The engine marks each `Tick` stage here, so
 * a queue keeps events no tick has seen and a reader knows it is read in `Tick`.
 */
export type EventTicks = {
  /** The engine drives this bus: ticks happen, so events are kept for them. */
  driven: boolean;
  /** A `Tick` stage is running. */
  ticking: boolean;
  /** `Tick` stages begun so far. */
  count: number;
};

/** Internal storage for one event type. Games use `EventBus` (`ctx.events`) instead. */
export class EventQueue<T> {
  /** Every kept event, oldest first. `events[i]` has sequence `base + i`. */
  private events: T[] = [];
  private base = 0;
  private nextSequence = 0;
  /** Sequences where the current and the previous frame began. */
  private currentStart = 0;
  private previousStart = 0;
  /** The tick count at the latest send, and the sequence of the first send since that tick began. */
  private sendTick = -1;
  private sentSinceTick = 0;
  private readonly ticks?: EventTicks;

  // cached two-frame buffer
  private combined: T[] = [];
  private combinedDirty = true;

  constructor(ticks?: EventTicks) {
    this.ticks = ticks;
  }

  public send(ev: T) {
    const ticks = this.ticks;
    if (ticks && ticks.count !== this.sendTick) {
      this.sendTick = ticks.count;
      this.sentSinceTick = this.nextSequence;
    }
    this.events.push(ev);
    this.nextSequence++;
    this.combinedDirty = true;
  }

  /**
   * Called once per frame, after all stages. Drops the frame two frames old, except, on a bus
   * the engine drives, the events sent since the last tick began: those stay until a tick has
   * begun after them, so a `Tick` reader gets them. A tick runs at least every
   * `fixedDelta` seconds of frame time, which bounds what is kept.
   */
  public update() {
    this.previousStart = this.currentStart;
    this.currentStart = this.nextSequence;

    let keepFrom = this.previousStart;
    const ticks = this.ticks;
    if (ticks?.driven && ticks.count === this.sendTick) keepFrom = Math.min(keepFrom, this.sentSinceTick);
    if (keepFrom > this.base) {
      this.events.splice(0, keepFrom - this.base);
      this.base = keepFrom;
    }

    this.combinedDirty = true;
  }

  /** The last two frames of events, oldest first. A stable array until the next send or update. */
  public read(): readonly T[] {
    if (this.combinedDirty) {
      this.combined.length = 0;
      for (let i = this.previousStart - this.base; i < this.events.length; i++) this.combined.push(this.events[i]!);
      this.combinedDirty = false;
    }
    return this.combined;
  }

  /**
   * A reader with its own cursor. Read in `Tick`, it returns every kept event it has not
   * returned; read anywhere else, only those of the last two frames. See `EventReader`.
   */
  public createReader(): EventReader<T> {
    let cursor = this.base;
    return {
      read: () => {
        const oldest = this.ticks?.ticking ? this.base : this.previousStart;
        const from = Math.max(cursor, oldest);
        cursor = this.nextSequence;
        return this.events.slice(from - this.base);
      },
    };
  }

  public clearAll() {
    this.events.length = 0;
    this.base = this.currentStart = this.previousStart = this.nextSequence;
    this.combined.length = 0;
    this.combinedDirty = false;
  }
}
