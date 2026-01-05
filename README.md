# Fenrir TS

**Fenrir TS** is a TypeScript game engine inspired by my C++ engine [FenrirEngine](https://github.com/Wolfleader101/FenrirEngine), re-imagined for the web with a TypeScript-first design.

It focuses on **clear engine architecture**, **explicit data flow**, and **high-performance ECS patterns**, while remaining flexible enough to support both 2D and 3D rendering backends.

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
engine
  .addSystems(Schedule.Init, [input.init, renderer.init])
  .addSystems(Schedule.Update, [movementSystem, renderSystem])
  .run();
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
