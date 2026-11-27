# 3D and physics (frozen)

These entry points are kept working and tested but get no new features: `fenrir-ts/3d` (Three.js), and `fenrir-ts/physics` (Jolt). New games should use the 2D path in [SKILL.md](../SKILL.md). Signatures are in [api/3d.md](../api/3d.md) and [api/physics.md](../api/physics.md).

## Basic example (3D)

The 3D renderer is frozen and has no plugin, so a 3D game still builds an `Engine` itself. `bootstrapEngine` from `fenrir-ts/3d` registers input, the Three.js renderer, camera and skybox systems in one call. Importing `fenrir-ts/3d` also adds the skybox members to `Scene`: `skybox`, `setSkybox`, `removeSkybox` and `hasSkybox`. Core's `Scene` does not have them, so a 2D bundle carries none.

```ts
import { ConsoleLogger, Engine, EventBus, SceneManager, Schedule, Scheduler } from "fenrir-ts";
import { bootstrapEngine } from "fenrir-ts/3d";
import { createPhysicsSystem } from "fenrir-ts/physics";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
if (!canvas) {
  throw new Error("Canvas element not found");
}

const logger = new ConsoleLogger();
const engine = new Engine({
  scheduler: new Scheduler(),
  sceneManager: new SceneManager(logger),
  events: new EventBus(),
  logger,
});

// Physics is optional; leave out `physics` and the fenrir-ts/physics import if you do not need it.
const { assets } = bootstrapEngine(engine, logger, { canvas, physics: createPhysicsSystem() });
await assets.loadModel("ship", "/models/ship.glb");

engine.addSystems(Schedule.Update, [yourGameSystem]);
await engine.run();
```
