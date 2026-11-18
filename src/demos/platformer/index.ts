import "@/style.css";
import { ConsoleLogger, Schedule } from "@/index";
import { createDemoGame2D } from "../shared/setup2D.ts";
import { createPlatformerDemo } from "./platformerDemo.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("platformer.html");
initDemoInfo("2D Platformer", [
  "WASD or Arrow keys to move",
  "SPACE, W, up or a tap to jump",
  "Click the game first: keys go to the focused canvas",
  "Collect coins and reach the goal",
  "Simple 2D physics with gravity",
  "Platform collision detection",
]);

const logger = new ConsoleLogger();
const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// createGame with the pixi2d plugin. Input comes with createGame; click the canvas to give it the keys.
const { game } = await createDemoGame2D(canvas, { logger, debug: true }); // window.__FENRIR__.inspect() in the console

const demo = createPlatformerDemo();

game
  .addSystem(Schedule.Init, demo.init, { name: "demo.platformer.init" })
  .addSystem(Schedule.Update, demo.update, { name: "demo.platformer.update" });

await game.run();

logger.info("🎮 Platformer Demo started!");
logger.info("🎮 Use arrow keys or WASD to move, SPACE to jump");
