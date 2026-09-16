# Pattern Generator

Generates vector patterns in Affinity as **native editable curves** — real paths
in a named group, not a placed image or an embedded picture.

Eleven generative designs, five aspect ratios, and a dialog for the parameters
of whichever design you pick.

- **Library title:** `Pattern Generator`
- **File to install:** [`pattern_generator.js`](pattern_generator.js)
- **Current version:** 1.0.0
- **Tested against:** Affinity 3.2 (April 2026)

---

## Version history

### 1.0.0 — 2026-09-16

First release.

- Eleven patterns: Flow Lines, Flow Dots, Truchet Arcs, Noise Field, Subdivide,
  Concentric Noise Rings, Organic Cells, Packed Blocks, Isometric Lattice,
  Isometric City, Mesh Weave.
- Aspect ratios 1:1, 2:3, 3:4, 9:16, and Artboard (the current canvas).
- Stroke, fill and background colour pickers; optional background rectangle.
- Output is one named group, e.g. `Flow Lines 2:3`, added as a single undo step.
- Shapes sharing a colour and stroke weight are merged into one curve object;
  patterns that rely on paint order are never merged.

---

## Dependencies

The short answer: **to run it, none.** `pattern_generator.js` is a self-contained
bundle — the whole pattern engine is compiled into it. That is why pasting the
file into the Scripts panel works with nothing else installed.

Everything else is only needed to *rebuild* the file or to install it over MCP.

### To run the script — nothing beyond Affinity

The bundle calls eleven modules that ship inside Affinity itself:

| Module | Used for |
|---|---|
| `/application.js` | `app.alert` |
| `/document.js` | the current document, its size, executing commands |
| `/dialog.js` | the whole dialog |
| `/colours.js` | building colours from RGB |
| `/fills.js` | solid and empty fills |
| `/linestyle.js` | stroke weight |
| `/geometry.js` | `CurveBuilder`, `PolyCurve` |
| `/nodes.js` | `PolyCurveNodeDefinition`, `ContainerNodeDefinition` |
| `/commands.js` | `AddChildNodesCommandBuilder`, `CompoundCommandBuilder` |
| `/units.js` | dialog unit types |
| `affinity:common` | `BlendMode` |

It reads no files, opens no network connections, and needs no AI or filesystem
permission. It does need **a document open** — it will tell you so if there isn't.

### To rebuild `pattern_generator.js`

| Dependency | Why | Where from |
|---|---|---|
| Node.js | runs the build | any recent version |
| `esbuild` | bundles 17 engine modules + 8 of ours into one file | `npm install` at the repo root |
| the `pattern-generator` project | the pattern engine itself | must sit beside this repo, or set `PATTERN_ENGINE` |

The engine is a separate, dependency-free ES-module project. The build pulls in
`src/graph.js` and everything it imports — `rng.js`, `expr.js`, `geom.js`,
`font.js`, and the ten `src/nodes/*.js` modules.

`src/font.js` imports `node:fs`, which does not exist in Affinity. The build
replaces it with a stub that raises a clear error, so the engine's `letter` and
`word` nodes cannot be used here. No pattern in the catalogue uses them.

### To install over MCP instead of pasting

| Dependency | Why |
|---|---|
| `@modelcontextprotocol/sdk` | `npm install` at the repo root |
| The Affinity AI connector, enabled | `script_mgr.js` talks to it on `localhost:6767` |

---

## Installing

### Option A — paste it (no dependencies)

1. Open [`pattern_generator.js`](pattern_generator.js) and copy the whole file.
2. In Affinity, open **Window > General > Scripts**.
3. Add a new script, paste, and name it `Pattern Generator`.

### Option B — install over MCP

Needs the Affinity connector enabled and `npm install` done at the repo root.

```bash
node script_mgr.js add --title "Pattern Generator" --description "Generative patterns as editable Affinity curves" --file scripts/pattern-generator/pattern_generator.js
```

### Then

Open a document and run **Pattern Generator** from the Scripts panel. There is no
build step unless you want to change the script — `pattern_generator.js` is
committed ready to use.

---

## Sharing it

`pattern_generator.js` is the whole thing. Send that one file and the recipient
pastes it into their Scripts panel — they need Affinity 3.2 and nothing else. No
build, no `npm install`, no connector, no sibling repo.

If you are sharing the *source* rather than the script, they will also need the
`pattern-generator` engine project beside the repo before `build.js` will run.

**Note:** Affinity's MCP cannot delete a library script. Remove old versions by
hand in the Scripts panel before installing a new one under the same title — and
`script_mgr.js add` refuses a title that already exists.

---

## Using it

| Control | What it does |
|---|---|
| **Design** | Which of the eleven patterns to build. Its own parameters appear below. |
| **Aspect ratio** | 1:1, 2:3, 3:4, 9:16, or **Artboard** — the proportions *and* size of the current artboard, or of the spread if the document has none. |
| **Long edge** | The longer side in pixels; the shorter follows from the ratio. Disabled for Artboard, which brings its own size. |
| *pattern parameters* | Spacing, stroke width, seed, and so on. Every pattern has a seed: change it for a different roll of the same design. |
| **Stroke / Fill / Background** | The engine paints through CSS variables rather than fixed colours, so these are resolved as the curves are built. Background is also the colour that occluding faces are filled with. |
| **Draw background rectangle** | Off by default, so the pattern drops onto whatever is already there. |
| **One object per shape** | Off by default. See *Merging* below. |

The readout at the bottom tells you how many shapes and how many curve objects
you are about to get, and the name of the group.

The result is one group named after the pattern and the ratio — `Flow Lines 2:3`
— centred on the page, or placed on the artboard when the ratio came from it.
It arrives as a single undo step.

---

## How it works

Affinity's SDK has **no SVG import**, so nothing can be handed over as an SVG
file. The geometry is rebuilt as real Affinity curves instead, in four stages.

### 1. Build a graph for this canvas — `src/catalogue.js`

The engine evaluates a typed node graph. Each catalogue entry is a
`build(width, height, params)` that returns one, composed **for the chosen
canvas** rather than scaled from a fixed square: counts come from spacing, radii
from the short edge, fields from a domain. A 9:16 canvas gets a pattern designed
for 9:16, not a squashed 1:1.

The isometric patterns get their own sizing. A 2:1 isometric projection turns a
square lattice into a diamond that is always √3 times wider than it is tall, so
the lattice is sized to **cover** the canvas and the corners that spill past the
frame are dropped later.

### 2. Render to SVG — the engine

`render(graph)` walks the graph in topological order and returns an SVG string.
Everything is deterministic: a seeded generator, no `Math.random`, no clock. The
same settings always produce the same pattern.

### 3. Flatten the SVG — `src/svg-to-shapes.js`

Not a general SVG reader — the engine emits a known subset: `g` with a
transform, `circle`, `ellipse`, `rect`, `line`, `polyline`, `polygon`, `path`.
Each becomes line and cubic segments with the group transforms already applied,
because an affine transform maps a cubic's control points directly. That single
pass removes the whole group hierarchy. Arcs, quadratics and rounded corners are
converted to cubics on the way.

Colours are resolved here too (`src/paint.js`). The engine paints through four
CSS variables — `--stroke-color`, `--fill-color`, `--occlusion-color`,
`--bg-color` — which map onto the dialog's pickers.

### 4. Build the curves — `src/shapes-to-affinity.js`

Each path is replayed into a `CurveBuilder` (`lineToXY`, `addBezierXY`,
`close`), collected into `PolyCurve`s, wrapped in `PolyCurveNodeDefinition`s,
and added inside a `ContainerNodeDefinition` as one compound command.

### Merging

By default, every shape sharing a colour and stroke weight is merged into a
single curve object. A pattern of sixteen thousand dots becomes one object
rather than sixteen thousand layers — the difference between a usable layer
panel and an unusable one. Visually it is identical, because same-coloured
overlapping shapes look the same merged.

**Patterns that occlude are never merged**, whatever the switch says. Isometric
cubes hide the ones behind them by being painted over them, and objects merged
into one lose that order. The script detects shapes filled with the sheet colour
and builds them separately; the dialog tells you when this happens.

### Trimming

Shapes falling entirely outside the canvas are dropped, so an isometric lattice
covering a portrait frame does not leave hundreds of curve objects off the page.
Shapes straddling an edge are kept whole, so a group can overhang slightly —
mask it in Affinity if you need a hard edge.

---

## Working on it

```bash
npm install                                    # once, at the repo root
node scripts/pattern-generator/build.js        # rebuild pattern_generator.js
```

`pattern_generator.js` is **generated**. Edit `src/*.js` and rebuild; do not
hand-edit the bundle.

| File | What's in it |
|---|---|
| `src/main.js` | entry point: dialog loop, generate, execute the command |
| `src/catalogue.js` | the eleven patterns and their parameters |
| `src/aspect.js` | aspect ratios and canvas sizing |
| `src/ui.js` | dialog construction and reading values back |
| `src/svg-to-shapes.js` | SVG subset → transformed paths, plus trimming |
| `src/paint.js` | CSS variables and literals → RGB |
| `src/shapes-to-affinity.js` | paths → `PolyCurve` node definitions |
| `src/sdk.js` | the one place that touches Affinity's own modules |
| `src/smoke.js` | the test entry point (not shipped) |
| `build.js` | esbuild bundling |

### Testing

`src/smoke.js` drives every pattern at every ratio through render, parse and
curve building, checks the dialog constructs and reads its values back, and lays
four patterns across the page to look at. It skips `runModal()`, which would
block an automated run.

```bash
node scripts/pattern-generator/build.js --entry smoke
node run_script.js --file scripts/pattern-generator/smoke_test.js --render out/smoke.jpg
```

It adds groups to the current document, so run it on a scratch one. `smoke_test.js`
is generated and git-ignored.

### Adding a pattern

Add an entry to `src/catalogue.js`:

```js
{
  id: "my-pattern",
  label: "My Pattern",
  note: "One line describing it, shown in the dialog.",
  params: [
    num("spacing", "Spacing", 40, 6, 400),
    num("strokeWidth", "Stroke width", 1, 0.1, 20),
  ],
  build: (w, h, p) => ({ nodes: [...], connections: [...] }),
}
```

`params` drives the dialog and arrives as `p`; `seed` is added for you. Size the
graph from `w` and `h` so it adapts to every aspect ratio. Run `node cli.js --list`
in the engine project to see all 103 node types, and read `examples/patterns.js`
there for graphs to start from.

---

## Known limits

- The engine's `letter` and `word` nodes need font files, which Affinity scripts
  cannot read. No catalogue pattern uses them.
- Trimming only drops shapes that are *entirely* off-canvas, so a group can
  overhang its frame slightly.
- *One object per shape* above ~1500 objects is refused with a warning; Affinity
  becomes very slow past that.
