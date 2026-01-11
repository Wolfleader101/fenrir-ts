import { Scene } from "./Scene";
import type { ILogger } from "./ILogger";

export class SceneManager {
  private scenes: Scene[] = [];
  private activeSceneIndex = 0;
  private readonly logger?: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger;

    // Always start with a default scene
    this.scenes.push(new Scene("Default"));
  }

  public getActiveScene(): Scene {
    return this.scenes[this.activeSceneIndex]!;
  }

  public changeActiveScene(name: string): void {
    const idx = this.scenes.findIndex((s) => s.name === name);
    if (idx === -1) {
      this.logger?.error(`Scene with name '${name}' does not exist`);
      return;
    }
    this.activeSceneIndex = idx;
  }

  public createScene(name: string): Scene {
    const existing = this.scenes.find((s) => s.name === name);
    if (existing) {
      this.logger?.warn(
        `Scene '${name}' already exists - returning existing scene`
      );
      return existing;
    }

    const scene = new Scene(name);
    this.scenes.push(scene);
    return scene;
  }

  public destroyScene(name: string): void {
    const idx = this.scenes.findIndex((s) => s.name === name);
    if (idx === -1) {
      this.logger?.error(`Scene with name '${name}' does not exist`);
      return;
    }

    // If deleting the active scene, fall back to 0 (or nearest valid)
    const deletingActive = idx === this.activeSceneIndex;

    this.scenes.splice(idx, 1);

    if (this.scenes.length === 0) {
      // Ensure at least one scene exists
      this.scenes.push(new Scene("Default"));
      this.activeSceneIndex = 0;
      return;
    }

    if (deletingActive) {
      this.activeSceneIndex = Math.min(idx, this.scenes.length - 1);
    } else if (idx < this.activeSceneIndex) {
      // shift active index left if we removed before it
      this.activeSceneIndex--;
    }
  }

  public getScene(name: string): Scene {
    const scene = this.scenes.find((s) => s.name === name);
    if (!scene) {
      this.logger?.error(`Scene with name '${name}' does not exist`);
      // mirror your C++ "return default" style
      return this.scenes[0]!;
    }
    return scene;
  }

  // Optional helpers (nice for debugging/UI)
  public listScenes(): readonly Scene[] {
    return this.scenes;
  }
}
