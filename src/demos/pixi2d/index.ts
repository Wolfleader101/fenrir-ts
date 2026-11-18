import "@/style.css";
import { ConsoleLogger, Schedule } from "@/index";
import { createDemoGame2D } from "../shared/setup2D.ts";
import { DESIGN, create2DDemo } from "./pixi2dDemo.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("pixi2d.html");
initDemoInfo("2D Demo (PixiJS)", [
  "Designed on a 390 x 520 portrait grid",
  "Full-bleed background, frame inside the safe area",
  "Resize the window: the frame grows taller or centres",
]);

const logger = new ConsoleLogger();
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// createGame with pixi2d({ design }), plus DOM input and input state
const { game, pixi } = await createDemoGame2D(canvas, { logger, design: DESIGN });

const demo = create2DDemo(pixi.renderer);

game
  .addSystem(Schedule.Init, demo.init, { name: "demo.pixi2d.init" })
  .addSystem(Schedule.Update, demo.update, { name: "demo.pixi2d.update" });

await game.run();

logger.info("🎨 2D Demo started!");
logger.info("🎮 PixiJS 2D Renderer active");
