import type { SystemCtx, SyncSystemFn } from "../SystemCtx";
import type { EventBus } from "../EventBus";
import { InputEvent } from "./InputEvents";
import { InputState } from "./InputState";

export function createInputStateSystem(): {
  state: InputState;
  preUpdate: SyncSystemFn;
} {
  const state = new InputState();

  const createReaders = (events: EventBus) => ({
    focus: events.createReader(InputEvent.Focus),
    keyDown: events.createReader(InputEvent.KeyDown),
    keyUp: events.createReader(InputEvent.KeyUp),
    mouseMove: events.createReader(InputEvent.MouseMove),
    mouseWheel: events.createReader(InputEvent.MouseWheel),
  });
  let bus: EventBus | undefined;
  let readers: ReturnType<typeof createReaders>;

  const preUpdate: SyncSystemFn = (ctx: SystemCtx) => {
    if (bus !== ctx.events) {
      bus = ctx.events;
      readers = createReaders(bus);
    }
    state.beginFrame();

    for (const ev of readers.focus.read()) {
      state.hasFocus = ev.hasFocus;
      if (!ev.hasFocus) {
        // optional: clear all keys when focus lost
        // easiest: recreate sets by clearing down
        // (or add a clear method)
        // state.clearAll();
      }
    }

    for (const ev of readers.keyDown.read()) {
      // ignore repeats for "pressed" semantics
      if (!ev.repeat) state._setKeyDown(ev.code);
      else state._setKeyDown(ev.code); // still keep down=true
    }

    for (const ev of readers.keyUp.read()) {
      state._setKeyUp(ev.code);
    }

    for (const ev of readers.mouseMove.read()) {
      state.mouseX = ev.x;
      state.mouseY = ev.y;
      state.mouseDX += ev.dx;
      state.mouseDY += ev.dy;
    }

    for (const ev of readers.mouseWheel.read()) {
      state.wheelDX += ev.dx;
      state.wheelDY += ev.dy;
    }
  };

  return { state, preUpdate } as const;
}
