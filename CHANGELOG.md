# Changelog

Fenrir TS is at 0.x: breaking changes are allowed, and each one is listed here with a migration line.

## Unreleased

### Smaller base build (part of #39)

A base 2D game ships 4.2 kB less engine code (58.4 → 54.1 kB minified, 18.7 → 17.2 kB gzip); a core-only game 4.3 kB less (42.7 → 38.3 kB, 13.6 → 12.0 kB gzip).

- **`inspector()` plugin.** `game.inspect()` and `window.__FENRIR__` come from `inspector()` in `fenrir-ts`. A game without it ships no snapshot or JSON-encoding code. Every `createTestGame` game has it with no plugin.
- **No prototype patching on `AssetStore`.** 2D textures load with functions from `fenrir-ts/2d`; 3D assets through `AssetStore3D` from `fenrir-ts/3d`, which `bootstrapEngine` builds. `pixi2d` registers the default Pixi texture loader on `game.assets` when it installs. `AssetStore` gains `hasLoader(kind, name)`.
- **`EntityBuilder` core methods are the class's own.** `transform()`, `name()`, `transform2D()` and `display2D()` no longer patch the class at import, so a game that never builds an entity ships no builder. Source-compatible.
- **Stable names in snapshots.** A class instance with a non-empty string `label` (every Pixi display object has one) shows it next to `$type`, which a minifier renames.

### Breaking changes

The 2D texture methods on `AssetStore` are removed (every 2D consumer that used them): five methods, each now a function of the same name from `fenrir-ts/2d` that takes the store first.

| Before | After |
| --- | --- |
| `assets.requestTexture2D(key, url)` | `requestTexture2D(assets, key, url)` from `fenrir-ts/2d` |
| `assets.loadTexture2D(key, url)` | `loadTexture2D(assets, key, url)` |
| `assets.getTexture2D(key)` | `getTexture2D(assets, key)` |
| `assets.registerTexture2DLoader(name, config)` | `registerTexture2DLoader(assets, name, config)` |
| `assets.getSupportedTexture2DExtensions()` | `getSupportedTexture2DExtensions(assets)` |
| `createGame({ canvas, debug: true })` | `createGame({ canvas, plugins: [inspector({ global: true })] })` |
| `game.inspect()` on a `createGame` game with no plugin | install `inspector()`; without it `inspect()` throws, naming the plugin. Test games need nothing. |
| `new AssetStore({ texture2DLoaders: { name: config } })` | `registerTexture2DLoader(store, name, config)` |
| `new AssetStore()` then `loadModel`, `loadTexture`, `getGeometry`, `getAnimations`, `getMaterials`, `getTexture`, `registerModelLoader`, `registerTextureLoader`, `getSupported*Extensions` (with `fenrir-ts/3d` imported) | `new AssetStore3D()` from `fenrir-ts/3d`; `bootstrapEngine` returns one as `assets` |
| `new AssetStore({ modelLoaders, textureLoaders })` | `new AssetStore3D({ modelLoaders, textureLoaders })` |
| type `IAssetStore` carrying the 2D or 3D methods; type `AssetStoreConfig` | `IAssetStore3D` / `AssetStore3DOptions` from `fenrir-ts/3d`; 2D code calls the functions above |
| `AssetStore.addInstaller(fn)` | removed: call `store.registerLoader(kind, name, config)` on the store, from a plugin's `install` |
| a `texture2d` manifest asset in a store without `pixi2d` (a test game) loaded through Pixi | register a loader first (`addPixiTextureLoader(game.assets)` or `registerTexture2DLoader`), or use `setAssetLoader` |
