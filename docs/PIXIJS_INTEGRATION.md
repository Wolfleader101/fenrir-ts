# PixiJS Integration Guide

## Overview

This document outlines the integration of PixiJS into the Fenrir-TS game engine as a separate 2D renderer system. While the engine supports only one active renderer at a time, the system-agnostic architecture allows for a clean 2D renderer implementation that follows the same patterns as the existing Three.js 3D renderer.

## Architecture

### System Design

The PixiJS integration follows Fenrir-TS's ECS (Entity-Component-System) architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                         Engine                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                      Scheduler                          │ │
│  │  ┌──────────────┐  ┌──────────────┐                   │ │
│  │  │   3D Route   │  │   2D Route   │                   │ │
│  │  │              │  │              │                   │ │
│  │  │ ThreeRenderer│  │ PixiRenderer │                   │ │
│  │  │   System     │  │   System     │                   │ │
│  │  └──────────────┘  └──────────────┘                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ▲                                  │
│                           │                                  │
│  ┌────────────────────────┴────────────────────────────────┐│
│  │               Scene / EntityList                         ││
│  │  ┌────────────────┐  ┌────────────────┐                ││
│  │  │  Renderable    │  │ Renderable2D   │                ││
│  │  │  (3D)          │  │ (2D)           │                ││
│  │  └────────────────┘  └────────────────┘                ││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Component Layer

New 2D-specific components are defined parallel to existing 3D components:

- `Renderable2D` - Core 2D rendering component (similar to `Renderable`)
- `Sprite2D` - Sprite rendering descriptor
- `Graphics2D` - Procedural graphics descriptor  
- `Text2D` - Text rendering descriptor
- `Container2D` - Grouping/hierarchy descriptor

## File Structure

```
src/core/Renderer2D/
├── render2DComponents.ts      # Component definitions
├── PixiRenderer.ts             # Core PIXI.Application wrapper
├── PixiRendererSystem.ts       # ECS system integration
└── index.ts                    # Public exports
```

## Implementation Details

### 1. Components (`render2DComponents.ts`)

```typescript
import type { Component } from '../ECS/Component';

export interface Renderable2D extends Component {
  readonly id: number;
  sprite?: SpriteDesc;
  graphics?: GraphicsDesc;
  text?: TextDesc;
  container?: ContainerDesc;
  flags?: Render2DFlags;
}

export type SpriteDesc = {
  readonly kind: 'sprite';
  readonly texture: string;      // Asset key
  readonly anchor?: [number, number];
  readonly tint?: number;
};

export type GraphicsDesc = {
  readonly kind: 'graphics';
  readonly shape: 'rect' | 'circle' | 'polygon';
  readonly fillColor?: number;
  readonly strokeColor?: number;
  readonly strokeWidth?: number;
  // Shape-specific data
  readonly data?: unknown;
};

export type TextDesc = {
  readonly kind: 'text';
  readonly content: string;
  readonly style?: {
    readonly fontFamily?: string;
    readonly fontSize?: number;
    readonly fill?: number;
    readonly align?: 'left' | 'center' | 'right';
  };
};

export type ContainerDesc = {
  readonly kind: 'container';
  readonly children?: number[];  // Entity IDs
};

export type Render2DFlags = {
  readonly visible?: boolean;
  readonly zIndex?: number;
  readonly alpha?: number;
  readonly blendMode?: number;
};
```

### 2. Core Renderer (`PixiRenderer.ts`)

```typescript
import * as PIXI from 'pixi.js';
import type { Entity, EntityList } from '../ECS';
import { Transform } from '../ECS/DefaultComponents';
import type { Renderable2D } from './render2DComponents';
import type { ILogger } from '../ILogger';

type ObjKey = string;
const keyFor = (e: Entity, id: number) => `${e}:${id}`;

export interface PixiRendererOptions {
  readonly canvas?: HTMLCanvasElement;
  readonly logger: ILogger;
  readonly width?: number;
  readonly height?: number;
  readonly clearColor?: number;
  readonly assets: IAssetStore;
}

export class PixiRenderer {
  public readonly app: PIXI.Application;
  private readonly objects = new Map<ObjKey, PIXI.DisplayObject>();
  private readonly assets: IAssetStore;
  private readonly logger: ILogger;
  private isInitialized = false;

  constructor(opts: PixiRendererOptions) {
    const {
      canvas,
      width = window.innerWidth,
      height = window.innerHeight,
      clearColor = 0x101010,
    } = opts;

    this.assets = opts.assets;
    this.logger = opts.logger;

    this.app = new PIXI.Application();
  }

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    await this.app.init({
      canvas: this.app.canvas,
      width: this.app.screen.width,
      height: this.app.screen.height,
      backgroundColor: this.clearColor,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    this.isInitialized = true;
    this.logger.info('PixiRenderer initialized');
  }

  public get initialized(): boolean {
    return this.isInitialized;
  }

  public resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
  }

  public async upsertRenderable(
    entities: EntityList,
    e: Entity,
    r: Renderable2D
  ): Promise<void> {
    const k = keyFor(e, r.id);
    let obj = this.objects.get(k);

    // Create new object if needed
    if (!obj) {
      obj = await this.createDisplayObject(r);
      this.objects.set(k, obj);
      this.app.stage.addChild(obj);
    } else {
      // Update existing object
      await this.updateDisplayObject(obj, r);
    }

    this.applyFlags(obj, r.flags);

    // Apply transform from Transform component
    if (entities.has(e, Transform)) {
      this.applyTransform(obj, entities.get(e, Transform));
    }
  }

  public removeRenderable(e: Entity, renderId: number): void {
    const k = keyFor(e, renderId);
    const obj = this.objects.get(k);
    if (!obj) return;

    this.app.stage.removeChild(obj);
    obj.destroy({ children: true });
    this.objects.delete(k);
  }

  public syncTransforms(entities: EntityList): void {
    const Q = [Transform, Renderable2D] as const;

    entities.each(Q, (e, transform, r) => {
      const obj = this.objects.get(keyFor(e, r.id));
      if (!obj) return;
      this.applyTransform(obj, transform);
    });
  }

  public render(): void {
    this.app.render();
  }

  public dispose(): void {
    for (const obj of this.objects.values()) {
      this.app.stage.removeChild(obj);
      obj.destroy({ children: true });
    }
    this.objects.clear();
    this.app.destroy(true);
  }

  // Internal methods

  private async createDisplayObject(r: Renderable2D): Promise<PIXI.DisplayObject> {
    if (r.sprite) {
      const texture = await this.assets.getTexture(r.sprite.texture);
      const sprite = new PIXI.Sprite(texture);
      if (r.sprite.anchor) {
        sprite.anchor.set(r.sprite.anchor[0], r.sprite.anchor[1]);
      }
      if (r.sprite.tint !== undefined) {
        sprite.tint = r.sprite.tint;
      }
      return sprite;
    }

    if (r.graphics) {
      return this.createGraphics(r.graphics);
    }

    if (r.text) {
      const style = new PIXI.TextStyle(r.text.style || {});
      return new PIXI.Text({ text: r.text.content, style });
    }

    if (r.container) {
      return new PIXI.Container();
    }

    throw new Error('No valid renderable type specified in Renderable2D');
  }

  private createGraphics(desc: GraphicsDesc): PIXI.Graphics {
    const graphics = new PIXI.Graphics();

    if (desc.fillColor !== undefined) {
      graphics.fill(desc.fillColor);
    }

    if (desc.strokeColor !== undefined && desc.strokeWidth !== undefined) {
      graphics.stroke({ color: desc.strokeColor, width: desc.strokeWidth });
    }

    switch (desc.shape) {
      case 'rect': {
        const data = desc.data as { x: number; y: number; width: number; height: number };
        graphics.rect(data.x, data.y, data.width, data.height);
        break;
      }
      case 'circle': {
        const data = desc.data as { x: number; y: number; radius: number };
        graphics.circle(data.x, data.y, data.radius);
        break;
      }
      case 'polygon': {
        const data = desc.data as { points: number[] };
        graphics.poly(data.points);
        break;
      }
    }

    return graphics;
  }

  private async updateDisplayObject(
    obj: PIXI.DisplayObject,
    r: Renderable2D
  ): Promise<void> {
    // Update sprite
    if (r.sprite && obj instanceof PIXI.Sprite) {
      const texture = await this.assets.getTexture(r.sprite.texture);
      obj.texture = texture;
      if (r.sprite.tint !== undefined) {
        obj.tint = r.sprite.tint;
      }
    }

    // Update text
    if (r.text && obj instanceof PIXI.Text) {
      obj.text = r.text.content;
      if (r.text.style) {
        obj.style = new PIXI.TextStyle(r.text.style);
      }
    }

    // Graphics would need full recreation
  }

  private applyFlags(obj: PIXI.DisplayObject, flags?: Render2DFlags): void {
    if (!flags) return;

    if (flags.visible !== undefined) obj.visible = flags.visible;
    if (flags.zIndex !== undefined) obj.zIndex = flags.zIndex;
    if (flags.alpha !== undefined) obj.alpha = flags.alpha;
    if (flags.blendMode !== undefined) obj.blendMode = flags.blendMode;
  }

  private applyTransform(
    obj: PIXI.DisplayObject,
    transform: {
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number; w: number };
      scale: { x: number; y: number; z: number };
    }
  ): void {
    // Map 3D transform to 2D (use x/y, ignore z)
    obj.position.set(transform.position.x, transform.position.y);
    obj.scale.set(transform.scale.x, transform.scale.y);

    // Convert quaternion to 2D rotation (simplified - use z rotation)
    // For proper quaternion->euler conversion, use a helper
    // obj.rotation = eulerFromQuaternion(transform.rotation).z;
  }

  public getRenderedObject(
    entity: Entity,
    renderableId: number
  ): PIXI.DisplayObject | undefined {
    return this.objects.get(keyFor(entity, renderableId));
  }
}
```

### 3. System Integration (`PixiRendererSystem.ts`)

```typescript
import type { SystemCtx } from '../SystemCtx';
import { PixiRenderer } from './PixiRenderer';
import type { PixiRendererOptions } from './PixiRenderer';
import { Renderable2D } from './render2DComponents';

export interface PixiRendererSystemOptions extends PixiRendererOptions {
  // Additional system-specific options
}

export function createPixiRendererSystem(opts: PixiRendererSystemOptions) {
  const renderer = new PixiRenderer(opts);

  return {
    renderer,

    init: async (ctx: SystemCtx) => {
      await renderer.init();

      // Setup signal handlers for component changes
      ctx.entities.signals.onAdd(Renderable2D, async (e, r) => {
        await renderer.upsertRenderable(ctx.entities, e, r);
      });

      ctx.entities.signals.onRemove(Renderable2D, (e, r) => {
        renderer.removeRenderable(e, r.id);
      });

      ctx.entities.signals.onUpdate(Renderable2D, async (e, r) => {
        await renderer.upsertRenderable(ctx.entities, e, r);
      });

      ctx.logger.info('PixiRendererSystem initialized');
    },

    update: (ctx: SystemCtx) => {
      renderer.syncTransforms(ctx.entities);
    },

    postUpdate: (ctx: SystemCtx) => {
      renderer.render();
    },

    exit: async (ctx: SystemCtx) => {
      renderer.dispose();
      ctx.logger.info('PixiRendererSystem disposed');
    },
  };
}
```

### 4. Bootstrap Integration

Update `src/core/Bootstrap.ts`:

```typescript
import { createPixiRendererSystem } from './Renderer2D/PixiRendererSystem';

export type BootstrapConfig = {
  canvas: HTMLCanvasElement;
  enablePhysics?: boolean;
  enableAnimations?: boolean;
  enableStats?: boolean;
  enable2D?: boolean;           // NEW: Enable 2D renderer
  statsParent?: HTMLElement;
  rendererType?: 'webgl' | 'webgpu';
  clearColor?: number;
};

export type BootstrapResult = {
  assets: IAssetStore;
  systems: {
    input: ReturnType<typeof createInputStateSystem>;
    renderer?: ReturnType<typeof createThreeRendererSystem>;  // Optional for 2D-only
    renderer2D?: ReturnType<typeof createPixiRendererSystem>;  // NEW
    camera: ReturnType<typeof createCameraSystem>;
    skybox: ReturnType<typeof createSkyboxSystem>;
    animations?: ReturnType<typeof createAnimationSystem>;
    physics?: ReturnType<typeof createPhysicsSystem>;
    stats?: ReturnType<typeof createStatsSystem>;
  };
};

export function bootstrapEngine(
  engine: Engine,
  logger: ILogger,
  config: BootstrapConfig
): BootstrapResult {
  const {
    canvas,
    enablePhysics = false,
    enableAnimations = false,
    enableStats = false,
    enable2D = false,              // NEW
    rendererType = 'webgpu',
    clearColor = 0x101010,
    statsParent = document.body,
  } = config;

  logger.info('🚀 Bootstrapping engine systems...');

  // Create AssetStore
  const assets = new AssetStore({
    // ... existing loaders
  });

  // Core Input Systems
  const domInput = createDomInputSystems({
    target: window,
    preventDefaults: true,
  });
  const input = createInputStateSystem();

  // Camera and Skybox
  const camera = createCameraSystem();
  const skybox = createSkyboxSystem({ assets });

  // Choose renderer based on config
  let renderer: ReturnType<typeof createThreeRendererSystem> | undefined;
  let renderer2D: ReturnType<typeof createPixiRendererSystem> | undefined;

  if (enable2D) {
    // Use 2D renderer
    renderer2D = createPixiRendererSystem({
      logger,
      canvas,
      clearColor,
      assets,
    });
  } else {
    // Use 3D renderer (default)
    renderer = createThreeRendererSystem({
      logger,
      canvas,
      clearColor,
      assets,
      cameraSystem: camera,
      skyboxSystem: skybox,
      rendererType,
    });
  }

  // Optional systems
  const animations = enableAnimations && renderer
    ? createAnimationSystem({
        assets,
        logger,
        renderer: renderer.renderer,
      })
    : undefined;

  const physics = enablePhysics ? createPhysicsSystem() : undefined;
  const stats = enableStats ? createStatsSystem(statsParent) : undefined;

  // Register systems with engine
  const initSystems = [
    domInput.init,
    ...(renderer ? [renderer.init] : []),
    ...(renderer2D ? [renderer2D.init] : []),
    ...(animations ? [animations.init] : []),
    ...(physics ? [physics.init] : []),
    camera.init,
    skybox.init,
  ];

  const preUpdateSystems = [
    input.preUpdate,
    camera.preUpdate,
    skybox.preUpdate,
    ...(animations ? [animations.preUpdate] : []),
  ];

  const tickSystems = physics ? [physics.tick] : [];

  const updateSystems = [
    camera.update,
    ...(renderer ? [renderer.update] : []),
    ...(renderer2D ? [renderer2D.update] : []),
  ];

  const postUpdateSystems = [
    ...(renderer ? [renderer.postUpdate] : []),
    ...(renderer2D ? [renderer2D.postUpdate] : []),
    ...(stats ? [stats.postUpdate] : []),
  ];

  const exitSystems = [
    domInput.exit,
    ...(renderer ? [renderer.exit] : []),
    ...(renderer2D ? [renderer2D.exit] : []),
    ...(animations ? [animations.exit] : []),
    ...(physics ? [physics.exit] : []),
    camera.exit,
    skybox.exit,
  ];

  engine
    .addSystems(Schedule.Init, initSystems)
    .addSystems(Schedule.PreUpdate, preUpdateSystems)
    .addSystems(Schedule.Tick, tickSystems)
    .addSystems(Schedule.Update, updateSystems)
    .addSystems(Schedule.PostUpdate, postUpdateSystems)
    .addSystems(Schedule.Exit, exitSystems);

  logger.info('✅ Core systems bootstrapped successfully');

  return {
    assets,
    systems: {
      input,
      renderer,
      renderer2D,
      camera,
      skybox,
      animations,
      physics,
      stats,
    },
  };
}
```

## Usage Examples

### Basic 2D Game Setup

```typescript
import { createEngine } from 'fenrir-ts/core';
import { bootstrapEngine } from 'fenrir-ts/core';
import { ConsoleLogger } from 'fenrir-ts/core';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const logger = new ConsoleLogger();
const engine = createEngine(logger);

const { assets, systems } = bootstrapEngine(engine, logger, {
  canvas,
  enable2D: true,           // Enable 2D renderer
  enablePhysics: true,      // Optional: 2D physics
  clearColor: 0x87CEEB,     // Sky blue
});

// Load assets
await assets.loadTexture('player', '/assets/player.png');
await assets.loadTexture('enemy', '/assets/enemy.png');

// Create entities
const player = engine.scenes.getActiveScene().entities.spawn()
  .with(Transform, {
    position: new Vector3(100, 100, 0),
    scale: new Vector3(1, 1, 1),
  })
  .with(Renderable2D, {
    id: 0,
    sprite: {
      kind: 'sprite',
      texture: 'player',
      anchor: [0.5, 0.5],
    },
    flags: {
      zIndex: 10,
    },
  });

await engine.run();
```

### Creating a 2D UI Layer

```typescript
// Spawn UI elements
const healthBar = scene.entities.spawn()
  .with(Transform, {
    position: new Vector3(20, 20, 0),
  })
  .with(Renderable2D, {
    id: 0,
    graphics: {
      kind: 'graphics',
      shape: 'rect',
      fillColor: 0xFF0000,
      data: { x: 0, y: 0, width: 200, height: 20 },
    },
    flags: {
      zIndex: 100,  // Always on top
    },
  });

const scoreText = scene.entities.spawn()
  .with(Transform, {
    position: new Vector3(20, 50, 0),
  })
  .with(Renderable2D, {
    id: 0,
    text: {
      kind: 'text',
      content: 'Score: 0',
      style: {
        fontFamily: 'Arial',
        fontSize: 24,
        fill: 0xFFFFFF,
      },
    },
    flags: {
      zIndex: 100,
    },
  });
```

## Package Dependencies

Add to `package.json`:

```json
{
  "peerDependencies": {
    "pixi.js": "^8.0.0"
  },
  "devDependencies": {
    "@pixi/eslint-config": "^5.0.0"
  }
}
```

## Migration from Three.js to PixiJS

To convert a 3D game to 2D:

1. Change bootstrap config: `enable2D: true`
2. Replace `Renderable` components with `Renderable2D`
3. Update `Transform` usage (ignore z-axis)
4. Replace 3D geometries with 2D sprites/graphics
5. Update asset loading (use 2D textures instead of 3D models)

## Performance Considerations

- **Single Renderer Active**: Only one renderer (3D or 2D) should be active per engine instance
- **Batch Rendering**: PixiJS automatically batches sprites with same texture
- **Z-Index Sorting**: Use `zIndex` flags for layer ordering instead of 3D depth
- **Asset Caching**: Share `AssetStore` between systems for efficient texture management
- **Transform Sync**: Only sync transforms that have changed (future optimization)

## Future Enhancements

1. **Particle Systems**: Add `ParticleEmitter2D` component
2. **Tilemap Support**: Integrate pixi-tilemap for large tile-based games
3. **Spine Animation**: Support for skeletal 2D animations
4. **Filters/Effects**: Post-processing shaders via PixiJS filters
5. **Hybrid Rendering**: Support both renderers simultaneously with layering

## Testing

Create test cases following existing renderer tests in `tests/core/Renderer/`:

```typescript
// tests/core/Renderer2D/PixiRenderer.test.ts
describe('PixiRenderer', () => {
  it('should initialize PIXI.Application', async () => {
    // Test implementation
  });

  it('should create sprite from Renderable2D', async () => {
    // Test implementation
  });

  it('should sync transforms from Transform component', () => {
    // Test implementation
  });
});
```

## Conclusion

This integration provides a clean, system-agnostic 2D rendering solution that:

- ✅ Follows existing Fenrir-TS architecture patterns
- ✅ Maintains ECS component-driven design
- ✅ Supports hot-swapping between 3D and 2D renderers
- ✅ Leverages shared `AssetStore` for efficiency
- ✅ Provides familiar PIXI.js API within ECS context

The system-agnostic nature allows developers to choose rendering approach per project while maintaining consistent ECS patterns throughout.
