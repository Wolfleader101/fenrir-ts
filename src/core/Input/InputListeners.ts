import type { InputImpl } from "./Input";

/** Keys whose default, scrolling the page, is prevented while the canvas has focus. */
const SCROLL_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/**
 * Internal. Listens on `canvas` for one run: keys while it has focus, and the primary pointer.
 * Everything is removed when `signal` aborts; `onCleanup` restores the canvas and clears input.
 *
 * Defaults prevented, all on the canvas only: page scroll on Space and the arrow keys, touch
 * scrolling and pinch zoom (`touch-action: none`), the context menu, and any key or pointer
 * press an `onDown` handler claims. The one listener off
 * the canvas is `visibilitychange` on its document, which only releases input.
 */
export function listenOnCanvas(
  input: InputImpl,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
  onCleanup: (cleanup: () => void) => void,
): void {
  const options = { signal };
  // Keyboard events reach a canvas only while it has focus, and it can take focus only with a tabindex.
  const setTabIndex = !canvas.hasAttribute("tabindex");
  if (setTabIndex) canvas.tabIndex = 0;
  const touchAction = canvas.style.touchAction;
  canvas.style.touchAction = "none";
  onCleanup(() => {
    if (setTabIndex) canvas.removeAttribute("tabindex");
    canvas.style.touchAction = touchAction;
    input.reset();
  });

  let active: number | undefined;
  const release = (): void => {
    active = undefined;
    input.releaseAll();
  };

  canvas.addEventListener("keydown", (event) => {
    // onDown handlers decide the default inside the event, before the press is latched.
    const claimed = event.code ? input.claim(event.code, event) : false;
    if (claimed || SCROLL_KEYS.has(event.code)) event.preventDefault();
    if (!event.repeat) input.gesture(event);
    if (event.code) input.setDown(event.code, true);
  }, options);
  canvas.addEventListener("keyup", (event) => {
    if (event.code) input.setDown(event.code, false);
  }, options);
  input.setFocus(canvas.ownerDocument.activeElement === canvas);
  canvas.addEventListener("focus", () => input.setFocus(true), options);
  // Keyups after focus leaves never arrive, so nothing may stay held. The window losing focus blurs the canvas too.
  canvas.addEventListener("blur", () => {
    input.setFocus(false);
    release();
  }, options);
  canvas.ownerDocument.addEventListener("visibilitychange", () => {
    if (canvas.ownerDocument.visibilityState === "hidden") release();
  }, options);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault(), options);

  const onPointer = (event: PointerEvent): void => {
    // Every press and lift is a user gesture, whichever pointer made it.
    if (event.type !== "pointermove") input.gesture(event);
    // Only the primary pointer drives input: a second finger is ignored.
    if (!event.isPrimary || (active !== undefined && event.pointerId !== active)) return;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    input.setPoint({ x, y }, x >= 0 && y >= 0 && x <= bounds.width && y <= bounds.height);

    // Buttons come from the bitmask: a second mouse button arrives as a pointermove, not a pointerdown.
    const primary = (event.buttons & 1) !== 0;
    const secondary = (event.buttons & 2) !== 0;
    let claimed = false;
    if (primary && !input.isDown("pointer.primary")) claimed = input.claim("pointer.primary", event);
    if (secondary && !input.isDown("pointer.secondary")) claimed = input.claim("pointer.secondary", event) || claimed;
    if (claimed) event.preventDefault();
    input.setDown("pointer.primary", primary);
    input.setDown("pointer.secondary", secondary);

    if (event.type === "pointerdown") {
      active = event.pointerId;
      if (canvas.ownerDocument.activeElement !== canvas) canvas.focus({ preventScroll: true });
      // Capture, so the release arrives even when the pointer leaves the canvas while down. It
      // throws for a pointer the browser no longer tracks, such as one already lifted.
      try {
        canvas.setPointerCapture?.(event.pointerId);
      } catch {
        // Not captured: the release still arrives while the pointer is over the canvas.
      }
    }
    if (event.buttons === 0) active = undefined;
  };
  for (const type of ["pointerdown", "pointermove", "pointerup"] as const) {
    canvas.addEventListener(type, onPointer, options);
  }
  const cancel = (event: PointerEvent): void => {
    if (event.pointerId !== active) return;
    active = undefined;
    input.cancelPointer();
  };
  canvas.addEventListener("pointercancel", cancel, options);
  canvas.addEventListener("lostpointercapture", cancel, options);
  canvas.addEventListener("pointerleave", (event) => {
    if (event.isPrimary && active === undefined) input.leave();
  }, options);
}
