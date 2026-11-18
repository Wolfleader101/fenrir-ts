// The default skybox faces, embedded in the build as data URLs (about 144 kB).
// SkyboxUtils.setupDefaultSkybox imports this module on demand, so the images
// are a separate chunk that only a program using the default skybox loads.
export { default as right } from "./assets/right.png";
export { default as left } from "./assets/left.png";
export { default as top } from "./assets/top.png";
export { default as bottom } from "./assets/bottom.png";
export { default as front } from "./assets/front.png";
export { default as back } from "./assets/back.png";
