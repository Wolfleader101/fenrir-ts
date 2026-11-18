import "@/style.css";
import { ConsoleLogger, Engine, EventBus, SceneManager, Schedule, Scheduler } from "@/index";
import { setup2D } from "../shared/setup2D.ts";
import { createPhysicsSystem } from "@/physics";
import { createPlatformerPhysicsDemo } from "./platformerPhysicsDemo.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("platformer-physics.html");
initDemoInfo("2D Platformer (Physics Engine)", [
  "WASD or Arrow keys to move",
  "SPACE to jump",
  "Powered by Jolt Physics Engine",
  "Realistic physics simulation",
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
const { input } = setup2D(engine, logger, canvas, { physics: createPhysicsSystem() });

// Create platformer demo with physics and input state
const demo = createPlatformerPhysicsDemo(input.state);

engine
  .addSystems(Schedule.Init, [demo.init])
  .addSystems(Schedule.Update, [demo.update]);

// Start the engine
engine.run();

logger.info("🎮 Physics-Based Platformer Demo started!");
logger.info("🎮 Use arrow keys or WASD to move, SPACE to jump");
logger.info("⚡ Powered by Jolt Physics Engine");
