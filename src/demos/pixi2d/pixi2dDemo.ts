import { Graphics, Text } from "pixi.js";
import { EntityBuilder, Name, Transform, defineAction, defineResource } from "@/index";
import type { AsyncSystemFn, QuatLike, SyncSystemFn } from "@/index";
import { Renderable2D, Viewport, ViewportResized } from "@/2d";
import type { PixiRenderer } from "@/2d";

/** The design frame: a 390-unit-wide portrait that grows taller on taller screens. */
export const DESIGN = { width: 390, minHeight: 520 } as const;

/** Sets a rotation of `angle` radians around the Z axis, the only rotation 2D uses. */
function setZRotation(q: QuatLike, angle: number): void {
  q.x = 0;
  q.y = 0;
  q.z = Math.sin(angle / 2);
  q.w = Math.cos(angle / 2);
}

const ORBIT_QUERY = [Transform, Renderable2D, Name] as const;

/** A tap: the primary pointer on the canvas, or Space or Enter while it has focus. */
export const Tap = defineAction("demo.pixi2d.tap", ["pointer.primary", "Space", "Enter"]);

/** The pointer as the demo last saw it, in design units. Read it with `window.__FENRIR__.inspect()`. */
export const PointerSeen = defineResource("demo.pixi2d.pointer", () => ({ x: 0, y: 0, down: false, inside: false, taps: 0 }));

/**
 * 2D demo laid out in design units with `pixi2d({ design })`.
 *
 * - A full-bleed striped background in `renderer.backdrop` covers the whole screen.
 * - The framed content (`renderer.root`) is drawn in 390-wide design units, inside the safe area.
 * - The frame and its labels redraw on `ViewportResized`, so nothing listens to window resize.
 */
export function create2DDemo(renderer: PixiRenderer) {
  const backdrop = new Graphics();
  const frame = new Graphics();
  const title = new Text({ text: "Fenrir-TS viewport", style: { fontFamily: "Arial", fontSize: 30, fill: 0xffffff } });
  const footer = new Text({ text: "", style: { fontFamily: "monospace", fontSize: 13, fill: 0xb8e0d2, align: "center" } });
  const pointerLabel = new Text({ text: "", style: { fontFamily: "monospace", fontSize: 13, fill: 0xf9ca24, align: "center" } });
  const marker = new Graphics().circle(0, 0, 10).stroke({ color: 0xf9ca24, width: 3 });
  pointerLabel.anchor.set(0.5, 0);
  title.anchor.set(0.5, 0);
  footer.anchor.set(0.5, 1);
  let centreY = DESIGN.minHeight / 2;

  function layout(viewport: Viewport): void {
    const { screen, insets, width, height } = viewport;
    // Full bleed: CSS pixels over the whole screen, including the notch and the side bars.
    backdrop.clear().rect(0, 0, screen.width, screen.height).fill(0x092c36);
    for (let x = -screen.height; x < screen.width; x += 40) {
      backdrop.moveTo(x, screen.height).lineTo(x + screen.height, 0);
    }
    backdrop.stroke({ color: 0x0f4250, width: 14 });
    // The safe area, outlined so a notch is easy to see.
    backdrop
      .rect(insets.left, insets.top, screen.width - insets.left - insets.right, screen.height - insets.top - insets.bottom)
      .stroke({ color: 0xff3d7f, width: 2, alpha: 0.8 });

    // Design units: the frame is always 390 wide and at least 520 tall.
    frame.clear().roundRect(4, 4, width - 8, height - 8, 18).fill(0x1a1a2e).stroke({ color: 0x4ecdc4, width: 4 });
    title.position.set(width / 2, 24);
    pointerLabel.position.set(width / 2, 64);
    footer.position.set(width / 2, height - 16);
    footer.text = [
      `logical ${width} x ${height.toFixed(1)}  scale ${viewport.scale.toFixed(3)}`,
      `screen ${screen.width} x ${screen.height} @${viewport.resolution}x`,
      `insets ${insets.top}/${insets.right}/${insets.bottom}/${insets.left}`,
    ].join("\n");
    centreY = height / 2;
  }

  const init: AsyncSystemFn = (ctx) => {
    renderer.backdrop.addChild(backdrop);
    renderer.root.addChild(frame, title, footer, pointerLabel, marker);
    frame.zIndex = -10;
    title.zIndex = footer.zIndex = pointerLabel.zIndex = marker.zIndex = 100;
    layout(ctx.resources.get(Viewport));
    ctx.events.on(ViewportResized, layout);

    const colors = [0xff6b6b, 0x4ecdc4, 0x45b7d1, 0xf9ca24, 0x6c5ce7, 0xe17055, 0x00b894, 0xfd79a8];
    colors.forEach((color, i) => {
      EntityBuilder.create()
        .name(`Circle ${i}`)
        .transform({ x: DESIGN.width / 2, y: centreY, z: 0 })
        .with(Renderable2D, {
          id: 0,
          graphics: { kind: "graphics", shape: "circle", fillColor: color, strokeColor: 0xffffff, strokeWidth: 3, data: { x: 0, y: 0, radius: 22 } },
          flags: { zIndex: 10 },
        })
        .spawn(ctx.entities);
    });

    EntityBuilder.create()
      .name("Center Square")
      .transform({ x: DESIGN.width / 2, y: centreY, z: 0 })
      .with(Renderable2D, {
        id: 0,
        graphics: { kind: "graphics", shape: "rect", fillColor: 0x2ecc71, strokeColor: 0xffffff, strokeWidth: 4, data: { x: -40, y: -40, width: 80, height: 80 } },
        flags: { zIndex: 20 },
      })
      .spawn(ctx.entities);

    ctx.onCleanup(() => {
      backdrop.removeFromParent();
      frame.removeFromParent();
      title.removeFromParent();
      footer.removeFromParent();
      pointerLabel.removeFromParent();
      marker.removeFromParent();
    });
  };

  // Circles orbit the centre of the frame, which moves down as the frame grows taller.
  const update: SyncSystemFn = (ctx) => {
    const time = ctx.time.elapsed;
    const { pointer } = ctx.input;
    const seen = ctx.resources.get(PointerSeen);
    if (ctx.input.pressed(Tap)) seen.taps++;
    Object.assign(seen, { x: pointer.x, y: pointer.y, down: pointer.down, inside: pointer.inside });
    marker.position.set(pointer.x, pointer.y);
    marker.visible = pointer.inside;
    marker.scale.set(pointer.down ? 1.6 : 1);
    pointerLabel.text = `pointer ${pointer.x.toFixed(1)}, ${pointer.y.toFixed(1)}${pointer.down ? " down" : ""}  taps ${seen.taps}`;
    ctx.entities.each(ORBIT_QUERY, (_e, transform, _renderable, { name }) => {
      if (name.startsWith("Circle ")) {
        const angle = (Number(name.slice(7)) / 8) * Math.PI * 2 + time * 0.5;
        transform.position.x = DESIGN.width / 2 + Math.cos(angle) * 140;
        transform.position.y = centreY + Math.sin(angle) * 140;
        setZRotation(transform.rotation, time * 2);
      } else if (name === "Center Square") {
        transform.position.y = centreY;
        setZRotation(transform.rotation, Math.sin(time * 3) * 0.2);
        const pulse = 1 + Math.sin(time * 2) * 0.1;
        transform.scale.x = pulse;
        transform.scale.y = pulse;
      }
    });
  };

  return { init, update };
}
