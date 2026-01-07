// Core Physics exports
export * from "./components";
export * from "./utils";

// Export the new unified PhysicsSystem
export { createPhysicsSystem, PhysicsHelpers } from "./PhysicsSystem";

// Export CommonMaterials for extensions
export { CommonMaterials } from "./components/PhysicsMaterial";

// Re-export key types for convenience
export type { SimplePhysicsWorld } from "./PhysicsSystem";
export type { JoltModule } from "./utils/JoltWrapper";
