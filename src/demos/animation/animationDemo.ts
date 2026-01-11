import { Vector3 } from "three";

import type { AsyncSystemFn } from "@/core/SystemCtx";
import { Spin } from "../shared/spinComponent.ts";
import type { IAssetStore } from "@/core/Assets/AssetStore";
import { assetKey } from "@/core/Assets/AssetStore";
import { EntityBuilder } from "@/core/EntityBuilder/EntityBuilder";

/**
 * Animation Demo Scene
 *
 * Demonstrates:
 * - Loading and displaying GLTF models
 * - Animation playback control
 * - Custom spinning behavior
 * - Entity Builder pattern
 */
export const createAnimationDemo = async (assetStore: IAssetStore) => {
  const duckUrl = "/models/Duck.glb";
  const foxUrl = "/models/CesiumMan.glb";
  const duckKey = assetKey("duck");
  const foxKey = assetKey("fox");

  // Demonstrate the enhanced AssetStore capabilities
  console.log("🔧 Testing AssetStore with custom loaders:");
  console.log(
    "📦 Supported model extensions:",
    assetStore.getSupportedModelExtensions()
  );
  console.log(
    "🖼️ Supported texture extensions:",
    assetStore.getSupportedTextureExtensions()
  );

  // preload assets using default GLTF loader
  console.log("📦 Loading GLTF models...");
  await assetStore.loadModel(duckKey, duckUrl);
  await assetStore.loadModel(foxKey, foxUrl);

  const duckEntity = EntityBuilder.create()
    .name("Duck")
    .transform(new Vector3(-3, 0, 0))
    .model(duckKey)
    .with(Spin, { speed: 1.5 });

  const foxEntity = (x: number, playing: boolean) =>
    EntityBuilder.create()
      .name("Fox")
      .transform(new Vector3(x, 0, 0))
      .model(foxKey)
      .animate(foxKey, { playing });

  const init: AsyncSystemFn = (ctx) => {
    const entities = ctx.scene.entityList;

    duckEntity.spawn(entities);
    foxEntity(3, true).spawn(entities);
    foxEntity(5, false).spawn(entities);
  };

  return { init };
};
