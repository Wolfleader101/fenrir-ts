import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SystemCtx } from "@/index";
import agentsMd from "../AGENTS.md?raw";
import thisFile from "./agentsExample.test.ts?raw";

/**
 * Runs the "Core model" example from AGENTS.md through the published core entry point, `fenrir-ts`.
 * Keep the body of `createExample` identical to the example in AGENTS.md, apart from
 * the destructured imports, so the documented code keeps compiling and running.
 */
type Core = typeof import("@/index");
let core: Core;

beforeAll(async () => {
  core = await import("@/index");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function createExample({ Schedule, createGame, defineComponent, defineEvent }: Core) {
  // --- AGENTS.md example starts ---
  type Health = { current: number; max: number };
  const Health = defineComponent<Health>("myGame.Health");
  const Damaged = defineEvent<{ amount: number }>("myGame.damaged");

  // Keep the query tuple in a constant: views are cached by array identity.
  const HEALTH_QUERY = [Health] as const;

  // A 2D game also passes plugins: [pixi2d()] from fenrir-ts/2d.
  const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
  const game = await createGame({ canvas });

  // Create each reader once. It returns only events it has not returned before.
  const damaged = game.events.createReader(Damaged);

  function spawnPlayer({ entities, events, onCleanup }: SystemCtx): void {
    const player = entities.createEntity();
    entities.set(player, Health, { current: 10, max: 10 });
    events.send(Damaged, { amount: 3 });

    const timer = setInterval(() => events.send(Damaged, { amount: 1 }), 1000);
    onCleanup(() => clearInterval(timer));
  }

  function listenForKeys({ events, signal }: SystemCtx): void {
    // The listener is removed when the run stops, because `signal` aborts.
    window.addEventListener("keydown", () => events.send(Damaged, { amount: 1 }), { signal });
  }

  function applyDamage({ entities }: SystemCtx): void {
    for (const { amount } of damaged.read()) {
      entities.each(HEALTH_QUERY, (_entity, health) => {
        health.current = Math.max(0, health.current - amount);
      });
    }
  }

  game
    .addSystem(Schedule.Init, spawnPlayer)
    .addSystem(Schedule.Init, listenForKeys, { after: "spawnPlayer" })
    .addSystem(Schedule.Update, applyDamage);
  // --- AGENTS.md example ends ---

  return { game, Damaged, Health, HEALTH_QUERY };
}

/** The example's lines, without blank lines, imports, indentation or the final `await game.run()`. */
function exampleLines(source: string): string[] {
  return source
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("import ") && line !== "await game.run();");
}

describe("AGENTS.md core model example", () => {
  it("matches the code block in AGENTS.md", () => {
    const doc = agentsMd.replace(/\r\n/g, "\n");
    const block = /```ts\n([\s\S]*?)```/.exec(doc)?.[1];
    const test = thisFile.replace(/\r\n/g, "\n");
    const body = /--- AGENTS\.md example starts ---\n([\s\S]*?)\n\s*\/\/ --- AGENTS\.md example ends ---/.exec(test)?.[1];

    expect(block).toBeDefined();
    expect(exampleLines(body ?? "")).toEqual(exampleLines(block ?? ""));
  });

  it("spawns, reads buffered events once per reader, and cleans up on stop", async () => {
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => ((frame = cb), 1)));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const clear = vi.spyOn(globalThis, "clearInterval");

    const canvas = document.body.appendChild(document.createElement("canvas"));
    canvas.id = "game";
    vi.spyOn(console, "info").mockImplementation(() => {});
    const { game, Damaged, Health, HEALTH_QUERY } = await createExample(core);
    let entities: InstanceType<Core["EntityList"]> | undefined;
    game.addSystem(core.Schedule.Init, (ctx) => {
      entities = ctx.entities;
    }, { name: "test.captureEntities" });
    const healthOf = (): number[] => {
      const values: number[] = [];
      entities?.each(HEALTH_QUERY, (_entity, health) => values.push(health.current));
      return values;
    };

    await game.run();
    expect(Health).toBe(core.defineComponent("myGame.Health"));

    frame?.(performance.now());
    expect(healthOf()).toEqual([7]);

    // The bus keeps the event through the next frame, but this reader already returned it.
    frame?.(performance.now());
    expect(healthOf()).toEqual([7]);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    frame?.(performance.now());
    expect(healthOf()).toEqual([6]);

    await game.stop();
    expect(clear).toHaveBeenCalledTimes(1);

    // The aborted signal removed the keydown listener.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(game.events.read(Damaged)).toHaveLength(0);
    clear.mockRestore();
  });
});
