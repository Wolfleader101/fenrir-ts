// builderExtensions.ts
// Import side-effect modules to extend EntityBuilder prototype
// These imports are essential for the module augmentations to take effect
import "./EntityBuilder/extensions/coreExtensions";
import "./EntityBuilder/extensions/renderExtensions";
import "./EntityBuilder/extensions/render2DExtensions";
import "./EntityBuilder/extensions/animationExtensions";
import "./EntityBuilder/extensions/physicsExtensions";

// Re-export all the extension modules to ensure their type declarations are included
export * from "./EntityBuilder/extensions/coreExtensions";
export * from "./EntityBuilder/extensions/renderExtensions";
export * from "./EntityBuilder/extensions/render2DExtensions";
export * from "./EntityBuilder/extensions/animationExtensions";
export * from "./EntityBuilder/extensions/physicsExtensions";
