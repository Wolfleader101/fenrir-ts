import type { SystemFn } from "../SystemCtx";
import { InputEvent } from "./InputEvents";
import { InputState } from "./InputState";

export function createInputStateSystem(): {
  state: InputState;
  preUpdate: SystemFn;
} {
  const state = new InputState();

  const preUpdate: SystemFn = (ctx) => {
    state.beginFrame();

    for (const ev of ctx.events.read(InputEvent.Focus)) {
      state.hasFocus = ev.hasFocus;
      if (!ev.hasFocus) {
        // optional: clear all keys when focus lost
        // easiest: recreate sets by clearing down
        // (or add a clear method)
      }
    }

    for (const ev of ctx.events.read(InputEvent.KeyDown)) {
      // ignore repeats for "pressed" semantics
      if (!ev.repeat) state._setKeyDown(ev.code);
      else state._setKeyDown(ev.code); // still keep down=true
    }

    for (const ev of ctx.events.read(InputEvent.KeyUp)) {
      state._setKeyUp(ev.code);
    }

    for (const ev of ctx.events.read(InputEvent.MouseMove)) {
      state.mouseX = ev.x;
      state.mouseY = ev.y;
      state.mouseDX += ev.dx;
      state.mouseDY += ev.dy;
    }

    for (const ev of ctx.events.read(InputEvent.MouseWheel)) {
      state.wheelDX += ev.dx;
      state.wheelDY += ev.dy;
    }
  };

  return { state, preUpdate } as const;
}
