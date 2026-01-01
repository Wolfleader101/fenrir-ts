import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "@/core/EventBus";
import { defineEvent } from "@/core/EventQueue";

// Test event types
type PlayerMoved = { playerId: string; x: number; y: number };
type PlayerAttacked = { playerId: string; targetId: string; damage: number };
type GameStateChanged = { state: "playing" | "paused" | "ended" };
type ItemCollected = { itemId: string; playerId: string; value: number };

const PlayerMoved = defineEvent<PlayerMoved>("PlayerMoved");
const PlayerAttacked = defineEvent<PlayerAttacked>("PlayerAttacked");
const GameStateChanged = defineEvent<GameStateChanged>("GameStateChanged");
const ItemCollected = defineEvent<ItemCollected>("ItemCollected");

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe("initialization", () => {
    it("should start empty", () => {
      const playerEvents = eventBus.read(PlayerMoved);
      const attackEvents = eventBus.read(PlayerAttacked);

      expect(playerEvents).toEqual([]);
      expect(attackEvents).toEqual([]);
    });

    it("should create separate queues for different event types", () => {
      const playerEvents = eventBus.read(PlayerMoved);
      const attackEvents = eventBus.read(PlayerAttacked);

      expect(playerEvents).not.toBe(attackEvents);
    });
  });

  describe("sending events", () => {
    it("should send events to correct queue", () => {
      const moveEvent: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const attackEvent: PlayerAttacked = {
        playerId: "player1",
        targetId: "player2",
        damage: 50,
      };

      eventBus.send(PlayerMoved, moveEvent);
      eventBus.send(PlayerAttacked, attackEvent);

      const moveEvents = eventBus.read(PlayerMoved);
      const attackEvents = eventBus.read(PlayerAttacked);

      expect(moveEvents).toEqual([moveEvent]);
      expect(attackEvents).toEqual([attackEvent]);
    });

    it("should handle multiple events of same type", () => {
      const move1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const move2: PlayerMoved = { playerId: "player2", x: 30, y: 40 };
      const move3: PlayerMoved = { playerId: "player1", x: 15, y: 25 };

      eventBus.send(PlayerMoved, move1);
      eventBus.send(PlayerMoved, move2);
      eventBus.send(PlayerMoved, move3);

      const events = eventBus.read(PlayerMoved);
      expect(events).toEqual([move1, move2, move3]);
    });

    it("should maintain event order within type", () => {
      const events: PlayerMoved[] = [];
      for (let i = 0; i < 10; i++) {
        const event: PlayerMoved = {
          playerId: `player${i}`,
          x: i * 10,
          y: i * 20,
        };
        events.push(event);
        eventBus.send(PlayerMoved, event);
      }

      const readEvents = eventBus.read(PlayerMoved);
      expect(readEvents).toEqual(events);
    });

    it("should isolate different event types", () => {
      const moveEvent: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const stateEvent: GameStateChanged = { state: "paused" };

      eventBus.send(PlayerMoved, moveEvent);
      eventBus.send(GameStateChanged, stateEvent);

      expect(eventBus.read(PlayerMoved)).toEqual([moveEvent]);
      expect(eventBus.read(GameStateChanged)).toEqual([stateEvent]);
      expect(eventBus.read(PlayerAttacked)).toEqual([]); // Should be empty
    });
  });

  describe("reading events", () => {
    it("should return readonly arrays", () => {
      const moveEvent: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      eventBus.send(PlayerMoved, moveEvent);

      const events = eventBus.read(PlayerMoved);
      expect(Array.isArray(events)).toBe(true);
      expect(events).toHaveLength(1);
    });

    it("should return empty array for unused event types", () => {
      const events = eventBus.read(ItemCollected);
      expect(events).toEqual([]);
      expect(events).toHaveLength(0);
    });

    it("should create queues lazily", () => {
      // Reading from a never-used event type should work
      const events1 = eventBus.read(ItemCollected);
      expect(events1).toEqual([]);

      // Sending to it should also work
      const item: ItemCollected = {
        itemId: "item1",
        playerId: "player1",
        value: 100,
      };
      eventBus.send(ItemCollected, item);

      const events2 = eventBus.read(ItemCollected);
      expect(events2).toEqual([item]);
    });
  });

  describe("update mechanism", () => {
    it("should update all queues", () => {
      const move1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const attack1: PlayerAttacked = {
        playerId: "player1",
        targetId: "player2",
        damage: 50,
      };

      eventBus.send(PlayerMoved, move1);
      eventBus.send(PlayerAttacked, attack1);
      eventBus.update();

      // Events should still be readable after update (moved to previous buffer)
      expect(eventBus.read(PlayerMoved)).toEqual([move1]);
      expect(eventBus.read(PlayerAttacked)).toEqual([attack1]);

      // Send new events
      const move2: PlayerMoved = { playerId: "player2", x: 30, y: 40 };
      const attack2: PlayerAttacked = {
        playerId: "player2",
        targetId: "player1",
        damage: 40,
      };

      eventBus.send(PlayerMoved, move2);
      eventBus.send(PlayerAttacked, attack2);

      // Should see both previous and current events
      expect(eventBus.read(PlayerMoved)).toEqual([move1, move2]);
      expect(eventBus.read(PlayerAttacked)).toEqual([attack1, attack2]);
    });

    it("should clear events after two updates", () => {
      const moveEvent: PlayerMoved = { playerId: "player1", x: 10, y: 20 };

      eventBus.send(PlayerMoved, moveEvent);
      eventBus.update(); // First update: current -> previous

      expect(eventBus.read(PlayerMoved)).toEqual([moveEvent]);

      eventBus.update(); // Second update: clears previous, current is empty

      expect(eventBus.read(PlayerMoved)).toEqual([]);
    });

    it("should handle mixed update patterns", () => {
      const move1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const state1: GameStateChanged = { state: "playing" };

      // Frame 1
      eventBus.send(PlayerMoved, move1);
      eventBus.update();

      // Frame 2 - only send state event
      eventBus.send(GameStateChanged, state1);

      // PlayerMoved should have previous event, GameStateChanged should have current
      expect(eventBus.read(PlayerMoved)).toEqual([move1]);
      expect(eventBus.read(GameStateChanged)).toEqual([state1]);

      eventBus.update();

      // Frame 3 - no new events
      expect(eventBus.read(PlayerMoved)).toEqual([]); // Cleared
      expect(eventBus.read(GameStateChanged)).toEqual([state1]); // Moved to previous

      eventBus.update();

      // Frame 4 - all should be cleared
      expect(eventBus.read(PlayerMoved)).toEqual([]);
      expect(eventBus.read(GameStateChanged)).toEqual([]);
    });
  });

  describe("clear functionality", () => {
    it("should clear all events immediately", () => {
      const move1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const attack1: PlayerAttacked = {
        playerId: "player1",
        targetId: "player2",
        damage: 50,
      };
      const state1: GameStateChanged = { state: "playing" };

      eventBus.send(PlayerMoved, move1);
      eventBus.send(PlayerAttacked, attack1);
      eventBus.send(GameStateChanged, state1);
      eventBus.update();

      // All events should be present
      expect(eventBus.read(PlayerMoved)).toEqual([move1]);
      expect(eventBus.read(PlayerAttacked)).toEqual([attack1]);
      expect(eventBus.read(GameStateChanged)).toEqual([state1]);

      eventBus.clear();

      // All should be cleared
      expect(eventBus.read(PlayerMoved)).toEqual([]);
      expect(eventBus.read(PlayerAttacked)).toEqual([]);
      expect(eventBus.read(GameStateChanged)).toEqual([]);
    });

    it("should reset all queues to fresh state", () => {
      const moveEvent: PlayerMoved = { playerId: "player1", x: 10, y: 20 };

      eventBus.send(PlayerMoved, moveEvent);
      eventBus.update();
      eventBus.clear();

      // Should behave like a fresh EventBus
      expect(eventBus.read(PlayerMoved)).toEqual([]);

      const newEvent: PlayerMoved = { playerId: "player2", x: 50, y: 60 };
      eventBus.send(PlayerMoved, newEvent);

      expect(eventBus.read(PlayerMoved)).toEqual([newEvent]);
    });
  });

  describe("queue management", () => {
    it("should reuse queues for same event type", () => {
      const move1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const move2: PlayerMoved = { playerId: "player2", x: 30, y: 40 };

      eventBus.send(PlayerMoved, move1);
      const events1 = eventBus.read(PlayerMoved);

      eventBus.send(PlayerMoved, move2);
      const events2 = eventBus.read(PlayerMoved);

      expect(events2).toEqual([move1, move2]);
      // The queue should be the same instance (though arrays might differ)
    });

    it("should handle many different event types", () => {
      const eventTypes = [
        PlayerMoved,
        PlayerAttacked,
        GameStateChanged,
        ItemCollected,
      ];
      const events = [
        { playerId: "p1", x: 10, y: 20 },
        { playerId: "p1", targetId: "p2", damage: 50 },
        { state: "paused" as const },
        { itemId: "item1", playerId: "p1", value: 100 },
      ];

      // Send one event of each type
      eventTypes.forEach((type, i) => {
        eventBus.send(type as any, events[i]);
      });

      // Each should be readable independently
      expect(eventBus.read(PlayerMoved)).toEqual([events[0]]);
      expect(eventBus.read(PlayerAttacked)).toEqual([events[1]]);
      expect(eventBus.read(GameStateChanged)).toEqual([events[2]]);
      expect(eventBus.read(ItemCollected)).toEqual([events[3]]);
    });
  });

  describe("edge cases", () => {
    it("should handle rapid send/update cycles", () => {
      for (let i = 0; i < 10; i++) {
        const event: PlayerMoved = {
          playerId: `player${i}`,
          x: i * 10,
          y: i * 20,
        };
        eventBus.send(PlayerMoved, event);
        eventBus.update();
      }

      // Should only see the last event (others cleared by updates)
      const events = eventBus.read(PlayerMoved);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ playerId: "player9", x: 90, y: 180 });
    });

    it("should handle update without any events", () => {
      expect(() => {
        for (let i = 0; i < 5; i++) {
          eventBus.update();
        }
      }).not.toThrow();

      expect(eventBus.read(PlayerMoved)).toEqual([]);
    });

    it("should handle clear without any events", () => {
      expect(() => {
        eventBus.clear();
      }).not.toThrow();

      expect(eventBus.read(PlayerMoved)).toEqual([]);
    });

    it("should handle same event type from different symbol instances", () => {
      // This tests the Symbol.for behavior - should be same symbol
      const PlayerMoved2 = defineEvent<PlayerMoved>("PlayerMoved");

      expect(PlayerMoved).toBe(PlayerMoved2); // Should be same symbol

      const event1: PlayerMoved = { playerId: "player1", x: 10, y: 20 };
      const event2: PlayerMoved = { playerId: "player2", x: 30, y: 40 };

      eventBus.send(PlayerMoved, event1);
      eventBus.send(PlayerMoved2, event2);

      const events = eventBus.read(PlayerMoved);
      expect(events).toEqual([event1, event2]); // Both events in same queue
    });
  });

  describe("memory management", () => {
    it("should not accumulate queues indefinitely", () => {
      // Send events for many different types (simulate dynamic event type creation)
      for (let i = 0; i < 100; i++) {
        const EventType = defineEvent<{ value: number }>(`TestEvent${i}`);
        eventBus.send(EventType, { value: i });

        if (i % 10 === 0) {
          eventBus.update();
        }
      }

      eventBus.update();
      eventBus.update(); // Clear all events

      // Should handle this gracefully
      expect(() => {
        const SomeEvent = defineEvent<{ data: string }>("SomeNewEvent");
        eventBus.send(SomeEvent, { data: "test" });
        expect(eventBus.read(SomeEvent)).toEqual([{ data: "test" }]);
      }).not.toThrow();
    });

    it("should handle large numbers of events efficiently", () => {
      const eventCount = 1000;
      const events: PlayerMoved[] = [];

      for (let i = 0; i < eventCount; i++) {
        const event: PlayerMoved = { playerId: `player${i}`, x: i, y: i * 2 };
        events.push(event);
        eventBus.send(PlayerMoved, event);
      }

      const readEvents = eventBus.read(PlayerMoved);
      expect(readEvents).toHaveLength(eventCount);
      expect(readEvents).toEqual(events);
    });
  });

  describe("integration scenarios", () => {
    it("should simulate typical game event flow", () => {
      // Simulate a game frame with various events

      // Player actions
      eventBus.send(PlayerMoved, { playerId: "p1", x: 100, y: 200 });
      eventBus.send(PlayerMoved, { playerId: "p2", x: 150, y: 250 });
      eventBus.send(PlayerAttacked, {
        playerId: "p1",
        targetId: "p2",
        damage: 25,
      });

      // System events
      eventBus.send(GameStateChanged, { state: "playing" });
      eventBus.send(ItemCollected, {
        itemId: "health_potion",
        playerId: "p2",
        value: 50,
      });

      // Systems read events
      const movements = eventBus.read(PlayerMoved);
      const attacks = eventBus.read(PlayerAttacked);
      const stateChanges = eventBus.read(GameStateChanged);
      const collections = eventBus.read(ItemCollected);

      expect(movements).toHaveLength(2);
      expect(attacks).toHaveLength(1);
      expect(stateChanges).toHaveLength(1);
      expect(collections).toHaveLength(1);

      // End of frame - update event bus
      eventBus.update();

      // Next frame - events should still be available for one more frame
      expect(eventBus.read(PlayerMoved)).toHaveLength(2);
      expect(eventBus.read(PlayerAttacked)).toHaveLength(1);

      // Another update should clear them
      eventBus.update();
      expect(eventBus.read(PlayerMoved)).toEqual([]);
      expect(eventBus.read(PlayerAttacked)).toEqual([]);
    });

    it("should handle event burst scenarios", () => {
      // Simulate many events happening at once (e.g., explosions affecting multiple entities)
      const affectedPlayers = ["p1", "p2", "p3", "p4", "p5"];

      // Explosion damage to all players
      affectedPlayers.forEach((playerId) => {
        eventBus.send(PlayerAttacked, {
          playerId: "explosion",
          targetId: playerId,
          damage: 30,
        });
      });

      // Multiple players move in response
      affectedPlayers.forEach((playerId, i) => {
        eventBus.send(PlayerMoved, {
          playerId,
          x: 100 + i * 50,
          y: 100 + i * 30,
        });
      });

      const attacks = eventBus.read(PlayerAttacked);
      const movements = eventBus.read(PlayerMoved);

      expect(attacks).toHaveLength(5);
      expect(movements).toHaveLength(5);

      // All attacks should be from explosion
      attacks.forEach((attack) => {
        expect(attack.playerId).toBe("explosion");
        expect(attack.damage).toBe(30);
      });
    });
  });
});
