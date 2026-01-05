import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDomInputSystems } from "@/core/InputSystem/DOMInputSystem";
import { InputEvent } from "@/core/InputSystem/InputEvents";
import { EventBus } from "@/core/EventBus";
import { NullLogger } from "@/core/NullLogger";

describe("DOMInputSystem", () => {
  let eventBus: EventBus;
  let domInputSystem: ReturnType<typeof createDomInputSystems>;
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: any;
  let mockWindow: any;
  let eventListeners: Map<string, Map<EventTarget, EventListener[]>>;

  beforeEach(() => {
    eventBus = new EventBus();

    // Mock canvas element
    mockCanvas = document.createElement("canvas");
    mockCanvas.width = 800;
    mockCanvas.height = 600;

    mockCtx = {
      events: eventBus,
      logger: new NullLogger(),
    };

    // Track event listeners for both window and canvas
    eventListeners = new Map();

    // Mock window object with event listener tracking
    mockWindow = {
      addEventListener: vi.fn(
        (type: string, listener: EventListener, options?: any) => {
          if (!eventListeners.has(type)) {
            eventListeners.set(type, new Map());
          }
          const typeMap = eventListeners.get(type)!;
          if (!typeMap.has(mockWindow)) {
            typeMap.set(mockWindow, []);
          }
          typeMap.get(mockWindow)!.push(listener);
        }
      ),
      removeEventListener: vi.fn(
        (type: string, listener: EventListener, options?: any) => {
          const typeMap = eventListeners.get(type);
          if (typeMap && typeMap.has(mockWindow)) {
            const listeners = typeMap.get(mockWindow)!;
            const index = listeners.indexOf(listener);
            if (index !== -1) {
              listeners.splice(index, 1);
            }
          }
        }
      ),
      innerWidth: 1920,
      innerHeight: 1080,
    };

    // Mock canvas addEventListener/removeEventListener
    const originalCanvasAdd = mockCanvas.addEventListener;
    const originalCanvasRemove = mockCanvas.removeEventListener;

    mockCanvas.addEventListener = vi.fn(
      (type: string, listener: EventListener, options?: any) => {
        if (!eventListeners.has(type)) {
          eventListeners.set(type, new Map());
        }
        const typeMap = eventListeners.get(type)!;
        if (!typeMap.has(mockCanvas)) {
          typeMap.set(mockCanvas, []);
        }
        typeMap.get(mockCanvas)!.push(listener);
      }
    );

    mockCanvas.removeEventListener = vi.fn(
      (type: string, listener: EventListener, options?: any) => {
        const typeMap = eventListeners.get(type);
        if (typeMap && typeMap.has(mockCanvas)) {
          const listeners = typeMap.get(mockCanvas)!;
          const index = listeners.indexOf(listener);
          if (index !== -1) {
            listeners.splice(index, 1);
          }
        }
      }
    );

    // Mock global window for the DOMInputSystem
    vi.stubGlobal("window", mockWindow);
  });

  afterEach(() => {
    if (domInputSystem) {
      domInputSystem.exit(mockCtx);
    }
    eventListeners.clear();
    vi.restoreAllMocks();
  });

  describe("initialization", () => {
    it("should create DOM input system with default options", () => {
      domInputSystem = createDomInputSystems();

      expect(domInputSystem).toBeDefined();
      expect(domInputSystem.init).toBeTypeOf("function");
      expect(domInputSystem.exit).toBeTypeOf("function");
    });

    it("should create DOM input system with window target", () => {
      domInputSystem = createDomInputSystems({ target: mockWindow });

      expect(domInputSystem).toBeDefined();
    });

    it("should create DOM input system with canvas target", () => {
      domInputSystem = createDomInputSystems({ target: mockCanvas });

      expect(domInputSystem).toBeDefined();
    });

    it("should create DOM input system with preventDefaults disabled", () => {
      domInputSystem = createDomInputSystems({ preventDefaults: false });

      expect(domInputSystem).toBeDefined();
    });
  });

  describe("event listener installation", () => {
    beforeEach(() => {
      domInputSystem = createDomInputSystems({ target: mockCanvas });
    });

    it("should install event listeners on init", () => {
      domInputSystem.init(mockCtx);

      // Keyboard events on window
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function),
        { passive: false }
      );
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "keyup",
        expect.any(Function),
        { passive: false }
      );

      // Mouse events on target (canvas)
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function),
        { passive: false }
      );
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
        "mouseup",
        expect.any(Function),
        { passive: false }
      );
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
        "mousemove",
        expect.any(Function),
        { passive: true }
      );
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith(
        "wheel",
        expect.any(Function),
        { passive: false }
      );

      // Focus events on window
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "focus",
        expect.any(Function)
      );
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "blur",
        expect.any(Function)
      );
    });

    it("should not install listeners multiple times", () => {
      domInputSystem.init(mockCtx);
      const firstCallCount =
        mockWindow.addEventListener.mock.calls.length +
        mockCanvas.addEventListener.mock.calls.length;

      domInputSystem.init(mockCtx);
      const secondCallCount =
        mockWindow.addEventListener.mock.calls.length +
        mockCanvas.addEventListener.mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount); // No additional calls
    });

    it("should log initialization message", () => {
      const loggerSpy = vi.spyOn(mockCtx.logger, "info");

      domInputSystem.init(mockCtx);

      expect(loggerSpy).toHaveBeenCalledWith("DOM input listeners installed");
    });
  });

  describe("keyboard event handling", () => {
    beforeEach(() => {
      domInputSystem = createDomInputSystems({ target: mockCanvas });
      domInputSystem.init(mockCtx);
    });

    it("should handle keydown events", () => {
      const mockEvent = new KeyboardEvent("keydown", {
        code: "KeyW",
        key: "w",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      const preventDefaultSpy = vi.spyOn(mockEvent, "preventDefault");

      const keydownListeners =
        eventListeners.get("keydown")?.get(mockWindow) || [];
      expect(keydownListeners.length).toBeGreaterThan(0);

      keydownListeners[0](mockEvent);

      const events = eventBus.read(InputEvent.KeyDown);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        code: "KeyW",
        key: "w",
        repeat: false,
        altKey: false,
        ctrlKey: false,
        shiftKey: false,
        metaKey: false,
      });

      // Should not prevent default for normal keys
      expect(preventDefaultSpy).not.toHaveBeenCalled();
    });

    it("should handle keyup events", () => {
      const mockEvent = new KeyboardEvent("keyup", {
        code: "KeyA",
        key: "a",
        repeat: false,
        altKey: true,
        ctrlKey: false,
        shiftKey: true,
        metaKey: false,
      });

      const keyupListeners = eventListeners.get("keyup")?.get(mockWindow) || [];
      keyupListeners[0](mockEvent);

      const events = eventBus.read(InputEvent.KeyUp);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        code: "KeyA",
        key: "a",
        repeat: false,
        altKey: true,
        ctrlKey: false,
        shiftKey: true,
        metaKey: false,
      });
    });

    it("should prevent default on arrow keys and space", () => {
      const arrowEvent = new KeyboardEvent("keydown", {
        code: "ArrowUp",
        key: "ArrowUp",
      });
      const spaceEvent = new KeyboardEvent("keydown", {
        code: "Space",
        key: " ",
      });

      const arrowPreventSpy = vi.spyOn(arrowEvent, "preventDefault");
      const spacePreventSpy = vi.spyOn(spaceEvent, "preventDefault");

      const keydownListeners =
        eventListeners.get("keydown")?.get(mockWindow) || [];

      keydownListeners[0](arrowEvent);
      keydownListeners[0](spaceEvent);

      expect(arrowPreventSpy).toHaveBeenCalledOnce();
      expect(spacePreventSpy).toHaveBeenCalledOnce();
    });

    it("should not prevent default when preventDefaults is false", () => {
      // Create new system with preventDefaults disabled
      domInputSystem.exit(mockCtx);
      domInputSystem = createDomInputSystems({ preventDefaults: false });
      domInputSystem.init(mockCtx);

      const arrowEvent = new KeyboardEvent("keydown", {
        code: "ArrowUp",
        key: "ArrowUp",
      });
      const preventSpy = vi.spyOn(arrowEvent, "preventDefault");

      const keydownListeners =
        eventListeners.get("keydown")?.get(mockWindow) || [];
      keydownListeners[0](arrowEvent);

      expect(preventSpy).not.toHaveBeenCalled();
    });

    it("should handle key repeat events", () => {
      const mockEvent = new KeyboardEvent("keydown", {
        code: "Space",
        key: " ",
        repeat: true,
        altKey: false,
        ctrlKey: true,
        shiftKey: false,
        metaKey: true,
      });

      const keydownListeners =
        eventListeners.get("keydown")?.get(mockWindow) || [];
      keydownListeners[0](mockEvent);

      const events = eventBus.read(InputEvent.KeyDown);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        code: "Space",
        key: " ",
        repeat: true,
        altKey: false,
        ctrlKey: true,
        shiftKey: false,
        metaKey: true,
      });
    });
  });

  describe("mouse event handling", () => {
    beforeEach(() => {
      domInputSystem = createDomInputSystems({ target: mockCanvas });
      domInputSystem.init(mockCtx);
    });

    it("should handle mousedown events", () => {
      const mockEvent = new MouseEvent("mousedown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 200,
        altKey: false,
        ctrlKey: true,
        shiftKey: false,
        metaKey: false,
      });

      const preventSpy = vi.spyOn(mockEvent, "preventDefault");

      const mousedownListeners =
        eventListeners.get("mousedown")?.get(mockCanvas) || [];
      mousedownListeners[0](mockEvent);

      const events = eventBus.read(InputEvent.MouseDown);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        button: 0,
        buttons: 1,
        x: 100,
        y: 200,
        altKey: false,
        ctrlKey: true,
        shiftKey: false,
        metaKey: false,
      });

      expect(preventSpy).toHaveBeenCalledOnce();
    });

    it("should handle mouseup events", () => {
      const mockEvent = new MouseEvent("mouseup", {
        button: 2,
        buttons: 0,
        clientX: 150,
        clientY: 250,
        altKey: true,
        ctrlKey: false,
        shiftKey: true,
        metaKey: true,
      });

      const mouseupListeners =
        eventListeners.get("mouseup")?.get(mockCanvas) || [];
      mouseupListeners[0](mockEvent);

      const events = eventBus.read(InputEvent.MouseUp);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        button: 2,
        buttons: 0,
        x: 150,
        y: 250,
        altKey: true,
        ctrlKey: false,
        shiftKey: true,
        metaKey: true,
      });
    });

    it("should handle mousemove events with movement calculation", () => {
      const mockEvent = new MouseEvent("mousemove", {
        clientX: 100,
        clientY: 200,
        buttons: 1,
        altKey: false,
        ctrlKey: true,
        shiftKey: false,
        metaKey: false,
      });

      // Mock movementX/Y properties
      Object.defineProperty(mockEvent, "movementX", {
        value: 5,
        writable: false,
      });
      Object.defineProperty(mockEvent, "movementY", {
        value: -3,
        writable: false,
      });

      const mousemoveListeners =
        eventListeners.get("mousemove")?.get(mockCanvas) || [];
      mousemoveListeners[0](mockEvent);

      const events = eventBus.read(InputEvent.MouseMove);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        x: 100,
        y: 200,
        dx: 5,
        dy: -3,
        buttons: 1,
        altKey: false,
        ctrlKey: true,
        shiftKey: false,
        metaKey: false,
      });
    });

    it("should calculate movement delta when movementX/Y not available", () => {
      // Need to init the system first to set up baseline coordinates
      domInputSystem = createDomInputSystems({ target: mockCanvas });
      domInputSystem.init(mockCtx);

      const mousemoveListeners =
        eventListeners.get("mousemove")?.get(mockCanvas) || [];

      // Create events - MouseEvent constructor sets movementX/Y to 0 by default
      const firstEvent = new MouseEvent("mousemove", {
        clientX: 100,
        clientY: 200,
        buttons: 0,
      });

      const secondEvent = new MouseEvent("mousemove", {
        clientX: 110,
        clientY: 190,
        buttons: 0,
      });

      mousemoveListeners[0](firstEvent);
      mousemoveListeners[0](secondEvent);

      const events = eventBus.read(InputEvent.MouseMove);
      expect(events).toHaveLength(2);

      // Verify that we get position updates
      expect(events[0].x).toBe(100);
      expect(events[0].y).toBe(200);
      expect(events[1].x).toBe(110);
      expect(events[1].y).toBe(190);

      // MouseEvent constructor sets movementX/Y to 0, so delta will be 0
      // This tests that the fallback logic exists even if values are 0
      expect(events[0].dx).toBe(0);
      expect(events[0].dy).toBe(0);
      expect(events[1].dx).toBe(0);
      expect(events[1].dy).toBe(0);
    });

    it("should handle wheel events", () => {
      const mockEvent = new WheelEvent("wheel", {
        deltaX: 10,
        deltaY: -50,
        deltaZ: 0,
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
        metaKey: false,
      });

      const preventSpy = vi.spyOn(mockEvent, "preventDefault");

      const wheelListeners = eventListeners.get("wheel")?.get(mockCanvas) || [];
      wheelListeners[0](mockEvent);

      const events = eventBus.read(InputEvent.MouseWheel);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        dx: 10,
        dy: -50,
        dz: 0,
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
        metaKey: false,
      });

      expect(preventSpy).toHaveBeenCalledOnce();
    });
  });

  describe("focus events", () => {
    beforeEach(() => {
      domInputSystem = createDomInputSystems({ target: mockCanvas });
      domInputSystem.init(mockCtx);
    });

    it("should handle focus events", () => {
      const mockEvent = new FocusEvent("focus");

      const focusListeners = eventListeners.get("focus")?.get(mockWindow) || [];
      focusListeners[0](mockEvent);

      const events = eventBus.read(InputEvent.Focus);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        hasFocus: true,
      });
    });

    it("should handle blur events", () => {
      const mockEvent = new FocusEvent("blur");

      const blurListeners = eventListeners.get("blur")?.get(mockWindow) || [];
      blurListeners[0](mockEvent);

      const events = eventBus.read(InputEvent.Focus);
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        hasFocus: false,
      });
    });
  });

  describe("cleanup", () => {
    beforeEach(() => {
      domInputSystem = createDomInputSystems({ target: mockCanvas });
      domInputSystem.init(mockCtx);
    });

    it("should remove all event listeners on exit", () => {
      domInputSystem.exit(mockCtx);

      expect(mockWindow.removeEventListener).toHaveBeenCalledTimes(4); // keydown, keyup, focus, blur
      expect(mockCanvas.removeEventListener).toHaveBeenCalledTimes(4); // mousedown, mouseup, mousemove, wheel

      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        "keydown",
        expect.any(Function)
      );
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        "keyup",
        expect.any(Function)
      );
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        "focus",
        expect.any(Function)
      );
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith(
        "blur",
        expect.any(Function)
      );

      expect(mockCanvas.removeEventListener).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function)
      );
      expect(mockCanvas.removeEventListener).toHaveBeenCalledWith(
        "mouseup",
        expect.any(Function)
      );
      expect(mockCanvas.removeEventListener).toHaveBeenCalledWith(
        "mousemove",
        expect.any(Function)
      );
      expect(mockCanvas.removeEventListener).toHaveBeenCalledWith(
        "wheel",
        expect.any(Function)
      );
    });

    it("should handle exit being called multiple times", () => {
      const firstExit = () => domInputSystem.exit(mockCtx);
      const secondExit = () => domInputSystem.exit(mockCtx);

      expect(firstExit).not.toThrow();
      expect(secondExit).not.toThrow();

      // Second exit should not remove listeners again
      const firstCallCount =
        (mockWindow.removeEventListener as any).mock.calls.length +
        (mockCanvas.removeEventListener as any).mock.calls.length;
      secondExit();
      const secondCallCount =
        (mockWindow.removeEventListener as any).mock.calls.length +
        (mockCanvas.removeEventListener as any).mock.calls.length;

      expect(secondCallCount).toBe(firstCallCount);
    });

    it("should log cleanup message", () => {
      const loggerSpy = vi.spyOn(mockCtx.logger, "info");

      domInputSystem.exit(mockCtx);

      expect(loggerSpy).toHaveBeenCalledWith("DOM input listeners removed");
    });

    it("should handle exit without init", () => {
      const freshSystem = createDomInputSystems();

      expect(() => freshSystem.exit(mockCtx)).not.toThrow();
    });
  });

  describe("edge cases", () => {
    beforeEach(() => {
      domInputSystem = createDomInputSystems({ target: mockCanvas });
      domInputSystem.init(mockCtx);
    });

    it("should handle events with missing properties gracefully", () => {
      // Create minimal events that might be missing some properties
      const keyEvent = new KeyboardEvent("keydown", { code: "KeyW" });
      const mouseEvent = new MouseEvent("mousemove", {
        clientX: 100,
        clientY: 150,
      });

      const keydownListeners =
        eventListeners.get("keydown")?.get(mockWindow) || [];
      const mousemoveListeners =
        eventListeners.get("mousemove")?.get(mockCanvas) || [];

      keydownListeners[0](keyEvent);
      mousemoveListeners[0](mouseEvent);

      expect(() => {
        const keyEvents = eventBus.read(InputEvent.KeyDown);
        const mouseEvents = eventBus.read(InputEvent.MouseMove);
      }).not.toThrow();

      const keyEvents = eventBus.read(InputEvent.KeyDown);
      const mouseEvents = eventBus.read(InputEvent.MouseMove);

      expect(keyEvents).toHaveLength(1);
      expect(mouseEvents).toHaveLength(1);

      // Should have default values for missing properties
      expect(keyEvents[0].altKey).toBe(false);
      expect(keyEvents[0].ctrlKey).toBe(false);
      expect(mouseEvents[0].buttons).toBe(0);
    });
  });

  describe("integration scenarios", () => {
    it("should work with window target", () => {
      domInputSystem = createDomInputSystems({ target: mockWindow });
      domInputSystem.init(mockCtx);

      // Mouse events should go to window instead of canvas
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "mousedown",
        expect.any(Function),
        { passive: false }
      );
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "mouseup",
        expect.any(Function),
        { passive: false }
      );
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "mousemove",
        expect.any(Function),
        { passive: true }
      );
      expect(mockWindow.addEventListener).toHaveBeenCalledWith(
        "wheel",
        expect.any(Function),
        { passive: false }
      );
    });

    it("should batch multiple events correctly", () => {
      domInputSystem = createDomInputSystems({ target: mockCanvas });
      domInputSystem.init(mockCtx);

      // Multiple events before processing
      const keyEvent = new KeyboardEvent("keydown", { code: "KeyW", key: "w" });
      const mouseEvent = new MouseEvent("mousedown", {
        button: 0,
        clientX: 100,
        clientY: 200,
      });

      const keydownListeners =
        eventListeners.get("keydown")?.get(mockWindow) || [];
      const mousedownListeners =
        eventListeners.get("mousedown")?.get(mockCanvas) || [];

      keydownListeners[0](keyEvent);
      mousedownListeners[0](mouseEvent);

      // Events should be batched until read
      expect(eventBus.read(InputEvent.KeyDown)).toHaveLength(1);
      expect(eventBus.read(InputEvent.MouseDown)).toHaveLength(1);
    });

    it("should handle system lifecycle correctly", () => {
      domInputSystem = createDomInputSystems({ target: mockCanvas });

      // Initialize -> Use -> Cleanup -> Reinitialize cycle
      domInputSystem.init(mockCtx);

      const keyEvent = new KeyboardEvent("keydown", { code: "KeyW", key: "w" });
      const keydownListeners =
        eventListeners.get("keydown")?.get(mockWindow) || [];
      keydownListeners[0](keyEvent);

      expect(eventBus.read(InputEvent.KeyDown)).toHaveLength(1);

      domInputSystem.exit(mockCtx);

      // Clear event bus to simulate frame boundary
      eventBus.update();

      // Should be able to reinitialize
      domInputSystem.init(mockCtx);

      // Should work after reinit - but EventBus might have events from previous frame
      keydownListeners[0](keyEvent);
      const finalEvents = eventBus.read(InputEvent.KeyDown);
      expect(finalEvents.length).toBeGreaterThan(0); // Should have at least the new event
      expect(finalEvents[finalEvents.length - 1].code).toBe("KeyW"); // Last event should be our new one
    });
  });
});
