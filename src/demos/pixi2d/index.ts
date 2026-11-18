import "@/style.css";
import { ConsoleLogger, Engine, EventBus, SceneManager, Schedule, Scheduler } from "@/index";
import { setup2D } from "../shared/setup2D.ts";
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
setup2D(engine, logger, canvas);

const demo = create2DDemo();

engine
  .addSystems(Schedule.Init, [demo.init])
  .addSystems(Schedule.Update, [demo.update]);

// Start the engine
engine.run();

logger.info("🎨 2D Demo started!");
logger.info("🎮 PixiJS 2D Renderer active");
