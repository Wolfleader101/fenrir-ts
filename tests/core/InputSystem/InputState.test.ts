import { describe, it, expect, beforeEach } from "vitest";
import { InputState } from "@/core/InputSystem/InputState";

describe("InputState", () => {
  let inputState: InputState;

  beforeEach(() => {
    inputState = new InputState();
  });

  describe("initialization", () => {
    it("should initialize with default values", () => {
      expect(inputState.mouseX).toBe(0);
      expect(inputState.mouseY).toBe(0);
      expect(inputState.mouseDX).toBe(0);
      expect(inputState.mouseDY).toBe(0);
      expect(inputState.wheelDX).toBe(0);
      expect(inputState.wheelDY).toBe(0);
      expect(inputState.hasFocus).toBe(true);
    });

    it("should start with no keys pressed", () => {
      expect(inputState.isDown("KeyW")).toBe(false);
      expect(inputState.wasPressed("KeyW")).toBe(false);
      expect(inputState.wasReleased("KeyW")).toBe(false);
    });
  });

  describe("key state management", () => {
    it("should track key down state", () => {
      inputState._setKeyDown("KeyW");

      expect(inputState.isDown("KeyW")).toBe(true);
      expect(inputState.wasPressed("KeyW")).toBe(true);
      expect(inputState.wasReleased("KeyW")).toBe(false);
    });

    it("should track key up state", () => {
      inputState._setKeyDown("KeyW");
      inputState._setKeyUp("KeyW");

      expect(inputState.isDown("KeyW")).toBe(false);
      expect(inputState.wasPressed("KeyW")).toBe(true);
      expect(inputState.wasReleased("KeyW")).toBe(true);
    });

    it("should not register pressed if key already down", () => {
      inputState._setKeyDown("KeyW");
      inputState.beginFrame(); // Clear pressed state
      inputState._setKeyDown("KeyW"); // Key still down

      expect(inputState.isDown("KeyW")).toBe(true);
      expect(inputState.wasPressed("KeyW")).toBe(false); // Not pressed again
      expect(inputState.wasReleased("KeyW")).toBe(false);
    });

    it("should not register released if key not down", () => {
      inputState._setKeyUp("KeyW"); // Key wasn't down to begin with

      expect(inputState.isDown("KeyW")).toBe(false);
      expect(inputState.wasPressed("KeyW")).toBe(false);
      expect(inputState.wasReleased("KeyW")).toBe(false);
    });

    it("should handle multiple keys independently", () => {
      inputState._setKeyDown("KeyW");
      inputState._setKeyDown("KeyA");
      inputState._setKeyUp("KeyW");

      expect(inputState.isDown("KeyW")).toBe(false);
      expect(inputState.isDown("KeyA")).toBe(true);
      expect(inputState.wasPressed("KeyW")).toBe(true);
      expect(inputState.wasPressed("KeyA")).toBe(true);
      expect(inputState.wasReleased("KeyW")).toBe(true);
      expect(inputState.wasReleased("KeyA")).toBe(false);
    });
  });

  describe("frame lifecycle", () => {
    it("should clear pressed and released states on beginFrame", () => {
      inputState._setKeyDown("KeyW");
      inputState._setKeyUp("KeyS");

      expect(inputState.wasPressed("KeyW")).toBe(true);
      expect(inputState.wasReleased("KeyS")).toBe(false);

      inputState.beginFrame();

      expect(inputState.wasPressed("KeyW")).toBe(false);
      expect(inputState.wasReleased("KeyS")).toBe(false);
      expect(inputState.isDown("KeyW")).toBe(true); // Still down
    });

    it("should reset mouse deltas on beginFrame", () => {
      inputState.mouseDX = 10;
      inputState.mouseDY = -5;
      inputState.wheelDX = 3;
      inputState.wheelDY = 7;

      inputState.beginFrame();

      expect(inputState.mouseDX).toBe(0);
      expect(inputState.mouseDY).toBe(0);
      expect(inputState.wheelDX).toBe(0);
      expect(inputState.wheelDY).toBe(0);
    });

    it("should preserve mouse position on beginFrame", () => {
      inputState.mouseX = 100;
      inputState.mouseY = 200;

      inputState.beginFrame();

      expect(inputState.mouseX).toBe(100);
      expect(inputState.mouseY).toBe(200);
    });

    it("should preserve focus state on beginFrame", () => {
      inputState.hasFocus = false;

      inputState.beginFrame();

      expect(inputState.hasFocus).toBe(false);
    });
  });

  describe("clearAll functionality", () => {
    it("should clear all input state", () => {
      // Set up some state
      inputState._setKeyDown("KeyW");
      inputState._setKeyDown("KeyA");
      inputState.mouseX = 150;
      inputState.mouseY = 250;
      inputState.mouseDX = 10;
      inputState.mouseDY = -10;
      inputState.wheelDX = 5;
      inputState.wheelDY = -5;

      inputState.clearAll();

      // All keys should be released
      expect(inputState.isDown("KeyW")).toBe(false);
      expect(inputState.isDown("KeyA")).toBe(false);
      expect(inputState.wasPressed("KeyW")).toBe(false);
      expect(inputState.wasPressed("KeyA")).toBe(false);
      expect(inputState.wasReleased("KeyW")).toBe(false);
      expect(inputState.wasReleased("KeyA")).toBe(false);

      // Mouse deltas should be reset
      expect(inputState.mouseDX).toBe(0);
      expect(inputState.mouseDY).toBe(0);
      expect(inputState.wheelDX).toBe(0);
      expect(inputState.wheelDY).toBe(0);

      // Mouse position should be preserved (not part of clearAll)
      expect(inputState.mouseX).toBe(150);
      expect(inputState.mouseY).toBe(250);
    });
  });

  describe("edge cases", () => {
    it("should handle rapid key presses", () => {
      // Press and release in same frame
      inputState._setKeyDown("Space");
      inputState._setKeyUp("Space");

      expect(inputState.isDown("Space")).toBe(false);
      expect(inputState.wasPressed("Space")).toBe(true);
      expect(inputState.wasReleased("Space")).toBe(true);
    });

    it("should handle special key codes", () => {
      const specialKeys = [
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "Escape",
        "Enter",
      ];

      specialKeys.forEach((key) => {
        inputState._setKeyDown(key);
        expect(inputState.isDown(key)).toBe(true);
        expect(inputState.wasPressed(key)).toBe(true);

        inputState._setKeyUp(key);
        expect(inputState.isDown(key)).toBe(false);
        expect(inputState.wasReleased(key)).toBe(true);
      });
    });

    it("should handle empty key code", () => {
      inputState._setKeyDown("");
      expect(inputState.isDown("")).toBe(true);
      expect(inputState.wasPressed("")).toBe(true);

      inputState._setKeyUp("");
      expect(inputState.isDown("")).toBe(false);
      expect(inputState.wasReleased("")).toBe(true);
    });

    it("should maintain state consistency across multiple frames", () => {
      // Frame 1: Press key
      inputState._setKeyDown("KeyW");
      expect(inputState.isDown("KeyW")).toBe(true);
      expect(inputState.wasPressed("KeyW")).toBe(true);

      // Frame 2: Hold key
      inputState.beginFrame();
      expect(inputState.isDown("KeyW")).toBe(true);
      expect(inputState.wasPressed("KeyW")).toBe(false);

      // Frame 3: Release key
      inputState._setKeyUp("KeyW");
      expect(inputState.isDown("KeyW")).toBe(false);
      expect(inputState.wasReleased("KeyW")).toBe(true);

      // Frame 4: Key no longer held
      inputState.beginFrame();
      expect(inputState.isDown("KeyW")).toBe(false);
      expect(inputState.wasPressed("KeyW")).toBe(false);
      expect(inputState.wasReleased("KeyW")).toBe(false);
    });
  });

  describe("mouse state", () => {
    it("should allow direct mouse position updates", () => {
      inputState.mouseX = 300;
      inputState.mouseY = 400;

      expect(inputState.mouseX).toBe(300);
      expect(inputState.mouseY).toBe(400);
    });

    it("should allow mouse delta accumulation", () => {
      inputState.mouseDX = 5;
      inputState.mouseDY = -3;
      inputState.mouseDX += 2;
      inputState.mouseDY += 1;

      expect(inputState.mouseDX).toBe(7);
      expect(inputState.mouseDY).toBe(-2);
    });

    it("should allow wheel delta accumulation", () => {
      inputState.wheelDX = 10;
      inputState.wheelDY = -20;
      inputState.wheelDX += 5;
      inputState.wheelDY += 10;

      expect(inputState.wheelDX).toBe(15);
      expect(inputState.wheelDY).toBe(-10);
    });
  });

  describe("focus state", () => {
    it("should allow focus state changes", () => {
      expect(inputState.hasFocus).toBe(true);

      inputState.hasFocus = false;
      expect(inputState.hasFocus).toBe(false);

      inputState.hasFocus = true;
      expect(inputState.hasFocus).toBe(true);
    });
  });
});
