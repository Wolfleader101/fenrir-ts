import { defineEvent } from "../EventQueue";

export type KeyEvent = {
  code: string; // e.g. "KeyW"
  key: string; // e.g. "w"
  repeat: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

export type MouseButtonEvent = {
  button: number; // 0 L, 1 M, 2 R
  buttons: number; // bitmask from DOM
  x: number;
  y: number;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

export type MouseMoveEvent = {
  x: number;
  y: number;
  dx: number;
  dy: number;
  buttons: number;
  altKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

export type MouseWheelEvent = {
  dx: number;
  dy: number;
  dz: number;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
};

export type FocusEvent = { hasFocus: boolean };

export const InputEvent = {
  KeyDown: defineEvent<KeyEvent>("input.keyDown"),
  KeyUp: defineEvent<KeyEvent>("input.keyUp"),

  MouseDown: defineEvent<MouseButtonEvent>("input.mouseDown"),
  MouseUp: defineEvent<MouseButtonEvent>("input.mouseUp"),
  MouseMove: defineEvent<MouseMoveEvent>("input.mouseMove"),
  MouseWheel: defineEvent<MouseWheelEvent>("input.mouseWheel"),

  Focus: defineEvent<FocusEvent>("input.focus"),
} as const;
