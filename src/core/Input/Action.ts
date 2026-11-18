type KeyLetter =
  | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M"
  | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z";
type KeyDigit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
type KeyFunction = `F${Exclude<KeyDigit, "0">}` | `F1${KeyDigit}` | `F2${"0" | "1" | "2" | "3" | "4"}`;

/**
 * A `KeyboardEvent.code` value: the physical key, whatever the layout. These are the standard
 * sections of the UI Events "KeyboardEvent code Values" spec: the writing-system keys, the
 * functional keys, the control and arrow pads, the numpad and the function row. Media and
 * browser keys are left out.
 */
export type KeyCode =
  // Writing system
  | `Key${KeyLetter}` | `Digit${KeyDigit}`
  | "Backquote" | "Backslash" | "BracketLeft" | "BracketRight" | "Comma" | "Equal"
  | "IntlBackslash" | "IntlRo" | "IntlYen" | "Minus" | "Period" | "Quote" | "Semicolon" | "Slash"
  // Functional
  | "AltLeft" | "AltRight" | "Backspace" | "CapsLock" | "ContextMenu" | "ControlLeft" | "ControlRight"
  | "Enter" | "MetaLeft" | "MetaRight" | "ShiftLeft" | "ShiftRight" | "Space" | "Tab"
  | "Convert" | "KanaMode" | "NonConvert"
  // Control pad and arrow pad
  | "Delete" | "End" | "Help" | "Home" | "Insert" | "PageDown" | "PageUp"
  | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "ArrowUp"
  // Numpad
  | `Numpad${KeyDigit}` | "NumLock" | "NumpadAdd" | "NumpadComma" | "NumpadDecimal" | "NumpadDivide"
  | "NumpadEnter" | "NumpadEqual" | "NumpadMultiply" | "NumpadSubtract"
  // Function row
  | "Escape" | KeyFunction | "PrintScreen" | "ScrollLock" | "Pause";

/** The primary pointer (left mouse button, a finger, a pen tip) or the secondary one (right mouse button, pen barrel). */
export type PointerBinding = "pointer.primary" | "pointer.secondary";

/** What an action can be bound to: a key by `KeyboardEvent.code`, or a pointer button. */
export type InputBinding = KeyCode | PointerBinding;

/** A named action and the inputs that drive it. Made by `defineAction`. */
export interface ActionType {
  readonly name: string;
  readonly bindings: readonly InputBinding[];
}

const BINDING = /^(?:pointer\.(?:primary|secondary)|[A-Z][A-Za-z0-9]+)$/;

/**
 * Defines an action: something the player does, bound to keys and pointer buttons. Read it with
 * `ctx.input.pressed(Action)`, `released` and `held`. The action is held while any of its
 * bindings is down.
 *
 * Keys are `KeyboardEvent.code` values, which name the physical key: `"KeyA"`, `"Space"`,
 * `"ArrowLeft"`, `"Enter"`. Pointers are `"pointer.primary"` (mouse left button, a finger or a
 * pen) and `"pointer.secondary"` (mouse right button). Prefix names with a namespace for your
 * game or library; names starting with `fenrir.` are reserved for the engine.
 *
 * @example
 * export const Tap = defineAction("myGame.tap", ["pointer.primary", "Space", "Enter"]);
 */
/* @__NO_SIDE_EFFECTS__ */
export function defineAction(name: string, bindings: readonly InputBinding[]): ActionType {
  if (bindings.length === 0) {
    throw new TypeError(`Action "${name}" has no bindings. Pass at least one, such as defineAction("${name}", ["Space"]).`);
  }
  for (const binding of bindings) {
    if (!BINDING.test(binding)) {
      throw new TypeError(
        `Action "${name}" is bound to "${binding}", which is not an input. Use a KeyboardEvent.code value ` +
          `such as "KeyA", "Space" or "ArrowLeft" (the physical key, not the character), or "pointer.primary" or "pointer.secondary".`,
      );
    }
  }
  return Object.freeze({ name, bindings: Object.freeze([...new Set(bindings)]) });
}
