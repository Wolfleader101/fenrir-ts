import "@/style.css";
import "@/core/builderExtensions.ts";

import { Engine } from "@/core/Engine.ts";
import { Scheduler, Schedule } from "@/core/Scheduler.ts";
import { SceneManager } from "@/core/SceneManager.ts";
import { EventBus } from "@/core/EventBus.ts";
import { ConsoleLogger } from "@/core/ConsoleLogger.ts";
import { bootstrapEngine } from "@/core/Bootstrap.ts";
import { createAnimationDemo } from "./animationDemo.ts";
import { spinSystemUpdate } from "../shared/spinComponent.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("animation.html");
initDemoInfo("Animation Demo (WebGPU)", [
  "GLTF model loading",
  "Animation playback control",
  "Custom spin component",
  "Entity Builder pattern",
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

// Bootstrap core engine systems
const { assets } = bootstrapEngine(engine, logger, {
  canvas,
  enablePhysics: false,
  enableAnimations: true,
  enableStats: true,
  rendererType: "webgpu",
});

engine.addSystems(Schedule.Update, [spinSystemUpdate]);

// Load and initialize demo scene
const demo = await createAnimationDemo(assets);

engine.addSystem(Schedule.PostInit, demo.init);

// Start the engine
engine.run();

logger.info("🎮 Animation Demo started!");
logger.info("Press F3 to toggle Debug UI");
