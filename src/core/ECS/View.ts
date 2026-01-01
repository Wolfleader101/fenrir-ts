// View.ts
import type { Pool } from "./Pool";
import type { Entity } from "./EntityList";
import type { EntityList } from "./EntityList";
import type { ComponentType } from "./Component";

export type ComponentDataOf<C> = C extends ComponentType<infer T> ? T : never;
export type ComponentTuple<TTypes extends readonly ComponentType<any>[]> = {
  [K in keyof TTypes]: ComponentDataOf<TTypes[K]>;
};

export class View<TTypes extends readonly ComponentType<any>[]> {
  private readonly entityList: EntityList;
  public readonly types: TTypes;

  private readonly pools: Pool<any>[];
  private readonly drive: Pool<any>;

  constructor(entityList: EntityList, types: TTypes) {
    this.entityList = entityList;
    this.types = types;

    // Resolve pools once (important!)
    this.pools = types.map((t) => entityList.pool(t)) as Pool<any>[];

    // Choose smallest pool once
    let smallest = this.pools[0];
    for (let i = 1; i < this.pools.length; i++) {
      if (this.pools[i].size() < smallest.size()) smallest = this.pools[i];
    }
    this.drive = smallest;
  }

  public each(
    fn: (entity: Entity, ...components: ComponentTuple<TTypes>) => void
  ): void {
    const pools = this.pools;
    const drive = this.drive;

    switch (pools.length) {
      case 0:
        return;
      case 1:
        return this.each1(drive, pools[0], fn as any);
      case 2:
        return this.each2(drive, pools[0], pools[1], fn as any);
      case 3:
        return this.each3(drive, pools[0], pools[1], pools[2], fn as any);
      case 4:
        return this.each4(
          drive,
          pools[0],
          pools[1],
          pools[2],
          pools[3],
          fn as any
        );
      default:
        return this.eachN(drive, pools, fn as any);
    }
  }

  // ---- hot paths ----

  private each1<A>(
    drive: Pool<any>,
    a: Pool<A>,
    fn: (e: Entity, a: A) => void
  ) {
    let i = 0;
    let end = drive.size();

    while (i < end) {
      const id = drive.entityAt(i);

      const ai = a === drive ? i : a.indexOf(id);
      if (ai !== -1) {
        fn(this.entityList.entityFromId(id), a.getAt(ai));
      }

      // shrink-only (don’t include newly-added entities)
      const newEnd = drive.size();
      if (newEnd < end) end = newEnd;

      // if swap+pop replaced index i, process the swapped entity next (don’t increment)
      if (i < end && drive.entityAt(i) === id) i++;
    }
  }

  private each2<A, B>(
    drive: Pool<any>,
    a: Pool<A>,
    b: Pool<B>,
    fn: (e: Entity, a: A, b: B) => void
  ) {
    let i = 0;
    let end = drive.size();

    while (i < end) {
      const id = drive.entityAt(i);

      const ai = a === drive ? i : a.indexOf(id);
      if (ai !== -1) {
        const bi = b === drive ? i : b.indexOf(id);
        if (bi !== -1) {
          fn(this.entityList.entityFromId(id), a.getAt(ai), b.getAt(bi));
        }
      }

      const newEnd = drive.size();
      if (newEnd < end) end = newEnd;

      if (i < end && drive.entityAt(i) === id) i++;
    }
  }

  private each3<A, B, C>(
    drive: Pool<any>,
    a: Pool<A>,
    b: Pool<B>,
    c: Pool<C>,
    fn: (e: Entity, a: A, b: B, c: C) => void
  ) {
    let i = 0;
    let end = drive.size();

    while (i < end) {
      const id = drive.entityAt(i);

      const ai = a === drive ? i : a.indexOf(id);
      if (ai !== -1) {
        const bi = b === drive ? i : b.indexOf(id);
        if (bi !== -1) {
          const ci = c === drive ? i : c.indexOf(id);
          if (ci !== -1) {
            fn(
              this.entityList.entityFromId(id),
              a.getAt(ai),
              b.getAt(bi),
              c.getAt(ci)
            );
          }
        }
      }

      // shrink-only end (don't include newly-added entities)
      const newEnd = drive.size();
      if (newEnd < end) end = newEnd;

      // If swap+pop replaced index i, don't increment (process swapped entity next)
      if (i < end && drive.entityAt(i) === id) i++;
    }
  }

  private each4<A, B, C, D>(
    drive: Pool<any>,
    a: Pool<A>,
    b: Pool<B>,
    c: Pool<C>,
    d: Pool<D>,
    fn: (e: Entity, a: A, b: B, c: C, d: D) => void
  ) {
    let i = 0;
    let end = drive.size();

    while (i < end) {
      const id = drive.entityAt(i);

      const ai = a === drive ? i : a.indexOf(id);
      if (ai !== -1) {
        const bi = b === drive ? i : b.indexOf(id);
        if (bi !== -1) {
          const ci = c === drive ? i : c.indexOf(id);
          if (ci !== -1) {
            const di = d === drive ? i : d.indexOf(id);
            if (di !== -1) {
              fn(
                this.entityList.entityFromId(id),
                a.getAt(ai),
                b.getAt(bi),
                c.getAt(ci),
                d.getAt(di)
              );
            }
          }
        }
      }

      // shrink-only end (don't include newly-added entities)
      const newEnd = drive.size();
      if (newEnd < end) end = newEnd;

      // If swap+pop replaced index i, don't increment (process swapped entity next)
      if (i < end && drive.entityAt(i) === id) i++;
    }
  }

  private eachN(
    drive: Pool<any>,
    pools: Pool<any>[],
    fn: (e: Entity, ...components: any[]) => void
  ) {
    let i = 0;
    let end = drive.size();

    // Allocate once per call (not per entity)
    const indices = new Array<number>(pools.length);
    const comps = new Array<any>(pools.length);

    while (i < end) {
      const id = drive.entityAt(i);

      let ok = true;

      // Resolve dense indices for each pool
      for (let p = 0; p < pools.length; p++) {
        const pool = pools[p];
        const idx = pool === drive ? i : pool.indexOf(id);
        if (idx === -1) {
          ok = false;
          break;
        }
        indices[p] = idx;
      }

      if (ok) {
        for (let p = 0; p < pools.length; p++) {
          comps[p] = pools[p].getAt(indices[p]);
        }
        fn(this.entityList.entityFromId(id), ...comps);
      }

      // shrink-only end (don't include newly-added entities)
      const newEnd = drive.size();
      if (newEnd < end) end = newEnd;

      // If swap+pop replaced index i, don't increment (process swapped entity next)
      if (i < end && drive.entityAt(i) === id) i++;
    }
  }
}
