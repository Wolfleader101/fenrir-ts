// How the docs checks find code in Markdown. `check:docs` compiles every block this returns, and
// `check:docs-browser` runs the guide's DOM blocks from it, so both read the same code.

/**
 * The ```ts (or ```typescript) blocks of a Markdown text, in order. `start` is the 0-based line
 * of the opening fence, `heading` the nearest `#` heading above it, and `code` the lines between
 * the fences.
 * @param {string} text
 * @returns {{ start: number, heading: string, code: string[] }[]}
 */
export function codeBlocks(text) {
  const lines = text.split(/\r?\n/);
  const blocks = [];
  let heading = "";
  let start = -1;
  let otherFence = false; // inside a block in another language, whose `#` lines are not headings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (otherFence) {
      if (line === "```") otherFence = false;
    } else if (start === -1 && /^```(ts|typescript)$/.test(line)) {
      start = i;
    } else if (start !== -1 && line === "```") {
      blocks.push({ start, heading, code: lines.slice(start + 1, i) });
      start = -1;
    } else if (start === -1 && line.startsWith("```")) {
      otherFence = true;
    } else if (start === -1 && /^#+\s/.test(line)) {
      heading = line.replace(/^#+\s+/, "");
    }
  }
  return blocks;
}

/**
 * Splits a block into its `// --- name ---` sections (the guide shows several files in one block
 * that way). A block without markers is one section named "". `offset` is the section's first
 * line within the block.
 * @param {string[]} code
 * @returns {{ name: string, offset: number, code: string[] }[]}
 */
export function sections(code) {
  const found = [];
  code.forEach((line, offset) => {
    const marker = /^\/\/ --- (.+?) ---/.exec(line);
    if (marker || found.length === 0) found.push({ name: marker ? marker[1] : "", offset, code: [] });
    found[found.length - 1].code.push(line);
  });
  return found;
}
