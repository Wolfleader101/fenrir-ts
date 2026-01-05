import * as THREE from "three";
import type { Entity, EntityList } from "../ECS";
import type { SystemFn } from "../SystemCtx";
import { Animation } from "./AnimationComponent";
import { Renderable } from "../Renderer/renderComponents";
import type { IAssetStore } from "../Assets/AssetStore";
import type { ILogger } from "../ILogger";
import type { ThreeRenderer } from "../Renderer/ThreeRenderer";

type AnimationMixerData = {
  mixer: THREE.AnimationMixer;
  actions: Map<string, THREE.AnimationAction>;
  currentAction?: THREE.AnimationAction;
};

export function createAnimationSystem(opts: {
  assets: IAssetStore;
  logger: ILogger;
  renderer: ThreeRenderer;
}) {
  const { assets, logger, renderer } = opts;

  // Map of entity -> mixer data
  const mixers = new Map<Entity, AnimationMixerData>();

  const init: SystemFn = (ctx) => {
    // Handle animation components being added
    ctx.entities.signals.onAdd(Animation, async (entity, animState) => {
      // Don't set up immediately - renderer might still be loading assets
      // Setup will happen in preUpdate when all async operations are complete
      // await setupAnimationMixer(ctx.entities, entity, animState);
    });

    // Handle animation components being removed
    ctx.entities.signals.onRemove(Animation, (entity) => {
      cleanupAnimationMixer(entity);
    });

    // Handle animation state changes
    ctx.entities.signals.onReplace(Animation, async (entity, animState) => {
      await setupAnimationMixer(ctx.entities, entity, animState);
    });
  };

  let hasInitializedExisting = false;

  const preUpdate: SystemFn = (ctx) => {
    // On first preUpdate, set up existing animations (renderer should be ready now)
    if (!hasInitializedExisting) {
      // Collect entities first, then setup synchronously to avoid async iteration issues
      const animationEntities: Array<{
        entity: Entity;
        animState: Animation;
      }> = [];
      ctx.entities.each([Animation] as const, (entity, animState) => {
        animationEntities.push({ entity, animState });
      });

      // Setup animations synchronously
      for (const { entity, animState } of animationEntities) {
        setupAnimationMixer(ctx.entities, entity, animState).catch((error) => {
          logger.error(
            `Failed to setup animation for entity ${entity}: ${error}`
          );
        });
      }
      hasInitializedExisting = true;
    }

    const deltaTime = ctx.time.deltaTime;

    for (const [entity, mixerData] of mixers) {
      mixerData.mixer.update(deltaTime);

      // Update animation state based on component changes
      if (ctx.entities.has(entity, Animation)) {
        const animState = ctx.entities.get(entity, Animation);
        updateAnimationState(mixerData, animState);
      }
    }
  };

  const exit: SystemFn = () => {
    // Clean up all mixers
    for (const entity of mixers.keys()) {
      cleanupAnimationMixer(entity);
    }
  };

  async function setupAnimationMixer(
    entities: EntityList,
    entity: Entity,
    animState: Animation
  ) {
    try {
      // Check if already set up to avoid double setup
      if (mixers.has(entity)) {
        return;
      }

      // Get the rendered object for this entity
      if (!entities.has(entity, Renderable)) {
        logger.warn(
          `Entity ${entity} has Animation but no Renderable component`
        );
        return;
      }

      // Check if renderer is ready
      if (!renderer) {
        return;
      }

      // Get the renderable component to find the rendered object
      const renderable = entities.get(entity, Renderable);

      // Get the actual rendered object from the renderer (the cloned object in the scene)
      const renderedObject = renderer.getRenderedObject(entity, renderable.id);
      if (!renderedObject) {
        return;
      }

      const animations = await assets.getAnimations(animState.assetKey);

      if (animations.length === 0) {
        logger.warn(`No animations found for asset key: ${animState.assetKey}`);
        return;
      }

      // Find the armature/skeleton root for the mixer (not the root Group)
      let mixerRoot = renderedObject;

      // Look for SkinnedMesh first (preferred for skeletal animation), then Armature
      let foundSkinnedMesh = false;
      renderedObject.traverse((child) => {
        if (child.type === "SkinnedMesh" || (child as any).isSkinnedMesh) {
          mixerRoot = child;
          foundSkinnedMesh = true;
        } else if (!foundSkinnedMesh && child.name === "Armature") {
          mixerRoot = child;
        }
      });

      // Create animation mixer on the proper root object
      const mixer = new THREE.AnimationMixer(mixerRoot);
      const actions = new Map<string, THREE.AnimationAction>();

      // Create actions for all animations
      animations.forEach((clip, index) => {
        const action = mixer.clipAction(clip);
        const name = clip.name || `animation_${index}`;
        actions.set(name, action);
        actions.set(index.toString(), action); // Also allow access by index
      });

      const mixerData: AnimationMixerData = {
        mixer,
        actions,
      };

      mixers.set(entity, mixerData);

      // Start playing only if playing is true (autoPlay is ignored if playing is explicitly false)
      if (animState.playing) {
        playAnimation(mixerData, animState);
      }
    } catch (error) {
      logger.error(
        `Failed to setup animation mixer for entity ${entity}: ${error}`
      );
    }
  }

  function cleanupAnimationMixer(entity: Entity) {
    const mixerData = mixers.get(entity);
    if (mixerData) {
      // Stop all actions
      for (const action of mixerData.actions.values()) {
        action.stop();
      }

      // Dispose mixer
      mixerData.mixer.stopAllAction();
      mixerData.mixer.uncacheRoot(mixerData.mixer.getRoot());

      mixers.delete(entity);
    }
  }

  function updateAnimationState(
    mixerData: AnimationMixerData,
    animState: Animation
  ) {
    if (animState.playing && !mixerData.currentAction?.isRunning()) {
      playAnimation(mixerData, animState);
    } else if (!animState.playing && mixerData.currentAction?.isRunning()) {
      stopAnimation(mixerData, animState);
    }

    // Update time scale and weight on current action (using effective methods)
    if (mixerData.currentAction) {
      mixerData.currentAction.setEffectiveTimeScale(
        animState.timeScale * animState.speed
      );
      mixerData.currentAction.setEffectiveWeight(animState.weight);
    }
  }

  function playAnimation(mixerData: AnimationMixerData, animState: Animation) {
    // Determine which animation to play
    let actionKey: string;
    if (animState.animationName) {
      actionKey = animState.animationName;
    } else if (animState.animationIndex !== undefined) {
      actionKey = animState.animationIndex.toString();
    } else {
      actionKey = "0"; // Default to first animation
    }

    const action = mixerData.actions.get(actionKey);
    if (!action) {
      logger.warn(
        `Animation not found: ${actionKey}, available actions: ${Array.from(
          mixerData.actions.keys()
        ).join(", ")}`
      );
      return;
    }

    // Stop current action with fade out
    if (mixerData.currentAction && mixerData.currentAction !== action) {
      if (animState.fadeDuration) {
        mixerData.currentAction.fadeOut(animState.fadeDuration);
      } else {
        mixerData.currentAction.stop();
      }
    }

    // Configure and start new action (following Three.js official pattern)
    action.reset();
    action.loop = animState.loop ? THREE.LoopRepeat : THREE.LoopOnce;

    // Enable action first (following official Three.js pattern)
    action.enabled = true;
    action.setEffectiveTimeScale(animState.timeScale * animState.speed);
    action.setEffectiveWeight(animState.weight);

    if (animState.fadeDuration) {
      action.fadeIn(animState.fadeDuration);
    }

    action.play();
    mixerData.currentAction = action;
  }

  function stopAnimation(mixerData: AnimationMixerData, animState: Animation) {
    if (mixerData.currentAction) {
      if (animState.fadeDuration) {
        mixerData.currentAction.fadeOut(animState.fadeDuration);
      } else {
        mixerData.currentAction.stop();
      }
      mixerData.currentAction = undefined;
    }
  }

  return { init, preUpdate, exit } as const;
}
