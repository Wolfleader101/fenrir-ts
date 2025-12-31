export type EventType<T> = symbol & { __eventType?: T };

export function defineEvent<T>(name: string): EventType<T> {
  // using Symbol.for to allow cross-module event type sharing
  return Symbol.for(`event:${name}`) as EventType<T>;
}

export class EventQueue<T> {
  private current: T[] = [];
  private previous: T[] = [];

  // cached combined buffer
  private combined: T[] = [];
  private combinedDirty = true;

  public send(ev: T) {
    this.current.push(ev);
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

  public clearAll() {
    this.current.length = 0;
    this.previous.length = 0;
    this.combined.length = 0;
    this.combinedDirty = false;
  }
}
