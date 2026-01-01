import { describe, it, expect, beforeEach } from "vitest";
import { EventQueue, defineEvent, type EventType } from "@/core/EventQueue";

// Test event types
type PlayerMoved = { playerId: string; x: number; y: number };
type PlayerAttacked = { playerId: string; targetId: string; damage: number };
type GameStateChanged = { state: "playing" | "paused" | "ended" };
type ItemPickup = { itemId: string; playerId: string; timestamp: number };

const PlayerMoved = defineEvent<PlayerMoved>("PlayerMoved");
const PlayerAttacked = defineEvent<PlayerAttacked>("PlayerAttacked");
const GameStateChanged = defineEvent<GameStateChanged>("GameStateChanged");
const ItemPickup = defineEvent<ItemPickup>("ItemPickup");

describe("EventQueue", () => {
  let eventQueue: EventQueue<PlayerMoved>;

  beforeEach(() => {
    eventQueue = new EventQueue<PlayerMoved>();
  });

  describe("initialization", () => {
    it("should start empty", () => {
      const events = eventQueue.read();
      expect(events).toEqual([]);
      expect(events).toHaveLength(0);
    });

    it("should return readonly array from read()", () => {
      const events = eventQueue.read();

      // TypeScript should prevent mutations, but we can test runtime behavior
      expect(Array.isArray(events)).toBe(true);
      expect(Object.isFrozen(events)).toBe(false); // readonly in TS, not frozen in runtime
    });
  });

  describe("sending events", () => {
    it("should accept and store events", () => {
      const event: PlayerMoved = { playerId: "player1", x: 10, y: 20 };

      eventQueue.send(event);

      const events = eventQueue.read();
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it("should handle multiple events", () => {
      const event1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const event2: PlayerMoved = { playerId: "player2", x: 30, y: 40 };

      eventQueue.send(event1);
      eventQueue.send(event2);

      const events = eventQueue.read();
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(event1);
      expect(events[1]).toEqual(event2);
    });

    it("should maintain order of sent events", () => {
      const events: PlayerMoved[] = [];
      for (let i = 0; i < 10; i++) {
        events.push({ playerId: `player${i}`, x: i * 10, y: i * 20 });
      }

      events.forEach((event) => eventQueue.send(event));

      const readEvents = eventQueue.read();
      expect(readEvents).toEqual(events);
    });
  });

  describe("update mechanism", () => {
    it("should swap buffers on update", () => {
      const event1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const event2: PlayerMoved = { playerId: "player2", x: 30, y: 40 };

      // Send event to current buffer
      eventQueue.send(event1);
      expect(eventQueue.read()).toHaveLength(1);

      // Update swaps current -> previous
      eventQueue.update();

      // Previous events should still be readable
      expect(eventQueue.read()).toHaveLength(1);
      expect(eventQueue.read()[0]).toEqual(event1);

      // Send new event to new current buffer
      eventQueue.send(event2);

      // Should see both previous and current
      const allEvents = eventQueue.read();
      expect(allEvents).toHaveLength(2);
      expect(allEvents[0]).toEqual(event1); // previous first
      expect(allEvents[1]).toEqual(event2); // current second
    });

    it("should clear old events after two updates", () => {
      const event1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const event2: PlayerMoved = { playerId: "player2", x: 30, y: 40 };
      const event3: PlayerMoved = { playerId: "player3", x: 50, y: 60 };

      // Frame 1: Send event1
      eventQueue.send(event1);
      eventQueue.update();

      // Frame 2: Send event2
      eventQueue.send(event2);
      let events = eventQueue.read();
      expect(events).toEqual([event1, event2]); // previous + current

      eventQueue.update();

      // Frame 3: Send event3
      eventQueue.send(event3);
      events = eventQueue.read();
      expect(events).toEqual([event2, event3]); // event1 should be gone
      expect(events).not.toContain(event1);
    });

    it("should handle empty updates correctly", () => {
      const event: PlayerMoved = { playerId: "player1", x: 10, y: 20 };

      eventQueue.send(event);
      eventQueue.update();

      // Event should still be readable in previous buffer
      expect(eventQueue.read()).toEqual([event]);

      // Update again without sending new events - this clears previous
      eventQueue.update();
      expect(eventQueue.read()).toEqual([]);
    });
  });

  describe("read behavior", () => {
    it("should return same array reference until next send/update", () => {
      const event: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      eventQueue.send(event);

      const read1 = eventQueue.read();
      const read2 = eventQueue.read();

      expect(read1).toBe(read2); // Same reference
    });

    it("should update content correctly after send", () => {
      const event1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const event2: PlayerMoved = { playerId: "player2", x: 30, y: 40 };

      eventQueue.send(event1);
      const read1 = eventQueue.read();
      expect(read1).toHaveLength(1);

      eventQueue.send(event2);
      const read2 = eventQueue.read();

      expect(read2).toHaveLength(2);
      expect(read2).toEqual([event1, event2]);
    });

    it("should update content correctly after update", () => {
      const event: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      eventQueue.send(event);

      const read1 = eventQueue.read();
      expect(read1).toEqual([event]);

      eventQueue.update();
      const read2 = eventQueue.read();

      expect(read2).toEqual([event]); // Content should be the same
    });

    it("should combine previous and current events correctly", () => {
      const event1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const event2: PlayerMoved = { playerId: "player2", x: 30, y: 40 };
      const event3: PlayerMoved = { playerId: "player3", x: 50, y: 60 };

      // Frame 1
      eventQueue.send(event1);
      eventQueue.update();

      // Frame 2
      eventQueue.send(event2);
      eventQueue.send(event3);

      const events = eventQueue.read();
      expect(events).toEqual([event1, event2, event3]);
      // Previous events first, then current events in order
    });
  });

  describe("clearAll method", () => {
    it("should clear all events immediately", () => {
      const event1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const event2: PlayerMoved = { playerId: "player2", x: 30, y: 40 };

      eventQueue.send(event1);
      eventQueue.update();
      eventQueue.send(event2);

      expect(eventQueue.read()).toHaveLength(2);

      eventQueue.clearAll();

      expect(eventQueue.read()).toEqual([]);
    });

    it("should reset internal state completely", () => {
      const event: PlayerMoved = { playerId: "player1", x: 10, y: 20 };

      eventQueue.send(event);
      eventQueue.update();
      eventQueue.clearAll();

      // Should behave like a fresh queue
      expect(eventQueue.read()).toEqual([]);

      eventQueue.send(event);
      expect(eventQueue.read()).toEqual([event]);
    });
  });

  describe("edge cases", () => {
    it("should handle rapid send/update cycles", () => {
      const events: PlayerMoved[] = [];

      for (let i = 0; i < 5; i++) {
        const event: PlayerMoved = { playerId: `player${i}`, x: i, y: i };
        events.push(event);

        eventQueue.send(event);
        eventQueue.update();
      }

      // Should only see the last two events (previous + current frame)
      const readEvents = eventQueue.read();
      expect(readEvents).toHaveLength(1);
      expect(readEvents[0]).toEqual(events[4]);
    });

    it("should handle update without any sends", () => {
      expect(() => {
        for (let i = 0; i < 10; i++) {
          eventQueue.update();
        }
      }).not.toThrow();

      expect(eventQueue.read()).toEqual([]);
    });

    it("should handle many events in single frame", () => {
      const events: PlayerMoved[] = [];
      for (let i = 0; i < 1000; i++) {
        const event: PlayerMoved = { playerId: `player${i}`, x: i, y: i * 2 };
        events.push(event);
        eventQueue.send(event);
      }

      const readEvents = eventQueue.read();
      expect(readEvents).toHaveLength(1000);
      expect(readEvents).toEqual(events);
    });
  });

  describe("memory management", () => {
    it("should not grow indefinitely with regular updates", () => {
      // Simulate many frames of events
      for (let frame = 0; frame < 100; frame++) {
        for (let i = 0; i < 10; i++) {
          eventQueue.send({ playerId: `p${frame}-${i}`, x: i, y: frame });
        }
        eventQueue.update();
      }

      // Should only contain events from last two frames
      const events = eventQueue.read();
      expect(events.length).toBeLessThanOrEqual(20); // Max 10 previous + 10 current
    });

    it("should reuse array capacity efficiently", () => {
      const largeEventCount = 1000;

      // Fill with many events
      for (let i = 0; i < largeEventCount; i++) {
        eventQueue.send({ playerId: `player${i}`, x: i, y: i });
      }

      eventQueue.update();
      eventQueue.update(); // Clear the events

      // Should handle new events efficiently
      eventQueue.send({ playerId: "newPlayer", x: 999, y: 999 });
      const events = eventQueue.read();

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ playerId: "newPlayer", x: 999, y: 999 });
    });
  });
});

describe("defineEvent", () => {
  describe("event type creation", () => {
    it("should create unique event types", () => {
      const Event1 = defineEvent<{ data: number }>("Event1");
      const Event2 = defineEvent<{ data: string }>("Event2");

      expect(Event1).not.toBe(Event2);
      expect(typeof Event1).toBe("symbol");
      expect(typeof Event2).toBe("symbol");
    });

    it("should return same symbol for same name", () => {
      const Event1A = defineEvent<{ value: number }>("TestEvent");
      const Event1B = defineEvent<{ value: number }>("TestEvent");

      expect(Event1A).toBe(Event1B); // Symbol.for behavior
    });

    it("should work with different event data types", () => {
      type SimpleEvent = { message: string };
      type ComplexEvent = {
        id: string;
        data: { values: number[]; meta: { timestamp: Date } };
        optional?: boolean;
      };

      const Simple = defineEvent<SimpleEvent>("Simple");
      const Complex = defineEvent<ComplexEvent>("Complex");

      expect(typeof Simple).toBe("symbol");
      expect(typeof Complex).toBe("symbol");
      expect(Simple).not.toBe(Complex);
    });

    it("should handle edge case names", () => {
      const EmptyName = defineEvent<{}>("");
      const SpecialChars = defineEvent<{}>("Event-With_Special.Chars123");
      const Unicode = defineEvent<{}>("Event🎮");

      expect(typeof EmptyName).toBe("symbol");
      expect(typeof SpecialChars).toBe("symbol");
      expect(typeof Unicode).toBe("symbol");
    });
  });

  describe("type safety", () => {
    it("should maintain type information", () => {
      type TestEvent = { playerId: string; score: number };
      const TestEvent = defineEvent<TestEvent>("TestEvent");

      const eventType: EventType<TestEvent> = TestEvent;
      expect(eventType).toBe(TestEvent);
    });

    it("should work with generic event queues", () => {
      type GameEvent = PlayerMoved | PlayerAttacked | GameStateChanged;
      const gameQueue = new EventQueue<GameEvent>();

      const moveEvent: PlayerMoved = { playerId: "p1", x: 10, y: 20 };
      const attackEvent: PlayerAttacked = {
        playerId: "p1",
        targetId: "p2",
        damage: 50,
      };

      gameQueue.send(moveEvent);
      gameQueue.send(attackEvent);

      const events = gameQueue.read();
      expect(events).toHaveLength(2);
      expect(events[0]).toEqual(moveEvent);
      expect(events[1]).toEqual(attackEvent);
    });
  });
});

describe("EventQueue Integration", () => {
  describe("multiple event queues", () => {
    it("should work independently", () => {
      const moveQueue = new EventQueue<PlayerMoved>();
      const attackQueue = new EventQueue<PlayerAttacked>();

      const moveEvent: PlayerMoved = { playerId: "p1", x: 10, y: 20 };
      const attackEvent: PlayerAttacked = {
        playerId: "p1",
        targetId: "p2",
        damage: 50,
      };

      moveQueue.send(moveEvent);
      attackQueue.send(attackEvent);

      expect(moveQueue.read()).toEqual([moveEvent]);
      expect(attackQueue.read()).toEqual([attackEvent]);

      moveQueue.update();
      expect(moveQueue.read()).toEqual([moveEvent]);
      expect(attackQueue.read()).toEqual([attackEvent]); // Unaffected
    });

    it("should handle different update schedules", () => {
      const fastQueue = new EventQueue<{ frame: number }>();
      const slowQueue = new EventQueue<{ tick: number }>();

      // Fast queue updates every frame
      for (let frame = 0; frame < 5; frame++) {
        fastQueue.send({ frame });
        fastQueue.update();
      }

      // Slow queue updates less frequently
      for (let tick = 0; tick < 2; tick++) {
        slowQueue.send({ tick });
      }
      slowQueue.update();

      expect(fastQueue.read()).toEqual([{ frame: 4 }]); // Only latest
      expect(slowQueue.read()).toEqual([{ tick: 0 }, { tick: 1 }]); // Both events
    });
  });

  describe("real-world simulation", () => {
    it("should simulate typical game loop", () => {
      const eventQueue = new EventQueue<PlayerMoved>();
      const frameEvents: PlayerMoved[][] = [];

      // Simulate 5 frames
      for (let frame = 0; frame < 5; frame++) {
        const events: PlayerMoved[] = [];

        // Generate random events for this frame
        const eventCount = Math.floor(Math.random() * 5) + 1;
        for (let i = 0; i < eventCount; i++) {
          const event: PlayerMoved = {
            playerId: `player${i}`,
            x: frame * 10 + i,
            y: frame * 20 + i,
          };
          events.push(event);
          eventQueue.send(event);
        }

        frameEvents.push(events);

        // Read events (previous + current frame)
        const readEvents = eventQueue.read();
        if (frame === 0) {
          expect(readEvents).toEqual(events); // First frame, only current
        } else {
          expect(readEvents).toEqual([...frameEvents[frame - 1], ...events]);
        }

        eventQueue.update();
      }
    });

    it("should handle burst events followed by quiet periods", () => {
      const eventQueue = new EventQueue<ItemPickup>();

      // Burst of events
      for (let i = 0; i < 10; i++) {
        eventQueue.send({
          itemId: `item${i}`,
          playerId: "player1",
          timestamp: Date.now() + i,
        });
      }

      eventQueue.update();

      // Quiet period
      for (let i = 0; i < 5; i++) {
        eventQueue.update();
      }

      expect(eventQueue.read()).toEqual([]); // All events cleared
    });
  });
});
