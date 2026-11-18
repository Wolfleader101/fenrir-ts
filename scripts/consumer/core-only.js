// A game loop that imports only the core entry, fenrir-ts. Bundled, never run.
import { AssetStore, ConsoleLogger, Engine, EventBus, SceneManager, Schedule, Scheduler, defineEvent } from "fenrir-ts";

const Scored = defineEvent("fixture.scored");

const logger = new ConsoleLogger();
const events = new EventBus();
const engine = new Engine({ scheduler: new Scheduler(), sceneManager: new SceneManager(logger), events, logger });
const assets = new AssetStore();
const scored = events.createReader(Scored);

engine
  .addSystem(Schedule.Exit, () => assets.clear())
  .addSystem(Schedule.Update, ({ events }) => events.send(Scored, { points: 1 }))
  .addSystem(Schedule.Update, () => {
    for (const { points } of scored.read()) logger.info("scored", points);
  });

await engine.run();
