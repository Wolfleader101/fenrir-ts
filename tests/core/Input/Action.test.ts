import { describe, expect, expectTypeOf, it } from "vitest";
import { defineAction } from "@/index";
import type { ActionType, Input, InputBinding, InputDomEvent, InputDownHandler, InputEdge, InputGestureHandler, InputPointer, KeyCode, SystemCtx, TestGame, TestInput } from "@/index";

describe("defineAction", () => {
  it("returns a frozen action with its name and bindings, duplicates dropped", () => {
    const Tap = defineAction("test.action.tap", ["pointer.primary", "Space", "Space", "Enter"]);
    expect(Tap).toEqual({ name: "test.action.tap", bindings: ["pointer.primary", "Space", "Enter"] });
    expect(Object.isFrozen(Tap)).toBe(true);
    expect(Object.isFrozen(Tap.bindings)).toBe(true);
  });

  it("rejects an action with no bindings", () => {
    expect(() => defineAction("test.action.none", [])).toThrow(
      'Action "test.action.none" has no bindings. Pass at least one, such as defineAction("test.action.none", ["Space"]).',
    );
  });

  it("rejects, at run time, a binding a JavaScript caller got wrong", () => {
    for (const binding of [" ", "a", "space", "pointer.middle", "pointer"]) {
      expect(() => defineAction("test.action.bad", [binding as InputBinding])).toThrow(
        `Action "test.action.bad" is bound to "${binding}", which is not an input. Use a KeyboardEvent.code value`,
      );
    }
  });

  it("accepts every kind of key code", () => {
    const codes: KeyCode[] = ["KeyZ", "Digit0", "Numpad9", "F1", "F12", "F24", "ArrowUp", "ShiftLeft", "Backquote", "NumpadEnter", "Escape"];
    expect(defineAction("test.action.keys", codes).bindings).toEqual(codes);
  });
});

describe("input types", () => {
  it("makes an unknown binding a compile error", () => {
    expect(() => {
      // @ts-expect-error: KeyboardEvent.key values are not bindings; "Space" is the code.
      defineAction("test.types.key", [" "]);
      // @ts-expect-error: a letter key's code is "KeyA".
      defineAction("test.types.letter", ["A"]);
      // @ts-expect-error: there is no third pointer binding.
      defineAction("test.types.pointer", ["pointer.middle"]);
      // @ts-expect-error: F25 is past the function row.
      defineAction("test.types.f25", ["F25"]);
    }).toThrow();
  });

  it("types defineAction and the Input methods exactly", () => {
    expectTypeOf(defineAction).parameters.toEqualTypeOf<[name: string, bindings: readonly InputBinding[]]>();
    expectTypeOf(defineAction).returns.toEqualTypeOf<ActionType>();
    expectTypeOf<ActionType["bindings"]>().toEqualTypeOf<readonly InputBinding[]>();

    expectTypeOf<Input["pressed"]>().toEqualTypeOf<(action: ActionType) => boolean>();
    expectTypeOf<Input["released"]>().toEqualTypeOf<(action: ActionType) => boolean>();
    expectTypeOf<Input["held"]>().toEqualTypeOf<(action: ActionType) => boolean>();
    expectTypeOf<Input["consumePointer"]>().toEqualTypeOf<() => void>();
    expectTypeOf<Input["pointer"]>().toEqualTypeOf<InputPointer>();
    expectTypeOf<InputPointer>().toEqualTypeOf<{ readonly x: number; readonly y: number; readonly down: boolean; readonly inside: boolean; readonly cancelled: boolean }>();
    expectTypeOf<Input["focused"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Input["consume"]>().toEqualTypeOf<(action: ActionType) => void>();
    expectTypeOf<Input["edges"]>().toEqualTypeOf<(actions: readonly ActionType[]) => readonly InputEdge[]>();
    expectTypeOf<InputEdge>().toEqualTypeOf<{ readonly action: ActionType; readonly kind: "pressed" | "released"; readonly binding: InputBinding }>();
    expectTypeOf<Input["onDown"]>().toEqualTypeOf<(action: ActionType, handler: InputDownHandler) => () => void>();
    expectTypeOf<InputDownHandler>().toEqualTypeOf<(event: KeyboardEvent | PointerEvent | undefined, ctx: SystemCtx) => boolean | void>();
    expectTypeOf<Input["onGesture"]>().toEqualTypeOf<(handler: InputGestureHandler) => () => void>();

    expectTypeOf<TestGame["input"]>().toEqualTypeOf<TestInput>();
    expectTypeOf<TestInput["press"]>().toEqualTypeOf<(action: ActionType, event?: InputDomEvent) => boolean>();
    expectTypeOf<TestInput["pointerDown"]>().toEqualTypeOf<(x: number, y: number) => boolean>();
    expectTypeOf<TestInput["pointerCancel"]>().toEqualTypeOf<() => void>();
    expectTypeOf<TestInput["focus"]>().toEqualTypeOf<() => void>();
    expectTypeOf<TestInput["blur"]>().toEqualTypeOf<() => void>();
  });

  it("keeps the test calls off a real game's input", () => {
    // @ts-expect-error: press stands in for the player in a TestGame only.
    expectTypeOf<Input>().toHaveProperty("press");
  });
});
