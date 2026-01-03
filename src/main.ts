import "./style.css";
import { createDomInputSystems } from "./core/InputSystem/DOMInputSystem.ts";
import { Engine } from "./core/Engine.ts";
import { Schedule, Scheduler } from "./core/Scheduler.ts";
import { createInputStateSystem } from "./core/InputSystem/InputStateSystem.ts";
import { SceneManager } from "./core/SceneManager.ts";
import { EventBus } from "./core/EventBus.ts";
import { ConsoleLogger } from "./core/ConsoleLogger.ts";
import type { ILogger } from "./core/ILogger.ts";
import { createTransformPropagationSystem } from "./core/TransformPropagationSystem.ts";
import { createThreeRendererSystem } from "./core/Renderer/ThreeRendererSystem.ts";
import { spinSystem } from "./game/spin.ts";
import { testSceneInit } from "./game/testScene.ts";

const logger: ILogger = new ConsoleLogger();

const scheduler = new Scheduler();
const sceneManager = new SceneManager(logger);
const eventBus = new EventBus();

const engine = new Engine({
  scheduler,
  sceneManager,
  events: eventBus,
  logger,
});

const domInput = createDomInputSystems({
  target: window,
  preventDefaults: true,
});

const input = createInputStateSystem();

const transformPropagation = createTransformPropagationSystem();

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const renderer = createThreeRendererSystem({
  logger,
  canvas,
  clearColor: 0x101010,
});

engine
  .addSystems(Schedule.Init, [domInput.init, renderer.init, testSceneInit])
  .addSystems(Schedule.PreUpdate, [
    input.preUpdate,
    spinSystem,
    transformPropagation.preUpdate,
  ])
  .addSystem(Schedule.Update, renderer.update)
  .addSystem(Schedule.PostUpdate, renderer.postUpdate)
  .addSystems(Schedule.Exit, [domInput.exit, renderer.exit])
  .run();
