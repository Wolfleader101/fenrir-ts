// The API the Monaco live-scripting sandbox can see, bundled into fenrir.d.ts by
// `pnpm types:bundle`. The editor demo runs a 3D scene with physics, so the
// sandbox's EntityBuilder, AssetStore and SystemCtx carry the core, 3D and
// physics additions. CI fails if fenrir.d.ts is not regenerated after a change.
export * from "../../index";
export * from "../../3d";
export * from "../../physics";
// Both core and 3D export Transform; the sandbox works with Three objects.
export { Transform } from "../../3d";
