import Stats from "three/addons/libs/stats.module.js";
import type { SyncSystemFn } from "../SystemCtx";

class StatsSystem {
  private stats: Stats;
  constructor(parent: HTMLElement) {
    this.stats = new Stats();
    parent.appendChild(this.stats.dom);
  }
  public postUpdate() {
    this.stats.update();
  }
}

export function createStatsSystem(parent: HTMLElement) {
  let statsSystem = new StatsSystem(parent);

  const postUpdate: SyncSystemFn = () => statsSystem.postUpdate();

  return { postUpdate } as const;
}
