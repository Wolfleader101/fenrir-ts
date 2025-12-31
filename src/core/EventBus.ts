import { EventQueue, type EventType } from "./EventQueue";

export class EventBus {
  private queues = new Map<symbol, EventQueue<any>>();

  private getQueue<T>(type: EventType<T>) {
    let q = this.queues.get(type) as EventQueue<T> | undefined;
    if (!q) {
      q = new EventQueue<T>();
      this.queues.set(type, q);
    }
    return q;
  }

  public send<T>(type: EventType<T>, ev: T) {
    this.getQueue(type).send(ev);
  }

  public read<T>(type: EventType<T>) {
    return this.getQueue(type).read();
  }

  /** called once per frame boundary (like your App::UpdateEvents) */
  public update() {
    for (const q of this.queues.values()) q.update();
  }

  /** optional: for scene changes / resets */
  public clear() {
    for (const q of this.queues.values()) q.clearAll();
  }
}
