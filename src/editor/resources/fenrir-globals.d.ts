import type * as Fenrir from "./fenrir";
import type * as Three from "./three-shim";

// This file is only for the Monaco live scripting environment.

declare global {
  // runtime values exposed in your sandbox
  const Vector3: typeof Three.Vector3;
  const Quaternion: typeof Three.Quaternion;
  const Color: typeof Three.Color;

  const EntityBuilder: typeof Fenrir.EntityBuilder;
  const SkyboxUtils: typeof Fenrir.SkyboxUtils;

  const scene: Fenrir.Scene;
  const entities: Fenrir.EntityList;
  const time: Fenrir.Time;
  const logger: Fenrir.ILogger;
  const assets: Fenrir.IAssetStore;

  // types that don’t exist at runtime
  type Entity = Fenrir.Entity;
  type SystemCtx = Fenrir.SystemCtx;
  type AsyncSystemFn = Fenrir.AsyncSystemFn;
  type SyncSystemFn = Fenrir.SyncSystemFn;
}

export {};
