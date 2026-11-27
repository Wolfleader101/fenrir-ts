# `fenrir-ts/physics` API reference

Generated from the TSDoc in the source by `scripts/api-reference.mjs`. Do not edit: run `pnpm api:reference`.

Frozen: kept working, no new features. Jolt physics for the 3D path.

Peer packages: `jolt-physics`, `three`. Import from `fenrir-ts/physics` only, never from `dist/` or a source path.

## Contents

- Functions: [`createPhysicsBody`](#createphysicsbody), [`createPhysicsMaterial`](#createphysicsmaterial), [`createPhysicsSystem`](#createphysicssystem), [`dynamicBox`](#dynamicbox), [`dynamicSphere`](#dynamicsphere), [`isDebugJolt`](#isdebugjolt), [`kinematicBox`](#kinematicbox), [`staticBox`](#staticbox), [`staticSphere`](#staticsphere)
- Classes: [`CollisionUtils`](#collisionutils), [`JoltUtils`](#joltutils), [`PhysicsHelpers`](#physicshelpers), [`PhysicsLayerManager`](#physicslayermanager)
- Constants: [`CollisionMasks`](#collisionmasks), [`CombineMode`](#combinemode), [`CommonLayers`](#commonlayers), [`CommonMaterials`](#commonmaterials), [`DefaultLayers`](#defaultlayers), [`MotionType`](#motiontype), [`PhysicsBody`](#physicsbody), [`PhysicsBodyPresets`](#physicsbodypresets), [`PhysicsMaterial`](#physicsmaterial), [`PhysicsShape`](#physicsshape), [`ShapeBuilder`](#shapebuilder), [`ShapeType`](#shapetype), [`SyncMode`](#syncmode)
- Types: [`BoxShapeParams`](#boxshapeparams), [`CapsuleShapeParams`](#capsuleshapeparams), [`CollisionLayer`](#collisionlayer), [`CollisionMask`](#collisionmask), [`CompoundShapeParams`](#compoundshapeparams), [`ConvexHullShapeParams`](#convexhullshapeparams), [`CylinderShapeParams`](#cylindershapeparams), [`HeightFieldShapeParams`](#heightfieldshapeparams), [`JoltAllowedDOFs`](#joltalloweddofs), [`JoltBody`](#joltbody), [`JoltBodyCreationSettings`](#joltbodycreationsettings), [`JoltBodyID`](#joltbodyid), [`JoltBodyInterface`](#joltbodyinterface), [`JoltBoxShape`](#joltboxshape), [`JoltCapsuleShape`](#joltcapsuleshape), [`JoltColor`](#joltcolor), [`JoltCylinderShape`](#joltcylindershape), [`JoltDebugModule`](#joltdebugmodule), [`JoltDebugRendererJS`](#joltdebugrendererjs), [`JoltEActivation`](#jolteactivation), [`JoltEMotionType`](#joltemotiontype), [`JoltInterface`](#joltinterface), [`JoltModule`](#joltmodule), [`JoltPhysicsSystem`](#joltphysicssystem), [`JoltQuat`](#joltquat), [`JoltRMat44`](#joltrmat44), [`JoltRVec3`](#joltrvec3), [`JoltSettings`](#joltsettings), [`JoltShape`](#joltshape), [`JoltSphereShape`](#joltsphereshape), [`JoltVec3`](#joltvec3), [`MeshShapeParams`](#meshshapeparams), [`ShapeParams`](#shapeparams), [`SimplePhysicsWorld`](#simplephysicsworld), [`SphereShapeParams`](#sphereshapeparams)
- [Added to core types when imported](#added-to-core-types-when-imported)

## Functions

### createPhysicsBody

```ts
function createPhysicsBody(config: {
    bodyId?: JoltBodyID;
    motionType: MotionType;
    collisionLayer?: CollisionLayer;
    collisionMask?: CollisionMask;
    syncMode?: SyncMode;
    mass?: number;
    gravityFactor?: number;
    allowSleeping?: boolean;
    isSensor?: boolean;
    lockRotation?: [
        boolean,
        boolean,
        boolean
    ];
}): PhysicsBody;
```

Helper function to create a physics body configuration

### createPhysicsMaterial

```ts
function createPhysicsMaterial(config: {
    restitution?: number;
    friction?: number;
    density?: number;
    restitutionCombineMode?: CombineMode;
    frictionCombineMode?: CombineMode;
    linearDamping?: number;
    angularDamping?: number;
    userData?: unknown;
}): PhysicsMaterial;
```

Helper function to create a physics material with sensible defaults

### createPhysicsSystem

```ts
function createPhysicsSystem(): { readonly init: AsyncSystemFn; readonly tick: SyncSystemFn; readonly exit: AsyncSystemFn; readonly getPhysics: () => PhysicsHelpers | null; };
```

Factory function that creates a physics system using the class + factory pattern
Provides clean system interface while encapsulating complex state in a private class

### dynamicBox

```ts
function dynamicBox<B extends EntityBuilder>(builder: B, halfExtents: Vector3, mass?: number): B;
```

Adds a dynamic `PhysicsBody` of `mass`, a box `PhysicsShape` of `halfExtents` and the `default`
material to `builder`, and returns it:

```ts
dynamicBox(EntityBuilder.create().transform(new Vector3(0, 5, 0)), new Vector3(0.5, 0.5, 0.5), 2).spawn(entities);
```

Add `with(PhysicsMaterial, CommonMaterials.wood())` after it to change the material.

### dynamicSphere

```ts
function dynamicSphere<B extends EntityBuilder>(builder: B, radius: number, mass?: number): B;
```

Adds a dynamic `PhysicsBody` of `mass`, a sphere `PhysicsShape` of `radius` and the `rubber` material to `builder`, and returns it.

### isDebugJolt

```ts
function isDebugJolt(jolt: JoltModule): jolt is JoltDebugModule;
```

Type guard to check if Jolt module has debug renderer

### kinematicBox

```ts
function kinematicBox<B extends EntityBuilder>(builder: B, halfExtents: Vector3): B;
```

Adds a kinematic `PhysicsBody`, a box `PhysicsShape` of `halfExtents` and the `default` material to `builder`, and returns it.

### staticBox

```ts
function staticBox<B extends EntityBuilder>(builder: B, halfExtents: Vector3): B;
```

Adds a static `PhysicsBody`, a box `PhysicsShape` of `halfExtents` and the `stone` material to `builder`, and returns it.

### staticSphere

```ts
function staticSphere<B extends EntityBuilder>(builder: B, radius: number): B;
```

Adds a static `PhysicsBody`, a sphere `PhysicsShape` of `radius` and the `stone` material to `builder`, and returns it.

## Classes

### CollisionUtils

```ts
class CollisionUtils {
    static hasLayer(mask: CollisionMask, layer: CollisionLayer): boolean;
    static addLayer(mask: CollisionMask, layer: CollisionLayer): CollisionMask;
    static removeLayer(mask: CollisionMask, layer: CollisionLayer): CollisionMask;
    static canCollide(layer1: CollisionLayer, mask1: CollisionMask, layer2: CollisionLayer, mask2: CollisionMask): boolean;
    static createMask(...layers: CollisionLayer[]): CollisionMask;
    static getLayersFromMask(mask: CollisionMask): CollisionLayer[];
    static maskToNames(mask: CollisionMask): string[];
    static allLayersMask(): CollisionMask;
    static emptyMask(): CollisionMask;
}
```

Bitwise collision utilities for fast layer operations

Members:

- `hasLayer`: Check if a layer is present in a collision mask
- `addLayer`: Add a layer to a collision mask
- `removeLayer`: Remove a layer from a collision mask
- `canCollide`: Check if two objects can collide based on layer and mask
- `createMask`: Create a collision mask from multiple layers
- `getLayersFromMask`: Get all layers present in a collision mask
- `maskToNames`: Convert a collision mask to human-readable layer names
- `allLayersMask`: Create a collision mask that collides with all layers
- `emptyMask`: Create an empty collision mask (collides with nothing)

### JoltUtils

```ts
class JoltUtils {
    static vec3ToJolt(jolt: JoltModule, vec: Vector3): JoltVec3;
    static vec3ToJoltR(jolt: JoltModule, vec: Vector3): JoltRVec3;
    static quatToJolt(jolt: JoltModule, quat: Quaternion): JoltQuat;
    static joltVec3ToThree(joltVec: JoltVec3, out: Vector3): Vector3;
    static joltRVec3ToThree(joltVec: JoltRVec3, out: Vector3): Vector3;
    static joltQuatToThree(joltQuat: JoltQuat, out: Quaternion): Quaternion;
}
```

Wrapper utilities for converting between Three.js and Jolt types

### PhysicsHelpers

```ts
class PhysicsHelpers {
    constructor(jolt: JoltModule, bodyInterface: JoltBodyInterface);
    applyImpulse(physicsBody: PhysicsBody, impulse: Vector3): void;
    addForce(physicsBody: PhysicsBody, force: Vector3): void;
    addTorque(physicsBody: PhysicsBody, torque: Vector3): void;
    applyAngularImpulse(physicsBody: PhysicsBody, impulse: Vector3): void;
    getVelocity(physicsBody: PhysicsBody, out: Vector3): Vector3;
    setVelocity(physicsBody: PhysicsBody, velocity: Vector3): void;
    getAngularVelocity(physicsBody: PhysicsBody, out: Vector3): Vector3;
    setAngularVelocity(physicsBody: PhysicsBody, velocity: Vector3): void;
    isActive(physicsBody: PhysicsBody): boolean;
    activate(physicsBody: PhysicsBody): void;
    getMass(physicsBody: PhysicsBody): number;
    setFriction(physicsBody: PhysicsBody, friction: number): void;
    setRestitution(physicsBody: PhysicsBody, restitution: number): void;
}
```

Physics helper class for manipulating physics bodies

This class is instantiated by PhysicsSystem and provided via SystemCtx

Members:

- `applyImpulse`: Apply an impulse to a physics body (instantaneous velocity change) Automatically wakes up sleeping bodies
- `addForce`: Add force to a physics body (continuous acceleration) Automatically wakes up sleeping bodies
- `addTorque`: Add torque to a physics body (rotational force) Automatically wakes up sleeping bodies
- `applyAngularImpulse`: Apply an angular impulse to a physics body Automatically wakes up sleeping bodies
- `getVelocity`: Get the current linear velocity of a physics body
- `setVelocity`: Set the linear velocity of a physics body Automatically wakes up sleeping bodies
- `getAngularVelocity`: Get the current angular velocity of a physics body
- `setAngularVelocity`: Set the angular velocity of a physics body Automatically wakes up sleeping bodies
- `isActive`: Check if the physics body is active (not sleeping)
- `activate`: Activate (wake up) a physics body Useful to force a body awake before applying physics operations
- `getMass`: Get the mass of a physics body
- `setFriction`: Set friction for a physics body
- `setRestitution`: Set restitution (bounciness) for a physics body

### PhysicsLayerManager

```ts
class PhysicsLayerManager {
    static setLayerName(layerIndex: number, name: string): void;
    static setLayerDescription(layerIndex: number, description: string): void;
    static getLayerName(layerIndex: number): string;
    static getLayerDescription(layerIndex: number): string;
    static getAllLayers(): Array<{
        index: number;
        name: string;
        description: string;
        bit: number;
    }>;
    static getLayerIndex(layer: CollisionLayer): number;
    static setupCommonLayers(): void;
}
```

Layer naming system for user customization

Members:

- `setLayerName`: Set a custom name for a layer
- `setLayerDescription`: Set a description for a layer
- `getLayerName`: Get the name of a layer by index
- `getLayerDescription`: Get the description of a layer by index
- `getAllLayers`: Get all configured layers
- `getLayerIndex`: Get layer index from layer bit value
- `setupCommonLayers`: Setup common layer names for convenience

## Constants

### CollisionMasks

```ts
const CollisionMasks: { readonly static: () => CollisionMask; readonly dynamic: () => CollisionMask; readonly character: () => CollisionMask; readonly trigger: () => CollisionMask; readonly projectile: () => CollisionMask; readonly all: () => CollisionMask; readonly none: () => CollisionMask; };
```

Helper to create common collision mask combinations

### CombineMode

```ts
const CombineMode: { readonly Average: 0; readonly Min: 1; readonly Multiply: 2; readonly Max: 3; };
type CombineMode = (typeof CombineMode)[keyof typeof CombineMode];
```

Material combine modes for how two materials interact

### CommonLayers

```ts
const CommonLayers: { readonly STATIC: number; readonly DYNAMIC: number; readonly KINEMATIC: number; readonly CHARACTER: number; readonly TRIGGER: number; readonly PROJECTILE: number; readonly DEBRIS: number; readonly VEHICLE: number; };
```

Commonly used layer presets for convenience

### CommonMaterials

```ts
const CommonMaterials: { readonly default: () => PhysicsMaterial; readonly rubber: () => PhysicsMaterial; readonly metal: () => PhysicsMaterial; readonly wood: () => PhysicsMaterial; readonly ice: () => PhysicsMaterial; readonly stone: () => PhysicsMaterial; readonly foam: () => PhysicsMaterial; readonly glass: () => PhysicsMaterial; };
```

Predefined common materials for convenience

### DefaultLayers

```ts
const DefaultLayers: { readonly LAYER_1: number; readonly LAYER_2: number; readonly LAYER_3: number; readonly LAYER_4: number; readonly LAYER_5: number; readonly LAYER_6: number; readonly LAYER_7: number; readonly LAYER_8: number; };
```

Default layer definitions (users can define their own)

### MotionType

```ts
const MotionType: { readonly Static: 0; readonly Kinematic: 1; readonly Dynamic: 2; };
type MotionType = (typeof MotionType)[keyof typeof MotionType];
```

Motion types for physics bodies

### PhysicsBody

```ts
type PhysicsBody = {
    readonly motionType: MotionType;
    readonly collisionLayer: CollisionLayer;
    readonly collisionMask: CollisionMask;
    readonly syncMode: SyncMode;
    readonly mass?: number;
    readonly gravityFactor?: number;
    readonly allowSleeping?: boolean;
    readonly isSensor?: boolean;
    readonly lockRotation?: [
        boolean,
        boolean,
        boolean
    ];
    bodyId?: JoltBodyID;
    joltBody?: JoltBody;
};
const PhysicsBody: ComponentType<PhysicsBody>;
```

Core physics body component that stores Jolt body reference and metadata

### PhysicsBodyPresets

```ts
const PhysicsBodyPresets: { readonly createFloor: (_size?: number) => { motionType: 0; }; readonly createDynamicBox: (mass?: number) => { motionType: 2; mass: number; }; readonly createDynamicSphere: (mass?: number) => { motionType: 2; mass: number; }; };
```

Helper functions for creating physics body configurations

### PhysicsMaterial

```ts
type PhysicsMaterial = {
    readonly restitution: number;
    readonly friction: number;
    readonly density: number;
    readonly restitutionCombineMode?: CombineMode;
    readonly frictionCombineMode?: CombineMode;
    readonly linearDamping?: number;
    readonly angularDamping?: number;
    readonly userData?: unknown;
};
const PhysicsMaterial: ComponentType<PhysicsMaterial>;
```

Physics material component that defines surface properties

### PhysicsShape

```ts
type PhysicsShape = {
    readonly shapeType: ShapeType;
    readonly parameters: ShapeParams;
    readonly convexRadius?: number;
    readonly centerOfMass?: Vector3;
    readonly userData?: unknown;
};
const PhysicsShape: ComponentType<PhysicsShape>;
```

Physics shape component that defines collision geometry

### ShapeBuilder

```ts
const ShapeBuilder: { readonly box: (halfExtents: Vector3, convexRadius?: number) => PhysicsShape; readonly sphere: (radius: number) => PhysicsShape; readonly capsule: (halfHeight: number, radius: number, convexRadius?: number) => PhysicsShape; readonly cylinder: (halfHeight: number, radius: number, convexRadius?: number) => PhysicsShape; readonly convexHull: (points: Vector3[], maxConvexRadius?: number) => PhysicsShape; readonly mesh: (vertices: number[], indices: number[]) => PhysicsShape; readonly heightField: (heights: number[], sampleCount: number, scale: Vector3, offset?: number) => PhysicsShape; };
```

Helper functions to create specific shape types

### ShapeType

```ts
const ShapeType: { readonly Box: "box"; readonly Sphere: "sphere"; readonly Capsule: "capsule"; readonly Cylinder: "cylinder"; readonly ConvexHull: "convexHull"; readonly Compound: "compound"; readonly Mesh: "mesh"; readonly HeightField: "heightField"; };
type ShapeType = (typeof ShapeType)[keyof typeof ShapeType];
```

Supported physics shape types

### SyncMode

```ts
const SyncMode: { readonly None: 0; readonly PhysicsToTransform: 1; readonly TransformToPhysics: 2; readonly Bidirectional: 3; };
type SyncMode = (typeof SyncMode)[keyof typeof SyncMode];
```

Synchronization strategies between physics and transform components

## Types

### BoxShapeParams

```ts
type BoxShapeParams = {
    readonly halfExtents: Vector3;
};
```

Box shape parameters

### CapsuleShapeParams

```ts
type CapsuleShapeParams = {
    readonly halfHeight: number;
    readonly radius: number;
};
```

Capsule shape parameters

### CollisionLayer

```ts
type CollisionLayer = number;
```

32-bit collision layer system similar to Godot
Each layer is represented as a single bit (1, 2, 4, 8, etc.)
Collision masks are bitwise combinations of layers

### CollisionMask

```ts
type CollisionMask = number;
```

### CompoundShapeParams

```ts
type CompoundShapeParams = {
    readonly subShapes: readonly {
        readonly shape: PhysicsShape;
        readonly position: Vector3;
        readonly rotation: {
            x: number;
            y: number;
            z: number;
            w: number;
        };
    }[];
};
```

Compound shape parameters

### ConvexHullShapeParams

```ts
type ConvexHullShapeParams = {
    readonly points: readonly Vector3[];
    readonly maxConvexRadius?: number;
};
```

Convex hull shape parameters

### CylinderShapeParams

```ts
type CylinderShapeParams = {
    readonly halfHeight: number;
    readonly radius: number;
};
```

Cylinder shape parameters

### HeightFieldShapeParams

```ts
type HeightFieldShapeParams = {
    readonly heights: readonly number[];
    readonly sampleCount: number;
    readonly scale: Vector3;
    readonly offset?: number;
};
```

Height field shape parameters (for terrain)

### JoltAllowedDOFs

```ts
type JoltAllowedDOFs = Jolt.EAllowedDOFs;
```

### JoltBody

```ts
type JoltBody = Jolt.Body;
```

### JoltBodyCreationSettings

```ts
type JoltBodyCreationSettings = Jolt.BodyCreationSettings;
```

### JoltBodyID

```ts
type JoltBodyID = Jolt.BodyID;
```

### JoltBodyInterface

```ts
type JoltBodyInterface = Jolt.BodyInterface;
```

### JoltBoxShape

```ts
type JoltBoxShape = Jolt.BoxShape;
```

### JoltCapsuleShape

```ts
type JoltCapsuleShape = Jolt.CapsuleShape;
```

### JoltColor

```ts
interface JoltColor {
    mU32: number;
}
```

Color class used by debug renderer

### JoltCylinderShape

```ts
type JoltCylinderShape = Jolt.CylinderShape;
```

### JoltDebugModule

```ts
interface JoltDebugModule extends JoltModule {
    readonly DebugRendererJS: new () => JoltDebugRendererJS;
    readonly DebugRendererVertexTraits: {
        prototype: {
            mPositionOffset: number;
            mNormalOffset: number;
            mUVOffset: number;
            mSize: number;
        };
    };
    readonly DebugRendererTriangleTraits: {
        prototype: {
            mVOffset: number;
            mSize: number;
        };
    };
    readonly EDrawMode_Wireframe: number;
    readonly ECullMode_Off: number;
    readonly ECullMode_CullBackFace: number;
    readonly ECullMode_CullFrontFace: number;
    readonly Color: {
        new (): JoltColor;
    };
    readonly HEAPF32: Float32Array;
    readonly HEAPU32: Uint32Array;
}
```

Extended types for debug renderer (only available in debug builds)
These properties are not in the standard Jolt type definitions

### JoltDebugRendererJS

```ts
interface JoltDebugRendererJS {
    Initialize(): void;
    DrawBodies(physicsSystem: JoltPhysicsSystem, drawSettings: unknown): void;
    DrawConstraints(physicsSystem: JoltPhysicsSystem): void;
    DrawConstraintLimits(physicsSystem: JoltPhysicsSystem): void;
    DrawLine: (inFrom: number, inTo: number, inColor: number) => void;
    DrawTriangle: (inV1: number, inV2: number, inV3: number, inColor: number, inCastShadow: number) => void;
    DrawText3D: (inPosition: number, inStringPtr: number, inStringLen: number, inColor: number, inHeight: number) => void;
    DrawGeometryWithID: (inModelMatrix: number, inWorldSpaceBounds: number, inLODScaleSq: number, inModelColor: number, inGeometryID: number, inCullMode: number, inCastShadow: number, inDrawMode: number) => void;
    CreateTriangleBatchID: (inTriangles: number, inTriangleCount: number) => number;
    CreateTriangleBatchIDWithIndex: (inVertices: number, inVertexCount: number, inIndices: number, inIndexCount: number) => number;
}
```

### JoltEActivation

```ts
type JoltEActivation = Jolt.EActivation;
```

### JoltEMotionType

```ts
type JoltEMotionType = Jolt.EMotionType;
```

### JoltInterface

```ts
type JoltInterface = Jolt.JoltInterface;
```

### JoltModule

```ts
type JoltModule = Awaited<ReturnType<typeof initJolt>>;
```

Runtime module type (what you get back from `await initJolt()`).
Keep this if you pass the loaded module around.

### JoltPhysicsSystem

```ts
type JoltPhysicsSystem = Jolt.PhysicsSystem;
```

### JoltQuat

```ts
type JoltQuat = Jolt.Quat;
```

### JoltRMat44

```ts
type JoltRMat44 = Jolt.RMat44;
```

### JoltRVec3

```ts
type JoltRVec3 = Jolt.RVec3;
```

### JoltSettings

```ts
type JoltSettings = Jolt.JoltSettings;
```

### JoltShape

```ts
type JoltShape = Jolt.Shape;
```

### JoltSphereShape

```ts
type JoltSphereShape = Jolt.SphereShape;
```

### JoltVec3

```ts
type JoltVec3 = Jolt.Vec3;
```

### MeshShapeParams

```ts
type MeshShapeParams = {
    readonly vertices: readonly number[];
    readonly indices: readonly number[];
};
```

Mesh shape parameters (for static complex geometry)

### ShapeParams

```ts
type ShapeParams = BoxShapeParams | SphereShapeParams | CapsuleShapeParams | CylinderShapeParams | ConvexHullShapeParams | CompoundShapeParams | MeshShapeParams | HeightFieldShapeParams;
```

Union of all shape parameter types

### SimplePhysicsWorld

```ts
interface SimplePhysicsWorld {
    readonly jolt: JoltModule;
    readonly joltInterface: JoltInterface;
    readonly physicsSystem: JoltPhysicsSystem;
    readonly bodyInterface: JoltBodyInterface;
    readonly config: {
        gravity: Vector3;
    };
    readonly utils: {
        vec3ToJolt: (jolt: JoltModule, vec: Vector3) => JoltVec3;
        vec3ToJoltR: (jolt: JoltModule, vec: Vector3) => JoltRVec3;
        quatToJolt: (jolt: JoltModule, quat: Quaternion) => JoltQuat;
        joltVec3ToThree: (joltVec: JoltVec3, out: Vector3) => Vector3;
        joltRVec3ToThree: (joltVec: JoltRVec3, out: Vector3) => Vector3;
        joltQuatToThree: (joltQuat: JoltQuat, out: Quaternion) => Quaternion;
    };
    readonly isInitialized: boolean;
}
```

Simplified PhysicsWorld interface for the new system

### SphereShapeParams

```ts
type SphereShapeParams = {
    readonly radius: number;
};
```

Sphere shape parameters

## Added to core types when imported

Importing `fenrir-ts/physics` adds these members to core types for the whole program.

### SystemCtx

```ts
interface SystemCtx {
    physics?: PhysicsHelpers;
}
```

- `physics`: Physics helpers, set by the physics system's init. Added by `fenrir-ts/physics`.
