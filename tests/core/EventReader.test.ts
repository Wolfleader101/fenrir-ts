import { describe, expect, it } from "vitest";
import { EventBus } from "../../src/core/EventBus";
import { defineEvent } from "../../src/core/EventQueue";

describe("event readers", () => {
  const ping = defineEvent<number>("test.eventReader");

  it("reads sends independently, including late sends and repeated fixed ticks", () => {
    const events = new EventBus();
    const first = events.createReader(ping);
    const second = events.createReader(ping);
    events.send(ping, 1);
    expect(first.read()).toEqual([1]);
    expect(first.read()).toEqual([]);
    events.send(ping, 2);
    events.update();
    expect(first.read()).toEqual([2]);
    expect(second.read()).toEqual([1, 2]);
    events.send(ping, 2);
    expect(first.read()).toEqual([2]);
    expect(events.read(ping)).toEqual([1, 2, 2]);
  });

  it("starts at the oldest retained event and keeps its position when cleared", () => {
    const events = new EventBus();
    events.send(ping, 1);
    events.update();
    events.update();
    events.send(ping, 2);
    const reader = events.createReader(ping);
    expect(reader.read()).toEqual([2]);
    events.clear();
    expect(reader.read()).toEqual([]);
    events.send(ping, 3);
    expect(reader.read()).toEqual([3]);
  });
});
