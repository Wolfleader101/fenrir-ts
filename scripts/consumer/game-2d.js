// A minimal 2D Pixi game: imports what the first consuming game imports from
// fenrir-ts and fenrir-ts/2d, and nothing else. Bundled, never run.
import {
  AssetStore,
  ConsoleLogger,
  Engine,
  EventBus,
  SceneManager,
  Schedule,
  Scheduler,
  defineEvent,
} from "fenrir-ts";
import { createPixiRendererSystem } from "fenrir-ts/2d";

const Scored = defineEvent("fixture.scored");

const logger = new ConsoleLogger();
const events = new EventBus();
const engine = new Engine({ scheduler: new Scheduler(), sceneManager: new SceneManager(logger), events, logger });
const assets = new AssetStore();
const canvas = document.querySelector("canvas");
const renderer = createPixiRendererSystem({ logger, canvas, assets });
const scored = events.createReader(Scored);

engine
  .addSystem(Schedule.Init, renderer.init)
  .addSystem(Schedule.Update, ({ events }) => events.send(Scored, { points: 1 }))
  .addSystem(Schedule.Update, () => {
    for (const { points } of scored.read()) logger.info("scored", points);
  })
  .addSystem(Schedule.Update, renderer.update)
  .addSystem(Schedule.PostUpdate, renderer.postUpdate)
  .addSystem(Schedule.Exit, renderer.exit);

await engine.run();
