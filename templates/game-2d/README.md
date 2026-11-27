# Fenrir game

A 2D browser game on [Fenrir](https://www.npmjs.com/package/fenrir-ts): tap to start, then tap the star as often as you can in ten seconds.

```sh
npm install
npm run dev          # play it at http://localhost:5173
npm test             # headless tests (Vitest)
npm run build        # type-check and build into dist/
npx playwright install chromium   # once
npm run test:e2e     # browser test (Playwright)
```

Gameplay is in `src/game.ts` and runs headless in `tests/`; drawing is in `src/main.ts`. The engine's guide for this code ships in the package: `node_modules/fenrir-ts/skills/fenrir/SKILL.md`. `AGENTS.md` points coding agents at it.

`fenrir-ts` is pinned to `~0.x.y`: at 0.x a minor version can break. Read `node_modules/fenrir-ts/CHANGELOG.md` before upgrading.
