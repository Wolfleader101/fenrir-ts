// Runs the agent guide's DOM examples in headless Chromium, against the packed package. Run
// `build:lib` first. `check:docs` compiles these blocks and tests/skillExamples.test.ts runs the
// rest of the guide headless, but only a browser runs the code that needs `document`.
//
// Takes the ```ts blocks of skills/fenrir/SKILL.md that have a section using `document.` (found
// with scripts/docs-blocks.mjs, as check:docs finds them), drops their test sections (those that
// import vitest), appends `exposeInspector(game)` and builds each as a page of a temporary Vite
// project that installs the packed tarball, pixi.js, Vite and Playwright the way a consumer
// does. Then serves the build and drives each page in Chromium with SwiftShader WebGL, reading
// the game through window.__FENRIR__.inspect(). Every page must log no console error and throw
// no page error, size its canvas to the window without scrolling the page, and set `Viewport`
// to `layoutViewport` of the window, also after a resize. The minimal game's entry must start
// `ready`, focus its canvas, and go `playing` on a click and, in a fresh load, on Space. The 2D
// example's fish must move.
//
// Playwright and Vite are installed in the temporary project only, so the repository has no new
// dependency; their versions are the starter game's (templates/game-2d/package.json), so CI's
// browser cache serves both. Needs the network.
//   --keep   leave the temporary folder in place and print where it is
import { execFileSync } from "node:child_process";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { codeBlocks, sections } from "./docs-blocks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const keep = process.argv.includes("--keep");
const GUIDE = "skills/fenrir/SKILL.md";
const engine = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const template = JSON.parse(readFileSync(join(root, "templates", "game-2d", "package.json"), "utf8"));
const started = Date.now();
const seconds = (since) => `${((Date.now() - since) / 1000).toFixed(1)} s`;

// On Windows npm and npx are .cmd shims, which execFileSync runs only through a shell.
const run = (command, args, cwd) => {
  console.log(`$ ${command} ${args.join(" ")}`);
  execFileSync(command, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
};

/** The guide's pages: each DOM block without its test sections, with the inspector exposed. */
function pages() {
  const found = [];
  for (const block of codeBlocks(readFileSync(join(root, GUIDE), "utf8"))) {
    const parts = sections(block.code);
    if (!parts.some((part) => /\bdocument\./.test(part.code.join("\n")))) continue;
    const kept = parts.filter((part) => !/from ["']vitest["']/.test(part.code.join("\n")));
    const source = kept.flatMap((part) => part.code).join("\n");
    const design = /design:\s*\{\s*width:\s*(\d+),\s*minHeight:\s*(\d+)\s*\}/.exec(source);
    found.push({
      heading: block.heading,
      line: block.start + 1,
      design: design ? { width: Number(design[1]), minHeight: Number(design[2]) } : undefined,
      source: `${source}\n\n// Added by check:docs-browser.\nimport { exposeInspector } from "fenrir-ts";\nexposeInspector(game);\n`,
    });
  }
  return found;
}

/**
 * What each page must do beyond the checks every page gets, by the heading it sits under. A DOM
 * block under another heading fails the check until it gets an entry here.
 */
const CHECKS = [
  { name: "entry", heading: /^A minimal game, its test and its entry$/, check: checkEntry },
  { name: "2d", heading: /^2D:/, check: checkFish },
];

const failures = [];
const fail = (page, message) => failures.push(`${page.name} (${GUIDE} line ${page.line}, "${page.heading}"): ${message}`);

const snapshot = (tab) => tab.evaluate(() => window.__FENRIR__?.inspect());

/** Polls `read` until `ok` holds or `timeout` ms pass; returns the last value read. */
async function until(read, ok, timeout = 10_000) {
  const end = Date.now() + timeout;
  let value = await read();
  while (!ok(value) && Date.now() < end) {
    await new Promise((done) => setTimeout(done, 50));
    value = await read();
  }
  return value;
}

/** Opens the page and waits for its first frame. Collects console errors and page errors. */
async function open(browser, url, page) {
  const tab = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  tab.on("console", (message) => {
    if (message.type() === "error") fail(page, `console error: ${message.text()}`);
  });
  tab.on("pageerror", (error) => fail(page, `page error: ${error.message}`));
  await tab.goto(url);
  const first = await until(() => snapshot(tab), (s) => (s?.frame ?? 0) > 0);
  if (!first) fail(page, "window.__FENRIR__ never appeared: the page did not get past `await game.run()`.");
  else if (!(first.frame > 0)) fail(page, "the game ran no frame.");
  return first ? tab : undefined;
}

/** The canvas fills the window, the page does not scroll, and Viewport is the window's layout. */
async function checkLayout(tab, page, when) {
  const viewport = await until(
    async () => (await snapshot(tab))?.resources["fenrir.viewport.Viewport"],
    (v) => v?.screen.width === tab.viewportSize().width && v?.screen.height === tab.viewportSize().height,
  );
  const dom = await tab.evaluate(() => {
    const canvas = document.querySelector("#game");
    const box = canvas?.getBoundingClientRect();
    const html = document.documentElement;
    return {
      window: { width: window.innerWidth, height: window.innerHeight },
      canvas: box && { x: box.x, y: box.y, width: box.width, height: box.height },
      scroll: { width: html.scrollWidth, height: html.scrollHeight, clientWidth: html.clientWidth, clientHeight: html.clientHeight },
    };
  });
  const { width, height } = dom.window;
  const box = dom.canvas;
  if (!box) return fail(page, `${when}: there is no #game canvas.`);
  if (box.x !== 0 || box.y !== 0 || box.width !== width || box.height !== height)
    fail(page, `${when}: the canvas is at ${box.x},${box.y} sized ${box.width}x${box.height}, not 0,0 sized ${width}x${height} (the window).`);
  if (dom.scroll.width > dom.scroll.clientWidth || dom.scroll.height > dom.scroll.clientHeight)
    fail(page, `${when}: the page scrolls (${dom.scroll.width}x${dom.scroll.height} in ${dom.scroll.clientWidth}x${dom.scroll.clientHeight}).`);
  if (!page.design) return fail(page, "found no `design: { width, minHeight }` in the example.");
  const expected = await tab.evaluate(
    ([design, screen, viewport]) => window.__layoutViewport__(design, screen, viewport.insets, viewport.resolution),
    [page.design, dom.window, viewport],
  );
  if (JSON.stringify(viewport) !== JSON.stringify(expected))
    fail(page, `${when}: Viewport is ${JSON.stringify(viewport)}, not layoutViewport of the ${width}x${height} window: ${JSON.stringify(expected)}.`);
}

/** The minimal game's entry: ready, its canvas focused, and playing on a click or on Space. */
async function checkEntry(browser, url, page) {
  const phase = (tab) => snapshot(tab).then((s) => s?.states["myGame.Phase"]?.value);
  const clicked = await open(browser, url, page);
  if (!clicked) return;
  if ((await phase(clicked)) !== "ready") fail(page, `the state is ${await phase(clicked)} after load, not "ready".`);
  await clicked.locator("#game").click();
  const afterClick = await until(() => phase(clicked), (value) => value === "playing");
  if (afterClick !== "playing") fail(page, `a click on the canvas left the state ${afterClick}, not "playing".`);
  await clicked.close();

  // A fresh load: the entry's own canvas.focus() is what lets Space start the game.
  const pressed = await open(browser, url, page);
  if (!pressed) return;
  const focused = await pressed.evaluate(() => document.activeElement === document.querySelector("#game"));
  if (!focused) fail(page, "the canvas is not focused after load, so keys do not reach the game before the first tap.");
  await pressed.keyboard.press("Space");
  const afterSpace = await until(() => phase(pressed), (value) => value === "playing");
  if (afterSpace !== "playing") fail(page, `Space left the state ${afterSpace}, not "playing".`);
  await pressed.close();
}

/** The 2D example: its one entity with a PixiNode moves right. */
async function checkFish(browser, url, page) {
  const tab = await open(browser, url, page);
  if (!tab) return;
  const fishX = (s) => s?.entities.find((entity) => entity.components["fenrir.PixiNode"])?.components["fenrir.Transform2D"]?.x;
  const before = fishX(await snapshot(tab));
  if (typeof before !== "number") {
    fail(page, "found no entity with fenrir.PixiNode and fenrir.Transform2D.");
  } else {
    const after = await until(async () => fishX(await snapshot(tab)), (x) => x > before + 5);
    if (!(after > before + 5)) fail(page, `the fish stayed at x ${after} (from ${before}).`);
  }
  await tab.close();
}

/** Serves `dir` on a free port; returns the server and its origin. */
function serve(dir) {
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json" };
  const server = createServer((request, response) => {
    const path = normalize(join(dir, decodeURIComponent(new URL(request.url, "http://x").pathname)));
    if (!path.startsWith(dir) || !existsSync(path) || !statSync(path).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": types[extname(path)] ?? "application/octet-stream" });
    createReadStream(path).pipe(response);
  });
  return new Promise((done) => server.listen(0, "127.0.0.1", () => done({ server, origin: `http://127.0.0.1:${server.address().port}` })));
}

const work = mkdtempSync(join(tmpdir(), "fenrir-docs-browser-"));
let server;
let browser;
try {
  const found = pages();
  for (const page of found) {
    const known = CHECKS.find((entry) => entry.heading.test(page.heading));
    if (known) Object.assign(page, { name: known.name, check: known.check });
    else failures.push(`${GUIDE} line ${page.line}, "${page.heading}": a DOM example with no browser checks. Add it to CHECKS in scripts/check-docs-browser.mjs.`);
  }
  for (const entry of CHECKS) {
    if (!found.some((page) => page.name === entry.name)) failures.push(`${GUIDE} has no DOM example under a heading matching ${entry.heading}: update CHECKS in scripts/check-docs-browser.mjs.`);
  }
  if (failures.length > 0) throw new Error("the guide's DOM examples are not the ones this check knows");
  const checked = found.filter((page) => page.check);

  // The project: one page per example, each the HTML the guide says a page needs.
  let step = Date.now();
  run("npm", ["pack", "--ignore-scripts", "--loglevel=error", "--pack-destination", work], root);
  const tarball = readdirSync(work).find((file) => file.endsWith(".tgz"));
  const game = join(work, "game");
  mkdirSync(join(game, "src"), { recursive: true });
  const input = {};
  for (const page of checked) {
    writeFileSync(join(game, "src", `${page.name}.ts`), page.source);
    writeFileSync(
      join(game, `${page.name}.html`),
      [
        "<!doctype html>",
        '<html lang="en">',
        "  <head>",
        '    <meta charset="UTF-8" />',
        '    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
        "  </head>",
        "  <body>",
        '    <canvas id="game"></canvas>',
        // The check's own module, not the guide's: it gives the page layoutViewport to compare with.
        '    <script type="module" src="/src/layout.ts"></script>',
        `    <script type="module" src="/src/${page.name}.ts"></script>`,
        "  </body>",
        "</html>",
        "",
      ].join("\n"),
    );
    input[page.name] = `${page.name}.html`;
  }
  writeFileSync(join(game, "src", "layout.ts"), 'import { layoutViewport } from "fenrir-ts/2d";\n(window as any).__layoutViewport__ = layoutViewport;\n');
  writeFileSync(
    join(game, "vite.config.mjs"),
    // keepNames, as the guide's project setup says; ES2022 for top-level await.
    `export default { esbuild: { keepNames: true }, build: { target: "es2022", rollupOptions: { input: ${JSON.stringify(input)} } } };\n`,
  );
  writeFileSync(
    join(game, "package.json"),
    `${JSON.stringify(
      {
        name: "fenrir-docs-browser",
        private: true,
        type: "module",
        dependencies: { "fenrir-ts": `file:${join(work, tarball).replaceAll("\\", "/")}`, "pixi.js": engine.peerDependencies["pixi.js"] },
        devDependencies: { playwright: template.devDependencies["@playwright/test"], vite: template.devDependencies.vite },
      },
      null,
      2,
    )}\n`,
  );
  run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], game);
  run("npx", ["playwright", "install", ...(process.env.CI ? ["--with-deps"] : []), "chromium"], game);
  run("npx", ["vite", "build", "--logLevel", "warn"], game);
  console.log(`project packed, installed and built in ${seconds(step)}`);

  step = Date.now();
  const served = await serve(join(game, "dist"));
  server = served.server;
  const { chromium } = await import(pathToFileURL(join(game, "node_modules", "playwright", "index.mjs")).href);
  browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-unsafe-swiftshader"] });
  for (const page of checked) {
    const url = `${served.origin}/${page.name}.html`;
    const before = failures.length;
    const tab = await open(browser, url, page);
    if (tab) {
      await checkLayout(tab, page, "at 1280x720");
      await tab.setViewportSize({ width: 390, height: 844 });
      await checkLayout(tab, page, "after a resize to 390x844");
      await tab.close();
    }
    await page.check(browser, url, page);
    console.log(`${failures.length === before ? "ok  " : "FAIL"} ${page.name}: ${GUIDE} line ${page.line}, "${page.heading}"`);
  }
  console.log(`pages checked in Chromium in ${seconds(step)}`);
} catch (error) {
  if (failures.length === 0) failures.push(`${error.message}${error.stdout ? `\n${error.stdout}` : ""}${error.stderr ? `\n${error.stderr}` : ""}`.trim());
} finally {
  await browser?.close();
  server?.close();
  if (keep) console.log(`kept in ${work}`);
  else rmSync(work, { recursive: true, force: true });
}

if (failures.length > 0) {
  for (const failure of new Set(failures)) console.error(`- ${failure}`);
  console.error(`\nA DOM example in ${GUIDE} does not behave as the guide says in Chromium. Fix the example, or the engine.`);
  process.exit(1);
}
console.log(`docs-browser: the DOM examples of ${GUIDE} run in Chromium against the packed fenrir-ts ${engine.version} (${seconds(started)}).`);
