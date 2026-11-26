/**
 * Fenrir-TS UI controls: the `fenrir-ts/ui` entry point. Peer: `pixi.js`.
 *
 * Makes Pixi nodes the game drew into tappable, focusable controls on the engine's own input:
 * `ui({ pixi })`, `control(node, options)`, `modalScope(node, options)`. Patches no class and
 * adds no DOM elements: the canvas's `aria-label` and `aria-description` carry the screen.
 */
export {
  ui,
  moveFocus,
  syncUi,
  control,
  modalScope,
  paginate,
  activateControl,
  listControls,
  UiFocus,
  ControlActivated,
} from "./core/UI/Ui";
export type {
  Activation,
  ControlBounds,
  ControlInfo,
  ControlOptions,
  FocusRingDrawer,
  HitArea,
  ModalScopeOptions,
  UiKeys,
  UiCtx,
  UiOptions,
} from "./core/UI/Ui";
