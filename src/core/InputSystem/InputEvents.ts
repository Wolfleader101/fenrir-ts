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
  KeyDown: defineEvent<KeyEvent>("fenrir.input.keyDown"),
  KeyUp: defineEvent<KeyEvent>("fenrir.input.keyUp"),

  MouseDown: defineEvent<MouseButtonEvent>("fenrir.input.mouseDown"),
  MouseUp: defineEvent<MouseButtonEvent>("fenrir.input.mouseUp"),
  MouseMove: defineEvent<MouseMoveEvent>("fenrir.input.mouseMove"),
  MouseWheel: defineEvent<MouseWheelEvent>("fenrir.input.mouseWheel"),

  Focus: defineEvent<FocusEvent>("fenrir.input.focus"),
} as const;
