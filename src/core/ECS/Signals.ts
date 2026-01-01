import type { ComponentType } from "./Component";
import type { Entity } from "./EntityList";

type AddCb<T> = (entity: Entity, component: T) => void;
type RemoveCb = (entity: Entity) => void;
type ReplaceCb<T> = (entity: Entity, component: T) => void; // new value

export class ComponentSignals {
  private onAddMap = new Map<symbol, Set<Function>>();
  private onRemoveMap = new Map<symbol, Set<Function>>();
  private onReplaceMap = new Map<symbol, Set<Function>>();

  // optional “any component” listeners
  private onAnyAdd = new Set<(type: symbol, entity: Entity) => void>();
  private onAnyRemove = new Set<(type: symbol, entity: Entity) => void>();
  private onAnyReplace = new Set<(type: symbol, entity: Entity) => void>();

  onAdd<T>(type: ComponentType<T>, cb: AddCb<T>): () => void {
    return this.addListener(this.onAddMap, type, cb);
  }
  onRemove(type: ComponentType<any>, cb: RemoveCb): () => void {
    return this.addListener(this.onRemoveMap, type, cb);
  }
  onReplace<T>(type: ComponentType<T>, cb: ReplaceCb<T>): () => void {
    return this.addListener(this.onReplaceMap, type, cb);
  }

  onAnyComponentAdded(cb: (type: symbol, entity: Entity) => void): () => void {
    this.onAnyAdd.add(cb);
    return () => this.onAnyAdd.delete(cb);
  }
  onAnyComponentRemoved(
    cb: (type: symbol, entity: Entity) => void
  ): () => void {
    this.onAnyRemove.add(cb);
    return () => this.onAnyRemove.delete(cb);
  }
  onAnyComponentReplaced(
    cb: (type: symbol, entity: Entity) => void
  ): () => void {
    this.onAnyReplace.add(cb);
    return () => this.onAnyReplace.delete(cb);
  }

  emitAdd<T>(type: ComponentType<T>, entity: Entity, component: T) {
    const set = this.onAddMap.get(type);
    if (set) for (const cb of set) (cb as AddCb<T>)(entity, component);
    for (const cb of this.onAnyAdd) cb(type, entity);
  }

  emitRemove(type: ComponentType<any>, entity: Entity) {
    const set = this.onRemoveMap.get(type);
    if (set) for (const cb of set) (cb as RemoveCb)(entity);
    for (const cb of this.onAnyRemove) cb(type, entity);
  }

  emitReplace<T>(type: ComponentType<T>, entity: Entity, component: T) {
    const set = this.onReplaceMap.get(type);
    if (set) for (const cb of set) (cb as ReplaceCb<T>)(entity, component);
    for (const cb of this.onAnyReplace) cb(type, entity);
  }

  private addListener(
    map: Map<symbol, Set<Function>>,
    type: symbol,
    cb: Function
  ): () => void {
    let set = map.get(type);
    if (!set) {
      set = new Set();
      map.set(type, set);
    }
    set.add(cb);
    return () => set!.delete(cb);
  }
}
