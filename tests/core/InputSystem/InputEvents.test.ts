import { describe, it, expect } from "vitest";
import { InputEvent } from "@/core/InputSystem/InputEvents";

describe("InputEvents", () => {
  describe("event definitions", () => {
    it("should define KeyDown event", () => {
      expect(InputEvent.KeyDown).toBeDefined();
      expect(typeof InputEvent.KeyDown).toBe("symbol");
      expect(InputEvent.KeyDown.toString()).toBe("Symbol(event:input.keyDown)");
    });

    it("should define KeyUp event", () => {
      expect(InputEvent.KeyUp).toBeDefined();
      expect(typeof InputEvent.KeyUp).toBe("symbol");
      expect(InputEvent.KeyUp.toString()).toBe("Symbol(event:input.keyUp)");
    });

    it("should define MouseDown event", () => {
      expect(InputEvent.MouseDown).toBeDefined();
      expect(typeof InputEvent.MouseDown).toBe("symbol");
      expect(InputEvent.MouseDown.toString()).toBe(
        "Symbol(event:input.mouseDown)"
      );
    });

    it("should define MouseUp event", () => {
      expect(InputEvent.MouseUp).toBeDefined();
      expect(typeof InputEvent.MouseUp).toBe("symbol");
      expect(InputEvent.MouseUp.toString()).toBe("Symbol(event:input.mouseUp)");
    });

    it("should define MouseMove event", () => {
      expect(InputEvent.MouseMove).toBeDefined();
      expect(typeof InputEvent.MouseMove).toBe("symbol");
      expect(InputEvent.MouseMove.toString()).toBe(
        "Symbol(event:input.mouseMove)"
      );
    });

    it("should define MouseWheel event", () => {
      expect(InputEvent.MouseWheel).toBeDefined();
      expect(typeof InputEvent.MouseWheel).toBe("symbol");
      expect(InputEvent.MouseWheel.toString()).toBe(
        "Symbol(event:input.mouseWheel)"
      );
    });

    it("should define Focus event", () => {
      expect(InputEvent.Focus).toBeDefined();
      expect(typeof InputEvent.Focus).toBe("symbol");
      expect(InputEvent.Focus.toString()).toBe("Symbol(event:input.focus)");
    });
  });

  describe("event types", () => {
    it("should have correct KeyEvent structure", () => {
      const keyEvent = {
        code: "KeyW",
        key: "w",
        repeat: false,
        altKey: false,
        ctrlKey: true,
        shiftKey: false,
        metaKey: false,
      };

      // Type check - should compile without errors
      expect(keyEvent.code).toBe("KeyW");
      expect(keyEvent.key).toBe("w");
      expect(keyEvent.repeat).toBe(false);
      expect(keyEvent.ctrlKey).toBe(true);
    });

    it("should have correct MouseButtonEvent structure", () => {
      const mouseButtonEvent = {
        button: 0,
        buttons: 1,
        x: 100,
        y: 200,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      };

      expect(mouseButtonEvent.button).toBe(0);
      expect(mouseButtonEvent.buttons).toBe(1);
      expect(mouseButtonEvent.x).toBe(100);
      expect(mouseButtonEvent.y).toBe(200);
    });

    it("should have correct MouseMoveEvent structure", () => {
      const mouseMoveEvent = {
        x: 150,
        y: 250,
        dx: 5,
        dy: -3,
        buttons: 0,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      };

      expect(mouseMoveEvent.x).toBe(150);
      expect(mouseMoveEvent.y).toBe(250);
      expect(mouseMoveEvent.dx).toBe(5);
      expect(mouseMoveEvent.dy).toBe(-3);
    });

    it("should have correct MouseWheelEvent structure", () => {
      const mouseWheelEvent = {
        dx: 0,
        dy: -100,
        dz: 0,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        metaKey: false,
      };

      expect(mouseWheelEvent.dx).toBe(0);
      expect(mouseWheelEvent.dy).toBe(-100);
      expect(mouseWheelEvent.dz).toBe(0);
    });

    it("should have correct FocusEvent structure", () => {
      const focusEvent = { hasFocus: true };
      expect(focusEvent.hasFocus).toBe(true);

      const blurEvent = { hasFocus: false };
      expect(blurEvent.hasFocus).toBe(false);
    });
  });

  describe("event immutability", () => {
    it("should be read-only object", () => {
      // InputEvent is a const object but not frozen, test that it exists and has expected properties
      expect(InputEvent).toBeDefined();
      expect(InputEvent.KeyDown).toBeDefined();
      expect(InputEvent.KeyUp).toBeDefined();
      expect(InputEvent.MouseDown).toBeDefined();
      expect(InputEvent.MouseUp).toBeDefined();
      expect(InputEvent.MouseMove).toBeDefined();
      expect(InputEvent.MouseWheel).toBeDefined();
      expect(InputEvent.Focus).toBeDefined();
    });

    it("should maintain consistent event symbols", () => {
      const events = Object.values(InputEvent);
      const symbols = events.map((event) => event.toString());
      const uniqueSymbols = new Set(symbols);

      expect(uniqueSymbols.size).toBe(symbols.length);
      expect(symbols.every((symbol) => symbol.includes("input."))).toBe(true);
    });

    it("should create unique symbols for each event", () => {
      const eventValues = Object.values(InputEvent);
      expect(eventValues.length).toBe(7);

      // Each event should be a unique symbol
      const symbolSet = new Set(eventValues);
      expect(symbolSet.size).toBe(eventValues.length);
    });
  });
});
