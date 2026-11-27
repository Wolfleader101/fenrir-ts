// game-2d.js plus an asset manifest: a boot bundle awaited before the first frame, a level
// bundle loaded with a progress bar and its completion event, a fallback, and an unload when the
// level is left. Its size minus game-2d's is what the manifest costs a game. Bundled, never run.
import { AssetBundleLoaded, EntityBuilder, Schedule, createGame, defineAssets, defineEvent, getAsset, loadAssets, unloadAssets } from "fenrir-ts";
import { PixiNode, Renderable2D, Transform2D, pixi2d, sprite2D } from "fenrir-ts/2d";
import { Graphics, Sprite } from "pixi.js";

const Scored = defineEvent("fixture.scored");
const GameAssets = defineAssets("fixture.assets", {
  assets: {
    logo: { kind: "texture2d", src: "img/logo.png" },
    missing: { kind: "texture2d", src: "img/missing.png" },
    reef: { kind: "texture2d", src: "img/reef.webp", fallback: "missing" },
  },
  bundles: { boot: ["logo", "missing"], reef: ["reef", "logo"] },
});

const canvas = document.querySelector("canvas");
const pixi = pixi2d({ layers: ["world", "ui"] });
const game = await createGame({ canvas, plugins: [pixi] });
const scored = game.events.createReader(Scored);
const MOVING = [Transform2D];
const bar = new Graphics();

game.on(AssetBundleLoaded, ({ bundle }, ctx) => {
  if (bundle !== "reef") return;
  const reef = new Sprite(getAsset(ctx, GameAssets, "reef"));
  EntityBuilder.create().transform2D(0, 0).with(PixiNode, { node: reef, layer: "world" }).spawn(ctx.entities);
});

game
  .addSystem(Schedule.PreInit, async function loadBoot(ctx) {
    await loadAssets(ctx, GameAssets, "boot");
  })
  .addSystem(Schedule.Init, function spawn(ctx) {
    pixi.renderer.root.addChild(bar);
    EntityBuilder.create().transform2D(20, 20).with(Renderable2D, sprite2D("logo")).spawn(ctx.entities);
    void loadAssets(ctx, GameAssets, "reef");
  })
  .addSystem(Schedule.Update, function showProgress({ resources }) {
    bar.clear().rect(0, 0, 200 * resources.get(GameAssets.progress).bundles.reef.fraction, 4).fill(0xffffff);
  })
  .addSystem(Schedule.Update, function move({ entities, time }) {
    entities.each(MOVING, (_entity, transform) => { transform.x += 60 * time.delta; });
  })
  .addSystem(Schedule.Update, function score({ events }) {
    events.send(Scored, { points: 1 });
  })
  .addSystem(Schedule.Update, function logScore({ logger }) {
    for (const { points } of scored.read()) logger.info("scored", { points });
  }, { after: "score" })
  .addSystem(Schedule.Exit, function leaveReef(ctx) {
    unloadAssets(ctx, GameAssets, "reef");
  });

await game.run();
