// Generates the API reference that ships in the package, one Markdown file per entry point, from
// the TSDoc on each exported symbol. It reads the source through the TypeScript compiler (already a
// dev dependency), so it needs no build and no other tool.
//
//   node scripts/api-reference.mjs           write skills/fenrir/api/*.md
//   node scripts/api-reference.mjs --check   fail if the committed files differ from a fresh run
//   node scripts/api-reference.mjs --report  also list exported symbols with no TSDoc
//
// For each entry it prints every export (functions, classes, constants, types) as a declaration with
// no bodies, private members or comments, followed by its documentation and `@example`s, and the
// members of interfaces and classes that carry their own docs. Names one entry re-exports from
// `fenrir-ts` are listed, not repeated. Augmentations an entry makes to core types when it is
// imported (`declare module` blocks it loads that core does not) get a section of their own.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "skills", "fenrir", "api");
const check = process.argv.includes("--check");
const report = process.argv.includes("--report");
const posix = (path) => path.replaceAll("\\", "/");

/** Each package export, its source and what the page says about it. */
const ENTRIES = [
  { name: "fenrir-ts", file: "fenrir-ts.md", source: "src/index.ts", peer: "none", note: "The core: games, systems, ECS, events, resources, states, time, input, timers and tweens, asset manifests, storage, test games and inspection." },
  { name: "fenrir-ts/2d", file: "2d.md", source: "src/2d.ts", peer: "`pixi.js`", note: "The `pixi2d` plugin, layers, the design-frame viewport, `PixiNode`, `Renderable2D` and the 2D builder methods." },
  { name: "fenrir-ts/ui", file: "ui.md", source: "src/ui.ts", peer: "`pixi.js`", note: "Controls and modal scopes on Pixi nodes the game drew, driven by the engine's input." },
  { name: "fenrir-ts/audio", file: "audio.md", source: "src/audio.ts", peer: "none", note: "Sounds, buses, the unlock policy, the `audio` asset kind and the Web Audio and test backends." },
  { name: "fenrir-ts/3d", file: "3d.md", source: "src/3d.ts", peer: "`three`", note: "Frozen: kept working, no new features. The Three renderer, camera, skybox, animation and window-level input." },
  { name: "fenrir-ts/physics", file: "physics.md", source: "src/physics.ts", peer: "`jolt-physics`, `three`", note: "Frozen: kept working, no new features. Jolt physics for the 3D path." },
  { name: "fenrir-ts/editor", file: "editor.md", source: "src/editor/index.ts", peer: "`monaco-editor`", note: "Frozen: kept working, no new features. The Monaco live code editor." },
];

const configPath = join(root, "tsconfig.json");
const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, root);
const options = { ...parsed.options, noEmit: true, skipLibCheck: true };
const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });

const undocumented = [];

/** The entry's program: only the files it reaches, so augmentations of other entries stay out. */
function programFor(source) {
  return ts.createProgram([join(root, source)], options);
}

const isPrivate = (member) =>
  ts.canHaveModifiers(member) &&
  (ts.getModifiers(member) ?? []).some((m) => m.kind === ts.SyntaxKind.PrivateKeyword || m.kind === ts.SyntaxKind.ProtectedKeyword);
const isHashPrivate = (member) => member.name && ts.isPrivateIdentifier(member.name);
const hasInternalTag = (node) => ts.getJSDocTags(node).some((tag) => tag.tagName.text === "internal");
const isExported = (node) => (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** Drops `export`, `declare` and `default` so declarations read as signatures. */
function keepModifiers(node) {
  return (ts.getModifiers(node) ?? []).filter(
    (m) => ![ts.SyntaxKind.ExportKeyword, ts.SyntaxKind.DeclareKeyword, ts.SyntaxKind.DefaultKeyword, ts.SyntaxKind.AsyncKeyword, ts.SyntaxKind.PublicKeyword].includes(m.kind),
  );
}

/** A class with its public surface only: no bodies, initializers, private or internal members. */
function stripClass(node) {
  const f = ts.factory;
  const members = [];
  const ctorCount = node.members.filter((m) => ts.isConstructorDeclaration(m)).length;
  const methodCount = new Map();
  for (const m of node.members) {
    if ((ts.isMethodDeclaration(m) || ts.isMethodSignature(m)) && m.name) {
      const key = m.name.getText();
      methodCount.set(key, (methodCount.get(key) ?? 0) + 1);
    }
  }
  for (const m of node.members) {
    if (isPrivate(m) || isHashPrivate(m) || hasInternalTag(m)) continue;
    if (m.name && /^_/.test(m.name.getText?.() ?? "")) continue;
    if (ts.isConstructorDeclaration(m)) {
      if (ctorCount > 1 && m.body) continue; // the implementation of overloads
      const params = m.parameters.map((p) =>
        f.updateParameterDeclaration(p, (ts.getModifiers(p) ?? []).filter((x) => x.kind !== ts.SyntaxKind.PrivateKeyword && x.kind !== ts.SyntaxKind.ProtectedKeyword), p.dotDotDotToken, p.name, p.questionToken, p.type, undefined),
      );
      members.push(f.updateConstructorDeclaration(m, keepModifiers(m), params, undefined));
    } else if (ts.isMethodDeclaration(m)) {
      if (m.body && (methodCount.get(m.name.getText()) ?? 0) > 1) continue;
      members.push(f.updateMethodDeclaration(m, keepModifiers(m), m.asteriskToken, m.name, m.questionToken, m.typeParameters, m.parameters.map(dropInitializer), m.type, undefined));
    } else if (ts.isPropertyDeclaration(m)) {
      members.push(f.updatePropertyDeclaration(m, keepModifiers(m), m.name, m.questionToken ?? m.exclamationToken, m.type ?? typeNodeOf(m), undefined));
    } else if (ts.isGetAccessorDeclaration(m)) {
      members.push(f.updateGetAccessorDeclaration(m, keepModifiers(m), m.name, m.parameters, m.type, undefined));
    } else if (ts.isSetAccessorDeclaration(m)) {
      members.push(f.updateSetAccessorDeclaration(m, keepModifiers(m), m.name, m.parameters, undefined));
    } else if (ts.isIndexSignatureDeclaration(m)) {
      members.push(m);
    }
  }
  return f.updateClassDeclaration(node, keepModifiers(node), node.name, node.typeParameters, node.heritageClauses, members);
}

let currentChecker;
/** A type node for a property with no annotation, from its inferred type. */
function typeNodeOf(node) {
  const type = currentChecker.getTypeAtLocation(node);
  return currentChecker.typeToTypeNode(type, node, ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.IgnoreErrors);
}

/** A parameter as a signature shows it: a default becomes `?`, a destructured one is `options`. */
const dropInitializer = (p) => {
  const name = ts.isIdentifier(p.name) ? p.name : ts.factory.createIdentifier("options");
  if (!p.initializer && name === p.name) return p;
  const optional = p.initializer ? (p.questionToken ?? ts.factory.createToken(ts.SyntaxKind.QuestionToken)) : p.questionToken;
  return ts.factory.updateParameterDeclaration(p, ts.getModifiers(p), p.dotDotDotToken, name, optional, p.type ?? typeNodeOf(p), undefined);
};

/** The declaration text of one exported declaration. */
function declarationText(node, name, checker) {
  const f = ts.factory;
  const sf = node.getSourceFile();
  const print = (n) => printer.printNode(ts.EmitHint.Unspecified, n, sf);
  if (ts.isFunctionDeclaration(node)) {
    return print(f.updateFunctionDeclaration(node, keepModifiers(node), node.asteriskToken, f.createIdentifier(name), node.typeParameters, node.parameters.map(dropInitializer), node.type ?? returnTypeNode(node, checker), undefined));
  }
  if (ts.isClassDeclaration(node)) return print(stripClass(node));
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
    const clean = ts.isInterfaceDeclaration(node)
      ? f.updateInterfaceDeclaration(node, keepModifiers(node), node.name, node.typeParameters, node.heritageClauses, node.members.filter((m) => !hasInternalTag(m)))
      : ts.isTypeAliasDeclaration(node)
        ? f.updateTypeAliasDeclaration(node, keepModifiers(node), node.name, node.typeParameters, node.type)
        : f.updateEnumDeclaration(node, keepModifiers(node), node.name, node.members);
    return print(clean);
  }
  if (ts.isVariableDeclaration(node)) {
    const type = node.type ? node.type.getText() : checker.typeToString(checker.getTypeAtLocation(node.name), node, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
    return `const ${name}: ${type};`;
  }
  if (ts.isModuleDeclaration(node)) return `namespace ${name}`;
  return print(node);
}

function returnTypeNode(node, checker) {
  const signature = checker.getSignatureFromDeclaration(node);
  if (!signature) return undefined;
  return checker.typeToTypeNode(checker.getReturnTypeOfSignature(signature), node, ts.NodeBuilderFlags.NoTruncation | ts.NodeBuilderFlags.IgnoreErrors);
}

/** The JSDoc of `node` as Markdown: summary, `@param`s, `@returns`, `@deprecated`, then `@example`s. */
function docOf(node) {
  const docs = ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
  const doc = docs.at(-1);
  if (!doc) return "";
  const text = (comment) => (typeof comment === "string" ? comment : (comment ?? []).map((part) => part.text ?? part.getText?.() ?? "").join(""));
  const out = [];
  const summary = text(doc.comment).trim();
  if (summary) out.push(summary);
  const params = [];
  const examples = [];
  for (const tag of doc.tags ?? []) {
    const name = tag.tagName.text;
    const body = text(tag.comment).trim().replace(/^- /, "");
    if (name === "param" && ts.isJSDocParameterTag(tag)) params.push(`- \`${tag.name.getText()}\`${body ? `: ${body}` : ""}`);
    else if (name === "returns" || name === "return") out.push(`Returns ${body.replace(/^./, (c) => c.toLowerCase())}`);
    else if (name === "deprecated") out.push(`**Deprecated.** ${body}`);
    else if (name === "throws") out.push(`Throws ${body.replace(/^./, (c) => c.toLowerCase())}`);
    else if (name === "remarks") out.push(body);
    else if (name === "example") examples.push(body);
    else if (name === "see") out.push(`See ${body}.`);
  }
  if (params.length) out.push(params.join("\n"));
  for (const example of examples) {
    const code = example.replace(/^```\w*\n?|```$/g, "").trimEnd();
    out.push("```ts\n" + code + "\n```");
  }
  return out.join("\n\n");
}

/** The first line of a member's doc, for the member list under an interface or class. */
function memberDocs(node) {
  const members = ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) ? node.members : [];
  const lines = [];
  const seen = new Set();
  for (const m of members) {
    if (!m.name || isPrivate(m) || isHashPrivate(m) || hasInternalTag(m)) continue;
    const name = m.name.getText();
    if (/^_/.test(name) || seen.has(name)) continue;
    const doc = docOf(m).replace(/\r\n?/g, "\n").split("\n\n")[0]?.replace(/\n/g, " ").trim();
    if (!doc) continue;
    seen.add(name);
    lines.push(`- \`${name}\`: ${doc}`);
  }
  return lines.join("\n");
}

function kindOf(node) {
  if (ts.isFunctionDeclaration(node)) return "Functions";
  if (ts.isClassDeclaration(node)) return "Classes";
  if (ts.isVariableDeclaration(node)) return "Constants";
  return "Types";
}
const KIND_ORDER = ["Functions", "Classes", "Constants", "Types"];

/** The declarations behind an export, without the `declare module` augmentations other files add. */
function declarationsOf(symbol, checker) {
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  return (target.declarations ?? []).filter((d) => {
    for (let p = d.parent; p; p = p.parent) if (ts.isModuleDeclaration(p) && ts.isStringLiteral(p.name)) return false;
    return true;
  });
}

/** `declare module "..."` blocks in `files`, as declaration text with member docs. */
function augmentationsIn(files) {
  const out = [];
  for (const sf of files) {
    ts.forEachChild(sf, (node) => {
      if (!ts.isModuleDeclaration(node) || !ts.isStringLiteral(node.name) || !node.body || !ts.isModuleBlock(node.body)) return;
      for (const statement of node.body.statements) {
        if (!ts.isInterfaceDeclaration(statement)) continue;
        const members = statement.members.filter((m) => !hasInternalTag(m));
        if (!members.length) continue;
        const clean = ts.factory.updateInterfaceDeclaration(statement, [], statement.name, statement.typeParameters, statement.heritageClauses, members);
        out.push({ name: statement.name.text, code: printer.printNode(ts.EmitHint.Unspecified, clean, sf), members: memberDocs(statement) });
      }
    });
  }
  return out;
}

const projectFiles = (program) => program.getSourceFiles().filter((sf) => !sf.isDeclarationFile && posix(sf.fileName).startsWith(posix(join(root, "src"))));
const coreProgram = programFor("src/index.ts");
const coreFiles = new Set(projectFiles(coreProgram).map((sf) => posix(sf.fileName)));
const coreExports = new Set();
{
  const checker = coreProgram.getTypeChecker();
  const moduleSymbol = checker.getSymbolAtLocation(coreProgram.getSourceFile(join(root, "src/index.ts")));
  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    const declaration = declarationsOf(symbol, checker)[0];
    if (declaration) coreExports.add(`${symbol.name}@${posix(relative(root, declaration.getSourceFile().fileName))}`);
  }
}

function renderEntry(entry) {
  const program = entry.source === "src/index.ts" ? coreProgram : programFor(entry.source);
  const checker = program.getTypeChecker();
  currentChecker = checker;
  const sourceFile = program.getSourceFile(join(root, entry.source));
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  const groups = new Map(KIND_ORDER.map((k) => [k, []]));
  const reexported = [];

  for (const symbol of checker.getExportsOfModule(moduleSymbol)) {
    const declarations = declarationsOf(symbol, checker);
    if (!declarations.length) continue;
    const first = declarations[0];
    const where = posix(relative(root, first.getSourceFile().fileName));
    if (entry.name !== "fenrir-ts" && coreExports.has(`${symbol.name}@${where}`)) {
      reexported.push(symbol.name);
      continue;
    }
    if (hasInternalTag(first)) continue;
    // A function's overloads, or a value and a type of the same name (defineComponent keys).
    const shown = declarations.filter((d) => !(ts.isFunctionDeclaration(d) && d.body && declarations.filter(ts.isFunctionDeclaration).length > 1));
    const code = [...new Set(shown.map((d) => declarationText(d, symbol.name, checker)))].join("\n");
    const doc = shown.map(docOf).find(Boolean) ?? "";
    if (!doc) undocumented.push(`${entry.name}: ${symbol.name}`);
    const members = shown.map(memberDocs).filter(Boolean).join("\n");
    const kind = KIND_ORDER.find((k) => shown.some((d) => kindOf(d) === k)) ?? "Types";
    groups.get(kind).push({ name: symbol.name, code, doc, members });
  }

  const lines = [];
  lines.push(`# \`${entry.name}\` API reference`, "");
  lines.push(`Generated from the TSDoc in the source by \`scripts/api-reference.mjs\`. Do not edit: run \`pnpm api:reference\`.`, "");
  lines.push(entry.note, "");
  lines.push(`Peer packages: ${entry.peer}. Import from \`${entry.name}\` only, never from \`dist/\` or a source path.`, "");
  const extraFiles = projectFiles(program).filter((sf) => !coreFiles.has(posix(sf.fileName)));
  const augmentations = entry.name === "fenrir-ts" ? [] : augmentationsIn(extraFiles);

  const toc = [];
  for (const kind of KIND_ORDER) {
    const items = groups.get(kind).sort((a, b) => a.name.localeCompare(b.name, "en"));
    if (items.length) toc.push(`- ${kind}: ${items.map((i) => `[\`${i.name}\`](#${anchor(i.name)})`).join(", ")}`);
  }
  if (augmentations.length) toc.push(`- [Added to core types when imported](#added-to-core-types-when-imported)`);
  if (reexported.length) toc.push(`- Re-exported from \`fenrir-ts\`: ${reexported.sort().map((n) => `\`${n}\``).join(", ")}`);
  lines.push("## Contents", "", ...toc, "");

  for (const kind of KIND_ORDER) {
    const items = groups.get(kind);
    if (!items.length) continue;
    lines.push(`## ${kind}`, "");
    for (const item of items) {
      lines.push(`### ${item.name}`, "", "```ts", item.code.trim(), "```", "");
      if (item.doc) lines.push(item.doc, "");
      if (item.members) lines.push("Members:", "", item.members, "");
    }
  }
  if (augmentations.length) {
    lines.push("## Added to core types when imported", "");
    lines.push(`Importing \`${entry.name}\` adds these members to core types for the whole program.`, "");
    for (const a of augmentations) {
      lines.push(`### ${a.name}`, "", "```ts", a.code.trim(), "```", "");
      if (a.members) lines.push(a.members, "");
    }
  }
  // A source checked out with CRLF line endings must give the same page as one with LF.
  return machineIndependent(lines.join("\n")).replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

/**
 * The same page on every machine: LF line endings, and no checkout paths in inferred types
 * (`import("/abs/node_modules/.pnpm/x@1/node_modules/x/y")` becomes `import("x/y")`).
 */
function machineIndependent(text) {
  const base = posix(root).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text
    .replace(/\r\n?/g, "\n")
    .replace(new RegExp(`${base}/node_modules/\\.pnpm/[^/"]+/node_modules/`, "gi"), "")
    .replace(new RegExp(`${base}/node_modules/`, "gi"), "")
    .replace(new RegExp(`${base}/`, "gi"), "");
}

/** GitHub-style heading anchor. */
function anchor(text) {
  return text.toLowerCase().replace(/[^a-z0-9 _-]/g, "").replace(/ /g, "-");
}

function renderIndex() {
  const lines = ["# Fenrir API reference", "", "Generated by `scripts/api-reference.mjs` from the TSDoc in the source. One page per entry point:", ""];
  for (const entry of ENTRIES) lines.push(`- [\`${entry.name}\`](${entry.file}): ${entry.note}`);
  return lines.join("\n") + "\n";
}

const outputs = new Map();
for (const entry of ENTRIES) outputs.set(entry.file, renderEntry(entry));
outputs.set("README.md", renderIndex());

if (report && undocumented.length) {
  console.log(`Exported symbols with no TSDoc (${undocumented.length}):\n${undocumented.join("\n")}`);
}

const normalise = (text) => text.replaceAll("\r\n", "\n");
if (check) {
  const stale = [];
  for (const [file, text] of outputs) {
    const path = join(outDir, file);
    if (!existsSync(path)) {
      stale.push(file);
      continue;
    }
    const committed = normalise(readFileSync(path, "utf8"));
    if (committed === text) continue;
    stale.push(file);
    // Show where it differs, so a failure on another platform can be read from the CI log.
    const a = committed.split("\n");
    const b = text.split("\n");
    const at = a.findIndex((line, i) => line !== b[i]);
    console.error(`${file}: first difference at line ${at + 1}`);
    for (let i = Math.max(0, at - 2); i < Math.min(Math.max(a.length, b.length), at + 4); i++) {
      if (a[i] !== b[i]) console.error(`  - ${a[i] ?? "(end)"}\n  + ${b[i] ?? "(end)"}`);
    }
  }
  const extra = existsSync(outDir) ? readdirSync(outDir).filter((file) => !outputs.has(file)) : [];
  if (stale.length || extra.length) {
    console.error(`The API reference in skills/fenrir/api/ is stale: ${[...stale, ...extra.map((f) => `${f} (not generated)`)].join(", ")}.`);
    console.error("Run `pnpm api:reference` and commit skills/fenrir/api/.");
    process.exit(1);
  }
  console.log(`API reference is current (${outputs.size} files).`);
} else {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const [file, text] of outputs) writeFileSync(join(outDir, file), text);
  console.log(`Wrote ${outputs.size} files to ${posix(relative(root, outDir))}/.`);
}
