import { afterEach, describe, expect, it, vi } from "vitest";
import { Container, Graphics, Circle } from "pixi.js";
import { Schedule, createTestGame, defineAction, inspect, type SystemCtx, type TestGame } from "@/index";
import { NullLogger } from "@/core/NullLogger";
import {
  ControlActivated,
  UiFocus,
  activateControl,
  control,
  listControls,
  modalScope,
  moveFocus,
  paginate,
  syncUi,
  ui,
  type ControlOptions,
  type UiOptions,
} from "@/ui";

const Tab = defineAction("test.tab", ["Tab"]);
const Shift = defineAction("test.shift", ["ShiftLeft"]);
const Down = defineAction("test.down", ["ArrowDown"]);
const Enter = defineAction("test.enter", ["Enter"]);
const Escape = defineAction("test.escape", ["Escape"]);
/** What a gameplay system bound to the same inputs would see. */
const GameTap = defineAction("test.gameTap", ["pointer.primary"]);

/** A 40 x 20 button drawn at (x, y). */
function button(parent: Container, x: number, y: number, options: ControlOptions): Graphics {
  const node = new Graphics().rect(0, 0, 40, 20).fill(0xffffff);
  node.position.set(x, y);
  parent.addChild(node);
  return control(node, options);
}

const games: TestGame[] = [];
afterEach(async () => {
  for (const game of games.splice(0)) if (game.isRunning()) await game.stop();
});

async function setUp(options: Omit<UiOptions, "root"> = {}) {
  const root = new Container();
  const logger = new NullLogger();
  const warn = vi.spyOn(logger, "warn");
  const game = await createTestGame({ seed: 1, logger, plugins: [ui({ root, ...options })] });
  games.push(game);
  const seen = { gameTaps: 0, gameEnters: 0, gameEscapes: 0, activated: [] as unknown[] };
  game.on(ControlActivated, (payload) => void seen.activated.push(payload));
  game.addSystem(Schedule.Update, function gameplay({ input }: SystemCtx) {
    if (input.pressed(GameTap)) seen.gameTaps++;
    if (input.pressed(Enter)) seen.gameEnters++;
    if (input.pressed(Escape)) seen.gameEscapes++;
  });
  await game.start();
  game.input.focus();
  // The press is seen in the first frame and the release, which activates, in the next.
  const tap = (x: number, y: number): void => {
    game.input.pointerDown(x, y);
    game.input.pointerUp();
    game.step(1 / 60, 2);
  };
  const key = (action: typeof Tab): void => {
    game.input.press(action);
    game.input.release(action);
    game.step(1 / 60, 2);
  };
  const focus = (): string | null => game.resources.get(UiFocus).id;
  return { root, game, warn, seen, tap, key, focus };
}

describe("control: pointer", () => {
  it("activates on press and release over the same control, once, and keeps the tap from later systems", async () => {
    const { root, game, seen, tap } = await setUp();
    const onActivate = vi.fn();
    button(root, 10, 10, { id: "buy", label: "Buy", onActivate });

    tap(20, 15);
    expect(onActivate).toHaveBeenCalledOnce();
    expect(onActivate).toHaveBeenCalledWith(expect.objectContaining({ input: game.input }), "pointer");
    expect(seen.activated).toEqual([{ id: "buy", via: "pointer" }]);
    expect(seen.gameTaps).toBe(0);

    // Failure path: a tap beside the control reaches the game and activates nothing.
    tap(100, 100);
    expect(onActivate).toHaveBeenCalledOnce();
    expect(seen.gameTaps).toBe(1);
  });

  it("activates on release over the same control, over several frames, and not after sliding off or a cancel", async () => {
    const { root, game, seen } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 100, 0, { id: "b", label: "B" });

    game.input.pointerDown(10, 10);
    game.step();
    game.input.pointerMove(110, 10);
    game.step();
    game.input.pointerUp();
    game.step();
    expect(seen.activated).toEqual([]);

    game.input.pointerDown(10, 10);
    game.step();
    game.input.pointerCancel();
    game.step();
    expect(seen.activated).toEqual([]);

    game.input.pointerDown(10, 10);
    game.step(1 / 60, 3);
    game.input.pointerUp();
    game.step();
    expect(seen.activated).toEqual([{ id: "a", via: "pointer" }]);
  });

  it("hits the topmost control where two overlap, and uses hitArea for round and enlarged targets", async () => {
    const { root, seen, tap } = await setUp();
    button(root, 0, 0, { id: "under", label: "Under" });
    button(root, 20, 0, { id: "over", label: "Over" });
    const round = control(new Graphics().circle(0, 0, 10).fill(0), { id: "round", label: "Round", hitArea: new Circle(0, 0, 10) });
    round.position.set(200, 200);
    const small = control(new Graphics().rect(0, 0, 4, 4).fill(0), { id: "small", label: "Small", hitArea: { x: -20, y: -20, width: 44, height: 44 } });
    small.position.set(300, 300);
    root.addChild(round, small);

    tap(30, 10);
    tap(208, 208); // inside the circle's square but outside the circle
    tap(205, 205);
    tap(285, 285);
    expect(seen.activated).toEqual([
      { id: "over", via: "pointer" },
      { id: "round", via: "pointer" },
      { id: "small", via: "pointer" },
    ]);
  });

  it("hit-tests in the root's units through scaled and rotated parents", async () => {
    const { root, seen, tap } = await setUp();
    const sheet = new Container();
    sheet.position.set(100, 50);
    sheet.scale.set(2);
    root.addChild(sheet);
    button(sheet, 10, 10, { id: "scaled", label: "Scaled" }); // covers 120..200 x 70..110 in root units

    tap(115, 75);
    expect(seen.activated).toEqual([]);
    tap(190, 105);
    expect(seen.activated).toEqual([{ id: "scaled", via: "pointer" }]);
  });

  it("is live only while its node is in the scene, visible and renderable", async () => {
    const { root, game, seen, tap } = await setUp();
    const sheet = new Container();
    root.addChild(sheet);
    const node = button(sheet, 0, 0, { id: "x", label: "X" });

    sheet.visible = false; // a hidden parent hides the control
    tap(10, 10);
    sheet.visible = true;
    node.renderable = false;
    tap(10, 10);
    node.renderable = true;
    sheet.removeFromParent();
    tap(10, 10);
    expect(seen.activated).toEqual([]);
    expect(listControls(game)).toEqual([]);

    root.addChild(sheet);
    tap(10, 10);
    expect(seen.activated).toEqual([{ id: "x", via: "pointer" }]);
    node.destroy();
    expect(listControls(game)).toEqual([]);
  });

  it("updates a control when control() is called again on its node", async () => {
    const { root, seen, tap } = await setUp();
    const node = button(root, 0, 0, { id: "old", label: "Old" });
    control(node, { id: "new", label: "New" });
    tap(10, 10);
    expect(seen.activated).toEqual([{ id: "new", via: "pointer" }]);
  });

  it("never activates a disabled control, but still keeps its tap from the game", async () => {
    const { root, seen, tap } = await setUp();
    const onActivate = vi.fn();
    button(root, 0, 0, { id: "buy", label: "Buy", disabled: true, onActivate });
    tap(10, 10);
    expect(onActivate).not.toHaveBeenCalled();
    expect(seen.activated).toEqual([]);
    expect(seen.gameTaps).toBe(0);
  });

  it("ignores a later live control with the same id, and warns once", async () => {
    const { root, game, seen, warn, tap } = await setUp();
    button(root, 0, 0, { id: "dup", label: "First" });
    button(root, 100, 0, { id: "dup", label: "Second" });
    tap(110, 10);
    tap(110, 10);
    expect(seen.activated).toEqual([]);
    expect(seen.gameTaps).toBe(2);
    expect(listControls(game).map((c) => c.label)).toEqual(["First"]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]![0]).toContain('"dup"');
  });

  it("throws for a control with no id or label", () => {
    expect(() => control(new Container(), { id: "", label: "x" })).toThrow(/id/);
    expect(() => control(new Container(), { id: "a" } as ControlOptions)).toThrow(/label/);
  });
});

describe("control: keyboard", () => {
  it("moves focus with Tab in display order, then with order, and Shift+Tab goes back", async () => {
    const { root, game, focus, key } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    const sheet = new Container();
    root.addChild(sheet);
    button(sheet, 0, 50, { id: "b", label: "B" });
    button(root, 0, 100, { id: "c", label: "C" });

    key(Tab);
    expect(focus()).toBe("a");
    key(Tab);
    expect(focus()).toBe("b");
    key(Tab);
    expect(focus()).toBe("c");
    game.input.press(Shift);
    key(Tab);
    game.input.release(Shift);
    game.step();
    expect(focus()).toBe("b");

    // order overrides display order: lower first.
    control(root.children[0] as Container, { id: "a", label: "A", order: 1 });
    expect(listControls(game).map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("keeps Tab on the canvas while a control is next, and lets it leave past either end", async () => {
    const { root, game, focus, key } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });

    const tab = (shiftKey = false): boolean => {
      const claimed = game.input.press(Tab, new KeyboardEvent("keydown", { code: "Tab", shiftKey }));
      game.input.release(Tab);
      game.step(1 / 60, 2);
      return claimed;
    };
    expect(tab()).toBe(true);
    expect(tab()).toBe(true);
    expect(focus()).toBe("b");
    expect(tab()).toBe(false); // past the last control: the browser moves focus on
    expect(focus()).toBeNull();

    expect(tab(true)).toBe(true); // Shift+Tab back in lands on the last control
    expect(focus()).toBe("b");
    expect(tab(true)).toBe(true);
    expect(tab(true)).toBe(false); // past the first
    expect(focus()).toBeNull();

    // With no control, Tab is never claimed.
    root.removeChildren();
    expect(tab()).toBe(false);
    key(Tab);
    expect(focus()).toBeNull();
  });

  it("activates the focused control with Enter and consumes it, and leaves Enter to the game with no focus", async () => {
    const { root, seen, key } = await setUp();
    const onActivate = vi.fn();
    button(root, 0, 0, { id: "a", label: "A", onActivate });

    key(Enter);
    expect(onActivate).not.toHaveBeenCalled();
    expect(seen.gameEnters).toBe(1);

    key(Tab);
    key(Enter);
    expect(onActivate).toHaveBeenCalledWith(expect.anything(), "key");
    expect(seen.activated).toEqual([{ id: "a", via: "key" }]);
    expect(seen.gameEnters).toBe(1);
  });

  it("moves with the arrows, wrapping, only once a control has focus", async () => {
    const { root, focus, key, game } = await setUp();
    const ArrowGame = vi.fn();
    game.addSystem(Schedule.Update, function arrows({ input }: SystemCtx) {
      if (input.pressed(Down)) ArrowGame();
    });
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });

    key(Down);
    expect(focus()).toBeNull();
    expect(ArrowGame).toHaveBeenCalledOnce();

    key(Tab);
    key(Down);
    expect(focus()).toBe("b");
    key(Down);
    expect(focus()).toBe("a");
    expect(ArrowGame).toHaveBeenCalledOnce();
  });

  it("keeps focus across a clear-and-redraw with the same id, and clears it when the id is gone", async () => {
    const { root, game, focus, key } = await setUp();
    let ids = ["a", "b"];
    const redraw = (): void => {
      for (const child of root.removeChildren()) child.destroy();
      ids.forEach((id, i) => button(root, 0, i * 50, { id, label: id }));
    };
    game.addSystem(Schedule.Update, function sheet() {
      redraw(); // every frame, as a sheet rebuilt from state
    });
    redraw();
    key(Tab);
    key(Tab);
    expect(focus()).toBe("b");
    game.step(1 / 60, 3);
    expect(focus()).toBe("b");
    // No nodes left behind: the two buttons, and the ring the kit put back after the redraw.
    expect(root.children.map((child) => child.label === "fenrir.ui.focusRing")).toEqual([false, false, true]);

    ids = ["a", "c"];
    game.step(1 / 60, 2);
    expect(focus()).toBeNull();
  });

  it("lets the game set focus through UiFocus, and clears an id that is not live", async () => {
    const { root, game, seen, focus, key } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });
    game.resources.get(UiFocus).id = "b";
    key(Enter);
    expect(seen.activated).toEqual([{ id: "b", via: "key" }]);

    game.resources.get(UiFocus).id = "missing";
    game.step();
    expect(focus()).toBeNull();
  });

  it("focuses a tapped control without showing the ring", async () => {
    const { root, game, tap } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    tap(10, 10);
    expect(game.resources.get(UiFocus)).toEqual({ id: "a", visible: false });
  });
});

describe("modalScope", () => {
  it("takes taps and focus only inside the top scope, keeps every tap from the game, and closes on Escape", async () => {
    const { root, game, seen, tap, key, focus } = await setUp();
    button(root, 0, 0, { id: "hud", label: "HUD" });
    const sheet = new Container();
    root.addChild(sheet);
    const onClose = vi.fn((ctx: SystemCtx) => {
      expect(ctx.input).toBe(game.input);
      sheet.visible = false;
    });
    modalScope(sheet, { label: "Shop", onClose });
    button(sheet, 0, 100, { id: "buy", label: "Buy" });

    tap(10, 10); // the HUD is under the sheet
    tap(200, 200); // nothing there, but the sheet is modal
    expect(seen.activated).toEqual([]);
    expect(seen.gameTaps).toBe(0);
    expect(activateControl(game, "hud")).toBe(false);
    expect(listControls(game).map(({ id, blocked }) => ({ id, blocked }))).toEqual([
      { id: "buy", blocked: false },
      { id: "hud", blocked: true },
    ]);
    key(Tab);
    expect(focus()).toBe("buy");

    key(Escape);
    expect(onClose).toHaveBeenCalledOnce();
    expect(seen.gameEscapes).toBe(0);
    expect(focus()).toBeNull(); // buy went with the sheet

    tap(10, 10);
    expect(seen.activated).toEqual([{ id: "hud", via: "pointer" }]);
    key(Escape); // no scope: Escape is the game's
    expect(seen.gameEscapes).toBe(1);
  });

  it("nests: the scope shown last is on top, and the one below returns when it is destroyed", async () => {
    const { root, game, seen, tap } = await setUp();
    const lower = modalScope(new Container(), { label: "Lower" });
    const upper = modalScope(new Container(), { label: "Upper" });
    root.addChild(upper); // drawn first, under lower...
    upper.visible = false;
    root.addChild(lower);
    button(lower, 0, 0, { id: "lower", label: "Lower" });
    button(upper, 100, 0, { id: "upper", label: "Upper" });
    game.step();
    upper.visible = true; // ...but shown last, so on top
    tap(10, 10);
    expect(seen.activated).toEqual([]);
    expect(inspect(game).resources["fenrir.UiControls"]).toMatchObject({ modal: "Upper" });
    tap(110, 10);
    expect(seen.activated).toEqual([{ id: "upper", via: "pointer" }]);

    upper.destroy({ children: true });
    tap(10, 10);
    expect(seen.activated).toEqual([{ id: "upper", via: "pointer" }, { id: "lower", via: "pointer" }]);
  });
});

describe("test helpers and inspection", () => {
  it("activateControl and listControls work between steps, and inspect shows the controls", async () => {
    const { root, game, seen } = await setUp();
    button(root, 10, 20, { id: "a", label: "Play" });
    button(root, 10, 60, { id: "off", label: "Off", disabled: true });

    expect(activateControl(game, "a")).toBe(true);
    expect(activateControl(game, "off")).toBe(false);
    expect(activateControl(game, "missing")).toBe(false);
    expect(seen.activated).toEqual([{ id: "a", via: "call" }]);
    expect(listControls(game)).toEqual([
      { id: "a", label: "Play", disabled: false, focused: false, blocked: false, bounds: { x: 10, y: 20, width: 40, height: 20 } },
      { id: "off", label: "Off", disabled: true, focused: false, blocked: false, bounds: { x: 10, y: 60, width: 40, height: 20 } },
    ]);

    game.step();
    const snapshot = inspect(game);
    expect(snapshot.schedule.preUpdate).toContain("fenrir.ui.preUpdate");
    expect(snapshot.resources["fenrir.UiControls"]).toEqual({ modal: null, controls: listControls(game) });
    expect(snapshot.resources["fenrir.UiFocus"]).toEqual({ id: null, visible: false });
  });

  it("throws without the plugin, and when ui() has neither pixi nor root", async () => {
    const game = await createTestGame({ seed: 1, logger: new NullLogger() });
    expect(() => listControls(game)).toThrow(/no ui\(\) plugin/);
    expect(() => activateControl(game, "a")).toThrow(/no ui\(\) plugin/);
    await expect(createTestGame({ seed: 1, logger: new NullLogger(), plugins: [ui()] })).rejects.toThrow(/list pixi2d\(\) before ui\(\)/);
  });

  it("leaves no state, focus or ring behind after stop(), and works again on the next start", async () => {
    const { root, game, key, tap, seen } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    key(Tab);
    game.step();
    const ring = root.children.find((child) => child.label === "fenrir.ui.focusRing");
    expect(ring?.visible).toBe(true);
    game.input.pointerDown(10, 10);
    game.step();

    await game.stop();
    expect(ring?.destroyed).toBe(true);
    expect(root.children.map((child) => child.label)).not.toContain("fenrir.ui.focusRing");
    expect(game.resources.get(UiFocus).id).toBeNull();
    expect(inspect(game).resources["fenrir.UiControls"]).toEqual({ modal: null, controls: [] });
    expect(() => activateControl(game, "a")).toThrow(/not running/);

    await game.start();
    tap(10, 10);
    expect(seen.activated).toEqual([{ id: "a", via: "pointer" }]);
  });
});

describe("focus ring", () => {
  it("draws the game's ring around the focused control while the canvas has focus, and none with focusRing: false", async () => {
    const drawer = vi.fn();
    const { root, game, key } = await setUp({ focusRing: drawer });
    button(root, 10, 20, { id: "a", label: "A" });
    key(Tab);
    game.step();
    expect(drawer).toHaveBeenCalledOnce(); // redrawn only when the box changes
    expect(drawer.mock.calls[0]![1]).toEqual({ x: 10, y: 20, width: 40, height: 20 });
    const ring = root.children.at(-1)!;
    expect(ring.label).toBe("fenrir.ui.focusRing");
    game.input.blur();
    game.step();
    expect(ring.visible).toBe(false);

    const bare = await setUp({ focusRing: false });
    button(bare.root, 0, 0, { id: "a", label: "A" });
    bare.key(Tab);
    expect(bare.root.children).toHaveLength(1);
  });
});

describe("paginate", () => {
  it("returns the page's rows, the clamped page and the page count", () => {
    const rows = [1, 2, 3, 4, 5];
    expect(paginate(rows, 2, 0)).toEqual({ rows: [1, 2], page: 0, pages: 3 });
    expect(paginate(rows, 2, 2)).toEqual({ rows: [5], page: 2, pages: 3 });
    expect(paginate(rows, 2, 9)).toEqual({ rows: [5], page: 2, pages: 3 });
    expect(paginate(rows, 2, -1)).toEqual({ rows: [1, 2], page: 0, pages: 3 });
    expect(paginate([], 4, 3)).toEqual({ rows: [], page: 0, pages: 1 });
    expect(() => paginate(rows, 0, 0)).toThrow(RangeError);
    expect(() => paginate(rows, 1.5, 0)).toThrow(RangeError);
  });
});

const NumpadEnter = defineAction("test.numpadEnter", ["NumpadEnter"]);
const Up = defineAction("test.up", ["ArrowUp"]);
/** A game key that opens a sheet. Bound to Enter, which the kit leaves to the game while nothing is focused. */
const Open = defineAction("test.open", ["Enter"]);

describe("one ordered pass over the kit's keys and the game's actions", () => {
  /** A game whose Open key draws a modal sheet with a close control, closed by Escape. */
  async function withSheet(onActionResult: boolean | undefined = true) {
    const opened: string[] = [];
    const sheet = new Container();
    const draw = (open: boolean): void => {
      for (const child of sheet.removeChildren()) child.destroy();
      sheet.visible = open;
      if (open) button(sheet, 0, 100, { id: "close", label: "Close" });
    };
    modalScope(sheet, { label: "Sheet", onClose: () => (opened.push("closed"), draw(false)) });
    const ctx = await setUp({
      actions: [Open],
      onAction: (_ctx, action) => {
        opened.push(action.name);
        draw(true);
        return onActionResult;
      },
    });
    ctx.root.addChild(sheet);
    draw(false);
    return { ...ctx, opened, sheet };
  }

  it("opens a sheet with Enter and closes it with an Escape typed after it in the same frame", async () => {
    const { game, opened, seen, sheet } = await withSheet();
    game.input.press(Open);
    game.input.release(Open);
    game.input.press(Escape);
    game.input.release(Escape);
    game.step();
    expect(opened).toEqual(["test.open", "closed"]);
    expect(sheet.visible).toBe(false);
    expect([seen.gameEnters, seen.gameEscapes]).toEqual([0, 0]); // both consumed
  });

  it("keeps the order the other way round: Escape first is the game's, then Enter opens", async () => {
    const { game, opened, seen, sheet } = await withSheet();
    game.input.press(Escape);
    game.input.release(Escape);
    game.input.press(Open);
    game.input.release(Open);
    game.step();
    expect(opened).toEqual(["test.open"]);
    expect(sheet.visible).toBe(true);
    expect(seen.gameEscapes).toBe(1);
  });

  it("lets the press through to later systems when onAction does not return true", async () => {
    const { game, seen } = await withSheet(false);
    game.input.press(Open);
    game.step();
    expect(seen.gameEnters).toBe(1);
  });

  it("acts first on a key it uses: Enter on a focused control activates it and never reaches onAction", async () => {
    const { root, opened, seen, key } = await withSheet();
    button(root, 0, 0, { id: "a", label: "A" });
    key(Tab);
    key(Enter);
    expect(seen.activated).toEqual([{ id: "a", via: "key" }]);
    expect(opened).toEqual([]);
  });

  it("throws for actions without onAction", () => {
    expect(() => ui({ root: new Container(), actions: [Open] })).toThrow(/onAction/);
  });
});

describe("press-time and pass-through controls", () => {
  it('activates an activateOn: "press" control in the frame of the press, once, and keeps the tap from the game', async () => {
    const { root, game, seen } = await setUp();
    button(root, 0, 0, { id: "cast", label: "Cast", activateOn: "press" });
    game.input.pointerDown(10, 10);
    game.step();
    expect(seen.activated).toEqual([{ id: "cast", via: "pointer" }]);
    game.input.pointerUp();
    game.step(1 / 60, 2);
    expect(seen.activated).toHaveLength(1);
    expect(seen.gameTaps).toBe(0);
  });

  it("still activates on release by default, and never activates a disabled press control", async () => {
    const { root, game, seen, tap } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 100, 0, { id: "off", label: "Off", activateOn: "press", disabled: true });
    game.input.pointerDown(10, 10);
    game.step();
    expect(seen.activated).toEqual([]);
    game.input.pointerUp();
    game.step();
    expect(seen.activated).toEqual([{ id: "a", via: "pointer" }]);
    tap(110, 10);
    expect(seen.activated).toHaveLength(1);
    expect(seen.gameTaps).toBe(0);
  });

  it("lets a passThrough control's press reach the game, even in a modal scope, and still activates it", async () => {
    const { root, seen, tap, focus } = await setUp();
    const sheet = modalScope(root.addChild(new Container()), { label: "Play" });
    button(sheet, 0, 0, { id: "fish", label: "Fish", passThrough: true, activateOn: "press" });
    tap(10, 10);
    expect(seen.gameTaps).toBe(1);
    expect(seen.activated).toEqual([{ id: "fish", via: "pointer" }]);
    expect(focus()).toBe("fish");
    tap(200, 200); // not on it: the scope keeps the tap
    expect(seen.gameTaps).toBe(1);
  });
});

describe("arrows and moveFocus", () => {
  it("in linear mode, moves from no focus, stops at the ends, and consumes the arrows while a control is live", async () => {
    const { root, game, focus, key } = await setUp({ arrows: "linear" });
    const arrowsForGame = vi.fn();
    game.addSystem(Schedule.Update, function arrows({ input }: SystemCtx) {
      if (input.pressed(Down) || input.pressed(Up)) arrowsForGame();
    });
    key(Down); // no control: the game's
    expect(arrowsForGame).toHaveBeenCalledOnce();

    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });
    key(Down);
    expect(focus()).toBe("a");
    key(Down);
    key(Down);
    expect(focus()).toBe("b"); // stopped at the end
    key(Up);
    key(Up);
    expect(focus()).toBe("a");
    game.resources.get(UiFocus).id = null;
    key(Up);
    expect(focus()).toBe("b"); // from no focus, previous goes to the last
    expect(arrowsForGame).toHaveBeenCalledOnce();
    expect(game.resources.get(UiFocus).visible).toBe(true);
  });

  it("still wraps and waits for focus by default", async () => {
    const { root, focus, key } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });
    key(Down);
    expect(focus()).toBeNull();
    key(Tab);
    key(Up);
    expect(focus()).toBe("b");
  });

  it("moveFocus moves by delta from game or ctx, stops or wraps, and returns the focused id", async () => {
    const { root, game, focus } = await setUp();
    expect(moveFocus(game, 1)).toBeNull(); // nothing live
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });
    button(root, 0, 100, { id: "c", label: "C" });
    expect(moveFocus(game, 1)).toBe("a");
    expect(moveFocus(game, 5)).toBe("c");
    expect(moveFocus(game, 1, true)).toBe("a");
    expect(moveFocus(game, -1)).toBe("a");
    expect(moveFocus(game, 0)).toBe("a");
    game.addSystem(Schedule.Update, function fromCtx(ctx: SystemCtx) {
      if (focus() === "a") moveFocus(ctx, 2);
    });
    game.step();
    expect(game.resources.get(UiFocus)).toEqual({ id: "c", visible: true });
    const bare = await createTestGame({ seed: 1, logger: new NullLogger() });
    expect(() => moveFocus(bare, 1)).toThrow(/no ui\(\) plugin/);
  });
});

describe("tap focus", () => {
  it("keeps focus on a tap elsewhere by default", async () => {
    const { root, focus, key, tap } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    key(Tab);
    tap(200, 200);
    expect(focus()).toBe("a");
  });

  it('clears focus on every press with tapFocus: "clear", and still activates the tapped control', async () => {
    const { root, focus, key, tap, seen } = await setUp({ tapFocus: "clear" });
    button(root, 0, 0, { id: "a", label: "A" });
    key(Tab);
    tap(200, 200);
    expect(focus()).toBeNull();
    key(Tab);
    tap(10, 10);
    expect(focus()).toBeNull();
    expect(seen.activated).toEqual([{ id: "a", via: "pointer" }]);
    key(Enter); // nothing focused: Enter is the game's again
    expect(seen.gameEnters).toBe(1);
  });
});

describe("focus across scope changes", () => {
  it("does not carry focus to a control with the same id in a different scope", async () => {
    const { root, game, focus, key } = await setUp();
    const first = modalScope(root.addChild(new Container()), { label: "First" });
    button(first, 0, 0, { id: "close", label: "Close" });
    key(Tab);
    expect(focus()).toBe("close");
    first.destroy({ children: true });
    const second = modalScope(root.addChild(new Container()), { label: "Second" });
    button(second, 0, 0, { id: "close", label: "Close" });
    game.step();
    expect(focus()).toBeNull();
  });

  it("keeps focus when the same scope node is redrawn, and when the game sets it after the change", async () => {
    const { root, game, focus, key } = await setUp();
    const sheet = modalScope(root.addChild(new Container()), { label: "Sheet" });
    button(sheet, 0, 0, { id: "close", label: "Close" });
    button(sheet, 0, 50, { id: "ok", label: "OK" });
    key(Tab);
    for (const child of sheet.removeChildren()) child.destroy();
    button(sheet, 0, 0, { id: "close", label: "Close" });
    game.step();
    expect(focus()).toBe("close");

    sheet.destroy({ children: true });
    const other = modalScope(root.addChild(new Container()), { label: "Other" });
    button(other, 0, 0, { id: "yes", label: "Yes" });
    game.resources.get(UiFocus).id = "yes";
    game.step();
    expect(focus()).toBe("yes");
  });

  it("focuses a scope's focus control when it comes on top, keeping the ring as it was", async () => {
    const { root, game, focus, key } = await setUp();
    button(root, 0, 0, { id: "open", label: "Open" });
    key(Tab);
    const sheet = modalScope(new Container(), { label: "Sheet", focus: "close" });
    button(sheet, 0, 0, { id: "help", label: "Help" });
    button(sheet, 0, 50, { id: "close", label: "Close" });
    root.addChild(sheet);
    game.step();
    expect(game.resources.get(UiFocus)).toEqual({ id: "close", visible: true });
    sheet.visible = false;
    game.step();
    expect(focus()).toBeNull();
  });
});

describe("output in the frame of the change", () => {
  it("shows the ring in the frame a system in Update moves focus", async () => {
    const { root, game } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    let moveNow = false;
    game.addSystem(Schedule.Update, function focusFromGame({ resources }: SystemCtx) {
      if (moveNow) Object.assign(resources.get(UiFocus), { id: "a", visible: true });
    });
    game.step();
    moveNow = true;
    game.step();
    const ring = root.children.find((child) => child.label === "fenrir.ui.focusRing")!;
    expect(ring.visible).toBe(true);
    const { schedule } = inspect(game);
    expect(schedule.postUpdate).toContain("fenrir.ui.postUpdate");
    expect(schedule.postInit).toContain("fenrir.ui.postInit");
  });

  it("syncUi throws while the game is not running", async () => {
    const { game } = await setUp();
    await game.stop();
    expect(() => syncUi(game)).toThrow(/not running/);
  });
});

describe("activate keys and quick presses", () => {
  it("activates the focused control with NumpadEnter by default", async () => {
    const { root, seen, key } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    key(Tab);
    key(NumpadEnter);
    expect(seen.activated).toEqual([{ id: "a", via: "key" }]);
  });

  it("activates both controls of a tap followed by a press on another in the very next frame", async () => {
    const { root, game, seen } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 100, 0, { id: "b", label: "B" });
    game.input.pointerDown(10, 10);
    game.input.pointerUp();
    game.step(); // the tap on a, consumed
    game.input.pointerDown(110, 10);
    game.step();
    game.input.pointerUp();
    game.step();
    expect(seen.activated).toEqual([{ id: "a", via: "pointer" }, { id: "b", via: "pointer" }]);
    expect(seen.gameTaps).toBe(0);
  });

  it("moves focus twice for a consumed Tab pressed again before the next frame", async () => {
    const { root, game, focus } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });
    game.input.press(Tab);
    game.step();
    game.input.release(Tab);
    game.input.press(Tab);
    game.step();
    expect(focus()).toBe("b");
  });
});

describe("the five behaviours consumers adapted after #77 (#78)", () => {
  const Left = defineAction("test.left", ["ArrowLeft"]);
  const tabEvent = (shiftKey = false): KeyboardEvent => new KeyboardEvent("keydown", { code: "Tab", shiftKey });

  /** A HUD control whose Enter opens a modal sheet with no `focus` option, closed by Escape. */
  async function withHudSheet() {
    const ctx = await setUp();
    const sheet = new Container();
    const draw = (open: boolean): void => {
      for (const child of sheet.removeChildren()) child.destroy();
      sheet.visible = open;
      if (open) button(sheet, 0, 100, { id: "close", label: "Close" });
    };
    modalScope(sheet, { label: "Sheet", onClose: () => draw(false) });
    button(ctx.root, 0, 0, { id: "hud", label: "HUD", onActivate: () => draw(true) });
    ctx.root.addChild(sheet);
    draw(false);
    return { ...ctx, sheet };
  }

  it("clears focus on a control a scope blocks as soon as the scope opens: Enter then Escape in one frame", async () => {
    const { game, focus, key, sheet } = await withHudSheet();
    key(Tab);
    expect(focus()).toBe("hud");
    game.input.press(Enter);
    game.input.release(Enter);
    game.input.press(Escape);
    game.input.release(Escape);
    game.step();
    expect(sheet.visible).toBe(false);
    expect(focus()).toBeNull(); // as with a frame between the keys
  });

  it("clears it the same way with a frame between the keys", async () => {
    const { focus, key, sheet } = await withHudSheet();
    key(Tab);
    key(Enter);
    expect(sheet.visible).toBe(true);
    key(Escape);
    expect(sheet.visible).toBe(false);
    expect(focus()).toBeNull();
  });

  it("keeps Tab on the canvas while a kit key typed before it waits for the frame", async () => {
    const { root, game, focus, key } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });
    key(Tab);
    key(Tab);
    expect(focus()).toBe("b");

    game.input.press(Left); // moves focus back to a in the frame
    expect(game.input.press(Tab, tabEvent())).toBe(true); // so Tab stays, and goes on to b
    game.input.release(Left);
    game.input.release(Tab);
    game.step(1 / 60, 2);
    expect(focus()).toBe("b");

    // Nothing waiting: past the last control, Tab leaves as before.
    expect(game.input.press(Tab, tabEvent())).toBe(false);
    game.input.release(Tab);
  });

  it("keeps Tab on the canvas while a press of one of the game's actions waits for the frame", async () => {
    const Bag = defineAction("test.bag", ["KeyB"]);
    const onAction = vi.fn(() => true);
    const { root, game, focus, key } = await setUp({ actions: [Bag], onAction });
    button(root, 0, 0, { id: "a", label: "A" });
    key(Tab);
    expect(focus()).toBe("a");
    game.input.press(Bag); // onAction may draw a sheet the Tab then moves into
    expect(game.input.press(Tab, tabEvent())).toBe(true);
    game.input.release(Bag);
    game.input.release(Tab);
    game.step();
    expect(onAction).toHaveBeenCalledOnce();
  });

  it("takes Tabs still waiting for the frame into account: a second Tab past the end leaves", async () => {
    const { root, game, focus } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });
    expect(game.input.press(Tab, tabEvent())).toBe(true);
    game.input.release(Tab);
    expect(game.input.press(Tab, tabEvent())).toBe(true);
    game.input.release(Tab);
    expect(game.input.press(Tab, tabEvent())).toBe(false); // a, b, then past the end
    game.input.release(Tab);
    game.step();
    expect(focus()).toBeNull();
  });

  it('with arrows: "clear", steps off either end to no focus, staying on the canvas', async () => {
    const { root, game, focus, key } = await setUp({ arrows: "clear" });
    const arrowsForGame = vi.fn();
    game.addSystem(Schedule.Update, function arrows({ input }: SystemCtx) {
      if (input.pressed(Down) || input.pressed(Up)) arrowsForGame();
    });
    key(Down); // no control: the game's
    expect(arrowsForGame).toHaveBeenCalledOnce();

    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });
    key(Down);
    expect(focus()).toBe("a");
    key(Down);
    expect(focus()).toBe("b");
    key(Down);
    expect(focus()).toBeNull(); // past the last
    key(Down);
    expect(focus()).toBe("a"); // starts again from no focus
    key(Up);
    expect(focus()).toBeNull(); // past the first
    key(Up);
    expect(focus()).toBe("b");
    expect(arrowsForGame).toHaveBeenCalledOnce(); // the kit's whenever a control is live
  });

  it('with blurFocus: "clear", clears focus while the canvas lacks keyboard focus', async () => {
    const { root, game, focus, key } = await setUp({ blurFocus: "clear" });
    button(root, 0, 0, { id: "a", label: "A" });
    button(root, 0, 50, { id: "b", label: "B" });
    key(Tab);
    key(Tab);
    expect(focus()).toBe("b");
    game.input.blur();
    game.step();
    expect(focus()).toBeNull();
    game.resources.get(UiFocus).id = "a"; // set while blurred: cleared too
    game.step();
    expect(focus()).toBeNull();
    game.input.focus();
    key(Tab);
    expect(focus()).toBe("a"); // starts again from the first
  });

  it("keeps focus across a blur by default", async () => {
    const { root, game, focus, key } = await setUp();
    button(root, 0, 0, { id: "a", label: "A" });
    key(Tab);
    game.input.blur();
    game.step();
    expect(focus()).toBe("a");
  });

  it("leaves Enter on a focused passThrough control unconsumed for gameplay, and still activates it", async () => {
    const { root, seen, key } = await setUp();
    button(root, 0, 0, { id: "fish", label: "Fish", passThrough: true, activateOn: "press" });
    button(root, 0, 50, { id: "shop", label: "Shop" });
    key(Tab);
    key(Enter);
    expect(seen.activated).toEqual([{ id: "fish", via: "key" }]);
    expect(seen.gameEnters).toBe(1); // gameplay sees the press as its own
    key(Tab);
    key(Enter);
    expect(seen.activated).toEqual([{ id: "fish", via: "key" }, { id: "shop", via: "key" }]);
    expect(seen.gameEnters).toBe(1); // a control without passThrough consumes it
  });

  it("sends neither a key nor a pointer press on a passThrough control to onAction", async () => {
    const onAction = vi.fn(() => false);
    const { root, seen, key, tap } = await setUp({ actions: [Open, GameTap], onAction });
    button(root, 0, 0, { id: "fish", label: "Fish", passThrough: true, activateOn: "press" });
    key(Tab);
    key(Enter);
    tap(10, 10);
    expect(onAction).not.toHaveBeenCalled();
    expect([seen.gameEnters, seen.gameTaps]).toEqual([1, 1]);
    tap(200, 200); // on no control: the game's action
    expect(onAction).toHaveBeenCalledExactlyOnceWith(expect.anything(), GameTap);
  });
});
