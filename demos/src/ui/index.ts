import "../style.css";
import { ConsoleLogger, Schedule, createGame, exposeInspector, type SystemCtx } from "fenrir-ts";
import { pixi2d } from "fenrir-ts/2d";
import { ControlActivated, control, modalScope, paginate, ui } from "fenrir-ts/ui";
import { Container, Graphics, Text } from "pixi.js";
import { initDemoInfo, initDemoNav } from "../shared/demoNav.ts";

initDemoNav("ui-controls.html");
initDemoInfo("UI Controls", [
  "Tap a button, or Tab to it and press Enter",
  "Tab past the last button leaves the canvas",
  "Open the list: a modal sheet, closed with Escape",
  "The sheet is cleared and redrawn on every change; focus stays",
]);

const logger = new ConsoleLogger();
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const pixi = pixi2d({ design: { width: 390, minHeight: 520 }, background: 0x0f2230, layers: ["hud", "sheet"] });
const game = await createGame({ canvas, logger, plugins: [pixi, ui({ pixi, summary: "UI controls demo" })] });
exposeInspector(game); // window.__FENRIR__.inspect().resources["fenrir.UiControls"] lists the controls

const ITEMS = Array.from({ length: 11 }, (_, i) => `Item ${i + 1}`);
const view = { count: 0, open: false, page: 0, picked: "nothing", dirty: true };

function button(label: string, width = 160, height = 44): Container {
  const node = new Container();
  node.addChild(new Graphics().roundRect(0, 0, width, height, 10).fill(0x2b5d7a));
  const text = node.addChild(new Text({ text: label, style: { fill: 0xffffff, fontSize: 18 } }));
  text.position.set(12, (height - text.height) / 2);
  return node;
}

const hud = new Container();
const sheet = new Container();

function redraw(): void {
  for (const child of hud.removeChildren()) child.destroy({ children: true });
  for (const child of sheet.removeChildren()) child.destroy({ children: true });

  const status = hud.addChild(new Text({ text: `Count ${view.count}, picked ${view.picked}`, style: { fill: 0xffffff, fontSize: 18 } }));
  status.position.set(24, 24);
  const plus = hud.addChild(button("Add one"));
  plus.position.set(24, 80);
  control(plus, { id: "add", label: `Add one, count ${view.count}`, onActivate: () => ((view.count += 1), (view.dirty = true)) });
  const open = hud.addChild(button("Open list"));
  open.position.set(24, 140);
  control(open, { id: "open", label: "Open the list", onActivate: () => ((view.open = true), (view.dirty = true)) });
  const reset = hud.addChild(button("Reset", 100));
  reset.position.set(200, 80);
  control(reset, { id: "reset", label: "Reset the count", disabled: view.count === 0, onActivate: () => ((view.count = 0), (view.dirty = true)) });
  reset.alpha = view.count === 0 ? 0.4 : 1;

  sheet.visible = view.open;
  if (!view.open) return;
  const close = (): void => {
    view.open = false;
    view.dirty = true;
  };
  modalScope(sheet, { label: "List", onClose: close });
  sheet.addChild(new Graphics().rect(0, 0, 390, 520).fill({ color: 0x000000, alpha: 0.6 }));
  sheet.addChild(new Graphics().roundRect(20, 40, 350, 440, 16).fill(0x18394d));
  const { rows, page, pages } = paginate(ITEMS, 4, view.page);
  rows.forEach((item, i) => {
    const row = sheet.addChild(button(item, 310));
    row.position.set(40, 70 + i * 56);
    control(row, { id: `pick-${item}`, label: `Pick ${item}`, onActivate: () => ((view.picked = item), close()) });
  });
  const more = sheet.addChild(button(`Page ${page + 1} / ${pages}`, 150));
  more.position.set(40, 410);
  control(more, { id: "page", label: `Next page, now ${page + 1} of ${pages}`, onActivate: () => ((view.page = (page + 1) % pages), (view.dirty = true)) });
  const shut = sheet.addChild(button("Close", 140));
  shut.position.set(210, 410);
  control(shut, { id: "close", label: "Close the list", onActivate: close });
}

game.on(ControlActivated, ({ id, via }) => logger.info(`activated ${id} by ${via}`));

game
  .addSystem(Schedule.Init, function mount() {
    pixi.renderer.layer("hud").addChild(hud);
    pixi.renderer.layer("sheet").addChild(sheet);
  }, { name: "demo.ui.mount" })
  .addSystem(Schedule.Update, function draw(_ctx: SystemCtx) {
    if (view.dirty) redraw();
    view.dirty = false;
  }, { name: "demo.ui.draw" });

await game.run();
