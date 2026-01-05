import { describe, it, expect, beforeEach, vi } from "vitest";
import { createInputStateSystem } from "@/core/InputSystem/InputStateSystem";
import { InputEvent } from "@/core/InputSystem/InputEvents";
import { EventBus } from "@/core/EventBus";
import { NullLogger } from "@/core/NullLogger";

describe("InputStateSystem", () => {
  let eventBus: EventBus;
  let inputStateSystem: ReturnType<typeof createInputStateSystem>;
  let mockCtx: any;

  beforeEach(() => {
    eventBus = new EventBus();
    inputStateSystem = createInputStateSystem();

    mockCtx = {
      events: eventBus,
      logger: new NullLogger(),
    };

    // Clear event bus before each test
    eventBus.update();
  });

  describe("initialization", () => {
    it("should create input state system with initial state", () => {
      expect(inputStateSystem.state).toBeDefined();
      expect(inputStateSystem.preUpdate).toBeDefined();
      expect(typeof inputStateSystem.preUpdate).toBe("function");
    });

    it("should initialize with default values", () => {
      const { state } = inputStateSystem;

      expect(state.mouseX).toBe(0);
      expect(state.mouseY).toBe(0);
      expect(state.mouseDX).toBe(0);
      expect(state.mouseDY).toBe(0);
      expect(state.wheelDX).toBe(0);
      expect(state.wheelDY).toBe(0);
      expect(state.hasFocus).toBe(true);
    });
  });

  describe("focus event handling", () => {
    it("should handle focus gained event", () => {
      eventBus.send(InputEvent.Focus, { hasFocus: true });

      inputStateSystem.preUpdate(mockCtx);

      expect(inputStateSystem.state.hasFocus).toBe(true);
    });

    it("should handle focus lost event", () => {
      eventBus.send(InputEvent.Focus, { hasFocus: false });

      inputStateSystem.preUpdate(mockCtx);

      expect(inputStateSystem.state.hasFocus).toBe(false);
    });

    it("should handle multiple focus events in same frame", () => {
      eventBus.send(InputEvent.Focus, { hasFocus: false });
      eventBus.send(InputEvent.Focus, { hasFocus: true });
      eventBus.send(InputEvent.Focus, { hasFocus: false });

      inputStateSystem.preUpdate(mockCtx);

      // Should reflect the last event
      expect(inputStateSystem.state.hasFocus).toBe(false);
    });
  });

  describe("keyboard event handling", () => {
    it("should handle key down events", () => {
      eventBus.send(InputEvent.KeyDown, {
        code: "KeyW",
        key: "w",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      expect(inputStateSystem.state.isDown("KeyW")).toBe(true);
      expect(inputStateSystem.state.wasPressed("KeyW")).toBe(true);
    });

    it("should handle key up events", () => {
      const { state } = inputStateSystem;

      // First press the key
      state._setKeyDown("KeyW");

      // Then send key up event
      eventBus.send(InputEvent.KeyUp, {
        code: "KeyW",
        key: "w",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      expect(state.isDown("KeyW")).toBe(false);
      expect(state.wasReleased("KeyW")).toBe(true);
    });

    it("should handle key repeat events", () => {
      // First non-repeat key down
      eventBus.send(InputEvent.KeyDown, {
        code: "KeyW",
        key: "w",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);
      inputStateSystem.state.beginFrame(); // Clear pressed state

      // Then repeat key down
      eventBus.send(InputEvent.KeyDown, {
        code: "KeyW",
        key: "w",
        repeat: true,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      expect(inputStateSystem.state.isDown("KeyW")).toBe(true);
      expect(inputStateSystem.state.wasPressed("KeyW")).toBe(false); // Should not be "pressed" again on repeat
    });

    it("should handle multiple key events in same frame", () => {
      eventBus.send(InputEvent.KeyDown, {
        code: "KeyW",
        key: "w",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      eventBus.send(InputEvent.KeyDown, {
        code: "KeyA",
        key: "a",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      eventBus.send(InputEvent.KeyUp, {
        code: "KeyW",
        key: "w",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      const { state } = inputStateSystem;
      expect(state.isDown("KeyW")).toBe(false);
      expect(state.isDown("KeyA")).toBe(true);
      expect(state.wasPressed("KeyW")).toBe(true);
      expect(state.wasPressed("KeyA")).toBe(true);
      expect(state.wasReleased("KeyW")).toBe(true);
      expect(state.wasReleased("KeyA")).toBe(false);
    });
  });

  describe("mouse event handling", () => {
    it("should handle mouse move events", () => {
      eventBus.send(InputEvent.MouseMove, {
        x: 100,
        y: 200,
        dx: 5,
        dy: -3,
        buttons: 0,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      const { state } = inputStateSystem;
      expect(state.mouseX).toBe(100);
      expect(state.mouseY).toBe(200);
      expect(state.mouseDX).toBe(5);
      expect(state.mouseDY).toBe(-3);
    });

    it("should accumulate mouse deltas from multiple events", () => {
      eventBus.send(InputEvent.MouseMove, {
        x: 100,
        y: 200,
        dx: 5,
        dy: -3,
        buttons: 0,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      eventBus.send(InputEvent.MouseMove, {
        x: 105,
        y: 197,
        dx: 3,
        dy: 2,
        buttons: 0,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      const { state } = inputStateSystem;
      expect(state.mouseX).toBe(105); // Last position
      expect(state.mouseY).toBe(197); // Last position
      expect(state.mouseDX).toBe(8); // Accumulated: 5 + 3
      expect(state.mouseDY).toBe(-1); // Accumulated: -3 + 2
    });

    it("should handle mouse wheel events", () => {
      eventBus.send(InputEvent.MouseWheel, {
        dx: 0,
        dy: -100,
        dz: 0,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      const { state } = inputStateSystem;
      expect(state.wheelDX).toBe(0);
      expect(state.wheelDY).toBe(-100);
    });

    it("should accumulate wheel deltas from multiple events", () => {
      eventBus.send(InputEvent.MouseWheel, {
        dx: 10,
        dy: -50,
        dz: 0,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });

      eventBus.send(InputEvent.MouseWheel, {
        dx: -5,
        dy: -25,
        dz: 0,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      const { state } = inputStateSystem;
      expect(state.wheelDX).toBe(5); // Accumulated: 10 + (-5)
      expect(state.wheelDY).toBe(-75); // Accumulated: -50 + (-25)
    });
  });

  describe("frame lifecycle", () => {
    it("should call beginFrame on state", () => {
      const { state } = inputStateSystem;
      const beginFrameSpy = vi.spyOn(state, "beginFrame");

      inputStateSystem.preUpdate(mockCtx);

      expect(beginFrameSpy).toHaveBeenCalledOnce();
    });

    it("should process events after beginFrame", () => {
      const { state } = inputStateSystem;

      // Set up some state
      state._setKeyDown("KeyW");
      state.mouseDX = 10;
      state.wheelDY = 5;

      // Send new events
      eventBus.send(InputEvent.KeyDown, {
        code: "KeyA",
        key: "a",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      // beginFrame should have cleared deltas but preserved key down state
      expect(state.isDown("KeyW")).toBe(true);
      expect(state.wasPressed("KeyW")).toBe(false); // Cleared by beginFrame
      expect(state.isDown("KeyA")).toBe(true);
      expect(state.wasPressed("KeyA")).toBe(true); // New event
      expect(state.mouseDX).toBe(0); // Cleared by beginFrame
      expect(state.wheelDY).toBe(0); // Cleared by beginFrame
    });
  });

  describe("integration scenarios", () => {
    it("should handle mixed input events in realistic sequence", () => {
      const { state } = inputStateSystem;

      // Simulate focus, then key press, mouse move, and wheel
      eventBus.send(InputEvent.Focus, { hasFocus: true });
      eventBus.send(InputEvent.KeyDown, {
        code: "KeyW",
        key: "w",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });
      eventBus.send(InputEvent.MouseMove, {
        x: 320,
        y: 240,
        dx: 10,
        dy: 5,
        buttons: 1,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });
      eventBus.send(InputEvent.MouseWheel, {
        dx: 0,
        dy: -50,
        dz: 0,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      expect(state.hasFocus).toBe(true);
      expect(state.isDown("KeyW")).toBe(true);
      expect(state.wasPressed("KeyW")).toBe(true);
      expect(state.mouseX).toBe(320);
      expect(state.mouseY).toBe(240);
      expect(state.mouseDX).toBe(10);
      expect(state.mouseDY).toBe(5);
      expect(state.wheelDX).toBe(0);
      expect(state.wheelDY).toBe(-50);
    });

    it("should handle no events gracefully", () => {
      const { state } = inputStateSystem;

      // Set up some initial state
      state._setKeyDown("KeyW");
      state.mouseX = 100;
      state.mouseY = 200;

      // Process with no events
      inputStateSystem.preUpdate(mockCtx);

      // Key should remain down, mouse position preserved, deltas cleared
      expect(state.isDown("KeyW")).toBe(true);
      expect(state.wasPressed("KeyW")).toBe(false); // Cleared by beginFrame
      expect(state.mouseX).toBe(100); // Preserved
      expect(state.mouseY).toBe(200); // Preserved
      expect(state.mouseDX).toBe(0); // Cleared
      expect(state.mouseDY).toBe(0); // Cleared
    });

    it("should maintain state consistency across multiple frames", () => {
      const { state } = inputStateSystem;

      // Frame 1: Press key, move mouse
      eventBus.send(InputEvent.KeyDown, {
        code: "Space",
        key: " ",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });
      eventBus.send(InputEvent.MouseMove, {
        x: 50,
        y: 75,
        dx: 10,
        dy: 15,
        buttons: 0,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);
      eventBus.update(); // Simulate frame end

      expect(state.isDown("Space")).toBe(true);
      expect(state.wasPressed("Space")).toBe(true);
      expect(state.mouseDX).toBe(10);

      // Frame 2: Hold key, different mouse move
      eventBus.send(InputEvent.MouseMove, {
        x: 60,
        y: 80,
        dx: 5,
        dy: -2,
        buttons: 0,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      inputStateSystem.preUpdate(mockCtx);

      expect(state.isDown("Space")).toBe(true);
      expect(state.wasPressed("Space")).toBe(false); // Not pressed again
      expect(state.mouseX).toBe(60); // Updated position
      expect(state.mouseDX).toBe(15); // Accumulated: 10 (from previous frame) + 5 (from current frame)
    });
  });
});
