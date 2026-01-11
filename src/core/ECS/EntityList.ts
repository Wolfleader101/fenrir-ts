import type { ComponentType } from "./Component";
import { applyDefaultComponents, Relationship } from "./DefaultComponents";
import { Pool } from "./Pool";
import { ComponentSignals } from "./Signals";
import { View, type ComponentTuple } from "./View";

export type Entity = number;

// 20 bits for id => up to ~1,048,576 entities
// 12 bits for generation => up to 4096 lifetimes per id
const ID_BITS = 20;
const GEN_BITS = 12;

const ID_MASK = (1 << ID_BITS) - 1; // 0xFFFFF
const GEN_MASK = (1 << GEN_BITS) - 1; // 0xFFF

// Use this as "no free entity" sentinel
const INVALID_ID = -1;

function packEntity(id: number, gen: number): Entity {
  // Keep within masks (important when gen wraps)
  return ((gen & GEN_MASK) << ID_BITS) | (id & ID_MASK);
}

function unpackId(e: Entity): number {
  return e & ID_MASK;
}

function unpackGen(e: Entity): number {
  return (e >>> ID_BITS) & GEN_MASK;
}

type AnyTypes = readonly ComponentType<any>[];

/**
 * EntityList manages entity lifetimes (create/destroy) and id recycling.
 * Component pools will be built on top of this.
 */
export class EntityList {
  // generation per entity id
  private generations: number[] = [];

  // free list pointer per id (meaningful only when id is dead)
  private nextFree: number[] = [];

  // head of free list (id) or INVALID_ID if none
  private freeHead: number = INVALID_ID;

  // component pools keyed by component token
  private pools = new Map<symbol, Pool<any>>();

  // cache of views keyed by component type array
  private viewCache = new WeakMap<AnyTypes, View<any>>();

  public readonly signals = new ComponentSignals(); // TODO might want to inject this and use interface

  public nullEntity(): Entity {
    return packEntity(ID_MASK, 0);
  }

  // ---------- Entities ----------

  /**
   * Create a new entity (reuses a destroyed id if available).
   */
  public createEntity(): Entity {
    let id: number;

    if (this.freeHead !== INVALID_ID) {
      // pop from free list
      id = this.freeHead;
      this.freeHead = this.nextFree[id]!;

      // mark as "alive": by convention, nextFree[id] points to itself when alive
      this.nextFree[id] = id;
    } else {
      // allocate a new id
      id = this.generations.length;
      this.generations.push(0);
      this.nextFree.push(id); // alive marker
    }

    const e = packEntity(id, this.generations[id]!);

    // defaults
    applyDefaultComponents(this, e);

    return e;
  }

  /**
   * Destroy an entity. Returns false if the handle was already dead/invalid.
   * Note: component removal will be added in Step 3 when pools exist.
   */
  public destroyEntity(entity: Entity) {
    if (!this.isAlive(entity)) return false;

    // 1) destroy children first
    this.destroyChildrenRecursive(entity);

    // 2) detach from parent/siblings
    this.detachFromParent(entity);

    const id = this.idOf(entity);

    // Remove from all component pools (emit per-type remove signals)
    for (const [typeSym, pool] of this.pools.entries()) {
      const removed = pool.remove(id);
      if (removed !== undefined) {
        // typeSym is a symbol, but we want to keep it as the component token.
        this.signals.emitRemove(typeSym, entity, removed);
      }
    }

    // bump generation (wraps naturally under GEN_MASK)
    this.generations[id] = (this.generations[id]! + 1) & GEN_MASK;

    // push id onto free list
    this.nextFree[id] = this.freeHead;
    this.freeHead = id;

    return true;
  }

  /**
   * Checks if an entity handle is currently alive and matches generation.
   */
  public isAlive(entity: Entity) {
    const id = unpackId(entity);
    const gen = unpackGen(entity);

    if (id < 0 || id >= this.generations.length) return false;

    // alive marker: nextFree[id] === id
    if (this.nextFree[id] !== id) return false;

    return this.generations[id] === gen;
  }

  /** Extract the numeric entity id (index) from a handle */
  public idOf(entity: Entity): number {
    return unpackId(entity);
  }

  /** Extract the generation/version from a handle */
  public genOf(entity: Entity): number {
    return unpackGen(entity);
  }

  /** Total allocated ids (includes dead). Useful for debugging. */
  public capacity(): number {
    return this.generations.length;
  }
  // ---------- Components ----------

  private getPool<T>(type: ComponentType<T>): Pool<T> {
    let pool = this.pools.get(type) as Pool<T> | undefined;
    if (!pool) {
      pool = new Pool<T>();
      this.pools.set(type, pool);
    }
    return pool;
  }

  private assertAlive(entity: Entity): number {
    if (!this.isAlive(entity)) {
      throw new Error("Entity is not alive (stale handle or destroyed).");
    }
    return unpackId(entity);
  }

  /**
   * Add or replace a component on an entity.
   * Returns true if inserted, false if replaced.
   */
  public set<T>(entity: Entity, type: ComponentType<T>, component: T): boolean {
    const id = this.assertAlive(entity);
    const pool = this.getPool(type);

    const existed = pool.has(id);
    const inserted = pool.set(id, component);

    if (!existed && inserted) {
      this.signals.emitAdd(type, entity, component);
    } else {
      // replaced
      this.signals.emitReplace(type, entity, component);
    }

    return inserted;
  }

  /**
   * Alias fror set<T>
   */
  public add<T>(entity: Entity, type: ComponentType<T>, component: T): boolean {
    return this.set(entity, type, component);
  }

  public has<T>(entity: Entity, type: ComponentType<T>): boolean {
    const id = this.assertAlive(entity);
    return this.getPool(type).has(id);
  }

  public get<T>(entity: Entity, type: ComponentType<T>): T {
    const id = this.assertAlive(entity);
    return this.getPool(type).get(id);
  }

  public tryGet<T>(entity: Entity, type: ComponentType<T>): T | undefined {
    const id = this.assertAlive(entity);
    return this.getPool(type).tryGet(id);
  }

  public remove<T>(entity: Entity, type: ComponentType<T>): boolean {
    const id = this.assertAlive(entity);
    const removed = this.getPool(type).remove(id);
    if (removed !== undefined) this.signals.emitRemove(type, entity, removed);
    return removed !== undefined;
  }

  /**
   * Expose a pool for view iteration
   */
  public pool<T>(type: ComponentType<T>): Pool<T> {
    return this.getPool(type);
  }

  private pack(id: number, gen: number): Entity {
    return ((gen & GEN_MASK) << ID_BITS) | (id & ID_MASK);
  }

  public entityFromId(entityId: number): Entity {
    // entityId must refer to a currently alive entity in the smallest pool.
    // Pools only store alive entity ids (because destroy removes from all pools).
    // So this is safe.
    return this.pack(entityId, this.generations[entityId]!);
  }

  // ---------- Views ----------

  /**
   * Create or get a cached view for the given component types.
   * 
   * Important: this cache works best if systems store the tuple
   * 
   * If you inline `[Position, Velocity] as const` each frame, you’ll create a new array, so caching won’t help.
   * @example
    const MOVEMENT_QUERY = [Position, Velocity] as const;
    entityList.each(MOVEMENT_QUERY, ...);
   */
  public view<TTypes extends AnyTypes>(types: TTypes) {
    const existing = this.viewCache.get(types);
    if (existing) return existing as View<TTypes>;

    const v = new View(this, types);
    this.viewCache.set(types, v);
    return v;
  }

  public each<TTypes extends readonly ComponentType<any>[]>(
    types: TTypes,
    fn: (entity: Entity, ...components: ComponentTuple<TTypes>) => void
  ): void {
    this.view(types).each(fn);
  }

  // ---------- Relationship ----------

  public forEachChild(parent: Entity, fn: (child: Entity) => void) {
    if (!this.isAlive(parent)) return;
    if (!this.has(parent, Relationship)) return;

    const rel = this.get(parent, Relationship);
    let child = rel.firstChild;

    while (this.isAlive(child)) {
      fn(child);
      const childRel = this.get(child, Relationship);
      child = childRel.nextSibling;
    }
  }

  public addChild(parent: Entity, child: Entity) {
    if (!this.isAlive(parent) || !this.isAlive(child)) return;

    const nullE = this.nullEntity();

    // Ensure Relationship exists
    if (!this.has(parent, Relationship)) {
      this.set(parent, Relationship, {
        parent: nullE,
        firstChild: nullE,
        nextSibling: nullE,
        prevSibling: nullE,
      });
    }
    if (!this.has(child, Relationship)) {
      this.set(child, Relationship, {
        parent: nullE,
        firstChild: nullE,
        nextSibling: nullE,
        prevSibling: nullE,
      });
    }

    const parentRel = this.get(parent, Relationship);
    const childRel = this.get(child, Relationship);

    // Detach child from existing parent first (optional but recommended)
    if (this.isAlive(childRel.parent)) {
      this.removeChild(childRel.parent, child);
    }

    // Insert
    if (!this.isAlive(parentRel.firstChild)) {
      parentRel.firstChild = child;
      childRel.parent = parent;
      childRel.prevSibling = nullE;
      childRel.nextSibling = nullE;
      return;
    }

    // Walk to last child
    let last = parentRel.firstChild;
    while (true) {
      const lastRel = this.get(last, Relationship);
      if (!this.isAlive(lastRel.nextSibling)) break;
      last = lastRel.nextSibling;
    }

    const lastRel = this.get(last, Relationship);
    lastRel.nextSibling = child;

    childRel.prevSibling = last;
    childRel.nextSibling = nullE;
    childRel.parent = parent;
  }

  public removeChild(parent: Entity, child: Entity) {
    if (!this.isAlive(parent) || !this.isAlive(child)) return;
    if (!this.has(parent, Relationship) || !this.has(child, Relationship))
      return;

    const nullE = this.nullEntity();
    const parentRel = this.get(parent, Relationship);
    const childRel = this.get(child, Relationship);

    // Ensure child is actually parented to this parent
    if (childRel.parent !== parent) return;

    const prev = childRel.prevSibling;
    const next = childRel.nextSibling;

    // If first child
    if (parentRel.firstChild === child) {
      parentRel.firstChild = next;
    }

    // Link prev -> next
    if (this.isAlive(prev)) {
      this.get(prev, Relationship).nextSibling = next;
    }

    // Link next -> prev
    if (this.isAlive(next)) {
      this.get(next, Relationship).prevSibling = prev;
    }

    // Clear child's links
    childRel.parent = nullE;
    childRel.prevSibling = nullE;
    childRel.nextSibling = nullE;
  }

  private detachFromParent(e: Entity) {
    if (!this.has(e, Relationship)) return;
    const rel = this.get(e, Relationship);

    const parent = rel.parent;
    if (!this.isAlive(parent)) return;

    // removeChild does all unlinking and clears child's links
    this.removeChild(parent, e);
  }

  private destroyChildrenRecursive(e: Entity) {
    if (!this.has(e, Relationship)) return;

    // snapshot nextSibling before destroying current child
    let child = this.get(e, Relationship).firstChild;

    while (this.isAlive(child)) {
      const next = this.get(child, Relationship).nextSibling;
      this.destroyEntity(child); // calls recursive
      child = next;
    }
  }
}
