# Fenrir TS

**Fenrir TS** is a TypeScript game engine inspired by my C++ engine [FenrirEngine](https://github.com/Wolfleader101/FenrirEngine), re-imagined for the web with a TypeScript-first design.

It focuses on **clear engine architecture**, **explicit data flow**, and **high-performance ECS patterns**, while remaining flexible enough to support both 2D and 3D rendering backends.

---

## Installation

Install `fenrir-ts` and the peer of each entry point you import. A 2D game:

```bash
npm install fenrir-ts pixi.js
# or
pnpm add fenrir-ts pixi.js
```

| Entry | Peers to install |
| --- | --- |
| `fenrir-ts` (core) | none |
| `fenrir-ts/2d` | `pixi.js` 8 |
| `fenrir-ts/ui` | `pixi.js` 8 |
| `fenrir-ts/audio` | none (Web Audio) |
| `fenrir-ts/3d` | `three` 0.182 (and `@types/three` for TypeScript) |
| `fenrir-ts/physics` | `jolt-physics` 1 and `three` 0.182 |

Every peer is optional, so the package manager installs only the ones you list and warns about none. Importing an entry whose peer is missing fails, naming the package: Node throws `Cannot find package 'three'`, and a Vite build fails with `"Vector3" is not exported by "__vite-optional-peer-dep:three:fenrir-ts"` (the peer, then the package that needs it). Each entry supports one major of its peer, the one it is built and tested with; a new major arrives in an engine release. The package is ES modules only, with types for `"moduleResolution"` `"bundler"`, `"node16"` and `"nodenext"`. Releases follow [CHANGELOG.md](CHANGELOG.md): at 0.x, a breaking change bumps the minor version, so depend on `"fenrir-ts": "~0.2.0"` to take only fixes.

### From a local checkout

To work on the engine and a game together, build the engine and point the game at it:

```bash
git clone https://github.com/Wolfleader101/fenrir-ts.git
cd fenrir-ts && pnpm install && pnpm build:lib
# in the game: "fenrir-ts": "file:../fenrir-ts" in package.json, then install
```

Rebuild with `pnpm build:lib` after each engine change. `pnpm pack` makes the same tarball npm would publish, which installs like a release. Changing the engine: [AGENTS.md](AGENTS.md).

### Using Fenrir with a coding agent

The package ships a guide for an agent that builds a game with Fenrir, with the full rules for each service and an API reference generated from the TSDoc, so the agent needs nothing but the installed package:

```text
node_modules/fenrir-ts/
├── llms.txt                     index of the docs below, in the llms.txt format
├── llms-full.txt                the guide, every reference and the 2D-path API in one file
└── skills/fenrir/
    ├── SKILL.md                 the guide: the model, a minimal game and its test, the rules that prevent common mistakes
    ├── references/*.md          one file per service: core, testing, input, 2d, motion, assets, storage, audio, ui (and the frozen 3D path)
    └── api/*.md                 one file per entry point: every export with its signature and docs
```

The references are the only place each service's rules are written down, so this README links to them rather than repeating them. `SKILL.md` is Markdown with a `name` and `description` frontmatter, the Agent Skills format; agents that do not read skills read the same file, so there is no separate plain copy.

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

On Windows, `New-Item -ItemType Junction -Path .claude\skills\fenrir -Target node_modules\fenrir-ts\skills\fenrir`. Or copy the folder, and copy it again after upgrading. This works the same for a registry install, a packed tarball and a `file:` dependency.

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

Importing `fenrir-ts/2d`, `fenrir-ts/3d` or `fenrir-ts/physics` also adds that entry's methods to `EntityBuilder` and `AssetStore`, so `renderSprite` and `requestTexture2D` exist once you import `fenrir-ts/2d`.

### Quick start (2D)

```ts
import { EntityBuilder, Schedule, createGame, type SystemCtx } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";

const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const game = await createGame({ canvas, plugins: [pixi2d({ design: { width: 390, minHeight: 640 }, background: 0x101820 })] });

function spawnBall({ entities }: SystemCtx): void {
  EntityBuilder.create().transform2D(195, 320).renderCircle(16, { fillColor: 0xff6600 }).spawn(entities);
}

game.addSystem(Schedule.Init, spawnBall);
await game.run();
```

The page needs the canvas in the DOM before `createGame` runs (a `type="module"` script does that) and `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. [SKILL.md](skills/fenrir/SKILL.md) has a fuller game with a headless test.

## Documentation

Each service is documented once, in `skills/fenrir/references/`, which ships in the package. Read [`skills/fenrir/SKILL.md`](skills/fenrir/SKILL.md) first: the model in a page, a minimal game and its test, and the rules that prevent the common mistakes.

| Topic | Covers |
| --- | --- |
| [Core](skills/fenrir/references/core.md) | plugins, components and systems, named systems and their order, time and random, resources, states, events and listeners |
| [Testing and inspecting](skills/fenrir/references/testing.md) | `createTestGame` and `step`, `inspect(game)`, `exposeInspector` and the snapshot's JSON rules |
| [Input](skills/fenrir/references/input.md) | `defineAction`, the pointer, `consume` and `consumePointer`, `edges`, `onDown`, `onGesture`, test input |
| [2D](skills/fenrir/references/2d.md) | `pixi2d`, the design frame and `Viewport`, `Transform2D`, `Display2D`, `PixiNode`, layers |
| [Timers and tweens](skills/fenrir/references/motion.md) | `motion()`, `addTimer`, `addTween`, easings, pausing |
| [Assets](skills/fenrir/references/assets.md) | manifests, bundles, `loadAsset`, fallbacks, optional assets, progress |
| [Storage](skills/fenrir/references/storage.md) | `storage()`, keys, versions and migrations, families, `persistResource` |
| [Audio](skills/fenrir/references/audio.md) | `fenrir-ts/audio`: sounds, buses, unlock, test audio |
| [UI controls](skills/fenrir/references/ui.md) | `fenrir-ts/ui`: controls, modal scopes, focus, keys, accessibility |
| [3D and physics](skills/fenrir/references/3d-and-physics.md) | the frozen `fenrir-ts/3d` and `fenrir-ts/physics` |
| [API reference](skills/fenrir/api/README.md) | every export of every entry point, generated from the TSDoc |

Breaking changes, each with a migration line, are in [CHANGELOG.md](CHANGELOG.md). Changing the engine itself: [AGENTS.md](AGENTS.md).

---

## Design

Fenrir TS is built around a sparse-set **Entity–Component–System** core, inspired by [EnTT](https://github.com/skypjack/entt): entities are IDs, components are plain data, systems are named functions over queried components, and schedules say when each runs, so execution order is explicit and inspectable rather than hidden in callbacks. It favours composition, explicit dependencies and data-oriented design over class hierarchies, global state and framework-driven control flow. Every feature is an opt-in plugin that costs nothing when not imported, and every game runs headless and deterministically under test.

Inspired by [FenrirEngine](https://github.com/Wolfleader101/FenrirEngine) and [EnTT](https://github.com/skypjack/entt).

---

## License

MIT — use it, break it, learn from it.

## Model Licenses

Sample models are sourced from the [glTF Sample Models repository](https://github.com/KhronosGroup/glTF-Sample-Models).
