// Browser test: the built game in Chromium. It reads the game through window.__FENRIR__.inspect(),
// which src/main.ts exposes in dev and e2e builds, and asserts on state, never on pixels.
import { expect, test, type Page } from "@playwright/test";
import type { DebugGlobal, GameSnapshot } from "fenrir-ts";

declare global {
  interface Window {
    __FENRIR__?: DebugGlobal;
  }
}

const snapshot = (page: Page): Promise<GameSnapshot | undefined> => page.evaluate(() => window.__FENRIR__?.inspect());

/** Taps the canvas at a point in design units, placed with the game's own Viewport resource. */
async function tapAt(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator("#game").boundingBox();
  const viewport = (await snapshot(page))?.resources["fenrir.viewport.Viewport"] as
    | { scale: number; offset: { x: number; y: number } }
    | undefined;
  if (!box || !viewport) throw new Error("the canvas or the Viewport resource is missing");
  await page.mouse.click(box.x + viewport.offset.x + x * viewport.scale, box.y + viewport.offset.y + y * viewport.scale);
}

test("the game loads, draws its star and plays", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/");
  await expect.poll(async () => (await snapshot(page))?.frame ?? 0).toBeGreaterThan(0);
  expect((await snapshot(page))?.states["game.Phase"]?.value).toBe("ready");

  // The star has its sprite: the texture loaded and the drawing system ran.
  const star = (await snapshot(page))?.entities.find((entity) => entity.name === "game.star");
  expect(star?.components["fenrir.PixiNode"]).toBeDefined();

  await tapAt(page, 195, 500);
  await expect.poll(async () => (await snapshot(page))?.states["game.Phase"]?.value).toBe("playing");

  expect(errors).toEqual([]);
});
