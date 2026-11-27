// The browser entry: the renderer, the art and the drawing. Gameplay is in ./game.ts.
import { Schedule, assetKey, createGame, exposeInspector, type Entity, type SystemCtx } from "fenrir-ts";
import { PixiNode, getTexture2D, loadTexture2D, pixi2d } from "fenrir-ts/2d";
import { Sprite, Text, type Texture } from "pixi.js";
import { DESIGN, Phase, Score, Star, addGameplay } from "./game";

const STAR = assetKey("game.star");
const STARS = [Star] as const;

const pixi = pixi2d({ design: DESIGN, background: 0x102030, layers: ["world", "hud"] });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi] });
addGameplay(game);

// window.__FENRIR__.inspect() for the browser test and for agents. `npm run build` leaves it out.
if (import.meta.env.DEV || import.meta.env.MODE === "e2e") exposeInspector(game);

let starTexture: Texture;
const label = new Text({ text: "", style: { fill: 0xffffff, fontSize: 24 } });

game
  .addSystem(Schedule.PreInit, async function loadArt(ctx: SystemCtx) {
    // Files in public/ are served from the page's folder: public/star.png is "star.png".
    await loadTexture2D(ctx, STAR, "star.png");
    starTexture = await getTexture2D(ctx, STAR);
  })
  .addSystem(Schedule.Init, function mountHud() {
    label.position.set(16, 16);
    pixi.renderer.layer("hud").addChild(label); // after fenrir.pixi.init: the layer exists
  })
  // Gameplay spawns stars with no Pixi objects; this gives each one its sprite. The renderer
  // copies Transform2D to the sprite every frame and destroys it with the entity.
  .addSystem(Schedule.Update, function drawStars({ entities }: SystemCtx) {
    const bare: Entity[] = [];
    entities.each(STARS, (entity) => {
      if (!entities.has(entity, PixiNode)) bare.push(entity);
    });
    for (const entity of bare) {
      entities.set(entity, PixiNode, { node: new Sprite({ texture: starTexture, anchor: 0.5 }), layer: "world" });
    }
  })
  .addSystem(Schedule.Update, function drawHud({ resources, states }: SystemCtx) {
    const { points, timeLeft } = resources.get(Score);
    const phase = states.get(Phase);
    if (phase === "playing") label.text = `${points} caught, ${Math.ceil(timeLeft)} s`;
    else if (phase === "over") label.text = `${points} caught. Tap to play again`;
    else label.text = "Tap to play, then tap the star";
  }, { after: "play" });

await game.run();
