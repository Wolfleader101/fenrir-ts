import "@/style.css";
import { ConsoleLogger, Schedule } from "@/index";
import { createDemoGame2D } from "../shared/setup2D.ts";
import { createPlatformerDemo } from "./platformerDemo.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("platformer.html");
initDemoInfo("2D Platformer", [
  "WASD or Arrow keys to move",
  "SPACE to jump",
  "Collect coins and reach the goal",
  "Simple 2D physics with gravity",
  "Platform collision detection",
]);

const logger = new ConsoleLogger();
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// createGame with the pixi2d plugin, plus DOM input and input state
const { game, input } = await createDemoGame2D(canvas, { logger });

const demo = createPlatformerDemo(input.state);

game
  .addSystem(Schedule.Init, demo.init, { name: "demo.platformer.init" })
  .addSystem(Schedule.Update, demo.update, { name: "demo.platformer.update" });

await game.run();

logger.info("🎮 Platformer Demo started!");
logger.info("🎮 Use arrow keys or WASD to move, SPACE to jump");
