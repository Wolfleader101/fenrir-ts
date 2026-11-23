// Run after bundling, in Node with the real pixi.js: fails if the consumer's
// bundler dropped a module that fenrir-ts or fenrir-ts/2d needs for its side
// effects: the 2D EntityBuilder methods (renderSprite, pixiNode). Also checks the core
// EntityBuilder methods (transform, name), which are the class's own, and the 2D texture
// functions with the default loader they register.
import { AssetStore, EntityBuilder, EntityList, Name, Transform, assetKey } from "fenrir-ts";
import { Display2D, PixiNode, Renderable2D, Transform2D, getSupportedTexture2DExtensions, registerTexture2DLoader, requestTexture2D } from "fenrir-ts/2d";
import { Container, Texture } from "pixi.js";

const check = (ok, message) => {
  if (!ok) throw new Error(`side-effects-2d: ${message}`);
};

const entities = new EntityList();
check(typeof EntityBuilder.prototype.transform === "function", "EntityBuilder has no transform");
const named = EntityBuilder.create().name("fixture").transform({ x: 1, y: 2, z: 3 }).spawn(entities);
check(entities.get(named, Name).name === "fixture", "name() did not set Name");
check(entities.get(named, Transform).position.y === 2, "transform() did not set Transform");

check(typeof EntityBuilder.prototype.renderSprite === "function", "EntityBuilder has no renderSprite");
const hero = EntityBuilder.create().renderSprite("hero.png", { anchor: [0.5, 0.5] }).spawn(entities);
const renderable = entities.get(hero, Renderable2D);
check(renderable.sprite?.kind === "sprite" && renderable.sprite.texture === "hero.png", "renderSprite set no sprite");

check(typeof EntityBuilder.prototype.pixiNode === "function", "EntityBuilder has no pixiNode");
const node = new Container();
const card = EntityBuilder.create().transform2D(4, 5).display2D({ visible: false }).pixiNode(node, { layer: "ui" }).spawn(entities);
check(entities.get(card, PixiNode).node === node && entities.get(card, PixiNode).layer === "ui", "pixiNode set no PixiNode");
check(entities.get(card, Transform2D).y === 5, "transform2D() did not set Transform2D");
check(entities.get(card, Display2D).visible === false, "display2D() did not set Display2D");

const assets = new AssetStore();
check(!("requestTexture2D" in assets), "something patched requestTexture2D onto AssetStore");
registerTexture2DLoader(assets, "fixture", { loader: async () => Texture.EMPTY, extensions: ["fixture"] });
const handle = requestTexture2D(assets, assetKey("hero"), "hero.fixture");
check(getSupportedTexture2DExtensions(assets).includes("png"), "requestTexture2D did not register the default Pixi texture loader");
check(handle.state.status === "loading", "requestTexture2D did not start loading");
check((await handle.ready) === Texture.EMPTY, "requestTexture2D did not resolve to the loaded texture");
check(handle.state.status === "ready", "the texture handle is not ready");

console.log("side-effects-2d: transform, transform2D, display2D, name, renderSprite, pixiNode and requestTexture2D work after bundling");
