// ThreeRenderer.ts
import * as THREE from "three";
import type { Entity, EntityList } from "../ECS";
import { WorldTransform } from "../ECS/DefaultComponents";
import type { ILogger } from "../ILogger";
import {
  type RenderFlags,
  type GeometryDesc,
  type MaterialDesc,
  Renderable,
} from "./renderComponents";

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

export class ThreeRenderer {
  public readonly scene = new THREE.Scene();
  public readonly renderer: THREE.WebGLRenderer;
  public readonly camera: THREE.PerspectiveCamera;

  private readonly objects = new Map<ObjKey, THREE.Object3D>();

  private readonly geomCache = new Map<string, THREE.BufferGeometry>();
  private readonly matCache = new Map<string, THREE.Material>();

  // optional: ref counts if you want to dispose caches safely later
  // private readonly geomRef = new Map<string, number>();
  // private readonly matRef = new Map<string, number>();

  constructor(opts: {
    canvas?: HTMLCanvasElement;
    logger: ILogger;
    width?: number;
    height?: number;
    clearColor?: number;
  }) {
    const {
      canvas,
      width = window.innerWidth,
      height = window.innerHeight,
    } = opts;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
    });

    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (opts.clearColor !== undefined) {
      this.renderer.setClearColor(opts.clearColor);
    }

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 0, 0);

    // Basic default lighting (optional)
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1.0);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(10, 20, 10);
    this.scene.add(dir);
  }

  public resize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Call when Renderable is added or replaced (if geometry/material can change). */
  public upsertRenderable(entities: EntityList, e: Entity, r: Renderable) {
    const k = keyFor(e, r.id);
    let obj = this.objects.get(k);

    if (!obj) {
      obj = this.createObjectFromRenderable(r);
      this.objects.set(k, obj);
      this.scene.add(obj);
    } else {
      // If you want to support runtime geometry/material changes:
      // simplest: recreate the Mesh
      if (obj instanceof THREE.Mesh) {
        const desiredGeom = this.getGeometry(r.geometry);
        const desiredMat = this.getMaterial(r.material);

        if (obj.geometry !== desiredGeom) obj.geometry = desiredGeom;
        if (obj.material !== desiredMat) obj.material = desiredMat as any;
      }
    }

    this.applyFlags(obj, r.flags);

    // Set initial transform immediately if available
    if (entities.has(e, WorldTransform)) {
      this.applyWorldTransform(obj, entities.get(e, WorldTransform));
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
    // Iterate only entities that have both WorldTransform and Renderable
    const Q = [WorldTransform, Renderable] as const;

    entities.each(Q, (e, wt, r) => {
      const obj = this.objects.get(keyFor(e, r.id));
      if (!obj) return; // if added without signals, fallback could upsert here
      this.applyWorldTransform(obj, wt);
    });
  }

  public render() {
    this.renderer.render(this.scene, this.camera);
  }

  // ---------- internals ----------

  private createObjectFromRenderable(r: Renderable): THREE.Object3D {
    const geom = this.getGeometry(r.geometry);
    const mat = this.getMaterial(r.material);
    const mesh = new THREE.Mesh(geom, mat);
    this.applyFlags(mesh, r.flags);
    return mesh;
  }

  private getGeometry(desc: GeometryDesc): THREE.BufferGeometry {
    const k = geomKey(desc);
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
      case "fromAsset": {
        // Later: pull from GLTF cache etc.
        // For now, create a placeholder geometry so you can see something.
        g = new THREE.BoxGeometry(1, 1, 1);
        break;
      }
      default: {
        // exhaustive check
        const _never: never = desc;
        g = new THREE.BoxGeometry(1, 1, 1);
      }
    }

    this.geomCache.set(k, g);
    return g;
  }

  private getMaterial(desc: MaterialDesc): THREE.Material {
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
      case "fromAsset": {
        // Later: textures/materials
        m = new THREE.MeshStandardMaterial({ color: 0xff00ff });
        break;
      }
      default: {
        const _never: never = desc;
        m = new THREE.MeshStandardMaterial({ color: 0xffffff });
      }
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
    }
  ) {
    obj.position.copy(wt.position);
    obj.quaternion.copy(wt.rotation);
    obj.scale.copy(wt.scale);
    obj.updateMatrixWorld(true);
  }
}
