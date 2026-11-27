# Fenrir TS

**Fenrir TS** is a TypeScript game engine inspired by my C++ engine [FenrirEngine](https://github.com/Wolfleader101/FenrirEngine), re-imagined for the web with a TypeScript-first design.

It focuses on **clear engine architecture**, **explicit data flow**, and **high-performance ECS patterns**, while remaining flexible enough to support both 2D and 3D rendering backends.

---

## Installation

```bash
npm install fenrir-ts
# or
pnpm add fenrir-ts
# or
yarn add fenrir-ts
```

### Peer Dependencies

Each entry point needs its own peer dependency. Install the ones for the entries you import:

| Entry | Install |
| --- | --- |
| `fenrir-ts/2d` | `pixi.js` |
| `fenrir-ts/3d` | `three` |
| `fenrir-ts/physics` | `jolt-physics` and `three` |
| `fenrir-ts/audio` | none (Web Audio) |
| `fenrir-ts/ui` | `pixi.js` |
| `fenrir-ts/editor` | `monaco-editor` |

The core entry, `fenrir-ts`, needs none of them.

### Using Fenrir with a coding agent

The package ships a guide for an agent that builds a game with Fenrir, with the full rules for each service and an API reference generated from the TSDoc, so the agent needs nothing but the installed package:

```text
node_modules/fenrir-ts/
├── llms.txt                     index of the docs below, in the llms.txt format
├── llms-full.txt                the guide, every reference and the 2D-path API in one file
└── skills/fenrir/
    ├── SKILL.md                 the guide: the model, a minimal game and its test, the rules that prevent common mistakes
    ├── references/*.md          one file per service: core, testing, input, 2d, motion, assets, storage, audio, ui
    └── api/*.md                 one file per entry point: every export with its signature and docs
```

The references are this README's sections, so the rules are the same in both. `SKILL.md` is Markdown with a `name` and `description` frontmatter, the Agent Skills format; agents that do not read skills read the same file, so there is no separate plain copy.

Tell your agent where it is. In your game repository's `AGENTS.md` or `CLAUDE.md`:

```md
This game is built on the Fenrir engine (`fenrir-ts`). Before writing or changing game code, read
`node_modules/fenrir-ts/skills/fenrir/SKILL.md` and follow it. Look up names and options in
`node_modules/fenrir-ts/skills/fenrir/api/` instead of guessing, and the rules for a service in
`node_modules/fenrir-ts/skills/fenrir/references/`.
```

For an agent that loads skills from a folder, such as Claude Code's `.claude/skills/`, link the package's skill there so it follows upgrades:

```sh
mkdir -p .claude/skills && ln -s ../../node_modules/fenrir-ts/skills/fenrir .claude/skills/fenrir
```

On Windows, `New-Item -ItemType Junction -Path .claude\skillsenrir -Target node_modulesenrir-ts\skillsenrir`. Or copy the folder, and copy it again after upgrading. This works the same for a registry install, a packed tarball and a `file:` dependency.

---

## Usage

The package has one entry point per area. Core never loads a renderer, so a 2D game ships no Three.js code.

| Import | Contents |
| --- | --- |
| `fenrir-ts` | Core: `createGame`, plugins, named systems, scenes, ECS, `Transform2D`, `Display2D`, events, time, logging, input actions (`defineAction`, `ctx.input`), `EntityBuilder`, `AssetStore`, asset manifests (`defineAssets`, `loadAssets`), `inspect(game)` |
| `fenrir-ts/2d` | The `pixi2d` renderer plugin with named layers, the `Viewport` resource and `ViewportResized` event, `PixiNode` (an app-built Pixi node on an entity), `Renderable2D`, 2D builder methods such as `pixiNode` and `renderSprite`, 2D texture loading |
| `fenrir-ts/3d` | Three.js renderer, camera, skybox, animation, model loading, `bootstrapEngine`, and the window-level keyboard and mouse input it registers (`createDomInputSystems`, `InputState`, `InputEvent`) |
| `fenrir-ts/physics` | Jolt physics system, components and builder methods |
| `fenrir-ts/audio` | The `audio()` plugin, `defineSound`, `playSound`, `stopSound` |
| `fenrir-ts/ui` | UI controls on Pixi nodes: the `ui()` plugin, `control`, `modalScope`, `UiFocus`, `ControlActivated`, `paginate`, `activateControl`, `listControls` |
| `fenrir-ts/editor` | Monaco live code editor |

Importing `fenrir-ts/2d`, `fenrir-ts/3d` or `fenrir-ts/physics` also adds that entry's methods to `EntityBuilder` and `AssetStore`, so `renderSprite` and `requestTexture2D` exist once you import `fenrir-ts/2d`.

### Quick start (2D)

`createGame` builds the game and installs its plugins. `pixi2d` from `fenrir-ts/2d` is the PixiJS renderer.

```ts
import { EntityBuilder, Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";

const canvas = document.querySelector<HTMLCanvasElement>("#game-canvas");
if (!canvas) throw new Error("Canvas element not found");

const game = await createGame({ canvas, plugins: [pixi2d({ background: 0x101820 })] });

function spawnBall({ entities }: SystemCtx): void {
  EntityBuilder.create().transform2D(200, 150).renderCircle(16, { fillColor: 0xff6600 }).spawn(entities);
}

game.addSystem(Schedule.Init, spawnBall);
await game.run();
```

The canvas element must exist in the DOM before you call `createGame()`: put the script at the end of the body or a `type="module"` script (deferred), wait for `DOMContentLoaded`, or call it from a framework's mounted hook.

`game.run()` resolves once `PreInit`, `Init` and `PostInit` have run and the first frame is scheduled. If any of them throws, the run rolls back: `Exit` systems and cleanups run, and `run()` rejects with the error. `game.stop()`, `game.pause()` and `game.resume()` control the loop, and `game.step(dt)` runs frames while paused. `game.isRunning()` is true from the end of startup until `stop()` is called, paused included. `run()` also resolves when a system calls `ctx.stop()` during startup, so check `isRunning()` after `await game.run()` to know whether gameplay started. Tests use `createTestGame` instead: see [Testing a game](#testing-a-game).

`game.assets` is the asset store. The 2D texture methods come from `fenrir-ts/2d`:

```ts
import "fenrir-ts/2d";

const hero = game.assets.requestTexture2D("hero", "/sprites/hero.png");
hero.subscribe((state) => game.logger.info(`hero texture: ${state.status}`));
```

To keep a Pixi application your app already owns, pass it in. It must be initialized on the same canvas with its ticker stopped, and the game does not destroy it at exit. It keeps its own clear colour unless you also pass `background`, which sets the application's clear colour when the game's Init stage runs. Game code that draws with Pixi directly adds to the plugin's `renderer.root`, in logical units (see [Viewport](#viewport)), or gives the node to an entity (see [Scene](#scene-transform2d-pixinode-and-layers)):

```ts
import type { Application } from "pixi.js";
import { createGame } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";

declare const app: Application; // initialized by your app, with app.ticker.stop() called

const pixi = pixi2d({ application: app });
const game = await createGame({ canvas: app.canvas, plugins: [pixi] });
await game.run();
pixi.renderer.root.addChild(myOverlay);
```

### Viewport

Pass `design` to draw in design units on any screen. The design width always fills the safe area's width and the logical height grows from `minHeight` to fill its height; a safe area too short for `minHeight` scales the frame down further and centres it horizontally.

```
 screen (canvas, CSS px) ─────────────────┐
 │ ░░░░░░░░░ safe-area inset top ░░░░░░░░ │  backdrop: full bleed,
 │ ┌─ root (design frame) ──────────────┐ │  CSS px, behind root
 │ │ (0,0)              (390,0)         │ │
 │ │   design width 390 fills the safe  │ │  root: logical units,
 │ │   width; height = max(520, safe    │ │  at offset, scaled
 │ │   height / scale)                  │ │  by scale
 │ │ (0,height)                         │ │
 │ └────────────────────────────────────┘ │
 │ ░░░░░░░░ safe-area inset bottom ░░░░░░ │
 └────────────────────────────────────────┘
```

```ts
import { Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { Viewport, ViewportResized, pixi2d } from "fenrir-ts/2d";
import { Graphics } from "pixi.js";

const pixi = pixi2d({
  design: { width: 390, minHeight: 520 }, // width is fixed; height grows to fill
  safeArea: true, // lay out inside env(safe-area-inset-*); the default
  maxResolution: 2, // backing-store pixels per CSS pixel, at most; the default
  background: 0x092c36,
});
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi] });

const sky = new Graphics();
const board = new Graphics();

function layout({ screen, width, height }: Viewport): void {
  sky.clear().rect(0, 0, screen.width, screen.height).fill(0x0f4250); // whole screen, CSS px
  board.clear().rect(0, 0, width, height).stroke({ color: 0xffffff, width: 2 }); // design units
}

function setUp({ resources, events }: SystemCtx): void {
  pixi.renderer.backdrop.addChild(sky);
  pixi.renderer.root.addChild(board);
  layout(resources.get(Viewport));
  events.on(ViewportResized, layout); // removed when the run stops
}

game.addSystem(Schedule.Init, setUp);
await game.run();
```

- The plugin owns the canvas: it pins it to the window's top-left (`position: fixed`), sizes it to `innerWidth` by `innerHeight`, and listens to window resize, `visualViewport` resize, orientation and device-pixel-ratio changes. The listeners are added in `fenrir.viewport.init` and removed when the run stops. A game adds none.
- `renderer.root` holds game content in logical units; entities with `Renderable2D` mount there, and named layers live there (see [Scene](#scene-transform2d-pixinode-and-layers)). `renderer.backdrop` sits behind it, in unscaled CSS pixels from the screen's top-left; cover `viewport.screen` with it to fill the area outside the frame and the safe area.
- `ctx.resources.get(Viewport)` is plain data: logical `width` and `height`, `scale` (CSS pixels per logical unit), the frame's `offset` on the screen, the `insets` in use, the `screen` size and the `resolution`. Each change replaces the object.
- `ViewportResized` carries the new `Viewport`. It is sent once at startup and then on each change, never twice for the same layout. A resize is applied in the next frame's `PreUpdate` (`fenrir.viewport.preUpdate`), before anything renders. While the game is paused no frame runs, so the plugin applies the layout and renders once on the next animation frame.
- `ctx.input.pointer` is already in logical units: see [Input](#input). `pixi.renderer.clientToLogical(clientX, clientY)` converts a DOM event's position into logical units, and `logicalToClient` converts back. `screenToLogical(viewport, point)` and `logicalToScreen` do the same for points relative to the canvas.
- `layoutViewport(design, screen, insets, resolution)` is the layout rule itself, as a pure function with no Pixi: it returns the `Viewport` that `pixi2d({ design })` would set for that screen. A browser test can turn design units into click positions without `exposeInspector` in the shipped build:

  ```ts
  import { layoutViewport, logicalToScreen } from "fenrir-ts/2d";

  const layout = layoutViewport({ width: 390, minHeight: 520 }, { width: 390, height: 844 }, { top: 47, right: 0, bottom: 34, left: 0 }, 3);
  const click = logicalToScreen(layout, { x: 195, y: 100 }); // CSS pixels from the canvas corner: { x: 195, y: 147 }
  ```
- `safeArea: false` ignores insets. `maxResolution` caps the resolution at `min(devicePixelRatio, maxResolution)`, with or without `design`. An adopted `application` is sized the same way.
- Without `design`, the canvas keeps the size it was created with and the plugin listens to nothing. `Viewport` then reports the renderer's screen at scale 1, and `ViewportResized` is sent when game code resizes the renderer.

The page needs `viewport-fit=cover`, or the browser reports zero insets and letterboxes the page itself:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<style>html, body { margin: 0; overflow: hidden; }</style>
<canvas id="game"></canvas>
```

### Scene: Transform2D, PixiNode and layers

Real art is usually a Pixi container the game builds itself. Give it to an entity with `PixiNode` and the renderer mounts it, moves it with the entity's `Transform2D`, shows it with its `Display2D`, parents it under the parent entity's node and destroys it with the entity.

```ts
import { EntityBuilder, Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { Display2D, PixiNode, Transform2D, pixi2d } from "fenrir-ts/2d";
import { Container, Graphics } from "pixi.js";

const pixi = pixi2d({ design: { width: 390, minHeight: 520 }, layers: ["background", "world", "ui"] });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi] });
const SWIMMING = [Transform2D] as const;
const FADING = [Display2D] as const;

function spawnBoat({ entities }: SystemCtx): void {
  const hull = new Container();
  hull.addChild(new Graphics().roundRect(-40, -10, 80, 20, 6).fill(0x8b5a2b));
  EntityBuilder.create()
    .transform2D(195, 300)
    .pixiNode(hull, { layer: "world" })
    .child((flag) => flag.transform2D(0, -30).pixiNode(new Graphics().rect(0, 0, 16, 10).fill(0xff3344)))
    .child((wake) => wake.display2D({ alpha: 0.6 }).pixiNode(new Graphics({ zIndex: -1 }).circle(0, 8, 30).fill(0xffffff)))
    .spawn(entities);

  // Full-bleed art behind the design frame: Transform2D here is CSS pixels from the screen's corner.
  EntityBuilder.create().transform2D(0, 0).pixiNode(new Graphics().rect(0, 0, 4000, 4000).fill(0x0f4250), { layer: "fenrir.backdrop" }).spawn(entities);

  // A node the app keeps across runs: unmounted at stop, never destroyed.
  const banner = entities.createEntity();
  entities.set(banner, PixiNode, { node: myOverlay, layer: "ui", keep: true });
}

function swim({ entities, time }: SystemCtx): void {
  entities.each(SWIMMING, (_entity, transform) => {
    transform.rotation = Math.sin(time.elapsed) * 0.1;
  });
  entities.each(FADING, (_entity, display) => {
    display.alpha = 0.4 + Math.abs(Math.sin(time.elapsed)) * 0.4;
  });
}

game.addSystem(Schedule.Init, spawnBoat).addSystem(Schedule.Update, swim);
await game.run();
```

- `Transform2D` is `{ x, y, rotation, scaleX, scaleY }`: logical units and radians, plain numbers. It lives in core (`fenrir-ts` exports it too), so game logic and `createTestGame` tests use it with no renderer. `builder.transform2D(x, y, { rotation, scaleX, scaleY })` adds it; entities do not get one by default.
- `Display2D` is `{ alpha, visible }`, also plain data in core. `builder.display2D({ alpha, visible })` adds it (1 and true unless given). It wins over a `Renderable2D`'s `flags.alpha` and `flags.visible`. An entity without it keeps the alpha and visibility the app gives its node; removing it leaves the last values written.
- `PixiNode` is `{ node, layer?, keep? }`. `builder.pixiNode(node, { layer, keep })` adds it; spawn such a builder once, since every spawn gets the same node.
- Each frame `fenrir.pixi.postUpdate` writes `Transform2D` and `Display2D` to every node, then renders. It runs after every `Update` system, so a move made in `Update` is drawn in the same frame. Every render syncs first, so `pixi.renderer.render()` called by game code (to show a first frame from `PostInit` while assets load, say) and the render the plugin makes for a resize while paused draw entities where their `Transform2D` says too. A node whose entity has no `Transform2D` keeps the position the app gives it. `Renderable2D` entities follow `Transform2D` too; an entity with both `Transform2D` and the default `Transform` follows `Transform2D`.
- A node goes under its parent entity's node (or `Renderable2D` view) when the parent has one, otherwise in its `layer`, otherwise straight in `renderer.root`. Layers are containers under `root`, back to front in the order given, and sort their children by `zIndex`; `pixi.renderer.layer("ui")` returns one for drawing into it directly. Content added straight to `root` draws above every layer. An unknown layer name throws at `entities.set`, listing the declared layers.
- `layer: "fenrir.backdrop"` mounts a node in `renderer.backdrop`, behind every layer, with the same lifetime rules. There `Transform2D` is in unscaled CSS pixels from the screen's top-left, the backdrop's own space; cover `Viewport.screen` to fill the screen. Declared layer names cannot start with `fenrir.`, so none collides with it: `pixi2d({ layers: ["fenrir.ui"] })` throws.
- Child entities' nodes sort by `zIndex` under their parent's node with nothing set by the app: Pixi turns `sortableChildren` on for a container when a child with a non-zero `zIndex` is added to it or a child's `zIndex` changes, and it does that even over an explicit `sortableChildren = false`. Give a node that has child entities a plain `Container`, with its own art as a child of it: Pixi draws a `Graphics` or `Sprite` before all of its children, so no `zIndex` puts a child behind it.
- When the `PixiNode` or its entity is removed, the node is removed from its parent and destroyed with its children (textures are left alone). When the run stops, every node is destroyed and its `PixiNode` removed, so the next run starts clean. Nodes of child entities and `Renderable2D` views inside a destroyed node are moved out first and survive. With `keep: true` a node is only removed from its parent, and at stop its `PixiNode` stays, so the next run mounts it again. One node belongs to one entity: giving it to a second throws.
- `inspect(game)` shows `fenrir.Transform2D` and `fenrir.Display2D` as their values and `fenrir.PixiNode` as `{ node: { $type: "Container" }, layer, keep }`: the node's class name only, so no Pixi object reaches the snapshot. A minified build may shorten the class name, so give a node a `label` (`node.label = "myGame.ship"`) to identify it: the snapshot then shows `{ $type: "Container", label: "myGame.ship" }`. See [Inspecting a game](#inspecting-a-game).

### Assets

Declare a game's assets once, by name, in bundles: `boot`, and one per level or location. `defineAssets` from `fenrir-ts` takes plain data (no `as const` needed), so a tool or test can read `manifest.assets` and `manifest.bundles`. `getAsset` returns the type of the asset's kind (a Pixi `Texture` for `texture2d`), and a wrong asset or bundle name is a compile error. A game that does not call `defineAssets` ships none of this code.

```ts
import { AssetBundleLoaded, EntityBuilder, Schedule, createGame, defineAssets, defineState, getAsset, loadAssets, unloadAssets, type SystemCtx } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";
import { Graphics, Sprite } from "pixi.js";

export const GameAssets = defineAssets("myGame.assets", {
  assets: {
    logo: { kind: "texture2d", src: "img/logo.png" },
    missing: { kind: "texture2d", src: "img/missing.png" },
    // If reef.webp fails, the reef asset is the missing texture instead.
    reef: { kind: "texture2d", src: "img/reef.webp", fallback: "missing" },
  },
  bundles: { boot: ["logo", "missing"], reef: ["reef", "logo"] },
});

const Level = defineState("myGame.Level", { values: ["loading", "reef"], initial: "loading" });
const pixi = pixi2d({ design: { width: 390, minHeight: 520 } });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi] });
const bar = new Graphics();

// Awaited in PreInit, so run() waits for boot and rejects if it fails.
async function loadBoot(ctx: SystemCtx): Promise<void> {
  await loadAssets(ctx, GameAssets, "boot");
}

function showTitle(ctx: SystemCtx): void {
  EntityBuilder.create().transform2D(195, 80).renderSprite("logo").spawn(ctx.entities); // by name, through game.assets
  pixi.renderer.root.addChild(bar);
  void loadAssets(ctx, GameAssets, "reef"); // not awaited: progress below, then AssetBundleLoaded
}

function drawProgress({ resources }: SystemCtx): void {
  const { fraction } = resources.get(GameAssets.progress).bundles.reef;
  bar.clear().rect(20, 500, 350 * fraction, 6).fill(0xffffff);
}

game.on(AssetBundleLoaded, ({ bundle }, { states }) => {
  if (bundle === "reef") states.set(Level, "reef");
});

game
  .onEnter(Level, "reef", (ctx) => {
    const reef = new Sprite(getAsset(ctx, GameAssets, "reef")); // a Texture, no cast
    EntityBuilder.create().transform2D(0, 0).pixiNode(reef).spawn(ctx.entities);
  })
  // Leaving the level: despawn what shows its textures first, then unload. logo stays: boot holds it.
  .onExit(Level, "reef", (ctx) => unloadAssets(ctx, GameAssets, "reef"))
  .addSystem(Schedule.PreInit, loadBoot)
  .addSystem(Schedule.Init, showTitle)
  .addSystem(Schedule.Update, drawProgress);
await game.run();
```

- **Where.** `loadAssets(ctx, manifest, bundle | bundles)`, `unloadAssets(...)` and `getAsset(ctx, manifest, name)` take a `SystemCtx` or the game itself; a helper of your own that calls them takes `AssetCtx`. An asset's `src` is a URL the browser fetches relative to the page: with Vite, a file in `public/img/` is `img/logo.png`. `ctx.assets` is `game.assets`, the asset store; a manifest loads through its loaders (chosen by kind and extension) and stores each asset under its name, so `getTexture2D("logo")` and `renderSprite("logo")` see it too. Two manifests may share a name only for the same kind and source.
- **Loading.** A loading or loaded bundle returns the same promise; an asset in two bundles loads once. Await `loadAssets` in a `PreInit` system to hold `run()` until a bundle is ready, or call it without awaiting and watch progress. Loads are not tied to a run: they finish after `stop()`, and loaded bundles stay loaded across `stop()` and `run()`, like entities.
- **Progress.** `ctx.resources.get(manifest.progress)` is plain data updated as each asset settles: `loaded`, `missing`, `failed`, `total` and `fraction` (`(loaded + missing) / total`) over every held asset, the same per bundle with its `status` (`unloaded`, `loading`, `loaded`, `failed`), and each asset's `status` (`unloaded`, `loading`, `loaded`, `fallback`, `missing`, `failed`), `error`, the `bundles` holding it and `direct` (held by `loadAsset`). `inspect(game)` shows it under the manifest's name. A bundle sends `AssetBundleLoaded { manifest, bundle, fallbacks, missing }` or `AssetBundleFailed { manifest, bundle, failures }` when it settles.
- **Failure.** Every asset of a bundle is tried. One that fails shows its declared `fallback` (another asset of the same kind, which every bundle listing it also loads) and the failure is logged as a warning. One that fails without a fallback fails the bundle: it is logged, `AssetBundleFailed` is sent and the promise rejects with an `AssetBundleError` whose `failures` name each asset, source and error. The assets that loaded stay loaded. Calling `loadAssets` again retries the failed assets; nothing retries on its own.
- **Optional assets.** `{ kind, src, optional: true }` marks a failure as cosmetic. An optional asset that fails (after its `fallback`, if it has one) is `missing`: logged as a warning, counted in `missing`, listed in `AssetBundleLoaded`'s `missing`, and its bundle still loads. `getAsset` returns `undefined` for it, and its type includes `undefined` only for assets declared `optional: true`; `getTexture2D(name)` resolves with `undefined`. A missing asset is not loaded again until a hold on it is dropped and taken again.
- **One asset at a time.** `loadAsset(ctx, manifest, name | names)` loads assets by name with no bundle, for a game that loads images lazily as they come into view; `unloadAsset(ctx, manifest, name | names)` drops that hold. A name is held like a one-asset bundle with its fallback, shared with any bundle that lists it: an asset is released only when no bundle and no `loadAsset` hold has it. It counts in the top-level progress and `assets[name]` (with `direct: true`), not in `progress.bundles`. It sends `AssetLoaded { manifest, asset, status }` (`loaded`, `fallback` or `missing`) or `AssetFailed { manifest, asset, src, error }`, and rejects with an `AssetLoadError`; calling it again retries a failed asset. `setAssetLoader` applies to it.

```ts
import { AssetLoaded, defineAssets, getAsset, loadAsset, unloadAsset, type SystemCtx } from "fenrir-ts";
import "fenrir-ts/2d";

const Cards = defineAssets("myGame.cards", {
  assets: {
    ace: { kind: "texture2d", src: "cards/ace.png" },
    // Decoration: if it fails the card still shows, with no shine.
    shine: { kind: "texture2d", src: "cards/shine.png", optional: true },
  },
  bundles: {},
});

function cardScrolledIn(ctx: SystemCtx): void {
  void loadAsset(ctx, Cards, ["ace", "shine"]); // not awaited: AssetLoaded fires per asset
}

function cardScrolledOut(ctx: SystemCtx): void {
  unloadAsset(ctx, Cards, ["ace", "shine"]); // despawn what shows them first
}

game.on(AssetLoaded, ({ manifest, asset }, ctx) => {
  if (manifest !== Cards.name || asset !== "shine") return;
  const shine = getAsset(ctx, Cards, "shine"); // Texture | undefined: optional
  if (shine) ctx.logger.info("shine ready");
});
```

- **Unloading.** `unloadAssets` drops each asset no other loading or loaded bundle holds, from any manifest, and calls its loader's `unload`. For 2D textures that is Pixi's `Assets.unload`, which destroys the texture: Pixi's cache owns 2D textures. Despawn the entities that show a bundle's textures before unloading it; nothing tracks them, and a sprite left on a destroyed texture draws nothing or fails to render. Unloading a bundle that is still loading rejects its promise. A custom loader frees its assets with `unload` in its `LoaderConfig`.

Tests replace the loaders with `setAssetLoader(game, { load, unload? })`, so each asset resolves or fails when the test says, with no network and no canvas:

```ts
import { createTestGame, defineAssets, getAsset, loadAssets, setAssetLoader } from "fenrir-ts";
import "fenrir-ts/2d"; // the texture2d kind
import type { Texture } from "pixi.js";
import { expect, it } from "vitest";

const GameAssets = defineAssets("myGame.assets", {
  assets: {
    logo: { kind: "texture2d", src: "img/logo.png" },
    missing: { kind: "texture2d", src: "img/missing.png" },
    reef: { kind: "texture2d", src: "img/reef.webp", fallback: "missing" },
  },
  bundles: { boot: ["logo", "missing"], reef: ["reef", "logo"] },
});

it("shows the reef's progress and falls back when reef.webp fails", async () => {
  const game = await createTestGame({ seed: 1 });
  const textures: Record<string, Texture> = { logo: {} as Texture, missing: {} as Texture };
  setAssetLoader(game, {
    load: async ({ name }) => textures[name] ?? Promise.reject(new Error("404")),
  });
  await loadAssets(game, GameAssets, "reef");
  expect(game.resources.get(GameAssets.progress).bundles.reef).toMatchObject({ status: "loaded", fraction: 1 });
  expect(getAsset(game, GameAssets, "reef")).toBe(textures.missing);
});
```

### Timers and tweens

Timers and tweens are plain data on entities, run by the opt-in `motion()` plugin from `fenrir-ts`. They advance with game time only (`time.delta`), so they pause with the game, run headless in `createTestGame` and give the same values for the same steps. A game that does not install `motion()` and import these names ships none of this code.

```ts
import { EntityBuilder, MotionSettings, Schedule, TimerFired, TweenDone, addTimer, addTween, createGame, defineState, motion, type SystemCtx } from "fenrir-ts";
import { Display2D, Transform2D, pixi2d } from "fenrir-ts/2d";

const Phase = defineState("myGame.Phase", { values: ["playing", "over"], initial: "playing" });
const Overlay = defineState("myGame.Overlay", { values: ["closed", "open"], initial: "closed" });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [motion(), pixi2d({ design: { width: 390, minHeight: 520 } })] });
const fired = game.events.createReader(TimerFired);
const finished = game.events.createReader(TweenDone);

// Respect the player's setting: every tween jumps to its end values and still sends TweenDone.
game.resources.get(MotionSettings).reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

function spawn(ctx: SystemCtx): void {
  const fish = EntityBuilder.create().transform2D(40, 420).display2D({ alpha: 0 }).spawn(ctx.entities);
  // A leap along an arc: three tweens on one entity, each driving its own fields.
  addTween(ctx, fish, Display2D, { to: { alpha: 1 }, duration: 0.2 });
  addTween(ctx, fish, Transform2D, { to: { x: 320, rotation: Math.PI }, duration: 0.8, ease: "sineInOut", name: "myGame.leap" });
  addTween(ctx, fish, Transform2D, { to: { y: 260 }, duration: 0.4, ease: "quadOut", repeat: 1, yoyo: true });

  // Ambient motion in a group, so an overlay can pause it while the rest of the game runs.
  const buoy = EntityBuilder.create().transform2D(200, 300).spawn(ctx.entities);
  addTween(ctx, buoy, Transform2D, { to: { y: 306 }, duration: 1.2, ease: "sineInOut", repeat: Infinity, yoyo: true, group: "ambient" });

  // Fires once after 30 s of play; removed unfired if Phase leaves "playing" first.
  addTimer(ctx, fish, "myGame.roundOver", { duration: 30, state: [Phase, "playing"] });
}

function react({ states, logger, resources }: SystemCtx): void {
  for (const { name } of fired.read()) if (name === "myGame.roundOver") states.set(Phase, "over");
  for (const { name } of finished.read()) if (name === "myGame.leap") logger.info("splash");
  resources.get(MotionSettings).paused.ambient = states.get(Overlay) === "open";
}

game.addSystem(Schedule.Init, spawn).addSystem(Schedule.Update, react);
await game.run();
```

- `addTween(ctx, entity, Component, options)` tweens numeric fields of a component on the same entity: `Transform2D`, `Display2D` or any game component of plain numbers. Fields are the keys of `to` (and `from`), checked by TypeScript against the component's number fields, so there are no string paths. Options: `duration` (seconds per play), `from` (default: the component's values when the delay ends), `delay`, `ease`, `repeat` (plays after the first; `Infinity` loops), `yoyo`, `name` and `group`. The entity must have the component when the tween is added.
- `ease` is a name, so tween data stays JSON: `linear` (the default), `quadIn`, `quadOut`, `quadInOut`, `cubicIn`, `cubicOut`, `cubicInOut`, `sineIn`, `sineOut`, `sineInOut` and `backOut`, which overshoots and settles. The functions are on `easings`; `defineEasing("myGame.steps", fn)` adds one by name.
- A tween is named after its component and fields unless given a `name`, such as `fenrir.Transform2D:x,y`. Adding a tween with a running one's name replaces it, and the newest tween of a field takes that field from any older tween, so tweening `x` again mid-move just works. A replaced or cancelled tween sends nothing.
- `addTimer(ctx, entity, name, { duration, repeat?, group?, state? })` sends `TimerFired { entity, name, count, last }` each time it fires. `state: [Phase, "playing"]` removes it, unfired, once `Phase` leaves that value, so do not make "paused" a value of that state: keep pause in a state of its own, or pause the timer (`paused`, a group or `pausedAll`, below). For how long a state has had its value, use `states.timeIn`; a timer is for something that must happen at a time.
- A tween ends exactly on its end values (on its start values after an even number of yoyo plays) and sends `TweenDone { entity, name }`. A frame that runs past the end of a play carries the rest into the next play, and a long frame fires a repeating timer as many times as it holds. Finished timers and tweens are removed, so a running one is one that is present.
- Both live in components, `Timers` and `Tweens` (records by name), that `inspect(game)` shows as plain JSON with their `elapsed` time. Each entry has a `paused` field to pause and resume it; `MotionSettings.paused[group] = true` pauses a group of them; `cancelTimer` and `cancelTween` remove one; removing the component or destroying the entity removes them all. If the tweened component is removed, its tweens are dropped without `TweenDone`.
- `motion()` registers `fenrir.motion.preUpdate`. Plugins install before the game adds systems, so it runs first in `PreUpdate`: `Update` systems and the renderer see this frame's values, and `TimerFired` and `TweenDone` are read in the same frame. Timers and tweens added in `Update` start moving the next frame.
- `MotionSettings.pausedAll = true` pauses every timer and tween, grouped or not, for a pause menu that leaves the rest of the game running. Settings are read when the motion system runs, so a pause set in `Update` holds from the next frame. For a pause that also stops this frame's advance, decide it in `PreUpdate` before the motion system, where this frame's input is already latched:

```ts
import { MotionSettings, Schedule, defineAction, type SystemCtx } from "fenrir-ts";

const Pause = defineAction("myGame.pause", ["Escape", "KeyP"]);

function pauseMenu({ input, resources }: SystemCtx): void {
  const settings = resources.get(MotionSettings);
  if (input.pressed(Pause)) settings.pausedAll = !settings.pausedAll;
}

game.addSystem(Schedule.PreUpdate, pauseMenu, { before: "fenrir.motion.preUpdate" });
```

- Timers and tweens are entity data, so they stay across `stop()` and `run()` and carry on where they were, as entities do. A paused game moves none of them.

### Audio

Sounds come from `fenrir-ts/audio`, which needs no peer package (Web Audio only). Declare each sound once with `defineSound`, as a sample (an `audio` asset of a manifest, so it preloads in a bundle with progress) or a synth (a function that builds nodes on the `AudioContext`), and play it by its handle from systems. The `audio()` plugin starts output inside the first user gesture on the canvas, with no game code. A game that does not import `fenrir-ts/audio` ships none of this code.

```ts
import { Schedule, createGame, defineAction, defineAssets, defineStorageKey, loadAssets, persistResource, storage, type SystemCtx } from "fenrir-ts";
import { AudioState, audio, defineSound, playSound, stopSound, type Synth } from "fenrir-ts/audio";
import { pixi2d } from "fenrir-ts/2d";

const Sounds = defineAssets("myGame.sounds", {
  assets: { tap: { kind: "audio", src: "sfx/tap.mp3" }, theme: { kind: "audio", src: "music/theme.mp3" } },
  bundles: { boot: ["tap", "theme"] },
});

// A synthesized sound: two quick notes. It returns the source that ends last. Its parameters are
// typed: the sound gives every one, and each play may change some.
const coin: Synth<{ low: number; high: number }> = (context, output, { rate, params }) => {
  const osc = context.createOscillator();
  const env = context.createGain();
  osc.frequency.setValueAtTime(params.low * rate, context.currentTime);
  osc.frequency.setValueAtTime(params.high * rate, context.currentTime + 0.06);
  env.gain.setValueAtTime(0.3, context.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
  osc.connect(env).connect(output);
  osc.start();
  osc.stop(context.currentTime + 0.3);
  return osc;
};

const Tap = defineSound("myGame.tap", { sample: "tap", volume: 0.8 });
const Coin = defineSound("myGame.coin", { synth: coin, params: { low: 988, high: 1319 }, limit: 3 });
const Theme = defineSound("myGame.theme", { sample: "theme", bus: "music", loop: true });
const Muted = defineStorageKey("myGame.muted", { default: false });
const ToggleMute = defineAction("myGame.toggleMute", ["KeyM"]);
const Jump = defineAction("myGame.jump", ["Space", "pointer.primary"]);
const Quit = defineAction("myGame.quit", ["Escape"]);

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [audio(), storage(), pixi2d()] });
// The game keeps mute, not the engine: loaded now, saved at the end of each frame it changes in.
persistResource(game, AudioState, "muted", Muted);

async function loadSounds(ctx: SystemCtx): Promise<void> {
  await loadAssets(ctx, Sounds, "boot");
  playSound(ctx, Theme); // a loop: queued until the first gesture, then it starts
}

let combo = 0;
function play(ctx: SystemCtx): void {
  const { input, random, resources } = ctx;
  if (input.pressed(ToggleMute)) {
    const audioState = resources.get(AudioState);
    audioState.muted = !audioState.muted; // applied, and saved, by the end of the frame
  }
  if (input.pressed(Jump)) playSound(ctx, Tap); // a one-shot: dropped while output is locked
  if (input.pressed(Jump) && random.next() < 0.2) {
    // One sound, a variant per combo step: the high note climbs a semitone each time.
    playSound(ctx, Coin, { rate: 0.9 + random.next() * 0.2, params: { high: 1319 * 2 ** (combo++ / 12) } });
  }
  if (input.pressed(Quit)) stopSound(ctx, Theme, { fade: 1 });
}

game.addSystem(Schedule.PreInit, loadSounds).addSystem(Schedule.Update, play);
await game.run();
```

- **Unlock.** Browsers start audio only inside a user gesture. The plugin starts output from `input.onGesture`, so the first key press, tap or click on the canvas starts it (on `pointerup` too, which iOS Safari needs). Where autoplay is allowed it starts when the run starts. For a gesture outside the canvas, such as an HTML menu button, call `unlockAudio(ctx)` in its handler. `AudioState.status` is `locked`, `running`, `suspended` or `unavailable`, and `AudioUnlocked` is sent once, the first time output runs.
- **Before unlock.** A one-shot played while output is not running is dropped and counted in `AudioState.dropped`: a tap sound played seconds late reads as a bug. A looping sound is queued in `AudioState.queued` and starts when output runs, so music asked for at startup begins at the first gesture. The same holds while the page is hidden.
- **Playing.** `playSound(ctx, sound, { volume?, rate?, params? })` returns whether it plays (for a loop: plays or is queued). `params` reach a synth as `params`, laid over the sound's own: a `Synth<P>` types them, `defineSound` then needs every field of `P` as `params`, and a play passes only those that differ, so one sound covers its variants. A sample, or a synth without parameters, takes none (a compile error, and a throw). A looping sound plays once at a time; playing it again does nothing. Each sound has a `limit` of instances (4 by default, 1 for a loop): one more stops the oldest. A sample whose asset is not loaded is dropped and logged once. `stopSound(ctx, sound, { fade? })` stops every instance, fading over `fade` seconds.
- **Volume.** `AudioState` is plain data the game edits: `muted`, `volume` (master) and `buses[name].volume` and `.muted`. Buses are `sfx` (the default for a sound) and `music`, or whatever `audio({ buses })` names. Changes apply by the end of the frame and to every sound as it starts. The engine does not save mute: bind it to a key of the game's with `persistResource` from `storage()`, as above, so the game decides the key.
- **Lifecycle.** Output is suspended while the page is hidden and resumed when it shows; a loop keeps its place. When the run stops, every sound stops and output is suspended; the next `run()` resumes it without a new gesture. A paused game keeps playing. `AudioState.playing` counts instances by sound name, and `inspect(game)` shows all of it under `fenrir.AudioState`.
- **Samples.** `fenrir-ts/audio` adds the `audio` asset kind. The plugin registers its loader (fetch, then decode), so manifests load samples with progress, fallbacks and unload. Before output starts, samples decode on an `OfflineAudioContext`: no `AudioContext` is created outside a gesture.
- **Backends.** The output is an `AudioBackend`: `webAudio()` by default, `testAudio()` in tests, or a host app's own (`audio({ backend })`). The engine decides what plays, when and how loud; a backend only does it.

Tests pass `testAudio()` as the backend: nothing is heard, output stays locked until a gesture (`game.input.pointerDown`) unless `{ autoplay: true }`, and `played` lists each voice in order with its bus, volume and rate:

```ts
import { Schedule, createTestGame } from "fenrir-ts";
import { AudioState, audio, defineSound, playSound, testAudio, type Synth } from "fenrir-ts/audio";
import { expect, it } from "vitest";

const blip: Synth = (context, output) => {
  const osc = context.createOscillator();
  osc.connect(output);
  osc.start();
  return osc;
};
const Blip = defineSound("myGame.blip", { synth: blip, volume: 0.5 });

it("plays nothing until the first tap", async () => {
  const sounds = testAudio();
  const game = await createTestGame({ seed: 1, plugins: [audio({ backend: sounds })] });
  game.addSystem(Schedule.Update, (ctx) => void playSound(ctx, Blip, { rate: 2 }), { name: "myGame.blip" });
  await game.start();
  game.step();
  expect(game.resources.get(AudioState)).toMatchObject({ status: "locked", dropped: 1 });
  game.input.pointerDown(10, 10);
  game.step();
  expect(sounds.played).toMatchObject([{ sound: "myGame.blip", bus: "sfx", volume: 0.5, rate: 2 }]);
  await game.stop();
});
```

### Storage

Typed, versioned values in `localStorage`, from the opt-in `storage()` plugin in `fenrir-ts`. A key has a default and a parser, so a read never throws and never returns a value of the wrong shape. Nothing throws on write either: when storage is unavailable or full, values live in memory for the session and the game carries on. A game that does not install `storage()` and import these names ships none of this code.

```ts
import { createGame, defineStorageKey, getStored, setStored, storage, updateStored, type SystemCtx } from "fenrir-ts";

const Muted = defineStorageKey("myGame.muted", { default: false });

type Progress = { best: number; level: number };
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const Progress = defineStorageKey<Progress>("myGame.progress", {
  default: { best: 0, level: 1 },
  version: 2,
  parse: (v) => (isRecord(v) && typeof v.best === "number" && typeof v.level === "number" ? { best: v.best, level: v.level } : undefined),
  // Version 1, and the game's own localStorage code before it (version 0), stored the best score as a number.
  migrate: (v, from) => (from < 2 && typeof v === "number" ? { best: v, level: 1 } : v),
});

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [storage()] });

function finishRound(ctx: SystemCtx, score: number): void {
  updateStored(ctx, Progress, (p) => ({ ...p, best: Math.max(p.best, score) }));
  if (getStored(ctx, Muted)) setStored(ctx, Muted, false);
}
```

- **Keys.** `defineStorageKey(name, { default, parse?, version?, migrate? })`; `version` defaults to 1. The name is namespaced, like a component's (`myGame.muted`), and is the key in `localStorage`, so two games on one origin do not collide; `storage({ prefix: "slot2:" })` adds a prefix for save slots or players. Values are stored as JSON with their version: `{"v":2,"value":{"best":40,"level":1}}`. Without `parse`, a stored value must have the default's `typeof`; pass `parse` for objects.
- **Reads.** `getStored(ctx, key)` returns the value set this session, else the stored value if it parses, else the default (objects copied). A missing key, unreadable storage, text that is not JSON, a value from a newer version and a value that does not parse all give the default; all but the first log one warning per key. Reads are cached, so reading every frame is cheap; mutating a returned object changes the cache only, so call `setStored` to save it.
- **Writes.** `setStored`, `updateStored` and `removeStored` never throw. A write the backend refuses (quota, storage blocked in a webview) keeps the value in memory for the session, logs once per key and returns false.
- **Migration.** A value stored with an older `version` goes through `migrate(value, from)`, then `parse`, and is written back. A value not written by Fenrir is version 0: its JSON, or its raw text if it is not JSON, so a game can adopt the keys its own code wrote before.
- **Status.** `StorageStatus` (`fenrir.StorageStatus`, shown by `inspect(game)`) is `{ backend, persistent, lastError }`: `persistent` is false when `localStorage` was unavailable at install (one warning, then memory), and `lastError` is the latest failure with its key.
- **Backends.** `localStorage` by default. `storage({ backend: memoryStorage() })` in tests, where `backend.items` is the `Map` written to. A backend is synchronous (`getItem`, `setItem`, `removeItem`), so systems read without awaiting; one backed by an asynchronous store, such as a host app's bridge in a webview, adds `hydrate()`, which the plugin awaits once in `fenrir.storage.preInit` before the game's startup systems.
- **Lifetime.** Values are not tied to a run: they stay across `stop()` and `run()`. Changes from another tab are not picked up while a value is cached. To test a reload, build a second `createTestGame` with `storage({ backend })` on the same `memoryStorage()` object.
- **Families.** `defineStorageKeyFamily(prefix, options)` takes the options of `defineStorageKey` and returns `family(suffix)`: the key named `prefix + suffix`, made once and the same object on every call after, for keys per player, level or save slot. The prefix is used as given, so end it with its separator.
- **Keeping old builds working.** By default a migrated value is written back on its first read. `writeMigrated: false` keeps it in memory and leaves the old value stored until the game next writes the key, so an older build can still read it: a release can be rolled back. Each session then migrates on its first read.
- **Resource fields.** `persistResource(game, Resource, field, key)` keeps one field of a resource in a key: it loads the field at once (after `hydrate`, with a backend that has one), and saves it with `setStored` at the end of each frame it changed in and when the run stops. Objects compare as JSON, so an edit in place counts. Call it after `createGame`, once the plugin that adds the resource is installed; a resource with a factory counts as having a value (the factory runs at the call), and it throws if the resource has neither a value nor a factory or the key is already bound, and returns a function that ends the binding. The engine binds nothing by default.

```ts
import { createGame, defineResource, defineStorageKey, defineStorageKeyFamily, getStored, persistResource, setStored, storage, type SystemCtx } from "fenrir-ts";

const Settings = defineResource("myGame.Settings", () => ({ hints: true, sensitivity: 1 }));
const Hints = defineStorageKey("myGame.hints", { default: true });
const BestTime = defineStorageKeyFamily("myGame.bestTime.", { default: 0, writeMigrated: false });

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [storage()] });
persistResource(game, Settings, "hints", Hints); // Settings.hints now loads and saves itself

function finishLevel(ctx: SystemCtx, level: string, seconds: number): void {
  const best = getStored(ctx, BestTime(level)); // "myGame.bestTime.<level>"
  if (!best || seconds < best) setStored(ctx, BestTime(level), seconds);
}
```

### Input

Systems read actions, not DOM events. `defineAction(name, bindings)` names something the player does and binds it to keys by `KeyboardEvent.code` (`"KeyA"`, `"Space"`, `"ArrowLeft"`, `"Enter"`) and to `"pointer.primary"` (left mouse button, a finger or a pen) or `"pointer.secondary"` (right mouse button). An unknown binding such as `"space"` or `"A"` is a compile error. `createGame` installs input: there is nothing to register.

```ts
import { Schedule, createGame, defineAction, type SystemCtx } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";

const Tap = defineAction("myGame.tap", ["pointer.primary", "Space", "Enter"]);
const Left = defineAction("myGame.left", ["ArrowLeft", "KeyA"]);

const canvas = document.querySelector<HTMLCanvasElement>("#game")!; // the engine makes it focusable
const game = await createGame({ canvas, plugins: [pixi2d({ design: { width: 390, minHeight: 520 } })] });

// A region that swallows taps, such as a top bar drawn over the playfield. Buttons are
// controls from fenrir-ts/ui, which consume their own taps; this is for everything else.
function topBar({ input }: SystemCtx): void {
  if (input.pressed(Tap) && input.pointer.y < 60) input.consumePointer();
}

function play({ input, logger }: SystemCtx): void {
  if (input.pressed(Tap)) logger.info(`tap at ${input.pointer.x}, ${input.pointer.y}`); // design units
  if (input.held(Left)) logger.debug("moving left");
}

game
  .addSystem(Schedule.Update, topBar, { before: "play" })
  .addSystem(Schedule.Update, play);
await game.run();
```

`ctx.input` and `game.input` are the same object:

| Read | Means |
| --- | --- |
| `pressed(action)` | The action went down this frame: none of its bindings was held last frame and one is now |
| `released(action)` | The action went up this frame: it was held last frame and no binding is down now |
| `held(action)` | Any of its bindings is down |
| `pointer` | `{ x, y, down, inside, cancelled }`: the primary pointer's last position in logical units, whether it is down, whether it is over the canvas, and whether this frame's release was a cancel rather than a lift |
| `focused` | The canvas had keyboard focus when the frame started |
| `edges(actions)` | This frame's presses and releases of `actions`, in the order they happened, repeats kept |
| `consumePointer()` | Stops this frame's pointer press reaching actions, for UI that handled it |
| `consume(action)` | Stops this frame's press of `action` reaching later systems, whichever binding pressed it |
| `onDown(action, handler)` | Setup: runs `handler` inside the DOM event that presses a binding; returning `true` prevents its default |
| `onGesture(handler)` | Setup: runs `handler` inside every user gesture on the canvas, for calls such as `audioContext.resume()` |

**Frames.** Input is latched when a frame starts, before `PreUpdate`, so every system in the frame, in every stage, reads the same answers; an event that arrives during a frame counts from the next one. `pressed` and `released` are each true for exactly one frame. A tap that goes down and up between two frames is not lost: it is pressed and held in one frame and released in the next. A second binding going down while another is held gives no second `pressed`. Two presses of the same binding between two frames count as one; `edges` keeps both.

**Tick.** In the `Tick` stage, `pressed` and `released` are true in exactly one tick: the first tick that runs after the edge. A frame that runs several ticks reports the press in the first only; a frame that runs none keeps it for the next frame's first tick. A tap carried past a frame with no tick can be pressed and released in the same tick. `held` is the frame's answer in every tick.

**Pointer.** Mouse, touch and pen all drive the primary pointer. Only the primary pointer counts: a second finger is ignored, and while one pointer is down no other moves it. `x` and `y` are logical units: design units with `pixi2d({ design })`, otherwise CSS pixels from the canvas's top-left corner. They keep the last position after the pointer lifts or leaves. `inside` is false once the mouse leaves the canvas or a finger lifts.

**consumePointer and consume.** Systems that run after `consumePointer()` see no `pressed`, `held` or `released` from the pointer bindings until the pointer lifts, so the matching release is hidden too. Keys bound to the same action still count, and `pointer.down` still reports the pointer. `consume(action)` does the same for whichever of the action's bindings went down this frame, keys included, so Enter on a focused canvas button does not also reach gameplay; any other action bound to the same key is hidden with it. Systems that ran earlier in the frame already saw the press, so the UI system must run first: in the same stage with `before` (as above), or in `PreUpdate` when gameplay reads input in `Tick`. With no new press of those bindings this frame they do nothing. Consuming hides only the press it was given: once the key or button lifts, its next press is seen again, even when it goes down in the very next frame or lifts and goes down again between two frames.

**Order.** `pressed` and `released` answer per frame. When order matters, as for keyboard focus moving between canvas controls, read `edges(actions)`: every press and release of those actions since the last frame, in the order the keys and buttons went down and up. Two quick ArrowRights are two `pressed` edges, and "Enter, Tab" and "Tab, Enter" differ. An action is pressed when its first binding goes down and released when its last goes up. A quick tap is `pressed` then `released` in one frame's list, the frame where `pressed()` is true. Each edge's `binding` is the key or button that made it; one key bound to several of `actions` gives each an edge with that binding, next to each other. Consumed bindings are left out until they lift. In `Tick` the list is the frame's in every tick, so read it in `PreUpdate` or `Update`.

```ts
import { Schedule, defineAction, type SystemCtx } from "fenrir-ts";

const FocusNext = defineAction("myGame.focusNext", ["ArrowRight", "ArrowDown"]);
const Activate = defineAction("myGame.activate", ["Enter", "Space"]);
const FOCUS_ACTIONS = [FocusNext, Activate];
declare const menu: { focusNext(): void; activate(): void };

function navigateMenu({ input }: SystemCtx): void {
  for (const { action, kind } of input.edges(FOCUS_ACTIONS)) {
    if (kind !== "pressed") continue;
    if (action === FocusNext) menu.focusNext();
    else menu.activate();
  }
}

game.addSystem(Schedule.Update, navigateMenu);
```

**Inside the DOM event.** Systems run in the next frame, after the browser has acted on an event. Two things cannot wait. Both are setup, registered once like `game.on`: they stay across `stop()` and `run()`, are called only while the game runs, with the run's `ctx`, and are removed by the function they return.

- `input.onDown(action, handler)` runs inside each `keydown` of a bound key (auto-repeats included) and the pointer event that presses a bound button, before the press is latched. Return `true` and the engine calls `preventDefault()`, for example to keep Tab on the canvas while a canvas control can take focus, and let it leave after the last one. The press is latched either way.
- `input.onGesture(handler)` runs inside each `keydown` that is not a repeat, `pointerdown` and `pointerup` on the canvas. Browsers allow some calls only inside a user gesture, such as starting audio on iOS Safari, where a touch counts on `pointerup`.

A handler that throws is logged and the others still run; a throwing `onDown` handler does not claim.

```ts
import { defineAction } from "fenrir-ts";

const FocusNext = defineAction("myGame.focusNext", ["Tab"]);
declare const ui: { hasNextControl(backwards: boolean): boolean };
const audio = new AudioContext();

// Tab moves between canvas controls, and leaves the canvas after the last one.
game.input.onDown(FocusNext, (event) => ui.hasNextControl(event instanceof KeyboardEvent && event.shiftKey));
// iOS Safari starts audio only inside a gesture. The audio() plugin from fenrir-ts/audio does this for you.
game.input.onGesture(() => {
  if (audio.state === "suspended") void audio.resume();
});
```

**Focus.** The engine listens on the canvas only. Keyboard events reach a canvas only while it has focus, so keys do nothing until the player clicks or taps the canvas, or the page calls `canvas.focus()`. If the canvas has no `tabindex`, the engine sets `tabindex="0"` while the game runs, so a click focuses it; a press on the canvas also focuses it. If your keys do nothing, the canvas does not have focus: check `document.activeElement`. `input.focused` tells systems whether the canvas had focus when the frame started, for example to hide a focus ring once it is lost; losing focus also releases everything held (see "Stuck input").

**Prevented defaults.** Only on the canvas, never elsewhere on the page: page scrolling on Space and the arrow keys (keydown), touch scrolling and pinch zoom (`touch-action: none`, restored when the game stops), and the context menu, so a secondary press reaches the game. Tab, Enter and every other key keep their defaults, unless an `onDown` handler claims the press.

**Stuck input.** Everything held is released, with a `released` edge next frame, when the canvas loses focus (which includes the window losing focus), when the page is hidden, on `pointercancel`, and when pointer capture is lost. A press captures the pointer, so its release arrives even when it lifts outside the canvas. When the pointer is released by anything but a lift (`pointercancel`, lost capture, focus loss or a hidden page), `pointer.cancelled` is true in the frame that reports the release, so a button that acts on release can ignore it: `if (input.released(Tap) && !input.pointer.cancelled)`. Stopping the game clears input, and every listener belongs to the run: a stopped game, or one whose startup threw, leaves none behind.

In a test game, `game.input` also stands in for the player. Each call takes effect when the next frame starts:

```ts
import { Schedule, createTestGame, defineAction, type SystemCtx } from "fenrir-ts";
import { expect, it } from "vitest";

const Tap = defineAction("myGame.tap", ["pointer.primary", "Space", "Enter"]);
const taps: Array<{ x: number; y: number }> = [];

function countTaps({ input }: SystemCtx): void {
  if (input.pressed(Tap)) taps.push({ x: input.pointer.x, y: input.pointer.y });
}

it("counts a tap at the pointer and one from the keyboard", async () => {
  const game = await createTestGame({ seed: 1 });
  game.addSystem(Schedule.Update, countTaps);
  await game.start();

  game.input.pointerDown(120, 340); // logical units
  game.input.pointerUp(); // a quick tap: pressed next frame, released the one after
  game.step(1 / 60, 2);
  game.input.press(Tap); // presses the action's first binding
  game.step();
  game.input.release(Tap); // releases all its bindings
  game.step();

  expect(taps).toEqual([{ x: 120, y: 340 }, { x: 120, y: 340 }]);
  await game.stop();
});
```

`press`, `release`, `pointerDown(x, y)`, `pointerMove(x, y)`, `pointerUp()`, `pointerCancel()`, `focus()` and `blur()` exist only on a test game's input. Coordinates are logical, whatever the `Viewport` resource says. `press(action, event?)` and `pointerDown` call the `onDown` handlers and then the `onGesture` handlers at once, as the DOM event would, and return whether a handler claimed the press; `pointerUp` is a gesture too. `press` passes `event` to the handlers, for example a `KeyboardEvent` with `shiftKey`. A pointer press focuses the canvas, as in the browser, and `blur()` releases everything held.

**Browser tests.** The engine reads pointer buttons from `event.buttons`, which browsers always set. A synthetic `new PointerEvent("pointerdown", { button: 0 })` has `buttons: 0`, so the engine sees no press at all. Dispatch the press with `buttons: 1` and a matching `pointerup` with `buttons: 0`, on the canvas, from the primary pointer:

```ts
declare const canvas: HTMLCanvasElement;
for (const [type, buttons] of [["pointerdown", 1], ["pointerup", 0]] as const) {
  canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, isPrimary: true, pointerId: 1, button: 0, buttons, clientX: 10, clientY: 10 }));
}
```

Playwright's `locator.click()` and `page.mouse` send real browser input and need nothing extra.

### UI controls

`fenrir-ts/ui` turns Pixi nodes the game drew into buttons: tappable, focusable with the keyboard, described to screen readers through the canvas, and gone when the node is destroyed. The game draws every pixel; the kit adds no DOM elements and patches no class. Its peer is `pixi.js`, and a game that does not import it ships none of its code.

```ts
import { Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";
import { ControlActivated, control, modalScope, paginate, ui } from "fenrir-ts/ui";
import { Container, Graphics } from "pixi.js";

const pixi = pixi2d({ design: { width: 390, minHeight: 520 }, layers: ["world", "overlay"] });
const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi, ui({ pixi, summary: "Town" })] });

const shop = { open: true, page: 0, coins: 40, dirty: true };
const ITEMS = ["sword", "shield", "potion", "bow", "arrows"];
const sheet = new Container();

function drawShop(ctx: SystemCtx): void {
  for (const child of sheet.removeChildren()) child.destroy({ children: true }); // rebuilt from state
  sheet.visible = shop.open;
  if (!shop.open) return;
  modalScope(sheet, { label: "Shop", onClose: () => ((shop.open = false), (shop.dirty = true)) });
  const { rows, page, pages } = paginate(ITEMS, 3, shop.page);
  rows.forEach((item, i) => {
    const row = sheet.addChild(new Graphics().roundRect(0, 0, 300, 48, 8).fill(0x2b5d7a));
    row.position.set(45, 80 + i * 60);
    control(row, { id: `buy-${item}`, label: `Buy ${item}, 50 coins`, disabled: shop.coins < 50, onActivate: () => ctx.logger.info(`bought ${item}`) });
  });
  const next = sheet.addChild(new Graphics().circle(0, 0, 24).fill(0x3b6d8a));
  next.position.set(345, 300);
  control(next, { id: "next-page", label: `Page ${page + 1} of ${pages}`, hitArea: { x: 0, y: 0, radius: 32 }, onActivate: () => ((shop.page = page + 1), (shop.dirty = true)) });
}

game.on(ControlActivated, ({ id, via }) => game.logger.debug(`${id} by ${via}`)); // a click sound, analytics
game
  .addSystem(Schedule.Init, function mountShop() {
    pixi.renderer.layer("overlay").addChild(sheet);
  })
  .addSystem(Schedule.Update, function redrawShop(ctx: SystemCtx) {
    if (shop.dirty) drawShop(ctx);
    shop.dirty = false;
  });
await game.run();
```

- **Plugin.** `ui({ pixi, keys?, arrows?, tapFocus?, blurFocus?, focusRing?, summary?, hint?, actions?, onAction? })`, listed after `pixi2d` and given that plugin, so the kit reaches its `root` and `backdrop` without `pixi2d` carrying any code for it. Without it, `createGame` rejects with a message that says so. A test game, which has no renderer, passes `ui({ root })`: a container whose units are the logical units the pointer reports.
- **Controls.** `control(node, { id, label, onActivate?, disabled?, hitArea?, order?, activateOn?, passThrough? })` returns `node`. A control is live while its node is under `root` or `backdrop` and it and every ancestor are `visible` and `renderable`. The kit keeps no list of controls: options are held against the node in a `WeakMap`, and each frame it walks the display tree for live ones, so clearing and redrawing a sheet every state change leaves nothing behind. Calling `control` again on a node replaces its options.
- **Hit areas** come from the node's local bounds (children included) unless `hitArea` gives a rectangle `{ x, y, width, height }` or a circle `{ x, y, radius }` in the node's own units; Pixi's `Rectangle` and `Circle` fit. Points are tested in the node's space, so scaled, rotated and nested nodes, the `Viewport` design frame, letterboxing and resizes all line up with what is drawn. Where controls overlap, the one drawn on top wins.
- **Pointer.** A control activates when the primary pointer goes down and comes up over it, in the frame that reports the release. The press is consumed (`input.consumePointer()`), so systems after `fenrir.ui.preUpdate` do not see a tap that hit a control. A press that slides off, or one the browser cancels (`pointer.cancelled`), activates nothing. The cursor is `pointer` over an enabled control. A quick second press, even in the very next frame, is a new tap.
- **Press-time and pass-through controls.** `activateOn: "press"` activates in the frame of the press, for a button that times a tap; sliding off or a cancel then changes nothing. `passThrough: true` leaves the press unconsumed, so gameplay still sees `pressed`, even inside a modal scope; the control still takes focus, is labelled and activates as `activateOn` says. With `passThrough`, Enter, NumpadEnter or Space on the focused control is left unconsumed too, so gameplay sees the key as its own press. A press the kit took this way, by key or pointer, does not also go to `onAction`. Together they make a focusable, labelled gameplay button whose tap or key the game also times.
- **Keyboard.** Tab and Shift+Tab move focus in display order (depth first, back to front), then by `order` (lower first, default 0). Tab is kept on the canvas while there is a control to move to and leaves it past either end, decided inside the `keydown` with `input.onDown`. A Tab typed after another press the kit reads (one of its keys, a pointer press or one of `actions`) and before the next frame stays on the canvas, since that press acts first and may move focus or open a sheet; Tabs still waiting for the frame are counted, so a second Tab past the last control still leaves. The arrows move focus too, wrapping, but only once a control has focus or a modal scope is open, so a game can use them for movement. `arrows: "linear"` makes them stop at the first and last control and work from no focus (`next` goes to the first control, `previous` to the last); they are then the kit's whenever a control is live. `arrows: "clear"` is the same, except that past the first or last control focus goes to none, still on the canvas, and the next arrow starts again from no focus. Enter, NumpadEnter and Space activate the focused control and are consumed (unless it is `passThrough`); with nothing focused they are the game's. Change the keys with `ui({ keys: { tab, next, previous, activate, close } })`; an empty list turns one off.
- **One ordered pass.** The kit reads its keys and pointer presses in `fenrir.ui.preUpdate`, in the order they arrived (`input.edges`). Give it the game's own keys with `actions` and `onAction(ctx, action)` and they join that pass: for each press of one, in typed order, the kit calls `onAction`, then reads the display tree again, so a sheet drawn there is live for the next key. Enter that opens a sheet and an Escape typed after it in the same frame open and then close it. A key the kit uses acts first under its own rules (Enter on a focused control activates it and never reaches `onAction`). Return `true` to consume the press; otherwise later systems see it too.
- **Focus.** `UiFocus` (`fenrir.UiFocus`) is `{ id, visible }`: set `id` to move focus. It survives a redraw when a control with the same id is live again by the next frame, and is cleared otherwise. It is also cleared each time the kit reads the display tree (after each activation, `onClose` and `onAction`, and at the start and end of the pass) and finds its control blocked by a modal scope, so a HUD control's Enter that opens a sheet and an Escape that closes it in one frame leave nothing focused, as they would a frame apart. A tap focuses the control without showing the ring (`visible: false`), and a tap elsewhere keeps focus; `tapFocus: "clear"` makes every press clear focus instead, so Enter after a tap is the game's again. While the canvas lacks keyboard focus, focus is kept and the ring hidden; `blurFocus: "clear"` clears it instead, in every frame that starts blurred, so returning to the canvas starts from no focus. A key shows the ring. `moveFocus(game, delta, wrap?)` moves focus as an arrow does, from a system (`moveFocus(ctx, 1)`) or a test, and returns the focused id. The default ring is a rounded rectangle drawn above everything in `root` while the canvas has keyboard focus; `focusRing: (ring, bounds, control) => ...` draws your own into a cleared `Graphics`, and `focusRing: false` draws none.
- **Disabled controls** take focus and taps (so a tap on a greyed button does not fall through to the game) and never activate: no `onActivate`, no `ControlActivated`. Screen readers hear ", unavailable".
- **Duplicate ids.** Ids must be unique among live controls. A later live control with an id already seen, in display order, is ignored, and the kit warns once per id.
- **Modal scopes.** `modalScope(node, { label, onClose? })` makes a container modal while it is live: only controls inside it take taps, focus and `activateControl`; every tap, inside or out, is kept from the game; Escape calls `onClose` (the game hides or destroys the node) and is consumed. Keys are not blocked: the game's own key actions still reach gameplay while a scope is open, so gate them on the game's own state (`runIf: inState(Pause, "running")`).
- **Gameplay keys next to controls.** The kit's keys are Tab, the arrows (once a control has focus or a scope is open), and Enter, NumpadEnter and Space (while a control has focus), and it consumes each one it acts on. A game that also plays with the arrows or Space loses them once a tap or Tab has focused a HUD control. Give the kit other keys or none (`ui({ pixi, keys: { next: [], previous: [] } })`), clear focus on taps (`tapFocus: "clear"`) or when the canvas loses focus (`blurFocus: "clear"`), or mark a gameplay button `passThrough`. Scopes nest: the one that became live last is on top, and the one below takes over when it ends. Focus belongs to the scope it was in: when another scope comes on top, a control there with the same id (a shared `close`, say) does not inherit it. `modalScope(node, { focus: "close" })` focuses that control each time the scope comes on top; setting `UiFocus.id` to a different id after the change also works. Redrawing the same scope node keeps focus.
- **Activation.** `onActivate(ctx, via)` runs first, then `ControlActivated { id, via }` is sent, where `via` is `"pointer"`, `"key"` or `"call"`. Both run inside `fenrir.ui.preUpdate`, as do `onClose` and the state hooks a `states.set` there triggers, so they run after `fenrir.motion.preUpdate` (when `motion()` is listed first): a pause they set (`MotionSettings.pausedAll`) holds from the next frame.
- **Order against game systems.** `fenrir.ui.preUpdate` runs in `PreUpdate`, before the game's own `PreUpdate` systems, so taps on controls are consumed before gameplay reads them. A game system that must see a press first passes `{ before: "fenrir.ui.preUpdate" }`. Controls drawn in `Update` are hit-tested from the next frame, where they are what the player sees. The ring, cursor and accessibility output are written by `fenrir.ui.postUpdate`, after `Update` and before the renderer, and by `fenrir.ui.postInit`, before the game's `PostInit` systems, so a scope opened or focus moved in `Update`, and controls drawn at `Init`, are in the frame that is drawn. A game that draws controls later and renders itself, such as in a `PostInit` system that draws the first frame, calls `syncUi(ctx)` before rendering.
- **Accessibility** goes through the canvas only: `aria-label` is the top modal scope's label, else `summary` (a string, or `(ctx) => string | undefined` read each frame, which returns nothing to fall back), else the canvas's own; `aria-description` is `Focused: <label>` or, while nothing has focus, `hint`. Both are restored when the run stops. The engine already makes the canvas focusable (`tabindex="0"`) when a run starts.
- **Paging.** `paginate(rows, capacity, page)` returns `{ rows, page, pages }` with `page` clamped into range, so a list that shrank shows its last page.
- **Tests.** Everything works in `createTestGame` with `ui({ root })` and `TestInput`: `pointerDown(x, y)` and `pointerUp()`, and `press(action)` with actions bound to the same keys. `activateControl(game, id)` activates as a tap would and returns whether it did; `listControls(game)` returns `{ id, label, disabled, focused, blocked, bounds }` in focus order, with `bounds` in logical units for `logicalToScreen` in a browser test. `inspect(game)` shows the same list under `fenrir.UiControls`, with the top scope's label as `modal`.

**Migrating hand-rolled canvas buttons.** A game that keeps its own list of button rectangles, hit-tests `ctx.input.pointer` against them and tracks a focused index:

1. Replace each `{ x, y, width, height, onTap }` entry with `control(node, { id, label, onActivate })` on the node that draws it; drop the rectangle, the list and the hit test.
2. Replace the hand-kept focus index with `UiFocus`, the Tab and arrow handling with the kit's keys, and the game's own `onDown(Tab)` handler with nothing.
3. Wrap each sheet or dialog in `modalScope(sheet, { label, onClose })` and delete the code that ignored taps behind it and handled Escape.
4. Replace the focus-ring drawing with `focusRing`, and the aria attributes the game set with `summary` and the scope labels.
5. In tests, replace synthetic clicks at computed coordinates with `activateControl(game, id)`, or with `listControls(game)` bounds and `logicalToScreen` in a browser test.

**Deleting adapters around the kit.** A game that wrapped the kit in systems of its own can drop them:

| Adapter | Replace with |
| --- | --- |
| A game system that reads every key in order and drives the kit, so its own keys and the kit's interleave | `ui({ actions, onAction })` |
| A system after the kit that times taps on a gameplay button, or re-reads presses the kit consumed | `control(node, { activateOn: "press", passThrough: true })` |
| Arrow handling that stops at the ends or works from no focus, built on `listControls` | `ui({ arrows: "linear" })`, and `moveFocus(ctx, delta)` for other keys |
| Clearing `UiFocus` on every pointer press | `ui({ tapFocus: "clear" })` |
| Clearing focus when a sheet is swapped for another with the same control ids | Nothing: focus stays with its scope. `modalScope(node, { focus })` picks the first focus |
| Writing the canvas's `aria-*` again after `Update`, or living with a frame-late ring | Nothing: `fenrir.ui.postUpdate` and `fenrir.ui.postInit` do it; `syncUi(ctx)` for a frame the game renders itself |
| `keys: { activate: [..., "NumpadEnter"] }` | Nothing: NumpadEnter is a default |
| A `summary` that reads the canvas's own label to return it | Return `undefined` |
| Clearing `UiFocus` whenever the game's sheet changes, so focus on a blocked HUD control does not survive a same-frame open and close | Nothing: the kit clears focus on a blocked control after each activation, `onClose` and `onAction` |
| A game `onDown(Tab)` that claims the keydown while a focus key is waiting for the frame | Nothing: Tab stays on the canvas while a press the kit reads is waiting |
| Arrows off, read as the game's `actions`, `moveFocus(ctx, ±1)`, then clearing `UiFocus` when focus did not move | `ui({ arrows: "clear" })` |
| Clearing `UiFocus` while `!input.focused` | `ui({ blurFocus: "clear" })` |
| A "tap requested" flag from a gameplay button's `onActivate` to the gameplay system, because the kit consumed its Enter | `control(node, { passThrough: true })`: gameplay sees the activate key as its own press |

```ts
import { defineAction } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";
import { control, ui } from "fenrir-ts/ui";
import { Graphics } from "pixi.js";

const OpenBag = defineAction("myGame.openBag", ["KeyB", "Enter"]);
const pixi = pixi2d({ design: { width: 390, minHeight: 520 } });
declare const bag: { open: boolean; draw(): void };

const kit = ui({
  pixi,
  arrows: "linear",
  tapFocus: "clear",
  actions: [OpenBag],
  // Called in typed order with the kit's keys: an Escape after this in the same frame closes the bag.
  onAction: (_ctx, action) => {
    if (action !== OpenBag || bag.open) return false;
    bag.open = true;
    bag.draw(); // a modalScope with its controls
    return true;
  },
});

// A labelled, focusable gameplay button whose taps gameplay also reads, activated on the press.
const cast = control(new Graphics().circle(0, 0, 40).fill(0x2266aa), { id: "myGame.cast", label: "Cast", activateOn: "press", passThrough: true });
```

### Plugins

A plugin is `{ name, install(game) }`. `createGame` installs plugins in order and awaits an async `install`. If an install throws, `createGame` rejects with that error.

`install` may read `game.canvas`, `game.logger`, `game.assets` and `game.events`, and add systems. It should only register: acquire GPU contexts, listeners and other resources in an `Init` system, and release them with `ctx.onCleanup` or an `Exit` system, so a failed startup rolls them back.

```ts
import { Schedule, type Plugin } from "fenrir-ts";

const frameLogger: Plugin = {
  name: "myGame.frameLogger",
  install(game) {
    game.addSystem(Schedule.PostUpdate, function logFrame({ time }) {
      game.logger.debug(`frame took ${time.delta}s`);
    }, { name: "myGame.frameLogger.postUpdate" });
  },
};
```

### Basic Example (3D)

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

### Components and systems

Define components with `defineComponent`, store them on entities, and query them from systems. Every system receives a `SystemCtx`. Its `signal` aborts when the game stops, and `onCleanup` registers teardown for the current run.

```ts
import { Schedule, defineComponent, type SystemCtx } from "fenrir-ts";

type Health = { current: number; max: number };
const Health = defineComponent<Health>("myGame.Health");

// Keep the query tuple in a constant so the engine can cache the view.
const HEALTH_QUERY = [Health] as const;

function spawnPlayer({ entities }: SystemCtx): void {
  const player = entities.createEntity();
  entities.set(player, Health, { current: 10, max: 10 });
}

function regenerate({ entities, time }: SystemCtx): void {
  entities.each(HEALTH_QUERY, (_entity, health) => {
    health.current = Math.min(health.max, health.current + time.delta);
  });
}

game.addSystem(Schedule.Init, spawnPlayer).addSystem(Schedule.Update, regenerate);
```

### Time and random

Read time and draw random numbers from the context, not from `Date.now()`, `performance.now()` or `Math.random()`, so a game replays exactly under test.

- `time.delta`: seconds since the last frame, clamped. `time.fixedDelta`: seconds per `Tick`, settable, 1/60 by default. `time.elapsed`: seconds of game time since `run()`, excluding pauses. `time.now()`: wall-clock milliseconds, like `Date.now()`.
- `random.next()` is in [0, 1), `random.int(min, max)` includes both ends, and `random.pick(items)` returns one item and throws on an empty list. The generator is mulberry32.
- `createGame({ seed })` seeds `ctx.random` and `game.random`. Without a seed it is seeded from the clock; `game.random.seed` reports the seed either way, so log it to replay a run. Stopping and running a game again continues the sequence.
- `Time` reads only the `Clock` it is given: `{ monotonic(), now() }`. `Engine` takes one as `clock`; the default is the browser's.
- `createGame({ maxFrameDelta })` caps `time.delta`, in seconds: after a stall (a background tab, a debugger) a frame moves the game at most this much. It defaults to 0.25; a game whose motion must not jump far passes a smaller cap, such as `1 / 20`. `createTestGame` takes it too.

```ts
import { Schedule, createGame, type SystemCtx } from "fenrir-ts";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, seed: 2024 });

let nextSpawnAt = 0;

function spawnEnemies({ time, random, logger }: SystemCtx): void {
  if (time.elapsed < nextSpawnAt) return;
  nextSpawnAt = time.elapsed + random.int(2, 5);
  const kind = random.pick(["slime", "bat", "ghost"] as const);
  logger.info(`spawned a ${kind} at ${new Date(time.now()).toISOString()}`);
}

game.addSystem(Schedule.Update, spawnEnemies);
```

### Named systems

A system's name is its function name, or the `name` option. An anonymous function with no `name` throws, and two systems in one stage cannot share a name. Within a stage, systems run in registration order unless `before` or `after` says otherwise. `runIf` is checked each time the system would run.

```ts
import { Schedule, type SystemCtx } from "fenrir-ts";

function movePlayer(_ctx: SystemCtx): void {}
function applyDamage(_ctx: SystemCtx): void {}
function applyDamageV2(_ctx: SystemCtx): void {}
let paused = false;

game
  .addSystem(Schedule.Update, applyDamage, { after: "movePlayer", runIf: () => !paused })
  .addSystem(Schedule.Update, movePlayer, { before: "myGame.trace" })
  .addSystem(Schedule.Update, (ctx) => ctx.logger.trace("frame"), { name: "myGame.trace" });

// While the game runs, both take effect from the next frame.
game.replaceSystem("applyDamage", applyDamageV2); // keeps its position and options
game.removeSystem("myGame.trace");
```

Order is resolved when `run()` starts. A `before` or `after` that names a system not in the stage, or a cycle, makes `run()` reject with an error that names both systems. While the game runs, `addSystem`, `replaceSystem` and `removeSystem` check the new order at once and throw at the call if it does not resolve. `replaceSystem` and `removeSystem` act on the name in every stage that has it.

Engine systems are named `fenrir.<module>.<stage>`, for example `fenrir.pixi.postUpdate` (writes transforms to nodes, then renders), `fenrir.input.dom.init` and `fenrir.physics.tick`.

### Resources

A resource is one value that a game owns, such as the score of the current round. Define it once at module level and read it with `ctx.resources.get`. The factory runs once per game, on the first `get`; a resource without a factory throws on `get` until you `set` it. `game.resources` and `ctx.resources` are the same object, so you can seed values before `run()`. Each game has its own values, so two games in one test never share them. Values survive `stop()` and `run()`, and `Engine.reset()` clears them so factories run again. Names are namespaced like component names.

```ts
import { Schedule, defineResource, type SystemCtx } from "fenrir-ts";

const Round = defineResource("myGame.Round", () => ({ meter: 0.5, score: 0 }));
const Level = defineResource<number>("myGame.Level"); // no factory: set before use

function scorePoint({ resources }: SystemCtx): void {
  const round = resources.get(Round); // typed { meter: number; score: number }
  round.score += resources.get(Level);
}

game.resources.set(Level, 3);
game.addSystem(Schedule.Update, scorePoint);
```

`resources.has(Resource)` says whether a resource has a value, without running its factory. A plugin's resource has one once the plugin is installed, so game code and tests use it to work with or without an optional plugin:

```ts
import { MotionSettings, type SystemCtx } from "fenrir-ts";
import { AudioState } from "fenrir-ts/audio";

function openMenu({ resources }: SystemCtx): void {
  if (resources.has(AudioState)) resources.get(AudioState).buses.music!.volume = 0.3; // only with audio()
  if (resources.has(MotionSettings)) resources.get(MotionSettings).pausedAll = true; // only with motion()
}
```

### States

`defineState(name, { values, initial })` defines a state machine whose value is one of `values`. `ctx.states` (the same object as `game.states`) has `get`, `set` and `timeIn`, the seconds of game time since the current value was entered, not counting pauses. `game.onEnter` and `game.onExit` add hooks: synchronous systems that receive the usual `ctx`. `inState(state, ...values)` is a `runIf` condition.

```ts
import { Schedule, defineState, inState, type SystemCtx } from "fenrir-ts";

const Phase = defineState("myGame.Phase", { values: ["idle", "casting", "waiting"], initial: "idle" });

function meter({ states }: SystemCtx): void {
  // Two seconds after casting starts, wait for the result.
  if (states.timeIn(Phase) > 2) states.set(Phase, "waiting");
}

game
  .onEnter(Phase, "idle", ({ logger }) => logger.info("ready")) // also runs when the game starts
  .onExit(Phase, "casting", ({ logger }) => logger.info("cast done"))
  .addSystem(Schedule.Update, function startCast({ states }) { states.set(Phase, "casting"); }, { runIf: inState(Phase, "idle") })
  .addSystem(Schedule.Update, meter, { runIf: inState(Phase, "casting") });
```

`states.set` queues the change, and it is applied after the current system returns: exit hooks for the old value, then enter hooks for the new one, then the next system, whose `runIf` sees the new value. This holds in every stage, startup and `Exit` included.

- Each run starts every state at `initial` and runs its enter hooks before the first `PreInit` system. Resources acquired in `Init`, such as the renderer, are not ready yet, so for setup that needs them start in a `loading` value and set the next one from `PostInit`.
- Setting the current value does nothing. If one system sets a state several times, only the last value is applied. Several states set in one system change in the order each was first set.
- A `set` in a hook is applied once that transition's hooks have all run. A `set` made outside a system, such as from setup code or a timer, is applied before the first system of the next stage the game runs: the next frame, or the next startup stage, or at `run()` after the initial enter hooks.
- Stopping the game is not a transition: it runs no exit hooks and drops changes not yet applied.
- More than 16 transitions of one state in one frame throws, naming the state and its last transitions. A hook that throws acts like a system that throws in that stage: in startup, `run()` rejects and the game rolls back.
- States belong to one game. Names are identities, so prefix them with your namespace.

### Events

`defineEvent<T>(name)` returns a typed key, and `events.send(Event, payload)` sends one. There are two ways to receive it. Use `on` for side effects that do not feed back into the frame, such as audio, analytics and notices. Use a reader when the result changes game state and order matters: `read()` runs in a system, in schedule order, and returns each event once.

```ts
import { Schedule, defineEvent, type SystemCtx } from "fenrir-ts";

const Scored = defineEvent<{ points: number }>("myGame.scored");
declare function playFanfare(points: number): void;

// Reaction: called inside every send while the game runs. Stays across stop() and run().
const off = game.on(Scored, ({ points }, ctx) => {
  playFanfare(points);
  ctx.logger.info("scored", { points });
});

// Simulation: read in a system, in schedule order. Create the reader once.
const scored = game.events.createReader(Scored);
let total = 0;
function addScore(_ctx: SystemCtx): void {
  for (const { points } of scored.read()) total += points;
}

// A listener for one run: added in a system, removed when that run stops.
function showNotices({ events }: SystemCtx): void {
  events.on(Scored, ({ points }) => console.log(`+${points}`));
}

game.addSystem(Schedule.Update, addScore).addSystem(Schedule.Init, showNotices);
// Send from a system or, while the game runs, from page UI outside the canvas, such as an HTML button.
// (Input on the canvas itself is read with defineAction, never with DOM listeners.)
document.querySelector("#goal")?.addEventListener("click", () => game.events.send(Scored, { points: 10 }));
off(); // removes the game.on listener early
```

- `game.on(Event, handler)` is setup, like `addSystem`: the listener stays across `stop()` and `run()` until the function it returns is called.
- `ctx.events.on(Event, handler)` belongs to the run it is called in and is removed when that run stops, after its `Exit` systems and cleanups. Calling `events.on` with no run going throws; use `game.on` there.
- Listeners are called synchronously inside `send`, in registration order, after the event is buffered, with the current run's `ctx`. A `send` before the first run or after a stop only buffers the event.
- A listener may send events; they are delivered at once, depth first. A listener removed during delivery is not called after that; one added during delivery receives only later events. Events nested 32 deep stop being delivered, with an error logged.
- A listener that throws, or an async one that rejects, is logged through the game's logger with the event name; the other listeners and the sender carry on. Async listeners are not awaited.
- Readers are unchanged: the bus keeps two frames of events, and `createReader(Event).read()` returns each one once.

### Testing a game

`createTestGame({ seed, now?, plugins?, logger? })` builds a game for tests: the same scheduler, services, states, events and plugins as `createGame`, with no canvas, no renderer and no `requestAnimationFrame`. Frames run when you call `game.step(dt)`, and time moves only with `step` and `game.clock.advance`, so the systems you register in the browser game run unchanged and deterministically in Vitest.

```ts
import { Schedule, createTestGame, defineResource, defineState, inState } from "fenrir-ts";
import type { SystemCtx } from "fenrir-ts";
import { expect, it } from "vitest";

const Phase = defineState("myGame.Phase", { values: ["waiting", "casting", "landed"], initial: "waiting" });
const Line = defineResource("myGame.Line", () => ({ ticks: 0 }));

// The same system the browser game registers: one second of fixed ticks lands the fish.
function reel({ resources, states }: SystemCtx): void {
  if (++resources.get(Line).ticks >= 60) states.set(Phase, "landed");
}

it("lands the fish after one second of casting", async () => {
  const game = await createTestGame({ seed: 1, now: 1_700_000_000_000 });
  game.addSystem(Schedule.Tick, reel, { runIf: inState(Phase, "casting") });
  await game.start(); // runs PreInit, Init and PostInit; schedules no frame

  game.states.set(Phase, "casting");
  game.step(1 / 60, 59); // fifty-nine frames, one tick each
  expect(game.states.get(Phase)).toBe("casting");
  game.step(1 / 60); // one more frame
  expect(game.states.get(Phase)).toBe("landed");

  game.clock.advance(5_000); // moves time.now() without running a frame
  await game.stop(); // runs Exit systems and cleanups
});
```

- `await game.start()` runs the startup stages with the same rollback as `run()`: if a startup system throws, `Exit` systems and cleanups run and `start()` rejects. `await game.stop()` runs `Exit` systems and cleanups. A stopped test game can `start()` again.
- `game.step(dt = 1 / 60, frames = 1)` runs whole frames through the same frame body as the browser loop: `PreUpdate`, the `Tick` stages the accumulator holds, `Update`, `PostUpdate`, then the event buffers advance. Fixed ticks accumulate from `dt` exactly, so `step(1 / 60, 600)` runs 600 ticks and `step(1 / 120, 2)` runs one.
- `dt` is at most 0.25 s, the engine's frame-delta clamp (`maxFrameDelta`, which `createTestGame` takes as an option). A longer `dt` throws rather than silently simulating less than you asked: to advance a second, write `step(1 / 60, 60)`. A frame still runs at most 8 ticks, as in the browser, so `step(0.25)` runs 8 ticks of 1/60 and drops the rest, as a long browser frame does.
- Each stepped frame moves `time.now()` by `dt`, starting from `now` (default 0). `time.elapsed` and `states.timeIn` count stepped time only; `clock.advance(ms)` moves `time.now()` alone.
- `seed` is required. Nothing in a test game reads `performance.now()`, `Date.now()` or `requestAnimationFrame`.
- A test game has no canvas, so a plugin that reads `game.canvas`, such as `pixi2d`, throws when it installs, saying so. Plugins that only add systems, resources or listeners install as usual. A system that draws with Pixi needs the renderer and is tested in the browser; keep drawing out of gameplay systems so they run in both.
- A test game has `start()` where a `Game` has `run()`, and no `pause` or `resume`: between steps it is never running, so there is nothing to pause.
- `game.input` has `press(action)`, `release(action)`, `pointerDown(x, y)`, `pointerMove(x, y)`, `pointerUp()`, `pointerCancel()`, `focus()` and `blur()`, which take effect on the next `step`: see [Input](#input).
- A system that throws stops the game, and the error propagates from `step`. A system that calls `ctx.stop()` ends the remaining frames of the `step` call.

`game.step` also exists on a `Game` made by `createGame`, for frame-by-frame debugging: call `game.pause()` first. Each step advances the game by `dt` whatever the real time, and runs every system, so the `pixi2d` renderer draws each stepped frame. Calling `step` before `run()` or while running throws and says to pause first.

### Inspecting a game

`inspect(game)` returns what the game is doing as plain JSON: the frame, time, the schedule, states, resources and the active scene's entities. It works on a `Game` and a `TestGame`, never throws, and works before `run()`, while paused and after `stop()`. It is a function rather than a method, so a game that never calls it ships none of the snapshot code. `exposeInspector(game)` puts the same function on `window.__FENRIR__.inspect`, for browser tests and agents.

```ts
import { Schedule, createGame, defineComponent, defineResource, exposeInspector, inspect, type GameSnapshot, type SystemCtx } from "fenrir-ts";

const Health = defineComponent<{ current: number }>("myGame.Health");
const Scores = defineResource("myGame.Scores", () => new Map<string, number>());

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas });
exposeInspector(game); // also on window.__FENRIR__

game.addSystem(Schedule.Init, function spawn({ entities, resources }: SystemCtx) {
  entities.set(entities.createEntity(), Health, { current: 3 });
  resources.get(Scores).set("ana", 10);
});
await game.run();

const snapshot: GameSnapshot = inspect(game);
const [player] = snapshot.entities;
console.log(player?.components["myGame.Health"]); // { current: 3 }
console.log(snapshot.resources["myGame.Scores"]); // { $type: "Map", entries: [["ana", 10]] }
```

```json
{
  "frame": 120,
  "time": { "elapsed": 2.0, "delta": 0.016 },
  "schedule": { "preInit": [], "init": ["fenrir.pixi.init", "spawn"], "update": ["move"], "postUpdate": ["fenrir.pixi.postUpdate"], "...": [] },
  "states": { "myGame.Phase": { "value": "playing", "timeIn": 1.5 } },
  "resources": { "myGame.Scores": { "$type": "Map", "entries": [["ana", 10]] } },
  "entities": [
    { "id": 0, "name": "Entity 0", "parent": null, "components": { "fenrir.Transform": { "position": { "x": 0, "y": 0, "z": 0 }, "...": {} }, "myGame.Health": { "current": 3 } } }
  ]
}
```

- A test can `step` a `TestGame` and then assert on `inspect(game)`. Stepped frames count like browser frames.
- A shipped game that wants `window.__FENRIR__` only in a debug build calls `exposeInspector` behind a build flag, for example `if (import.meta.env.DEV) exposeInspector(game)`; the bundler drops the inspection code from the production build.
- `frame` counts frames since the current run started: 0 during startup, kept after `stop()`, back to 0 at the next `run()` (or `start()` on a test game). `time.elapsed` and `time.delta` are as of the start of the latest frame, so two calls with no frame between them return equal snapshots.
- `schedule` lists system names per stage in run order. `states` lists the states the game has used (read, set or hooked) with their value and seconds in it. `resources` lists the resources that have a value.
- `entities` are the active scene's, by id. `id` and `parent` are entity handles, the values `entities.get` takes; `parent` is null for a root. The engine's `fenrir.Name` and `fenrir.Relationship` are folded into `name` and `parent`; `fenrir.Transform` stays in `components`.
- Keys of `states`, `resources` and `components` are the names given to `defineState`, `defineResource` and `defineComponent`, sorted. A component keyed by a symbol `defineComponent` did not make appears as `Symbol(description)`.
- With `exposeInspector` called for two games on one page, the last one owns `window.__FENRIR__`, with a warning. It stays after the game stops. Without a `window`, it does nothing.

Values are encoded by these rules, so the snapshot always survives `JSON.parse(JSON.stringify(snapshot))` unchanged:

| Value | Appears as |
| --- | --- |
| string, boolean, null, finite number | itself; `-0` as `0` |
| `NaN`, `Infinity`, `-Infinity` | `{ "$type": "number", "value": "NaN" }` |
| `undefined` | `{ "$type": "undefined" }`, also as an object field, so the key stays visible |
| bigint, symbol | `{ "$type": "bigint", "value": "12" }`, `{ "$type": "symbol", "value": "description" }` |
| function | `{ "$type": "function", "name": "jump" }` |
| array | an array |
| `Map` | `{ "$type": "Map", "entries": [[key, value], ...] }`, keys encoded too, in insertion order |
| `Set` | `{ "$type": "Set", "values": [...] }` |
| `Date` | `{ "$type": "Date", "value": "2026-01-02T00:00:00.000Z" }`, `null` if invalid |
| typed array | `{ "$type": "Float32Array", "values": [...] }` |
| plain object (prototype `Object` or null) | an object with its own enumerable fields, in insertion order; a key starting with `$` gets one more `$` |
| object with `toJSON` | what `toJSON` returns, encoded by these rules |
| class instance whose own fields are all strings, numbers, booleans or null | `{ "$type": "Vector3", "x": 1, "y": 2, "z": 3 }` |
| any other class instance, DOM node, `WeakMap`, `Promise`... | `{ "$type": "Container" }`: the constructor name, which a minifier may shorten. One with a non-empty string `label` field (every Pixi display object has one) also gets it: `{ "$type": "Container", "label": "myGame.ship" }`, a name that survives minification |
| a getter or `toJSON` that throws | `{ "$type": "Thrown", "message": "..." }` |

So an object with a `$type` key is always a tag, and plain data never has one. Anything cut short has a `$truncated` key, so a truncated value is never mistaken for a complete one:

| Limit | What is cut |
| --- | --- |
| a reference to an object that contains it | `{ "$type": "Object", "$truncated": "cycle" }`; an object shared but not cyclic is repeated |
| 8 levels below a component or resource | `{ "$type": "Array", "$truncated": "depth" }` |
| 100 items of an array, `Map`, `Set`, typed array or object | `{ "$type": "Array", "size": 5000, "values": [first 100], "$truncated": "length" }`; an object keeps its first 100 keys under `value` |
| 1000 characters of a string | `{ "$type": "string", "size": 4096, "value": "first 1000", "$truncated": "length" }` |
| 5000 values in one component or resource | each further value is `{ "$type": "...", "$truncated": "size" }` |

The limits are fixed. Keep component and resource values plain data (objects, arrays, numbers, strings, `Map` and `Set`) to see them in full; a display object or texture shows only its class.

**For agents and browser tests:** to check what a game is doing, assert on `inspect()` rather than on pixels. In a unit test call `inspect(game)`; in a Playwright test call `exposeInspector(game)` in the game and read `await page.evaluate(() => window.__FENRIR__.inspect())`. Compare whole snapshots, or the entities, states and resources you care about: two snapshots of the same game state are identical, so they can be snapshot-tested.

### Live Code Editor Example

Fenrir TS includes a built-in live code editor powered by Monaco Editor. The worker configuration is built into the bootstrap process.

**Note:** Monaco Editor workers must be imported using your bundler's worker loading mechanism. The examples below use Vite's `?worker` syntax. For other bundlers, see the [Monaco ESM Integration Guide](https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md).

**Step 1: Install Monaco Editor**

```bash
npm install monaco-editor
```

**Step 2: Import Workers and Bootstrap Editor (Vite example)**

```ts
import { Engine, Scheduler, SceneManager, EventBus, ConsoleLogger } from "fenrir-ts";
import { bootstrapEngine } from "fenrir-ts/3d";
import { createPhysicsSystem } from "fenrir-ts/physics";
import { bootstrapEditor, type MonacoWorkerLoaders } from "fenrir-ts/editor";

// Import Monaco workers (Vite-specific - adjust for your bundler)
import jsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import cssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import htmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import tsWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import editorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";

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

// Bootstrap core engine systems
const { assets } = bootstrapEngine(engine, logger, {
  canvas,
  physics: createPhysicsSystem(),
  enableAnimations: true,
});

// Bootstrap the live editor with Monaco workers
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
```

**Step 3: HTML Setup**

```html
<div id="editor-container"></div>
<canvas id="canvas"></canvas>

<!-- Web Components Controls -->
<ed-control-bar></ed-control-bar>
<ed-error-modal></ed-error-modal>
```

**For Non-Vite Bundlers:**

If you're using webpack, esbuild, or another bundler, you'll need to configure Monaco workers differently:

- **Webpack:** Use [monaco-editor-webpack-plugin](https://github.com/microsoft/monaco-editor-webpack-plugin)
- **Others:** See [Monaco ESM Integration Guide](https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md)

For a complete working Vite example, see the [Monaco Editor demo](./monaco-editor.html) in the repository.

---

## Key Goals

- **Modern TypeScript-first engine design**
- **Explicit, predictable architecture** (no magic)
- **Composable systems over inheritance**
- **Web-friendly runtime** (browser + worker compatible)
- **Engine-building playground** — not just a framework

Fenrir TS is intentionally opinionated in _structure_, but unopinionated in _what you build with it_.

---

## Architecture Overview

Fenrir TS is built around an **Entity–Component–System (ECS)** core.

- **Entities** are lightweight IDs
- **Components** are pure data
- **Systems** operate over queried component sets
- **Schedules** define _when_ systems run

The ECS implementation is heavily inspired by the **sparse-set model** used in [EnTT](https://github.com/skypjack/entt), adapted to fit JavaScript/TypeScript runtime constraints.

### Why Sparse Sets?

- Fast iteration over components
- Efficient add/remove operations
- Cache-friendly layouts (as much as JS allows)
- Simple mental model for engine programmers

---

## Core Concepts

### ECS

- Sparse-set component storage
- Typed component queries
- Explicit system execution order
- No reflection or runtime magic

### Systems & Scheduling

Systems are grouped into **schedules** such as:

- `Init`
- `PreUpdate`
- `Update`
- `PostUpdate`
- `Exit`

This makes execution order **explicit and debuggable**, rather than hidden behind callbacks.

```ts
game
  .addSystem(Schedule.Update, movementSystem)
  .addSystem(Schedule.Update, renderSystem, { after: "movementSystem" });
await game.run();
```

---

## Design Philosophy

Fenrir TS intentionally avoids:

- Class-heavy inheritance hierarchies
- Implicit global state
- Framework-driven control flow

Instead, it emphasizes:

- **Composition**
- **Explicit dependencies**
- **Clear ownership**
- **Data-oriented design**

---

## Inspiration

- [FenrirEngine](https://github.com/Wolfleader101/FenrirEngine)
- [EnTT](https://github.com/skypjack/entt)

---

## License

MIT — use it, break it, learn from it.

## Model Licenses

Sample models are sourced from the [glTF Sample Models repository](https://github.com/KhronosGroup/glTF-Sample-Models).
