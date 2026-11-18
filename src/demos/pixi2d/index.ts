import "@/style.css";
import { ConsoleLogger, Schedule } from "@/index";
import { createDemoGame2D } from "../shared/setup2D.ts";
import { create2DDemo } from "./pixi2dDemo.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("pixi2d.html");
initDemoInfo("2D Demo (PixiJS)", [
  "2D rendering with PixiJS",
  "Graphics shapes (circles, rects)",
  "Text rendering",
  "Transform animations",
  "ECS architecture",
]);

const logger = new ConsoleLogger();
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// createGame with the pixi2d plugin, plus DOM input and input state
const { game } = await createDemoGame2D(canvas, { logger });

const demo = create2DDemo();

game
  .addSystem(Schedule.Init, demo.init, { name: "demo.pixi2d.init" })
  .addSystem(Schedule.Update, demo.update, { name: "demo.pixi2d.update" });

await game.run();

logger.info("🎨 2D Demo started!");
logger.info("🎮 PixiJS 2D Renderer active");
