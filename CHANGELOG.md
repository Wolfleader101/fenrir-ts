# Changelog

Fenrir TS is at 0.x: breaking changes are allowed, and each one is listed here with a migration line. Until the API is declared stable, a release with a breaking change bumps the minor version (0.2.0 to 0.3.0) and any other release the patch (0.2.0 to 0.2.1). How a release is made: [RELEASING.md](https://github.com/Wolfleader101/fenrir-ts/blob/main/RELEASING.md).

## Unreleased

## 0.3.0

Three breaking changes: `fenrir-ts/2d` and `fenrir-ts/physics` no longer add methods to `EntityBuilder` and `AssetStore` when they are imported. Each section below has a before/after for its migration. Also new: a starter game (`npx fenrir-ts create`), SVG textures, input in `inspect(game)`, and a UI kit that can walk only the layers that hold controls.

### Breaking: `fenrir-ts/physics` adds no methods to `EntityBuilder` (#89)

- Importing `fenrir-ts/physics` no longer patches `EntityBuilder.prototype`. Its 14 builder methods are gone, and every builder chain that calls one stops compiling. It still makes default transforms out of Three objects and adds `ctx.physics`. Physics behaviour is unchanged: each replacement builds the same components the method did.
  - Dropped, replaced by the builder's own `with` and exports `fenrir-ts/physics` already had: `physicsBody(config)` is `with(PhysicsBody, createPhysicsBody(config))`; `collisionLayer(layer)`, `collisionMask(mask)` and `collidesWith(...layers)` are the `collisionLayer` and `collisionMask` options of `createPhysicsBody` (`collisionMask: CollisionUtils.createMask(...layers)` for `collidesWith`); `physicsBox`, `physicsSphere`, `physicsCapsule` and `physicsCylinder` are `with(PhysicsShape, ShapeBuilder.box(...))` and its `sphere`, `capsule` and `cylinder`, with the same arguments; `physicsMaterial(preset)` is `with(PhysicsMaterial, CommonMaterials[preset]())`.
  - Replaced by functions that take the builder and return it, since each adds a body, a shape and a material: `dynamicBox(builder, halfExtents, mass)`, `dynamicSphere(builder, radius, mass)`, `staticBox(builder, halfExtents)`, `staticSphere(builder, radius)` and `kinematicBox(builder, halfExtents)`, exported from `fenrir-ts/physics`, with the same shapes and materials as before.

  ```ts
  // 0.2.x
  EntityBuilder.create().transform(new Vector3(0, 5, 0)).dynamicBox(new Vector3(1, 1, 1), 2).spawn(entities);
  EntityBuilder.create().physicsBody({ motionType: MotionType.Dynamic, mass: 5 }).physicsSphere(0.5).physicsMaterial("metal").spawn(entities);

  // 0.3.0
  dynamicBox(EntityBuilder.create().transform(new Vector3(0, 5, 0)), new Vector3(1, 1, 1), 2).spawn(entities);
  EntityBuilder.create()
    .with(PhysicsBody, createPhysicsBody({ motionType: MotionType.Dynamic, mass: 5 }))
    .with(PhysicsShape, ShapeBuilder.sphere(0.5))
    .with(PhysicsMaterial, CommonMaterials.metal())
    .spawn(entities);
  ```

- `fenrir-ts/3d` is now the only entry that adds methods to `EntityBuilder`.

### Breaking: `fenrir-ts/2d` adds no methods to `AssetStore` (#94)

- Importing `fenrir-ts/2d` no longer patches `AssetStore.prototype`, and its `IAssetStore` and `AssetStore` augmentation is gone. `requestTexture2D`, `loadTexture2D`, `getTexture2D`, `registerTexture2DLoader` and `getSupportedTexture2DExtensions` are now functions exported from `fenrir-ts/2d` that take a `SystemCtx`, the game, or anything with its `assets` (`{ assets }`), as `getAsset(ctx, manifest, name)` does, then the old arguments. Every `assets.*Texture2D` call stops compiling; move the receiver into the first argument. Behaviour is unchanged: `pixi2d` still registers the default Pixi loader, and manifests and `sprite2D(name)` still find textures by name.

  ```ts
  // 0.2.x
  const handle = game.assets.requestTexture2D("logo", "img/logo.png");
  const texture = await ctx.assets.getTexture2D("logo");

  // 0.3.0
  import { getTexture2D, requestTexture2D } from "fenrir-ts/2d";
  const handle = requestTexture2D(game, "logo", "img/logo.png");
  const texture = await getTexture2D(ctx, "logo");
  ```

- A 2D game ships only the texture functions it calls: the `game-2d` fixture's engine code went from 54.46 kB to 53.50 kB minified (17.29 kB to 16.96 kB gzip), and `Assets2D.ts` in it from 1,246 B to 289 B.

### Breaking: `fenrir-ts/2d` adds no methods to `EntityBuilder` (#88)

- Importing `fenrir-ts/2d` no longer patches `EntityBuilder.prototype`. `pixiNode`, `renderSprite`, `renderCircle`, `renderRect` and `renderText` are gone: every builder chain that calls one stops compiling. Give an entity a node with the builder's own `with(PixiNode, { node, layer, keep })`, and a drawn shape with `with(Renderable2D, ...)` and the new value functions `sprite2D(texture, options)`, `circle2D(radius, options)`, `rect2D(width, height, options)` and `text2D(content, options)`, exported from `fenrir-ts/2d`. They take the same arguments as the old methods and assign the `id` the same way.

  ```ts
  // 0.2.x
  EntityBuilder.create().transform2D(100, 200).pixiNode(fish, { layer: "world" }).spawn(entities);
  EntityBuilder.create().transform2D(195, 320).renderCircle(16, { fillColor: 0xff6600 }).spawn(entities);

  // 0.3.0
  EntityBuilder.create().transform2D(100, 200).with(PixiNode, { node: fish, layer: "world" }).spawn(entities);
  EntityBuilder.create().transform2D(195, 320).with(Renderable2D, circle2D(16, { fillColor: 0xff6600 })).spawn(entities);
  ```

- A 2D game ships only the value functions it calls: the `game-2d` fixture's engine code went from 55.28 kB to 54.46 kB minified (17.51 kB to 17.29 kB gzip).

### A starter game: `npx fenrir-ts create`

- `npx fenrir-ts@latest create my-game` copies a starter game that ships in the package into a new folder: a `pixi2d` game (one action, one state, one `.png` texture, one entity drawn through a `PixiNode`), gameplay in `src/game.ts` tested headless with Vitest, a Playwright test that reads `window.__FENRIR__.inspect()`, a GitHub Actions workflow, and `AGENTS.md` / `CLAUDE.md` pointing coding agents at the guide in the package. It depends on the `fenrir-ts` version that created it. Nothing in the engine's entry points changed.
- Docs: a minified production build renames functions, and a system's name is its function's name. `SKILL.md` and `references/core.md` now say to keep names (Vite: `esbuild: { keepNames: true }`, as the starter game does) or name every system.
- For contributors: `pnpm check:template` (in CI) creates the starter game from the packed tarball and runs its type-check, tests and build. The `template-browser` CI job also runs its Playwright test on every pull request.

### SVG textures (#92)

- The default `texture2d` loader that `pixi2d` registers now loads `.svg` sources, through Pixi's own SVG parser, as a `Texture`. Before, an `.svg` failed with "Unsupported ... format". An SVG is rasterised at its declared `width`/`height`, so set those to the size it is drawn at: scaling the sprite up later blurs it, as with a PNG. 3D texture loading is unchanged.

### `inspect(game)` shows input (#93)

- `GameSnapshot.input` is the input the latest frame latched: `held`, the bindings held, sorted (`["KeyA", "pointer.primary"]`); `pointer`, as `game.input.pointer` (`x`, `y`, `down`, `inside`, `cancelled`); and `focused`, as `game.input.focused`. Its type is exported as `InputSnapshot`. Actions are not listed by name: `defineAction` still registers nothing. Games that never call `inspect` ship none of it. [Testing and inspecting a game](https://github.com/Wolfleader101/fenrir-ts/blob/main/skills/fenrir/references/testing.md#inspecting-a-game) has the rules.
- A test that compares a whole snapshot with `toEqual` (or a stored snapshot) gains the `input` field: add it to the expected value, or compare only the fields you check.

### The UI kit can walk only the layers that hold controls (#95)

- `ui({ pixi, layers: ["hud", "menus"] })` looks for controls and modal scopes only in those `pixi2d({ layers })` containers, and in `renderer.backdrop` only when `"fenrir.backdrop"` is listed. Without `layers` the kit walks every visible node under `backdrop` and `root` each frame, world sprites included, as before. A control in an unlisted layer or added straight to `root` is not live under `layers`, with no warning. An unknown layer name makes `createGame` reject, naming the declared layers. In `tests/bench/Ui.bench.ts`, 3,000 world sprites with 60 HUD controls: a frame with no input went from about 0.22 ms to 0.02 ms (p75), one with a key press from about 1.07 ms to 0.11 ms. Not breaking.

### Docs: limits that stay as they are

No code change. The guide now states these limits, which are staying as they are:

- UI controls: a node that is not a control, drawn over one, does not block its taps (use a `modalScope`); a control hidden through `Display2D.visible` leaves the ring and accessibility output one frame behind (set `node.visible` for the same frame); the kit is tested in jsdom and desktop Chromium only, not with screen readers or on real phones. See `skills/fenrir/references/ui.md`.
- Timers and tweens: they follow the game-wide `maxFrameDelta`, with no cap per group, and there is one motion system, so a tween that follows a value computed in `Update` follows it from the next frame. See `skills/fenrir/references/motion.md`.

### Agent guide checked in a browser (part of #91)

- `SKILL.md` no longer says the engine focuses the canvas: it makes it focusable, and keys reach the game after the first click, a Tab or `canvas.focus()`. The browser entry example calls `canvas.focus()` after `run()`, and "Mistakes that look right" lists a keyboard-only start screen.
- The guide and references now say: the first `ViewportResized` is sent before the game's `Init` systems can listen; the design frame already sits inside the safe area; how to show a loading bar instead of awaiting the bundle in `PreInit`; a labelled button is a `Container` (Pixi warns on children of a `Graphics`); Escape reaches the game while no modal scope is open; the `fenrir.UiControls` snapshot shape; when a state set outside a system applies.

## 0.2.1

The first release staged by the release workflow. No change to the package's code: games can stay on 0.2.0.

### Releases are staged on npm

- For maintainers: a version tag now stages the release on npm (`npm stage publish`) instead of publishing it. It goes live only when a maintainer approves it with 2FA (npmjs.com → Staged Packages, or `npm stage approve`), and the workflow's GitHub release stays a draft until then. The manual dry run stages a throwaway prerelease when the version is already on npm, instead of failing. [RELEASING.md](https://github.com/Wolfleader101/fenrir-ts/blob/main/RELEASING.md) has the steps. Nothing changes for games.

## 0.2.0

The first release on npm. Before it, games built the engine from a checkout; `0.1.0` was never published, and the breaking changes below are against the code at that version.

### Published to npm (#13, #15, #18, #24, part of #25)

- **Install from the registry**: `npm install fenrir-ts pixi.js` for a 2D game. README "Installation" lists the peers per entry point.
- **Every peer is optional** (`pixi.js`, `three`, `jolt-physics`), so installing `fenrir-ts` installs only what you list. Before, npm and pnpm installed `three` and `jolt-physics` for every game, 2D or not, and `pixi.js` for games without it: with npm, a game that lists no peer went from 15 packages (177 MB) to `fenrir-ts` alone (2 MB), and a 2D game from 177 MB to 95 MB.
- **`pixi.js` peer `^8.16.0`**: one Pixi major, the one the engine is built and tested with. A new Pixi major arrives in an engine release.
- **Declarations work with `"moduleResolution": "node16"` and `"nodenext"`**: their relative imports and `declare module` augmentations now name files (`./core/Game.js`). Before, a `nodenext` project saw no exports at all, and the augmentations (the 2D builder and asset methods) did not apply. Two 3D declarations imported the build machine's `src/` by absolute path when built on Windows; they no longer do.
- **Smaller package**: 227 kB packed and 777 kB unpacked, down from 688 kB and 2.06 MB. Source maps no longer ship, nor the default skybox images (below), nor `llms.txt` and `llms-full.txt` (an index and a 284 kB copy of `skills/fenrir/`; agents read `SKILL.md`) (the code is not minified, so stack traces read as they did), and the published files carry no `sourceMappingURL`.
- **`fenrir-ts/package.json`** is exported, and the manifest has `repository`, `homepage`, `bugs`, `author`, `engines` (Node 22 or later) and `publishConfig`.
- For contributors: `pnpm check:package` (in CI) fails when the tarball holds a file outside its allowed list, passes its size budget in `size-budget.json`, lists a runtime dependency or a required peer, or fails publint or `@arethetypeswrong/cli`, and `pnpm check:install` (in CI) installs the tarball with npm and pnpm, with and without `pixi.js`, and fails on a peer warning, an entry that does not import, or a type error under `bundler` or `nodenext` resolution. Releases are tagged and published by `.github/workflows/release.yml`, which also makes the GitHub release with the version's notes from this file, as RELEASING.md says.

Breaking: a game that imports `fenrir-ts/3d` or `fenrir-ts/physics` must now list `three` (and `jolt-physics` for physics) in its own `package.json`, since they are no longer installed for it. Migration: `npm install three jolt-physics` as needed.

### Removed: the default skybox images

- **Breaking.** `SkyboxUtils.setupDefaultSkybox` and the six cube faces it embedded (a 138 kB chunk of `fenrir-ts/3d`) are gone, so the package ships no images. Migration: put six face images in your game's public folder and call `SkyboxUtils.setupCubemapSkybox(scene, assets, { basePath: "/textures/skybox" })` (faces `right.png`, `left.png`, `top.png`, `bottom.png`, `front.png`, `back.png`, or name them with `faces`), as the 3D demos now do.
- For contributors: the demo pages moved to `demos/` (pages, `demos/src/`, `demos/public/`) and import the engine only as `fenrir-ts` and its entry points, type-checked by `pnpm type-check` through `demos/tsconfig.json`. They build to `dist-demos/`.

### Removed: the `fenrir-ts/editor` entry

- **Breaking.** The Monaco live code editor is gone: `fenrir-ts/editor` (`bootstrapEditor`, the sandbox, transpiler and Lit controls), the `monaco-editor.html` demo, and the `types:bundle` and `check:editor-types` scripts. `skills/fenrir/references/3d-and-editor.md` is now `3d-and-physics.md`, and `skills/fenrir/api/editor.md` is gone.
- The package no longer depends on `lit`, `lit-html`, `@lit-labs/signals`, `signal-polyfill`, `signal-utils`, `lucide`, `postcss` or `@tailwindcss/postcss`, and no longer lists `monaco-editor`, `tailwindcss` or `@tailwindcss/vite` as peers. The demo pages no longer use Tailwind.

Migration: nothing in the engine depended on the editor. A project that imported `fenrir-ts/editor` keeps an older version or embeds Monaco itself.

### Agent docs ship in the package (part of #39)

- **`skills/fenrir/`** ships with the package: `SKILL.md`, a guide for an agent building a game (the model, a minimal game and its test, the engine's system names and how to order against them, what `consume` hides and for how long, run-scoped and app-scoped listeners, and a table of tempting mistakes), `references/` (the full rules per service, moved out of this README, which now links to them) and `api/` (every export of every entry point with its signature and TSDoc, generated). README "Using Fenrir with a coding agent" says how to wire it into a game repository.
- **`AGENTS.md` no longer ships**: it is now only for changing the engine. Migration: a game repository that pointed its agent at `node_modules/fenrir-ts/AGENTS.md` points it at `node_modules/fenrir-ts/skills/fenrir/SKILL.md`. `CHANGELOG.md` ships instead.
- TSDoc added to the public symbols that had none on the 2D path (`GameOptions`, `Schedule`, `EventBus`, `EntityBuilder`, `PixiRenderer`, `UiOptions`, `AudioOptions` and others).
- For contributors: `pnpm docs:agent` regenerates the docs, `pnpm check:agent-docs` (in CI) fails when they are stale, and `check:docs` now also compiles every block of `SKILL.md` on its own and rejects examples that import anything but the entry points and peers.

### Asset manifests: one asset at a time, and optional assets (part of #39)

- **`loadAsset(ctx, manifest, name | names)`** and **`unloadAsset(...)`** load and release assets by name, with no bundle. A name is held like a one-asset bundle with its fallback and shares the load with any bundle that lists it; an asset is released when neither holds it. It shows in `manifest.progress` as `assets[name].direct` and in the top-level counts, sends **`AssetLoaded`** `{ manifest, asset, status }` or **`AssetFailed`** `{ manifest, asset, src, error }`, and rejects with **`AssetLoadError`**. A game that loaded images lazily through a generated one-asset bundle each can drop those bundles.
- **`optional: true`** on an asset declaration: a failure (after its `fallback`, if any) makes it `missing`, logged as a warning, and its bundle still loads. `getAsset` returns `undefined` for it, typed `Texture | undefined` only for optional assets. A missing image no longer needs a placeholder file.
- Progress gains `missing` (in every count, and `fraction` is now `(loaded + missing) / total`), `AssetStatus` gains `"missing"`, `AssetState` gains `direct`, and `AssetBundleLoaded` gains `missing: string[]`. Without `optional` and `loadAsset` every value is what it was, plus `missing: 0`, `direct: false` and `missing: []`. Code that compares a whole progress object with `toEqual` adds those fields. The `getAsset` error for an asset that is not loaded now also suggests `loadAsset`.

Size: `game-2d-assets` grows 0.66 kB minified / 0.20 kB gzip (61.55 / 19.73 kB). Games that do not use a manifest (`game-2d`, `core-only` and the other fixtures) do not change.

### UI controls: the last adapters a consumer kept (#78, part of #39)

- **Focus on a blocked control (bug fix).** The kit clears `UiFocus` from a control that a modal scope blocks, or that is no longer live, every time it reads the display tree: after each activation, `onClose` and `onAction` as well as at the start and end of its pass and in `syncUi`. A HUD control's Enter that opens a sheet and an Escape that closes it in the same frame now leave nothing focused, as they did a frame apart.
- **Tab and waiting keys.** Tab stays on the canvas while another press the kit reads (its keys, the pointer or `actions`) is waiting for the next frame, and counts the Tabs still waiting.
- **`ui({ arrows: "clear" })`**: as `"linear"`, but stepping past either end leaves no control focused, still on the canvas.
- **`ui({ blurFocus: "clear" })`** clears focus while the canvas lacks keyboard focus. The default, `"keep"`, is unchanged.
- **`passThrough` and keys.** Enter, NumpadEnter and Space on a focused `passThrough` control activate it and are left unconsumed for gameplay. A press a `passThrough` control took, by key or pointer, no longer also goes to `onAction`.

Size: the kit costs a 2D game 0.30 kB minified / 0.10 kB gzip more (`game-2d-ui` 62.42 / 20.58 kB).

Changed defaults, both judged bugs: focus on a blocked control is cleared within the frame, and a pointer press on a `passThrough` control no longer reaches `onAction`. Migration: a game that read that press in `onAction` reads `input.pressed` in a gameplay system instead, or listens for `ControlActivated`. Enter on a focused `passThrough` control is no longer consumed; drop `passThrough` to keep it consumed.

### Input and UI controls: gaps a first consumer hit (part of #39)

- **Consumed input (bug fix).** `consume(action)` and `consumePointer()` hide only the press they were given. A key or pointer button that lifts and goes down again before the next frame, or goes down in the frame right after a consumed tap, is a new press: `pressed`, `edges` and `Tick` see it. Before, it stayed hidden until it lifted again. `consume` also hides a second press that `pressed()` folded into a hold.
- **`InputEdge.binding`**: the key or button that made the edge.
- **One ordered pass.** `ui({ actions, onAction })` hands the game's own key and pointer presses to `onAction(ctx, action)` in the order they were typed among the kit's keys, reading the display tree again after each, so Enter that opens a sheet and Escape after it in one frame open and close it. The kit's pointer presses are read from `input.edges` too, so a quick second tap is no longer lost.
- **Press-time controls.** `control(node, { activateOn: "press" })` activates in the frame of the press; `passThrough: true` lets the press reach gameplay, even in a modal scope.
- **Arrows.** `ui({ arrows: "linear" })` stops at the ends and works from no focus. **`moveFocus(game | ctx, delta, wrap?)`** moves focus from game code.
- **Tap focus.** `ui({ tapFocus: "clear" })` clears focus on every pointer press.
- **Focus and scopes (bug fix).** Focus no longer carries to a control with the same id in a different modal scope. `modalScope(node, { focus })` names the control that takes focus when the scope comes on top.
- **Output in the frame of the change.** The ring, cursor and canvas `aria-*` are written by the new `fenrir.ui.postUpdate` (before `fenrir.pixi.postUpdate`) and `fenrir.ui.postInit`, not in `fenrir.ui.preUpdate`, so a scope opened or focus moved in `Update`, and controls drawn at `Init`, are in the frame drawn. **`syncUi(ctx)`** does it on demand. A frame with no input no longer walks the tree in `fenrir.ui.preUpdate`, so an idle frame still walks once.
- **NumpadEnter** activates the focused control by default.
- **`summary`** may return nothing to keep the canvas's own label.
- `activateControl` and `listControls` take a system's `ctx` as well as the game.

Size: the kit costs a 2D game 6.84 kB minified / 2.94 kB gzip, up from 5.49 / 2.32. The input fix adds 0.20 kB / 0.05 kB gzip to every game.

Changed defaults, both judged bugs: the consumed re-press above, and focus no longer moving into another scope by id. No other breaking changes.

### UI controls: `fenrir-ts/ui` (#16, #17, part of #39)

A new entry point, opt-in: a game that does not import it ships none of its code. Its peer is `pixi.js`.

- **`ui({ pixi })`** is the plugin, listed after `pixi2d` and given it; `ui({ root })` in a test game. It registers `fenrir.ui.init` and `fenrir.ui.preUpdate`.
- **`control(node, { id, label, onActivate, disabled, hitArea, order })`** makes a Pixi node the game drew tappable and focusable while it is live (in the scene, visible, renderable). Hit areas come from the node's bounds, or a rectangle or circle. No registry: a node that is destroyed or dropped takes its control with it.
- **Pointer**: press and release on the same control activates it, the tap is consumed, a cancelled pointer does nothing, and the cursor is `pointer` over an enabled control.
- **Keyboard**: Tab and Shift+Tab move focus and leave the canvas past either end; arrows move once a control has focus; Enter and Space activate the focused control; Escape closes the top modal scope. `UiFocus` holds the focused id and a default focus ring is drawn, replaceable with `focusRing`.
- **`modalScope(node, { label, onClose })`**: only controls inside the top live scope take input, and every tap is kept from the game while one is open.
- **`ControlActivated`** `{ id, via }` is sent on every activation, after `onActivate`.
- **Accessibility** is the canvas's `aria-label` (the top scope's label or `summary`) and `aria-description` (`Focused: <label>`); no DOM elements are added.
- **`paginate(rows, capacity, page)`**, and **`activateControl(game, id)`** and **`listControls(game)`** for tests; `inspect(game)` lists the controls under `fenrir.UiControls`.

No breaking changes.

### Smaller base build (part of #39)

A game that never inspects itself ships about 3.2 kB less engine code (about 1.2 kB gzip); a core-only game that never builds an entity about 1 kB less on top.

- **`inspect(game)` is a function.** `game.inspect()` is gone: `inspect(game)` from `fenrir-ts` returns the same `GameSnapshot`, on a `Game` or a `TestGame`. `exposeInspector(game)` puts it on `window.__FENRIR__`. A game that calls neither ships no snapshot or JSON-encoding code.
- **`EntityBuilder` core methods are the class's own.** `transform()`, `name()`, `transform2D()` and `display2D()` no longer patch the class at import, so a game that never builds an entity ships no builder. Source-compatible.
- **Stable names in snapshots.** A class instance with a non-empty string `label` (every Pixi display object has one) shows it next to `$type`, which a minifier renames.

### Breaking changes

| Before | After |
| --- | --- |
| `game.inspect()` | `inspect(game)` from `fenrir-ts` |
| `createGame({ canvas, debug: true })` | `createGame({ canvas })`, then `exposeInspector(game)` |
