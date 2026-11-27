/**
 * Fenrir-TS
 *
 * The root entry point, `fenrir-ts`, is the core: ECS, scheduler, engine,
 * scenes, events, time, logging, input, the entity builder and the asset cache.
 * It imports no renderer. Renderers, physics, audio and UI have their own
 * entry points: `fenrir-ts/2d`, `fenrir-ts/3d`, `fenrir-ts/physics`,
 * `fenrir-ts/audio` and `fenrir-ts/ui`.
 *
 * @packageDocumentation
 */
export * from "./core/index";
