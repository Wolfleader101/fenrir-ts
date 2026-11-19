import { describe, expect, it } from "vitest";
import { createDomInputSystems } from "@/core/InputSystem/DOMInputSystem";
import { createInputStateSystem } from "@/core/InputSystem/InputStateSystem";
import { createPixiRendererSystem } from "@/core/Renderer2D";
import { AssetStore } from "@/core/Assets/AssetStore";
import { NullLogger } from "@/core/NullLogger";

describe("engine system names", () => {
  it("names every core and 2D factory system fenrir.<module>.<stage>", () => {
    const dom = createDomInputSystems();
    const state = createInputStateSystem();
    const pixi = createPixiRendererSystem({ logger: new NullLogger(), assets: new AssetStore() });
    expect([dom.init.name, dom.exit.name]).toEqual(["fenrir.input.dom.init", "fenrir.input.dom.exit"]);
    expect(state.preUpdate.name).toBe("fenrir.input.state.preUpdate");
    expect([pixi.init.name, pixi.postUpdate.name, pixi.exit.name]).toEqual([
      "fenrir.pixi.init", "fenrir.pixi.postUpdate", "fenrir.pixi.exit",
    ]);
  });
});
