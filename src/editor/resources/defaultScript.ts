// Welcome to the Fenrir-TS Monaco Editor Live Coding Demo!
// Available: Vector3, Quaternion, Color, EntityBuilder, SkyboxUtils, entities, scene, time, logger, assets

/**
 * postInit - ASYNC - Runs after initialization
 * This is typically where you create entities and set up the scene
 */
const postInit: AsyncSystemFn = async (ctx) => {
  logger.info("🎾 Initializing bouncing ball demo...");

  // Set up skybox
  await SkyboxUtils.setupDefaultSkybox(scene, assets);

  // Create ground plane
  EntityBuilder.create()
    .name("Ground")
    .transform(new Vector3(0, -2, 0))
    .staticBox(new Vector3(15, 0.5, 15))
    .renderBox([30, 1, 30], {
      material: {
        kind: "standard",
        color: 0x2c3e50,
        roughness: 0.8,
        metalness: 0.2,
      },
      flags: { castShadow: false, receiveShadow: true },
    })
    .spawn(entities);

  // Create colorful bouncing balls in a circle
  const colors = [
    0xff6b6b, // red
    0x4ecdc4, // cyan
    0x45b7d1, // blue
    0xf9ca24, // yellow
    0x6c5ce7, // purple
    0xe17055, // orange
    0x00b894, // green
    0xfd79a8, // pink
  ];

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = 3;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 5 + i * 1.5; // Stagger heights

    EntityBuilder.create()
      .name(`Ball \${i + 1}`)
      .transform(new Vector3(x, y, z))
      .dynamicSphere(0.5, 1.0) // radius 0.5, mass 1.0
      .physicsMaterial("rubber") // Bouncy material!
      .renderSphere(0.5, 32, 16, {
        material: {
          kind: "standard",
          color: colors[i],
          roughness: 0.6,
          metalness: 0.1,
        },
      })
      .spawn(entities);
  }

  // Add a larger center ball
  EntityBuilder.create()
    .name("Big Ball")
    .transform(new Vector3(0, 15, 0))
    .dynamicSphere(1.0, 3.0) // radius 1.0, mass 3.0
    .physicsMaterial("rubber")
    .renderSphere(1.0, 32, 16, {
      material: {
        kind: "standard",
        color: 0x3498db,
        roughness: 0.5,
        metalness: 0.2,
      },
    })
    .spawn(entities);

  logger.info("✅ Bouncing ball scene initialized!");
  logger.info("💡 Try editing the physics or colors and press Ctrl+S!");
};

/**
 * update - SYNC - Variable timestep updates (runs every frame)
 * This can be hot-reloaded without resetting game state!
 * Try changing values and pressing Ctrl+S!
 */
const update: SyncSystemFn = (ctx) => {
  const delta = time.delta;

  // Your game logic here
  // Example: Add wind force, spawn new balls, etc.
  // console.log("Frame delta:", delta);
};

// You can also define other schedules:
// const preInit = async (ctx) => { ... };  // Runs before initialization
// const init = async (ctx) => { ... };     // Main initialization phase
// const preUpdate = (ctx) => { ... };      // Runs before main update
// const tick = (ctx) => { ... };           // Fixed timestep updates
// const postUpdate = (ctx) => { ... };     // Runs after update (rendering)
// const exit = async (ctx) => { ... };     // Cleanup on engine stop
