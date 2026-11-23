import { expect, it } from "vitest";
import { Schedule, createTestGame, EntityBuilder, EntityList, Transform2D, type SystemCtx } from "@/index";
import { inspect } from "@/core/Inspect";

const MOVING = [Transform2D] as const;

function drift({ entities, time }: SystemCtx): void {
  entities.each(MOVING, (_entity, t) => {
    t.x += 60 * time.fixedDelta;
    t.rotation += Math.PI * time.fixedDelta;
  });
}

it("moves Transform2D entities headless, with no renderer, and shows them in inspect()", async () => {
  const game = await createTestGame({ seed: 1 });
  const builder = EntityBuilder.create().name("fish").transform2D(10, 20, { scaleX: 2 });
  game.addSystem(Schedule.Init, function spawn({ entities }: SystemCtx) {
    builder.spawn(entities);
    builder.spawn(entities);
  });
  game.addSystem(Schedule.Tick, drift);
  await game.start();
  game.step(1 / 60, 30);

  const fish = inspect(game).entities.filter((e) => e.name === "fish");
  expect(fish).toHaveLength(2);
  for (const { components } of fish) {
    const t = components["fenrir.Transform2D"] as Transform2D;
    expect(t.x).toBeCloseTo(40);
    expect(t.y).toBe(20);
    expect(t.rotation).toBeCloseTo(Math.PI / 2);
    expect([t.scaleX, t.scaleY]).toEqual([2, 1]);
  }
  await game.stop();
});

it("gives every spawn of a transform2D builder its own component", () => {
  const entities = new EntityList();
  const builder = EntityBuilder.create().transform2D();
  const a = builder.spawn(entities);
  const b = builder.spawn(entities);
  entities.get(a, Transform2D).x = 5;
  expect(entities.get(b, Transform2D)).toEqual({ x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
});
