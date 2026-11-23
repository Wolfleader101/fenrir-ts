# Changelog

Fenrir TS is at 0.x: breaking changes are allowed, and each one is listed here with a migration line.

## Unreleased

### Smaller base build (part of #39)

A game that does not install `inspector()` ships about 3.2 kB less engine code (about 1.2 kB gzip); a core-only game that never builds an entity about 1 kB more on top.

- **`inspector()` plugin.** `game.inspect()` and `window.__FENRIR__` come from `inspector()` in `fenrir-ts`. A game without it ships no snapshot or JSON-encoding code. Every `createTestGame` game has it with no plugin.
- **`EntityBuilder` core methods are the class's own.** `transform()`, `name()`, `transform2D()` and `display2D()` no longer patch the class at import, so a game that never builds an entity ships no builder. Source-compatible.
- **Stable names in snapshots.** A class instance with a non-empty string `label` (every Pixi display object has one) shows it next to `$type`, which a minifier renames.

### Breaking changes

| Before | After |
| --- | --- |
| `createGame({ canvas, debug: true })` | `createGame({ canvas, plugins: [inspector({ global: true })] })` |
| `game.inspect()` on a `createGame` game with no plugin | install `inspector()`; without it `inspect()` throws, naming the plugin. Test games need nothing. |
