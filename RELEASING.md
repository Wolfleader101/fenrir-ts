# Releasing fenrir-ts

One package, one version, released from a tag. There is no Changesets and no release bot: every PR already writes its notes in `CHANGELOG.md` under `## Unreleased`, so a release only names the version and tags it.

A tag does not publish: the workflow **stages** the version on npm (`npm stage publish`), and it reaches users only when a maintainer approves it with 2FA. No workflow run, stray tag or leaked CI credential can ship a version on its own ([staged publishing](https://docs.npmjs.com/staged-publishing)).

## Versions

Fenrir is at 0.x until its API is declared stable:

- A release with any breaking change bumps the **minor** version: 0.2.0 to 0.3.0.
- Any other release bumps the **patch**: 0.2.0 to 0.2.1.

`CHANGELOG.md` lists every breaking change with a migration line, as `AGENTS.md` asks of each PR. Peers follow the same rule: moving to a new Pixi major (the `pixi.js` peer range in `package.json`) is a breaking change.

## Every PR

Add its notes under `## Unreleased` in `CHANGELOG.md`, as before. Nothing else.

## Making a release

1. **Release PR.** On a branch from `main`:
   - Set the version: `npm version 0.3.0 --no-git-tag-version` (or edit `package.json`).
   - In `CHANGELOG.md`, rename the content of `## Unreleased` into a new `## 0.3.0` section below it, and leave `## Unreleased` empty.
   - `pnpm check:release v0.3.0` passes. Merge the PR once CI is green.
2. **Dry run (optional).** Actions → Release → Run workflow, on `main`. It runs CI, packs, runs `npm stage publish --dry-run` (as a throwaway prerelease when the version is already on npm), and shows the release notes a tag would get in the run summary. It cannot stage or publish.
3. **Tag `main`.** Only the owner pushes tags:
   ```sh
   git switch main && git pull --ff-only
   git tag -a v0.3.0 -m "fenrir-ts 0.3.0"
   git push origin v0.3.0
   ```
4. **The Release workflow stages it.** On the tag it runs every CI step, checks the tag names `package.json`'s version, the tagged commit is on `main` and `CHANGELOG.md` has the notes, builds, runs `check:package` and runs `npm stage publish`, authenticated by npm trusted publishing. Approve the `npm` environment first if it has a required reviewer.
5. **Approve it on npm, with 2FA.** npmjs.com → fenrir-ts → **Staged Packages** → Approve. Or from a terminal (npm 11.15.0 or later):
   ```sh
   npm stage list fenrir-ts          # shows the stage id
   npm stage approve <stage-id>      # asks for the 2FA code
   ```
   Approval publishes it and moves `latest` to it. To drop a staged version instead: `npm stage reject <stage-id>`.
6. **Publish the GitHub release.** A last job made it from the tag as a **draft**, titled `fenrir-ts 0.3.0`, with the `## 0.3.0` section of `CHANGELOG.md` as its notes, so it never announces a version users cannot install yet. Publish the draft on GitHub once step 5 is done. (It skips a release that already exists, and is not a draft if the version was already on npm.)
7. **Verify** (see below).

A tag whose version is already on npm stages nothing and only makes its GitHub release (the run says so).

## If something goes wrong

- **The workflow fails before `npm stage publish`, or you reject the staged version**: nothing was published. Fix it on `main` in a PR, delete the tag (`git push origin :refs/tags/v0.3.0`, then `git tag -d v0.3.0`), and tag the fixed commit. Delete the draft GitHub release too, if one was made.
- **The tag was pushed twice while the version waits for approval**: the second run fails at `npm stage publish` (the version is already staged, and a run cannot see staged versions). Approve or reject the first one.
- **A bad version was published**: do not move the tag or unpublish. `npm deprecate fenrir-ts@0.3.0 "<why, and which version to use>"`, then release a fix as the next patch.

## Verifying a release

```sh
npm view fenrir-ts@0.3.0 version dist.tarball   # it exists
mkdir /tmp/fenrir-check && cd /tmp/fenrir-check && npm init -y >/dev/null
npm install fenrir-ts@0.3.0 pixi.js              # no peer warnings
node --input-type=module -e "import('fenrir-ts').then(m => console.log(Object.keys(m).length, 'exports')); import('fenrir-ts/2d')"
npm audit signatures                             # the registry signature and provenance attestation verify
cd /tmp && npx fenrir-ts@0.3.0 create fenrir-starter && cd fenrir-starter
npm install && npm test && npm run build         # the starter game installs this version and passes
```

For a version staged by the workflow, the package page on npmjs.com should show a "Provenance" section linking to the workflow run and commit. npm's docs do not say whether provenance survives staging, so check this on the first release staged from CI. 0.2.0 has none: it was staged by hand.

## One-time setup (owner)

Trusted publishing (npm's OIDC exchange with GitHub Actions, no stored token) can only be configured for a package that already exists on the registry ([`npm trust`](https://docs.npmjs.com/cli/v11/commands/npm-trust): "Package must exist"). So the first version was staged by hand, and every later one is staged by the workflow.

1. **npm account with two-factor authentication** (an authenticator app or security key) on npmjs.com. Publishing requires it.
2. **First publish, by hand** (done for 0.2.0), from a clean checkout of `main`:
   ```sh
   git switch main && git pull --ff-only && git status   # clean
   pnpm install --frozen-lockfile
   npm login
   npm publish --access public   # prepublishOnly runs the tests, build:lib and check:package
   ```
   npm staged it, published a `0.0.0-stage` placeholder for the new name, and 0.2.0 went live once approved under Staged Packages (step 5 above). The placeholder stays in the version list; `latest` moved to 0.2.0. This version has no provenance (provenance needs a CI build); later ones do. If npm rejects the name as too similar to an existing package, nothing was published: publish under a scope instead (`@<your-npm-user>/fenrir-ts`, with `--access public`), which changes every import path, so ask an agent for that rename across `package.json`, the docs and the checks first.
3. **Tag that commit on `main`**, after approving it (`git tag -a v0.2.0 -m "fenrir-ts 0.2.0" <commit> && git push origin v0.2.0`). The Release workflow runs CI and, seeing the version on npm, stages nothing, then makes the (published) GitHub release for 0.2.0. A tag on a commit that is not on `main` fails the run.
4. **Add the trusted publisher**: npmjs.com → fenrir-ts → Settings → Trusted publishing → GitHub Actions. Owner `Wolfleader101`, repository `fenrir-ts`, workflow `release.yml`, environment `npm`. Every field must match exactly ([trusted publishers](https://docs.npmjs.com/trusted-publishers)). Under **Allowed actions**, leave it at staging only (the default for new configurations): the workflow never runs `npm publish`.
5. **Create the `npm` environment** in the GitHub repository (Settings → Environments → New environment → `npm`): deployment branches and tags → selected → tag pattern `v*.*.*`. Optionally add yourself as a required reviewer.
6. **Disallow tokens**: npmjs.com → fenrir-ts → Settings → Publishing access → "Require two-factor authentication and disallow tokens". Trusted publishing keeps working.
7. **Optional**: a tag ruleset (Settings → Rules → Rulesets) so only you can create `v*` tags.

### Token fallback

If trusted publishing is unavailable, the workflow uses an `NPM_TOKEN` secret on the `npm` environment instead: a granular access token from npmjs.com (Access Tokens → Generate New Token → Granular), read and write on `fenrir-ts` only, with "bypass two-factor authentication" ticked and the shortest expiry that works. Staging takes any token type, and approval still needs your 2FA. This only works while the package allows tokens (step 6 turns that off), and the token must be rotated before it expires. Remove the secret once trusted publishing works.

## When the repository moves

`repository.url` in `package.json` is the source; `homepage` and `bugs.url` must be built from it, and `pnpm check:package` fails until all three agree. Also update the trusted publisher's owner and repository on npmjs.com, and the clone URL in `README.md` and the `RELEASING.md` link in `CHANGELOG.md`. Provenance checks that `repository.url` matches the repository that published.
