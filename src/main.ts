import "./style.css";
import typescriptLogo from "./typescript.svg";
import viteLogo from "/vite.svg";
import { setupCounter } from "./counter.ts";
import { createDomInputSystems } from "./core/InputSystem/DOMInputSystem.ts";
import { Engine } from "./core/Engine.ts";
import { Schedule, Scheduler } from "./core/Scheduler.ts";
import { createInputStateSystem } from "./core/InputSystem/InputStateSystem.ts";
import { SceneManager } from "./core/SceneManager.ts";
import { EventBus } from "./core/EventBus.ts";
import { ConsoleLogger } from "./core/ConsoleLogger.ts";
import type { ILogger } from "./core/ILogger.ts";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <a href="https://vite.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`;

setupCounter(document.querySelector<HTMLButtonElement>("#counter")!);

const domInput = createDomInputSystems({
  target: window,
  preventDefaults: true,
});

const input = createInputStateSystem();

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

engine.addSystem(Schedule.Init, domInput.init);
engine.addSystem(Schedule.PreUpdate, input.preUpdate);
engine.addSystem(Schedule.Exit, domInput.exit);

engine.run();
