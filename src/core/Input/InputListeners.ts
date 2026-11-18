import type { InputImpl } from "./Input";

/** Keys whose default, scrolling the page, is prevented while the canvas has focus. */
const SCROLL_KEYS = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/**
 * Internal. Listens on `canvas` for one run: keys while it has focus, and the primary pointer.
 * Everything is removed when `signal` aborts; `onCleanup` restores the canvas and clears input.
 *
 * Defaults prevented, all on the canvas only: page scroll on Space and the arrow keys, touch
 * scrolling and pinch zoom (`touch-action: none`), and the context menu. The one listener off
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
    if (SCROLL_KEYS.has(event.code)) event.preventDefault();
    if (event.code) input.setDown(event.code, true);
  }, options);
  canvas.addEventListener("keyup", (event) => {
    if (event.code) input.setDown(event.code, false);
  }, options);
  // Keyups after focus leaves never arrive, so nothing may stay held. The window losing focus blurs the canvas too.
  canvas.addEventListener("blur", release, options);
  canvas.ownerDocument.addEventListener("visibilitychange", () => {
    if (canvas.ownerDocument.visibilityState === "hidden") release();
  }, options);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault(), options);

  const onPointer = (event: PointerEvent): void => {
    // Only the primary pointer drives input: a second finger is ignored.
    if (!event.isPrimary || (active !== undefined && event.pointerId !== active)) return;
    const bounds = canvas.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    input.setPoint({ x, y }, x >= 0 && y >= 0 && x <= bounds.width && y <= bounds.height);

    // Buttons come from the bitmask: a second mouse button arrives as a pointermove, not a pointerdown.
    input.setDown("pointer.primary", (event.buttons & 1) !== 0);
    input.setDown("pointer.secondary", (event.buttons & 2) !== 0);

    if (event.type === "pointerdown") {
      active = event.pointerId;
      // Capture, so the release arrives even when the pointer leaves the canvas while down.
      canvas.setPointerCapture?.(event.pointerId);
      if (canvas.ownerDocument.activeElement !== canvas) canvas.focus({ preventScroll: true });
    }
    if (event.buttons === 0) active = undefined;
  };
  for (const type of ["pointerdown", "pointermove", "pointerup"] as const) {
    canvas.addEventListener(type, onPointer, options);
  }
  const cancel = (event: PointerEvent): void => {
    if (event.pointerId !== active) return;
    active = undefined;
    input.setDown("pointer.primary", false);
    input.setDown("pointer.secondary", false);
    input.leave();
  };
  canvas.addEventListener("pointercancel", cancel, options);
  canvas.addEventListener("lostpointercapture", cancel, options);
  canvas.addEventListener("pointerleave", (event) => {
    if (event.isPrimary && active === undefined) input.leave();
  }, options);
}
