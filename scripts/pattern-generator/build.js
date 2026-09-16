#!/usr/bin/env node
// Bundle the pattern engine and this project's Affinity code into one script.
//
// Affinity's script library takes a single file, and the engine is seventeen ES
// modules in a sibling repo, so esbuild flattens the lot into
// pattern_generator.js, which is the file you install or paste. Two things need
// special handling:
//
//   * `pattern-engine` resolves to the sibling repo's graph module — it is not
//     an npm package, so the path is stitched in here rather than installed.
//   * `node:fs` does not exist in Affinity. Only the TrueType reader wants it,
//     and only for `letter` / `word`, which no catalogue pattern uses; it gets
//     a stub that reports the limitation rather than crashing the script.
//
// Affinity's own modules (`/document.js`, `affinity:common`) stay as live
// `require` calls: src/sdk.js reaches them through an alias esbuild ignores.

const path = require("node:path");
const fs = require("node:fs");
const esbuild = require("esbuild");

const ROOT = __dirname;
// ../../.. is the repo root, so the engine is looked for beside the repo.
const ENGINE = process.env.PATTERN_ENGINE
  ?? path.resolve(ROOT, "../../../pattern-generator/src/graph.js");
// `--entry smoke` builds the headless test instead of the real script.
const entryName = flag("--entry") ?? "main";
const OUT = path.resolve(ROOT, flag("--out")
  ?? (entryName === "main" ? "pattern_generator.js" : `${entryName}_test.js`));

function flag(name) {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

if (!fs.existsSync(ENGINE)) {
  console.error(
    `Cannot find the pattern engine at:\n  ${ENGINE}\n\n` +
    `Check out the pattern-generator project beside this repo, or point ` +
    `PATTERN_ENGINE at its src/graph.js.`);
  process.exit(1);
}

const FS_STUB = `
export function readFileSync() {
  throw new Error(
    "Font loading is not available in Affinity scripts, so the letter and " +
    "word nodes cannot be used here.");
}
export default { readFileSync };
`;

/** Point bare specifiers at the engine, and stub what Affinity has no use for. */
const resolvePlugin = {
  name: "pattern-resolve",
  setup(build) {
    build.onResolve({ filter: /^pattern-engine$/ }, () => ({ path: ENGINE }));
    build.onResolve({ filter: /^node:fs$/ }, (args) => ({ path: args.path, namespace: "fs-stub" }));
    build.onLoad({ filter: /.*/, namespace: "fs-stub" }, () => ({ contents: FS_STUB, loader: "js" }));
  },
};

esbuild.build({
  entryPoints: [path.resolve(ROOT, `src/${entryName}.js`)],
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "es2022",
  outfile: OUT,
  plugins: [resolvePlugin],
  banner: {
    js: "// Pattern Generator for Affinity — GENERATED, do not edit.\n" +
        "// Source: scripts/pattern-generator/src/*.js plus the pattern-generator engine.\n" +
        "// Rebuild with: node scripts/pattern-generator/build.js\n",
  },
  legalComments: "none",
  logLevel: "info",
}).then(() => {
  const bytes = fs.statSync(OUT).size;
  console.log(`\n${path.relative(process.cwd(), OUT)}  (${(bytes / 1024).toFixed(1)} kB)`);
  if (entryName === "main") {
    console.log(
      `Install with:\n  node script_mgr.js add --title "Pattern Generator" ` +
      `--description "Generative patterns as editable Affinity curves" ` +
      `--file scripts/pattern-generator/pattern_generator.js`);
  }
}).catch(() => process.exit(1));
