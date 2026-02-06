import "@/core/builderExtensions.ts";

import { Engine } from "@/core/Engine.ts";
import { Scheduler, Schedule } from "@/core/Scheduler.ts";
import { SceneManager } from "@/core/SceneManager.ts";
import { EventBus } from "@/core/EventBus.ts";
import { ConsoleLogger } from "@/core/ConsoleLogger.ts";
import { bootstrapEngine } from "@/core/Bootstrap.ts";
import { spinSystemUpdate } from "../shared/spinComponent.ts";
import { initDemoNav } from "@/shared/demoNav.ts";
import { initMonacoWorkers } from "./initMonacoWorkers.ts";
import { bootstrapEditor } from "@/editor";

// Initialize navigation
initDemoNav("monaco-editor.html");

// Initialize Monaco workers
initMonacoWorkers();

// Initialize game engine
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

// Bootstrap core engine systems (but don't start yet)
const { assets } = bootstrapEngine(engine, logger, {
  canvas,
  enablePhysics: true,
  enableAnimations: true,
  enableStats: false,
  rendererType: "webgpu",
});

// Add spin system
engine.addSystems(Schedule.Update, [spinSystemUpdate]);

// Bootstrap editor with MVP architecture
await bootstrapEditor({
  engine,
  assets,
  logger,
  buildContext: () => ({
    scene: sceneManager.getActiveScene(),
    entities: sceneManager.getActiveScene().entityList,
    time: engine.getTime(),
    logger,
    events: eventBus,
    scenes: sceneManager,
    stop: () => engine.stop(),
  }),
});
