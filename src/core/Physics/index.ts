// Core Physics exports
export * from "./components";
export * from "./utils";

// Export the new unified PhysicsSystem
export { createPhysicsSystem, PhysicsBodyPresets } from "./PhysicsSystem";

// Export PhysicsHelpers class
export { PhysicsHelpers } from "./PhysicsHelpers";

// Export CommonMaterials for extensions
export { CommonMaterials } from "./components/PhysicsMaterial";

// Re-export key types for convenience
export type { SimplePhysicsWorld } from "./PhysicsSystem";
export type { JoltModule, JoltDebugModule } from "./utils/JoltWrapper";
