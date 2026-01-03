import type { SystemFn } from "../SystemCtx";
import { InputEvent } from "./InputEvents";

export type DomInputOptions = {
  target?: Window | HTMLElement;
  preventDefaults?: boolean;
};

export function createDomInputSystems(opts: DomInputOptions = {}) {
  const target = opts.target ?? window;
  const prevent = opts.preventDefaults ?? true;

  let installed = false;
  let lastX = 0;
  let lastY = 0;

  const keyDown = (ctx: any) => (e: KeyboardEvent) => {
    if (prevent && (e.code.startsWith("Arrow") || e.code === "Space"))
      e.preventDefault();
    ctx.events.send(InputEvent.KeyDown, {
      code: e.code,
      key: e.key,
      repeat: e.repeat,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    });
  };

  const keyUp = (ctx: any) => (e: KeyboardEvent) => {
    if (prevent && (e.code.startsWith("Arrow") || e.code === "Space"))
      e.preventDefault();
    ctx.events.send(InputEvent.KeyUp, {
      code: e.code,
      key: e.key,
      repeat: e.repeat,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    });
  };

  const mouseDown = (ctx: any) => (e: MouseEvent) => {
    if (prevent) e.preventDefault();
    ctx.events.send(InputEvent.MouseDown, {
      button: e.button,
      buttons: e.buttons,
      x: e.clientX,
      y: e.clientY,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    });
  };

  const mouseUp = (ctx: any) => (e: MouseEvent) => {
    if (prevent) e.preventDefault();
    ctx.events.send(InputEvent.MouseUp, {
      button: e.button,
      buttons: e.buttons,
      x: e.clientX,
      y: e.clientY,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    });
  };

  const mouseMove = (ctx: any) => (e: MouseEvent) => {
    const dx = (e as any).movementX ?? e.clientX - lastX;
    const dy = (e as any).movementY ?? e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    ctx.events.send(InputEvent.MouseMove, {
      x: e.clientX,
      y: e.clientY,
      dx,
      dy,
      buttons: e.buttons,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    });
  };

  const wheel = (ctx: any) => (e: WheelEvent) => {
    if (prevent) e.preventDefault();
    ctx.events.send(InputEvent.MouseWheel, {
      dx: e.deltaX,
      dy: e.deltaY,
      dz: e.deltaZ,
      ctrlKey: e.ctrlKey,
      altKey: e.altKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey,
    });
  };

  const focus = (ctx: any) => (_e: Event) =>
    ctx.events.send(InputEvent.Focus, { hasFocus: true });
  const blur = (ctx: any) => (_e: Event) =>
    ctx.events.send(InputEvent.Focus, { hasFocus: false });

  // handler refs
  let hKeyDown: ((e: KeyboardEvent) => void) | null = null;
  let hKeyUp: ((e: KeyboardEvent) => void) | null = null;
  let hMouseDown: ((e: MouseEvent) => void) | null = null;
  let hMouseUp: ((e: MouseEvent) => void) | null = null;
  let hMouseMove: ((e: MouseEvent) => void) | null = null;
  let hWheel: ((e: WheelEvent) => void) | null = null;
  let hFocus: ((e: Event) => void) | null = null;
  let hBlur: ((e: Event) => void) | null = null;

  const init: SystemFn = (ctx) => {
    if (installed) return;
    installed = true;

    // reset mouse deltas baseline
    if (typeof window !== "undefined") {
      lastX = window.innerWidth * 0.5;
      lastY = window.innerHeight * 0.5;
    }

    hKeyDown = keyDown(ctx);
    hKeyUp = keyUp(ctx);
    hMouseDown = mouseDown(ctx);
    hMouseUp = mouseUp(ctx);
    hMouseMove = mouseMove(ctx);
    hWheel = wheel(ctx);
    hFocus = focus(ctx);
    hBlur = blur(ctx);

    // Keyboard events are usually best on window
    window.addEventListener("keydown", hKeyDown, { passive: !prevent });
    window.addEventListener("keyup", hKeyUp, { passive: !prevent });

    // Mouse events on target (window or canvas element)
    const el: any = target;
    el.addEventListener("mousedown", hMouseDown, { passive: !prevent });
    el.addEventListener("mouseup", hMouseUp, { passive: !prevent });
    el.addEventListener("mousemove", hMouseMove, { passive: true }); // movement only
    el.addEventListener("wheel", hWheel, { passive: !prevent });

    window.addEventListener("focus", hFocus);
    window.addEventListener("blur", hBlur);

    ctx.logger.info("DOM input listeners installed");
  };

  const exit: SystemFn = (ctx) => {
    if (!installed) return;
    installed = false;

    if (hKeyDown) window.removeEventListener("keydown", hKeyDown);
    if (hKeyUp) window.removeEventListener("keyup", hKeyUp);

    const el: any = target;
    if (hMouseDown) el.removeEventListener("mousedown", hMouseDown);
    if (hMouseUp) el.removeEventListener("mouseup", hMouseUp);
    if (hMouseMove) el.removeEventListener("mousemove", hMouseMove);
    if (hWheel) el.removeEventListener("wheel", hWheel);

    if (hFocus) window.removeEventListener("focus", hFocus);
    if (hBlur) window.removeEventListener("blur", hBlur);

    hKeyDown =
      hKeyUp =
      hMouseDown =
      hMouseUp =
      hMouseMove =
      hWheel =
      hFocus =
      hBlur =
        null;

    ctx.logger.info("DOM input listeners removed");
  };

  return { init, exit } as const;
}
