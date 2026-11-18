import { ConsoleLogger, Engine, EventBus, SceneManager, Schedule, Scheduler } from "@/index";
import { bootstrapEngine } from "@/3d";
import { createPhysicsSystem } from "@/physics";
import { spinSystemUpdate } from "../shared/spinComponent.ts";
import { initDemoNav } from "@/shared/demoNav.ts";
import { bootstrapEditor } from "@/editor";

// Import Monaco workers (Vite-specific)
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

// Initialize navigation
initDemoNav("monaco-editor.html");

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
  physics: createPhysicsSystem(),
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
  monacoWorkers: {
    jsonWorker: () => new jsonWorker(),
    cssWorker: () => new cssWorker(),
    htmlWorker: () => new htmlWorker(),
    tsWorker: () => new tsWorker(),
    editorWorker: () => new editorWorker(),
  },
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
