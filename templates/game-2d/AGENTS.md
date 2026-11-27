# AGENTS.md

This game is built on the Fenrir engine (`fenrir-ts`). Before writing or changing game code, read
`node_modules/fenrir-ts/skills/fenrir/SKILL.md` and follow it. Look up names and options in
`node_modules/fenrir-ts/skills/fenrir/api/` instead of guessing, and the rules for a service in
`node_modules/fenrir-ts/skills/fenrir/references/`.

## Layout

- `src/game.ts`: gameplay (components, resources, states, systems), with no Pixi, so it runs in tests. New gameplay goes here or in modules it imports, registered from `addGameplay`.
- `src/main.ts`: the browser entry: `pixi2d`, loading art, giving entities their Pixi nodes, the HUD.
- `tests/`: Vitest, headless, with `createTestGame` and `game.step`. Assert on `inspect(game)` and resources, never on time or pixels.
- `e2e/`: Playwright against the built game, reading `window.__FENRIR__.inspect()`.
- `public/`: files served as-is, such as `public/star.png` (loaded as `"star.png"`). Textures are `.png`, `.jpg`, `.webp`, `.gif` or `.bmp`.

## Commands

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # headless tests
npm run type-check
npm run build        # type-check and production build into dist/
npx playwright install chromium   # once, for the browser test
npm run test:e2e     # browser test against a build
```

## Before you finish

- `npm run type-check`, `npm test` and `npm run build` pass. Run `npm run test:e2e` when you changed what the page loads or draws.
- New gameplay has a headless test in `tests/` that drives input with `game.input` and frames with `game.step`.
- Names are namespaced (`game.Health`); `fenrir.` is the engine's.
