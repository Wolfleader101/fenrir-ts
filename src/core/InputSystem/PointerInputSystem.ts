import type { SystemCtx } from "../SystemCtx";
import { InputEvent } from "./InputEvents";

export function createPointerInputSystems(canvas: HTMLCanvasElement) {
  let listeners: AbortController | undefined;

  return {
    init({ events }: SystemCtx): void {
      if (listeners) return;
      listeners = new AbortController();
      const options = { signal: listeners.signal };
      const bindings = [
        ["pointerdown", InputEvent.PointerDown],
        ["pointerup", InputEvent.PointerUp],
        ["pointermove", InputEvent.PointerMove],
        ["pointercancel", InputEvent.PointerCancel],
      ] as const;

      for (const [name, eventType] of bindings) {
        canvas.addEventListener(name, (event) => {
          const bounds = canvas.getBoundingClientRect();
          events.send(eventType, {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            isPrimary: event.isPrimary,
            button: event.button,
            buttons: event.buttons,
            x: event.clientX - bounds.left,
            y: event.clientY - bounds.top,
          });
        }, options);
      }
    },

    exit(): void {
      listeners?.abort();
      listeners = undefined;
    },
  };
}
