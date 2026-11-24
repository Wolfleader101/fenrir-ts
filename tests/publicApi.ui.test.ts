import { beforeAll, describe, expect, expectTypeOf, it, vi } from "vitest";
import { Container, Graphics } from "pixi.js";

// The UI entry's only peer is pixi.js. Each of these throws if it reaches another.
vi.mock("three", () => {
  throw new Error("fenrir-ts/ui imported three");
});
vi.mock("jolt-physics/wasm-compat", () => {
  throw new Error("fenrir-ts/ui imported jolt-physics");
});
vi.mock("monaco-editor", () => {
  throw new Error("fenrir-ts/ui imported monaco-editor");
});

/** `fenrir-ts` plus `fenrir-ts/ui`, imported the way a game does. */
let core: typeof import("@/index");
let kit: typeof import("@/ui");

beforeAll(async () => {
  core = await import("@/index");
  kit = await import("@/ui");
});

describe("fenrir-ts/ui public API", () => {
  it("exports the plugin, the control helpers, the focus resource and the event, and nothing internal", () => {
    expect(Object.keys(kit).sort()).toEqual([
      "ControlActivated",
      "UiFocus",
      "activateControl",
      "control",
      "listControls",
      "modalScope",
      "paginate",
      "ui",
    ]);
    expect("ui" in core).toBe(false);
  });

  it("drives a sheet of controls through createTestGame and TestInput, and shows them in inspect (#16, #17)", async () => {
    const { Schedule, createTestGame, defineAction, inspect, NullLogger } = core;
    const { ControlActivated, UiFocus, activateControl, control, listControls, modalScope, paginate, ui } = kit;
    const Enter = defineAction("publicApi.enter", ["Enter"]);
    const Tab = defineAction("publicApi.tab", ["Tab"]);

    const root = new Container();
    const game = await createTestGame({ seed: 1, logger: new NullLogger(), plugins: [ui({ root })] });
    const bought: string[] = [];
    const activated: unknown[] = [];
    game.on(ControlActivated, (payload) => void activated.push(payload));

    const sheet = root.addChild(new Container());
    game.addSystem(Schedule.Update, function drawShop(ctx) {
      for (const child of sheet.removeChildren()) child.destroy();
      modalScope(sheet, { label: "Shop" });
      const { rows } = paginate(["potion", "shield", "sword"], 2, 0);
      rows.forEach((item, i) => {
        const row = sheet.addChild(new Graphics().rect(0, 0, 100, 30).fill(0));
        row.y = i * 40;
        control(row, { id: `buy-${item}`, label: `Buy ${item}`, onActivate: (c) => void bought.push(`${item}@${c === ctx ? "ctx" : "?"}`) });
      });
    });
    await game.start();
    game.step();

    expectTypeOf(listControls(game)[0]!.bounds).toEqualTypeOf<import("@/ui").ControlBounds>();
    expect(listControls(game).map((c) => c.id)).toEqual(["buy-potion", "buy-shield"]);
    game.input.pointerDown(50, 50);
    game.input.pointerUp();
    game.step(1 / 60, 2);
    // The tap focused buy-shield, the last control: Tab leaves the canvas, and the next Tab comes back to the first.
    for (let i = 0; i < 2; i++) {
      game.input.press(Tab);
      game.input.release(Tab);
      game.step(1 / 60, 2);
    }
    game.input.press(Enter);
    game.input.release(Enter);
    game.step(1 / 60, 2);
    expect(activateControl(game, "buy-sword")).toBe(false); // on the next page

    expect(bought).toEqual(["shield@ctx", "potion@ctx"]);
    expect(activated).toEqual([{ id: "buy-shield", via: "pointer" }, { id: "buy-potion", via: "key" }]);
    expect(game.resources.get(UiFocus)).toEqual({ id: "buy-potion", visible: true });
    expect(inspect(game).resources["fenrir.UiControls"]).toMatchObject({ modal: "Shop", controls: [{ id: "buy-potion", focused: true }, { id: "buy-shield" }] });
    await game.stop();
  });
});
