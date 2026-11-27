import { expect, it, vi } from "vitest";
import { Container, Graphics } from "pixi.js";
import { Schedule, createTestGame, defineAction } from "@/index";
import { ControlActivated, UiFocus, activateControl, control, listControls, modalScope, ui } from "@/ui";

// The UI controls example in skills/fenrir/SKILL.md, which tests/skillExamples.test.ts also runs.
it("runs the guide's UI controls example", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});

  const Tab = defineAction("myGame.tab", ["Tab"]);
  const root = new Container();
  const game = await createTestGame({ seed: 1, plugins: [ui({ root })] });
  const activated: string[] = [];
  game.on(ControlActivated, ({ id, via }) => void activated.push(`${id}:${via}`));

  const sheet = root.addChild(new Container());
  game.addSystem(Schedule.Update, function drawSheet() {
    for (const child of sheet.removeChildren()) child.destroy();
    modalScope(sheet, { label: "Shop" });
    control(sheet.addChild(new Graphics().rect(0, 0, 100, 40).fill(0)), { id: "myGame.buy", label: "Buy" });
  });
  await game.start();
  game.step();
  game.input.press(Tab);
  game.input.release(Tab);
  game.step(1 / 60, 2);
  game.input.pointerDown(50, 20);
  game.input.pointerUp();
  game.step(1 / 60, 2);
  console.log([...activated], game.resources.get(UiFocus).id);
  console.log(activateControl(game, "myGame.buy"), listControls(game)[0]!.bounds);

  expect(log.mock.calls).toEqual([
    [["myGame.buy:pointer"], "myGame.buy"],
    [true, { x: 0, y: 0, width: 100, height: 40 }],
  ]);
  await game.stop();
});
