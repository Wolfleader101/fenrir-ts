import "@/style.css";
import { Vector3 } from "three";
import { ConsoleLogger, Engine, EventBus, SceneManager, Schedule, Scheduler } from "@/index";
import { bootstrapEngine } from "@/3d";
import { createPhysicsSystem } from "@/physics";
import { createPhysicsDemo } from "./physicsDemo.ts";
import { createECSCameraController } from "../shared/CameraController.ts";
import { initDemoNav, initDemoInfo } from "@/shared/demoNav.ts";

// Initialize navigation
initDemoNav("index.html");
initDemoInfo("Physics Demo (WebGPU)", [
  "Entity Component System architecture",
  "WebGPU rendering with Three.js",
  "Jolt Physics integration",
  "Dynamic object spawning",
  "Multiple material types",
  "WASD + Mouse: Camera controls",
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

// Bootstrap core engine systems with physics enabled
const { assets } = bootstrapEngine(engine, logger, {
  canvas,
  physics: createPhysicsSystem(),
  enableAnimations: true,
  enableStats: true,
  rendererType: "webgpu",
});

// Camera controller
const cameraController = createECSCameraController({
  target: new Vector3(0, 0, 0),
  distance: 30,
  fov: 75,
  near: 0.1,
  far: 1000,
});

engine
  .addSystem(Schedule.Init, cameraController.init, { name: "demo.camera.init" })
  .addSystem(Schedule.Update, cameraController.update, { name: "demo.camera.update" })
  .addSystem(Schedule.Exit, cameraController.exit, { name: "demo.camera.exit" });

// Load and initialize physics demo
const demo = createPhysicsDemo(assets);

engine
  .addSystem(Schedule.PostInit, demo.init, { name: "demo.physics.init" })
  .addSystem(Schedule.Update, demo.update, { name: "demo.physics.update" });

// Start the engine
engine.run();

logger.info("🎮 Physics Demo started!");
logger.info("📦 Dynamic object spawning enabled");
logger.info("🎥 WASD + Mouse for camera controls");
logger.info("⌨️ Press F3 to toggle Debug UI");
logger.info("🔧 Physics debug rendering enabled - toggle in Debug UI");
