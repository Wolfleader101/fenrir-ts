// game-2d.js plus UI controls: the ui() plugin, a HUD button, and a modal sheet rebuilt from
// state with a paged list of controls, closed with Escape. Its size minus game-2d's is what the
// controls kit costs a game. Bundled, never run.
import { EntityBuilder, Schedule, createGame, defineEvent } from "fenrir-ts";
import { PixiNode, Transform2D, pixi2d } from "fenrir-ts/2d";
import { ControlActivated, control, modalScope, paginate, ui } from "fenrir-ts/ui";
import { Container, Graphics } from "pixi.js";

const Scored = defineEvent("fixture.scored");
const ITEMS = ["one", "two", "three", "four", "five", "six", "seven"];

const canvas = document.querySelector("canvas");
const pixi = pixi2d({ layers: ["world", "ui"] });
const game = await createGame({ canvas, plugins: [pixi, ui({ pixi, summary: "Fixture game" })] });
const scored = game.events.createReader(Scored);
const MOVING = [Transform2D];
const view = { open: false, page: 0, dirty: true };
const sheet = new Container();

function drawSheet() {
  for (const child of sheet.removeChildren()) child.destroy({ children: true });
  sheet.visible = view.open;
  if (!view.open) return;
  modalScope(sheet, { label: "Items", onClose: () => ((view.open = false), (view.dirty = true)) });
  const { rows, page, pages } = paginate(ITEMS, 3, view.page);
  rows.forEach((item, i) => {
    const row = sheet.addChild(new Graphics().rect(0, 0, 200, 40).fill(0x334455));
    row.position.set(20, 60 + i * 50);
    control(row, { id: `item-${item}`, label: `Item ${item}` });
  });
  const more = sheet.addChild(new Graphics().rect(0, 0, 80, 40).fill(0x556677));
  more.position.set(20, 220);
  control(more, { id: "next-page", label: `Page ${page + 1} of ${pages}`, disabled: pages === 1, onActivate: () => ((view.page = (page + 1) % pages), (view.dirty = true)) });
}

game.on(ControlActivated, ({ id, via }) => game.logger.info("activated", { id, via }));

game
  .addSystem(Schedule.Init, function spawn({ entities }) {
    const ball = new Graphics().circle(0, 0, 8).fill(0xffffff);
    EntityBuilder.create().transform2D(20, 20).display2D({ alpha: 0.8 }).with(PixiNode, { node: ball, layer: "world" }).spawn(entities);
    const open = new Graphics().roundRect(0, 0, 60, 30, 6).fill(0x223344);
    control(open, { id: "open", label: "Open items", onActivate: () => ((view.open = true), (view.dirty = true)) });
    pixi.renderer.layer("ui").addChild(open, sheet);
  })
  .addSystem(Schedule.Update, function redraw() {
    if (view.dirty) drawSheet();
    view.dirty = false;
  })
  .addSystem(Schedule.Update, function move({ entities, time }) {
    entities.each(MOVING, (_entity, transform) => { transform.x += 60 * time.delta; });
  })
  .addSystem(Schedule.Update, function score({ events }) {
    events.send(Scored, { points: 1 });
  })
  .addSystem(Schedule.Update, function logScore({ logger }) {
    for (const { points } of scored.read()) logger.info("scored", { points });
  }, { after: "score" });

await game.run();
