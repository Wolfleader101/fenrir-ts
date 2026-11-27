// Checks that this commit is ready to publish as the version in package.json:
// CHANGELOG.md has a "## <version>" section with notes, and nothing waits under
// "## Unreleased" (it would ship without being in any release's notes).
//
//   node scripts/check-release.mjs          the release workflow's dry run
//   node scripts/check-release.mjs v0.2.0   also checks the tag names this version
//   ... --notes <file>                       and writes the version's notes there (the GitHub release)
// See RELEASING.md.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const changelog = readFileSync(join(root, "CHANGELOG.md"), "utf8").replaceAll("\r\n", "\n");
const args = process.argv.slice(2);
const notesAt = args.indexOf("--notes");
const notesFile = notesAt >= 0 ? args.splice(notesAt, 2)[1] : undefined;
if (notesAt >= 0 && !notesFile) {
  console.error("--notes needs a file path.");
  process.exit(1);
}
const tag = args[0];
const failures = [];

if (!/^\d+\.\d+\.\d+$/.test(version)) failures.push(`package.json "version" is "${version}", not MAJOR.MINOR.PATCH.`);
if (tag !== undefined && tag !== `v${version}`) {
  failures.push(`the tag is "${tag}", but package.json is at ${version}: tag v${version}, or bump the version first.`);
}

/** The body of the "## <title>" section, up to the next "## " heading, or undefined. */
const section = (title) => {
  const lines = changelog.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start < 0) return undefined;
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n").trim();
};

const notes = section(version);
if (notes === undefined) failures.push(`CHANGELOG.md has no "## ${version}" section.`);
else if (notes === "") failures.push(`CHANGELOG.md's "## ${version}" section is empty.`);
const unreleased = section("Unreleased");
if (unreleased) {
  failures.push(`CHANGELOG.md has entries under "## Unreleased". Move them into "## ${version}" (or a new version) before tagging.`);
}

if (failures.length > 0) {
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}
if (notesFile) writeFileSync(notesFile, `${notes}
`);
console.log(`release: ${tag ?? "(no tag given)"} publishes fenrir-ts@${version}, with notes in CHANGELOG.md.`);
