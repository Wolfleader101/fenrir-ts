import * as THREE from "three";
// Type-only: the WebGPU build reads WebGPU globals while it loads, so it is
// imported lazily in init() and only when WebGPU is available.
import type * as THREE_WEBGPU from "three/webgpu";

import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import type { Entity, EntityList } from "../ECS";
import { Transform } from "../Transform3D";
import type { ILogger } from "../ILogger";
import type { Scene } from "../Scene";
import {
  type RenderFlags,
  type GeometryDesc,
  type MaterialDesc,
  Renderable,
} from "./renderComponents";
import type { IAssetStore3D } from "../Assets/Assets3D";
// Adds the model and texture methods and loaders to the asset store.
import "../Assets/Assets3D";
import type { CameraInstance } from "../Camera/CameraComponents";
import type { SkyboxInstance } from "../Skybox/SkyboxComponents";

type ObjKey = string;
const keyFor = (e: Entity, id: number) => `${e}:${id}`;

function flagsDefaults(flags?: RenderFlags): Required<RenderFlags> {
  return {
    visible: flags?.visible ?? true,
    castShadow: flags?.castShadow ?? false,
    receiveShadow: flags?.receiveShadow ?? false,
    layer: flags?.layer ?? 0,
  };
}

function geomKey(d: GeometryDesc): string {
  // Simple stable key. Later you can hand-roll a faster one.
  return JSON.stringify(d);
}

function matKey(d: MaterialDesc): string {
  return JSON.stringify(d);
}

function isModelGeom(
  d: GeometryDesc,
): d is Extract<GeometryDesc, { kind: "model" }> {
  return d.kind === "model";
}
function isAssetMat(
  d: MaterialDesc,
): d is Extract<MaterialDesc, { kind: "asset" }> {
  return d.kind === "asset";
}
function isNoneMat(
  d: MaterialDesc,
): d is Extract<MaterialDesc, { kind: "none" }> {
  return d.kind === "none";
}

export type RendererType = "webgl" | "webgpu";

export interface ThreeRendererOptions {
  canvas?: HTMLCanvasElement;
  logger: ILogger;
  width?: number;
  height?: number;
  clearColor?: number;
  assets: IAssetStore3D;
  rendererType?: RendererType;
}

type AnyRenderer = THREE.WebGLRenderer | THREE_WEBGPU.WebGPURenderer;

/** True when the WebGPU globals that `three/webgpu` reads at load time exist. */
export function isWebGPUAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "gpu" in navigator &&
    !!(navigator as Navigator & { gpu?: unknown }).gpu &&
    typeof (globalThis as { GPUShaderStage?: unknown }).GPUShaderStage !==
      "undefined"
  );
}

export class ThreeRenderer {
  public readonly scene = new THREE.Scene();
  public readonly camera: THREE.PerspectiveCamera; // Kept for backward compatibility

  private readonly objects = new Map<ObjKey, THREE.Object3D>();

  private readonly geomCache = new Map<string, THREE.BufferGeometry>();
  private readonly matCache = new Map<string, THREE.Material>();

  private readonly assets: IAssetStore3D;
  private readonly logger: ILogger;
  private readonly canvas: HTMLCanvasElement | undefined;
  private readonly clearColor: number | undefined;
  private width: number;
  private height: number;
  private currentSkybox: SkyboxInstance | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /** Requested renderer type. See `rendererType` for the one in use. */
  public readonly requestedRendererType: RendererType;
  private activeRendererType: RendererType;
  private threeRenderer: AnyRenderer | null = null;

  // optional: ref counts if you want to dispose caches safely later
  // private readonly geomRef = new Map<string, number>();
  // private readonly matRef = new Map<string, number>();

  constructor(opts: ThreeRendererOptions) {
    const {
      canvas,
      width = window.innerWidth,
      height = window.innerHeight,
    } = opts;

    this.assets = opts.assets;
    this.logger = opts.logger;
    this.requestedRendererType = opts.rendererType || "webgl";
    this.activeRendererType = this.requestedRendererType;

    // Validate canvas if provided
    if (canvas && !(canvas instanceof HTMLCanvasElement)) {
      throw new Error(
        "Invalid canvas element provided to ThreeRenderer. Expected HTMLCanvasElement, got: " +
          typeof canvas,
      );
    }

    this.canvas = canvas;
    this.clearColor = opts.clearColor;
    this.width = width;
    this.height = height;

    // WebGL is created now. WebGPU needs a dynamic import, so it is created in init().
    if (this.requestedRendererType === "webgl") {
      this.threeRenderer = this.configure(this.createWebGLRenderer());
    }

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    this.camera.position.set(0, 2, 10);
    this.camera.lookAt(0, 0, 0);

    // Basic default lighting (optional)
    // TODO these shouldnt be here, lights should be added as components on entities
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(10, 20, 10);
    this.scene.add(dir);
  }

  /**
   * The underlying three.js renderer. For `"webgpu"` it exists only after `init()` resolves.
   */
  public get renderer(): AnyRenderer {
    if (!this.threeRenderer) {
      throw new Error(
        "ThreeRenderer: the WebGPU renderer is created in init(). Await init() before using it.",
      );
    }
    return this.threeRenderer;
  }

  /**
   * Renderer type in use. Starts as the requested type and becomes `"webgl"`
   * after init() if WebGPU was requested but is unavailable.
   */
  public get rendererType(): RendererType {
    return this.activeRendererType;
  }

  /**
   * Initialize the renderer. For `"webgpu"` this loads `three/webgpu` and creates
   * the renderer; without WebGPU it logs a warning and uses WebGL instead.
   */
  public init(): Promise<void> {
    if (this.isInitialized) return Promise.resolve();
    this.initPromise ??= this.doInit();
    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    if (this.requestedRendererType === "webgpu" && !this.threeRenderer) {
      this.threeRenderer = this.configure(await this.createWebGPUOrFallback());
    }
    this.isInitialized = true;
  }

  private async createWebGPUOrFallback(): Promise<AnyRenderer> {
    if (!isWebGPUAvailable()) {
      this.logger.warn(
        "WebGPU is not available in this environment; falling back to the WebGL renderer.",
      );
      this.activeRendererType = "webgl";
      return this.createWebGLRenderer();
    }

    let gpu: THREE_WEBGPU.WebGPURenderer | null = null;
    try {
      const { WebGPURenderer } = await import("three/webgpu");
      gpu = new WebGPURenderer({ canvas: this.canvas, antialias: true });
      await gpu.init();
      return gpu;
    } catch (err) {
      gpu?.dispose();
      this.logger.warn(
        "WebGPU renderer failed to initialize; falling back to the WebGL renderer.",
        { error: err instanceof Error ? err.message : String(err) },
      );
      this.activeRendererType = "webgl";
      return this.createWebGLRenderer();
    }
  }

  private createWebGLRenderer(): THREE.WebGLRenderer {
    return new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
  }

  private configure<R extends AnyRenderer>(renderer: R): R {
    renderer.shadowMap.enabled = true;
    renderer.setSize(this.width, this.height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (this.clearColor !== undefined) {
      renderer.setClearColor(this.clearColor);
    }
    return renderer;
  }

  /**
   * Check if renderer is initialized
   */
  public get initialized(): boolean {
    return this.isInitialized;
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.threeRenderer?.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Call when Renderable is added or replaced (if geometry/material can change). */
  public async upsertRenderable(
    entities: EntityList,
    e: Entity,
    r: Renderable,
  ) {
    const k = keyFor(e, r.id);
    const existing = this.objects.get(k);

    const geoOrObj = await this.getGeometry(r.geometry);

    const wantsObject3D = geoOrObj instanceof THREE.Object3D;

    // If existence + type mismatch, recreate
    if (existing && wantsObject3D) {
      // existing might be Mesh -> replace
      this.scene.remove(existing);
      this.objects.delete(k);
    } else if (
      existing &&
      !wantsObject3D &&
      !(existing instanceof THREE.Mesh)
    ) {
      this.scene.remove(existing);
      this.objects.delete(k);
    }

    let obj = this.objects.get(k);

    if (!obj) {
      // If we already computed geoOrObj, avoid double work
      if (wantsObject3D) {
        // Check if the object has skeletal animations (SkinnedMesh)
        let hasSkeletalAnimation = false;
        geoOrObj.traverse((child) => {
          if (
            child instanceof THREE.SkinnedMesh ||
            (child as any).isSkinnedMesh
          ) {
            hasSkeletalAnimation = true;
          }
        });

        // Use SkeletonUtils.clone for animated models, regular clone for static models
        if (hasSkeletalAnimation) {
          obj = SkeletonUtils.clone(geoOrObj);
        } else {
          obj = geoOrObj.clone(true);
        }
      } else {
        const material = await this.getMaterial(r.material!);
        if (!material) {
          throw new Error("Material is required for BufferGeometry meshes");
        }
        obj = new THREE.Mesh(geoOrObj, material);
      }

      this.objects.set(k, obj);
      this.scene.add(obj);
    } else if (obj instanceof THREE.Mesh && !wantsObject3D) {
      const desiredGeom = geoOrObj;
      const desiredMat = await this.getMaterial(r.material!);

      if (obj.geometry !== desiredGeom) obj.geometry = desiredGeom;
      if (desiredMat && obj.material !== desiredMat) obj.material = desiredMat;
    }

    this.applyFlags(obj, r.flags);

    // Apply transform directly from Transform component
    if (entities.has(e, Transform)) {
      this.applyWorldTransform(obj, entities.get(e, Transform));
    }
  }

  /** Call when Renderable is removed or entity destroyed. */
  public removeRenderable(e: Entity, renderId: number) {
    const k = keyFor(e, renderId);
    const obj = this.objects.get(k);
    if (!obj) return;

    this.scene.remove(obj);
    this.objects.delete(k);

    // If you’re not ref-counting caches, do NOT dispose cached geometries/materials here.
    // But we can dispose per-object non-cached resources if you ever create unique ones.
  }

  /** Sync transforms for all renderables each frame. */
  public syncTransforms(entities: EntityList) {
    // Iterate only entities that have both Transform and Renderable
    const Q = [Transform, Renderable] as const;

    entities.each(Q, (e, transform, r) => {
      const obj = this.objects.get(keyFor(e, r.id));
      if (!obj) return; // if added without signals, fallback could upsert here
      this.applyWorldTransform(obj, transform);
    });
  }

  /**
   * Render with cameras
   */
  public renderWithCameras(
    cameras: Array<[Entity, CameraInstance]>,
    _ecsScene?: Scene,
    skyboxInstance?: SkyboxInstance | null,
  ) {
    // Update skybox if needed
    this.updateSkybox(skyboxInstance ?? null);

    // Render each camera in order
    for (const [_entity, cameraInstance] of cameras) {
      const camera = cameraInstance.threeCamera;

      // Apply viewport if camera has one
      const viewport = camera.viewport;
      if (viewport) {
        const canvas = this.renderer.domElement;
        this.renderer.setViewport(
          viewport.x * canvas.width,
          viewport.y * canvas.height,
          viewport.width * canvas.width,
          viewport.height * canvas.height,
        );
        this.renderer.setScissor(
          viewport.x * canvas.width,
          viewport.y * canvas.height,
          viewport.width * canvas.width,
          viewport.height * canvas.height,
        );
        this.renderer.setScissorTest(true);
      } else {
        // Full viewport
        this.renderer.setViewport(
          0,
          0,
          this.renderer.domElement.width,
          this.renderer.domElement.height,
        );
        this.renderer.setScissorTest(false);
      }

      // Render with this camera
      this.renderer.render(this.scene, camera);
    }

    // Reset viewport
    this.renderer.setViewport(
      0,
      0,
      this.renderer.domElement.width,
      this.renderer.domElement.height,
    );
    this.renderer.setScissorTest(false);
  }

  /**
   * Legacy render method (kept for backward compatibility)
   */
  public render(skyboxInstance: SkyboxInstance | null) {
    // Update skybox if provided
    this.updateSkybox(skyboxInstance);

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Render with a specific camera
   */
  public renderWithCamera(
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  ) {
    this.renderer.render(this.scene, camera);
  }

  /** Get the rendered Three.js object for an entity/renderable ID */
  public getRenderedObject(
    entity: Entity,
    renderableId: number,
  ): THREE.Object3D | undefined {
    const k = keyFor(entity, renderableId);
    const obj = this.objects.get(k);

    return obj;
  }

  public dispose() {
    // remove objects
    for (const obj of this.objects.values()) this.scene.remove(obj);
    this.objects.clear();

    // dispose procedural caches only
    for (const g of this.geomCache.values()) g.dispose();
    this.geomCache.clear();

    for (const m of this.matCache.values()) m.dispose();
    this.matCache.clear();

    this.threeRenderer?.dispose();
  }

  // ---------- internals ----------

  private async getGeometry(desc: GeometryDesc) {
    if (isModelGeom(desc)) {
      // AssetStore provides Object3D geometry
      return await this.assets.getGeometry(desc.key);
    }

    const k = geomKey(desc); // only procedural desc reach here
    const existing = this.geomCache.get(k);
    if (existing) return existing;

    let g: THREE.BufferGeometry;
    switch (desc.kind) {
      case "box": {
        const [x, y, z] = desc.size ?? [1, 1, 1];
        g = new THREE.BoxGeometry(x, y, z);
        break;
      }
      case "plane": {
        const [x, y] = desc.size ?? [1, 1];
        g = new THREE.PlaneGeometry(x, y);
        break;
      }
      case "sphere": {
        const radius = desc.radius ?? 0.5;
        const w = desc.widthSeg ?? 16;
        const h = desc.heightSeg ?? 12;
        g = new THREE.SphereGeometry(radius, w, h);
        break;
      }
      default:
        const exhaustiveCheck: never = desc;
        throw new Error(`Unknown geometry kind: ${exhaustiveCheck}`);
    }

    this.geomCache.set(k, g);
    return g;
  }

  private async getMaterial(
    desc: MaterialDesc,
  ): Promise<THREE.Material | null> {
    if (isNoneMat(desc)) {
      return null; // Object3D uses its own material
    }

    if (isAssetMat(desc)) {
      // For now, we'll create a basic material with the loaded texture
      const texture = await this.assets.getTexture(desc.key);
      return new THREE.MeshStandardMaterial({ map: texture });
    }

    const k = matKey(desc);
    const existing = this.matCache.get(k);
    if (existing) return existing;

    let m: THREE.Material;
    switch (desc.kind) {
      case "standard": {
        m = new THREE.MeshStandardMaterial({
          color: desc.color ?? 0xffffff,
          roughness: desc.roughness ?? 0.8,
          metalness: desc.metalness ?? 0.0,
        });
        break;
      }
      case "lambert": {
        m = new THREE.MeshLambertMaterial({
          color: desc.color ?? 0xffffff,
        });
        break;
      }
      case "basic": {
        m = new THREE.MeshBasicMaterial({
          color: desc.color ?? 0xffffff,
        });
        break;
      }
      default:
        const exhaustiveCheck: never = desc;
        throw new Error(`Unknown material kind: ${exhaustiveCheck}`);
    }

    this.matCache.set(k, m);
    return m;
  }

  private applyFlags(obj: THREE.Object3D, flags?: RenderFlags) {
    const f = flagsDefaults(flags);
    obj.visible = f.visible;
    obj.layers.set(f.layer);

    if (obj instanceof THREE.Mesh) {
      obj.castShadow = f.castShadow;
      obj.receiveShadow = f.receiveShadow;
    }
  }

  private applyWorldTransform(
    obj: THREE.Object3D,
    wt: {
      position: THREE.Vector3;
      rotation: THREE.Quaternion;
      scale: THREE.Vector3;
    },
  ) {
    obj.position.copy(wt.position);
    obj.quaternion.copy(wt.rotation);
    obj.scale.copy(wt.scale);
    obj.updateMatrixWorld(true);
  }

  /**
   * Update skybox in the scene using Three.js recommended scene.background approach
   */
  private updateSkybox(skyboxInstance: SkyboxInstance | null) {
    // Remove current skybox background if it exists
    if (this.currentSkybox && this.currentSkybox !== skyboxInstance) {
      this.scene.background = null;
      this.currentSkybox = null;
    }

    // Set new skybox background if provided
    if (skyboxInstance && skyboxInstance !== this.currentSkybox) {
      // Use Three.js recommended background approach for proper skybox rendering
      this.scene.background = skyboxInstance.background;
      this.currentSkybox = skyboxInstance;
    }
  }

  /**
   * Get the current skybox instance
   */
  public getCurrentSkybox(): SkyboxInstance | null {
    return this.currentSkybox;
  }

  /**
   * Force remove skybox from scene
   */
  public removeSkybox() {
    if (this.currentSkybox) {
      this.scene.background = null;
      this.currentSkybox = null;
    }
  }
}
