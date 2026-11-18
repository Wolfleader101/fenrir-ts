import "@/style.css";
import { ConsoleLogger, Engine, EventBus, SceneManager, Schedule, Scheduler } from "@/index";
import { setup2D } from "../shared/setup2D.ts";
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
const scheduler = new Scheduler();
const sceneManager = new SceneManager(logger);
const eventBus = new EventBus();

const engine = new Engine({
  scheduler,
  sceneManager,
  events: eventBus,
  logger,
});

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

// Register DOM input, input state and the PixiJS renderer from fenrir-ts/2d
const { input } = setup2D(engine, logger, canvas);

// Create platformer demo with input state
const demo = createPlatformerDemo(input.state);

engine
  .addSystems(Schedule.Init, [demo.init])
  .addSystems(Schedule.Update, [demo.update]);

// Start the engine
engine.run();

logger.info("🎮 Platformer Demo started!");
logger.info("🎮 Use arrow keys or WASD to move, SPACE to jump");
