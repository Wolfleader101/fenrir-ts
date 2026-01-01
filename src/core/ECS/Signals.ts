import type { ComponentType } from "./Component";
import type { Entity } from "./EntityList";

type AddCb<T> = (entity: Entity, component: T) => void;
type RemoveCb = (entity: Entity) => void;
type ReplaceCb<T> = (entity: Entity, component: T) => void; // new value

export class ComponentSignals {
  private onAddMap = new Map<symbol, Function[]>();
  private onRemoveMap = new Map<symbol, Function[]>();
  private onReplaceMap = new Map<symbol, Function[]>();

  // optional "any component" listeners
  private onAnyAdd: Array<(type: symbol, entity: Entity) => void> = [];
  private onAnyRemove: Array<(type: symbol, entity: Entity) => void> = [];
  private onAnyReplace: Array<(type: symbol, entity: Entity) => void> = [];

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
    this.onAnyAdd.push(cb);
    return () => {
      const index = this.onAnyAdd.indexOf(cb);
      if (index >= 0) this.onAnyAdd.splice(index, 1);
    };
  }
  onAnyComponentRemoved(
    cb: (type: symbol, entity: Entity) => void
  ): () => void {
    this.onAnyRemove.push(cb);
    return () => {
      const index = this.onAnyRemove.indexOf(cb);
      if (index >= 0) this.onAnyRemove.splice(index, 1);
    };
  }
  onAnyComponentReplaced(
    cb: (type: symbol, entity: Entity) => void
  ): () => void {
    this.onAnyReplace.push(cb);
    return () => {
      const index = this.onAnyReplace.indexOf(cb);
      if (index >= 0) this.onAnyReplace.splice(index, 1);
    };
  }

  emitAdd<T>(type: ComponentType<T>, entity: Entity, component: T) {
    const callbacks = this.onAddMap.get(type);
    if (callbacks)
      for (const cb of callbacks) (cb as AddCb<T>)(entity, component);
    for (const cb of this.onAnyAdd) cb(type, entity);
  }

  emitRemove(type: ComponentType<any>, entity: Entity) {
    const callbacks = this.onRemoveMap.get(type);
    if (callbacks) for (const cb of callbacks) (cb as RemoveCb)(entity);
    for (const cb of this.onAnyRemove) cb(type, entity);
  }

  emitReplace<T>(type: ComponentType<T>, entity: Entity, component: T) {
    const callbacks = this.onReplaceMap.get(type);
    if (callbacks)
      for (const cb of callbacks) (cb as ReplaceCb<T>)(entity, component);
    for (const cb of this.onAnyReplace) cb(type, entity);
  }

  private addListener(
    map: Map<symbol, Function[]>,
    type: symbol,
    cb: Function
  ): () => void {
    let callbacks = map.get(type);
    if (!callbacks) {
      callbacks = [];
      map.set(type, callbacks);
    }
    callbacks.push(cb);
    return () => {
      const callbacksList = map.get(type);
      if (callbacksList) {
        const index = callbacksList.indexOf(cb);
        if (index >= 0) callbacksList.splice(index, 1);
      }
    };
  }
}
