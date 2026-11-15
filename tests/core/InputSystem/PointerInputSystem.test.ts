import { describe, expect, it } from "vitest";
import { EventBus } from "../../../src/core/EventBus";
import { InputEvent } from "../../../src/core/InputSystem/InputEvents";
import { createPointerInputSystems } from "../../../src/core/InputSystem/PointerInputSystem";
import { createMockSystemCtx } from "../../utils/testHelpers";

describe("canvas pointer input", () => {
  it("publishes canvas-relative pointer data and removes listeners on exit", () => {
    const canvas = document.createElement("canvas");
    canvas.getBoundingClientRect = () => new DOMRect(10, 20, 100, 100);
    const events = new EventBus();
    const reader = events.createReader(InputEvent.PointerCancel);
    const input = createPointerInputSystems(canvas);
    input.init(createMockSystemCtx({ events }));
    const cancel = new PointerEvent("pointercancel", {
      pointerId: 7, pointerType: "touch", isPrimary: true, clientX: 40, clientY: 60,
    });
    canvas.dispatchEvent(cancel);
    expect(reader.read()).toEqual([expect.objectContaining({
      pointerId: 7, pointerType: "touch", isPrimary: true, x: 30, y: 40,
    })]);
    input.exit();
    canvas.dispatchEvent(cancel);
    expect(reader.read()).toEqual([]);
  });
});
