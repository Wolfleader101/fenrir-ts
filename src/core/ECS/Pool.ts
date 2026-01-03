/**
 * Sparse-set component pool (EnTT-style).
 * - sparse[entityId] = denseIndex + 1 (0 means not present)
 * - denseEntities[denseIndex] = entityId
 * - dense[denseIndex] = component
 */
export class Pool<T> {
  // 0 => missing, otherwise denseIndex+1
  private sparse: number[] = [];

  private denseEntities: number[] = [];
  private dense: T[] = [];

  public size() {
    return this.denseEntities.length;
  }

  public has(entityId: number) {
    return (this.sparse[entityId] ?? 0) !== 0;
  }

  /** Returns dense index, or -1 if missing */
  public indexOf(entityId: number): number {
    const s = this.sparse[entityId] ?? 0;
    return s === 0 ? -1 : s - 1;
  }

  /** Get component by entity id (sparse lookup) */
  public get(entityId: number): T {
    const idx = this.indexOf(entityId);
    if (idx === -1) throw new Error(`Component missing on entity ${entityId}`);
    return this.dense[idx];
  }

  public tryGet(entityId: number): T | undefined {
    const idx = this.indexOf(entityId);
    return idx === -1 ? undefined : this.dense[idx];
  }

  /** Get by dense index (fast path) */
  public getAt(denseIndex: number): T {
    return this.dense[denseIndex];
  }

  public entityAt(denseIndex: number): number {
    return this.denseEntities[denseIndex];
  }

  public entities(): readonly number[] {
    return this.denseEntities;
  }

  public components(): readonly T[] {
    return this.dense;
  }

  /**
   * Add or replace.
   * Returns true if inserted, false if replaced.
   */
  public set(entityId: number, component: T) {
    const existing = this.indexOf(entityId);
    if (existing !== -1) {
      this.dense[existing] = component;
      return false;
    }

    const denseIndex = this.denseEntities.length;
    this.denseEntities.push(entityId);
    this.dense.push(component);
    this.sparse[entityId] = denseIndex + 1;
    return true;
  }

  /**
   * Remove component for entityId.
   * Returns true if removed, false if it wasn't present.
   */
  public remove(entityId: number): T | undefined {
    const idx = this.indexOf(entityId);
    if (idx === -1) return undefined;

    const removed = this.dense[idx];

    // swap+pop removal
    const lastIndex = this.dense.length - 1;

    if (idx !== lastIndex) {
      // Only do swap if not removing the last element
      const lastEntity = this.denseEntities[lastIndex];

      // move last into idx
      this.dense[idx] = this.dense[lastIndex];
      this.denseEntities[idx] = lastEntity;

      // update sparse for moved entity (remember sparse stores denseIndex + 1)
      this.sparse[lastEntity] = idx + 1;
    }

    // pop back
    this.dense.pop();
    this.denseEntities.pop();

    // mark sparse for removed entity as "missing"
    this.sparse[entityId] = 0;

    return removed;
  }

  /**
   * Iterate all entries in packed order
   */
  public forEach(fn: (entityId: number, component: T) => void) {
    // local refs for speed
    const entities = this.denseEntities;
    const comps = this.dense;
    for (let i = 0; i < entities.length; i++) {
      fn(entities[i], comps[i]);
    }
  }
}
