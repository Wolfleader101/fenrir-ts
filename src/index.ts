/**
 * Fenrir-TS
 *
 * The root entry point, `fenrir-ts`, is the core: ECS, scheduler, engine,
 * scenes, events, time, logging, input, the entity builder and the asset cache.
 * It imports no renderer. Renderers, physics and the editor have their own
 * entry points: `fenrir-ts/2d`, `fenrir-ts/3d`, `fenrir-ts/physics` and
 * `fenrir-ts/editor`.
 *
 * @packageDocumentation
 */
export * from "./core/index";
