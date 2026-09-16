// The patterns offered in the dialog.
//
// Each entry builds its graph from the canvas size rather than carrying fixed
// dimensions, so a pattern fills a 9:16 canvas as honestly as a square one:
// counts come from spacing, radii from the short edge, fields from a domain.
// `params` drives the dialog, and its values arrive as `p`.

const node = (id, type, inputs = {}) => ({ id, type, inputs });
const wire = (from, fromPort, to, toPort) => ({
  source: { nodeId: from, portId: fromPort },
  target: { nodeId: to, portId: toPort },
});

const RENDER = { FILL: 0, STROKE: 1, BOTH: 2 };
const FACE = { OFF: 0, FILL: 1, STROKE: 2, BOTH: 3 };

// Param shorthands. `int` rounds in the dialog; `num` keeps decimals.
const int = (key, label, def, min, max) => ({ key, label, def, min, max, kind: "int" });
const num = (key, label, def, min, max, precision = 2) =>
  ({ key, label, def, min, max, kind: "num", precision });

/** Whole cells across a span, never fewer than one. */
const fit = (span, spacing) => Math.max(1, Math.round(span / spacing));

// A 2:1 isometric projection turns a square lattice into a diamond that is
// always cos(30)/0.5 times wider than it is tall, so a square canvas runs out
// of width long before it runs out of height.
const ISO_RATIO = Math.cos(Math.PI / 6) / 0.5;

/**
 * Side of the square isometric lattice that covers a canvas.
 *
 * Covering, not fitting: a diamond that fits inside a rectangle leaves most of
 * it empty, which does not read as a pattern. The corners that spill past the
 * frame are dropped later by `trimToCanvas`.
 */
function isoCover(w, h, spacing) {
  const span = Math.max(w / (ISO_RATIO * spacing), h / spacing);
  return Math.max(2, Math.ceil(span) + 1);
}

export const PATTERNS = [
  {
    id: "flow-lines",
    label: "Flow Lines",
    note: "Evenly spaced streamlines through a vector field.",
    params: [
      num("separation", "Line spacing", 0.186, 0.02, 1, 3),
      num("stopDistance", "Break distance", 0.036, 0.005, 0.5, 3),
      num("a", "Field warp A", 1.1, -4, 4),
      num("b", "Field warp B", 0.25, -4, 4),
      num("domain", "Field zoom", 5, 0.5, 20, 2),
      int("maxLines", "Max lines", 220, 10, 2000),
      num("strokeWidth", "Stroke width", 1, 0.1, 20),
    ],
    build: (w, h, p) => ({
      nodes: [
        node("field", "flow-lines", {
          fieldX: "cos(cos(y) - a * x * y)",
          fieldY: "x + b * sin(y)",
          a: p.a, b: p.b,
          width: w, height: h, domain: p.domain,
          separation: p.separation, stopDistance: p.stopDistance,
          simplify: 0.2, minLength: 0.4, maxLines: p.maxLines, seed: p.seed,
        }),
        node("pen", "polyline", { strokeWidth: p.strokeWidth }),
        node("sheet", "compose", {}),
        node("out", "canvas", { width: w, height: h }),
      ],
      connections: [
        wire("field", "groups", "pen", "points"),
        wire("pen", "svg", "sheet", "items"),
        wire("sheet", "svg", "out", "svg"),
      ],
    }),
  },

  {
    id: "flow-dots",
    label: "Flow Dots",
    note: "The same field, sampled as dots along each streamline.",
    params: [
      num("separation", "Line spacing", 0.12, 0.02, 1, 3),
      num("dotSpacing", "Dot spacing", 0.09, 0.01, 0.5, 3),
      num("radius", "Dot radius", 1.6, 0.2, 20),
      num("a", "Field warp A", 0.45, -4, 4),
      num("b", "Field warp B", 1.3, -4, 4),
      num("domain", "Field zoom", 4.5, 0.5, 20, 2),
      int("maxLines", "Max lines", 260, 10, 2000),
    ],
    build: (w, h, p) => ({
      nodes: [
        node("field", "flow-lines", {
          fieldX: "sin(y) - a * x", fieldY: "cos(x * b) + y * 0.2",
          a: p.a, b: p.b,
          width: w, height: h, domain: p.domain,
          separation: p.separation, stopDistance: 0.03, dotSpacing: p.dotSpacing,
          minLength: 0.5, maxLines: p.maxLines, seed: p.seed,
        }),
        node("unpack", "unpack-points", {}),
        node("dot", "circle", { radius: p.radius, renderMode: RENDER.FILL }),
        // The fan only has to be long enough; surplus copies get no position.
        node("fan", "repeat", { count: 20000 }),
        node("sheet", "compose", {}),
        node("out", "canvas", { width: w, height: h }),
      ],
      connections: [
        wire("dot", "svg", "fan", "svg"),
        wire("fan", "items", "sheet", "items"),
        wire("field", "points", "unpack", "points"),
        wire("unpack", "x", "sheet", "x"),
        wire("unpack", "y", "sheet", "y"),
        wire("sheet", "svg", "out", "svg"),
      ],
    }),
  },

  {
    id: "truchet-arcs",
    label: "Truchet Arcs",
    note: "One quarter-arc tile, turned a random quarter turn per cell.",
    params: [
      num("spacing", "Tile size", 40, 6, 400),
      num("strokeWidth", "Stroke width", 2, 0.1, 20),
    ],
    build: (w, h, p) => {
      const cols = fit(w, p.spacing);
      const rows = fit(h, p.spacing);
      return {
        nodes: [
          node("cells", "grid-points", { cols, rows, spacingX: p.spacing, spacingY: p.spacing }),
          node("roll", "random", { seed: p.seed, min: 0, max: 4 }),
          node("quantise", "floor", {}),
          node("angle", "multiply", { amount: 90 }),
          node("tile", "arc", {
            radius: p.spacing / 2, angle: 90, rotation: 0,
            renderMode: RENDER.STROKE, strokeWidth: p.strokeWidth,
          }),
          node("fan", "repeat", { count: cols * rows }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h }),
        ],
        connections: [
          wire("cells", "points", "roll", "input"),
          wire("roll", "value", "quantise", "value"),
          wire("quantise", "result", "angle", "value"),
          wire("tile", "svg", "fan", "svg"),
          wire("fan", "items", "sheet", "items"),
          wire("cells", "x", "sheet", "x"),
          wire("cells", "y", "sheet", "y"),
          wire("angle", "result", "sheet", "rotation"),
          wire("sheet", "svg", "out", "svg"),
        ],
      };
    },
  },

  {
    id: "noise-field",
    label: "Noise Field",
    note: "A dot grid displaced and resized by 2D value noise.",
    params: [
      num("spacing", "Dot spacing", 14, 3, 200),
      num("radius", "Dot radius", 2, 0.2, 20),
      num("jitter", "Displacement", 9, 0, 120),
      num("noiseScale", "Noise scale", 0.012, 0.0005, 0.2, 4),
      num("sizeVariation", "Size variation", 1.15, 0, 4),
    ],
    build: (w, h, p) => {
      const cols = fit(w, p.spacing);
      const rows = fit(h, p.spacing);
      return {
        nodes: [
          node("cells", "grid-points", { cols, rows, spacingX: p.spacing, spacingY: p.spacing }),
          node("warp", "jitter-points", { amount: p.jitter, scale: p.noiseScale, seed: p.seed, mode: 1 }),
          node("split", "unpack-points", {}),
          node("size", "noise", { scale: p.noiseScale, amplitude: p.sizeVariation, seed: p.seed + 1 }),
          node("bias", "add", { amount: 1.45 }),
          node("dot", "circle", { radius: p.radius, renderMode: RENDER.FILL }),
          node("fan", "repeat", { count: cols * rows }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h }),
        ],
        connections: [
          wire("cells", "points", "warp", "points"),
          wire("warp", "points", "split", "points"),
          wire("split", "x", "size", "x"),
          wire("split", "y", "size", "y"),
          wire("size", "noiseA", "bias", "value"),
          wire("dot", "svg", "fan", "svg"),
          wire("fan", "items", "sheet", "items"),
          wire("split", "x", "sheet", "x"),
          wire("split", "y", "sheet", "y"),
          wire("bias", "result", "sheet", "scale"),
          wire("sheet", "svg", "out", "svg"),
        ],
      };
    },
  },

  {
    id: "subdivide",
    label: "Subdivide",
    note: "The sheet split recursively along its longer axis.",
    params: [
      int("maxDepth", "Max depth", 7, 1, 12),
      num("splitChance", "Split chance", 0.92, 0, 1, 3),
      num("depthDecay", "Depth decay", 0.1, 0, 1, 3),
      num("inset", "Cell inset", 9, 0, 60),
      num("cornerRadius", "Corner radius", 2, 0, 60),
      num("strokeWidth", "Stroke width", 1.2, 0.1, 20),
    ],
    build: (w, h, p) => {
      const margin = 0.9;
      return {
        nodes: [
          node("split", "recursive-subdivide", {
            width: w * margin, height: h * margin,
            maxDepth: p.maxDepth, splitChance: p.splitChance,
            depthDecay: p.depthDecay, seed: p.seed,
          }),
          node("insetW", "add", { amount: -p.inset }),
          node("insetH", "add", { amount: -p.inset }),
          node("cell", "rect", {
            renderMode: RENDER.STROKE, strokeWidth: p.strokeWidth, cornerRadius: p.cornerRadius,
          }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h }),
        ],
        connections: [
          wire("split", "width", "insetW", "value"),
          wire("split", "height", "insetH", "value"),
          wire("insetW", "result", "cell", "width"),
          wire("insetH", "result", "cell", "height"),
          wire("cell", "svg", "sheet", "items"),
          wire("split", "x", "sheet", "x"),
          wire("split", "y", "sheet", "y"),
          wire("sheet", "svg", "out", "svg"),
        ],
      };
    },
  },

  {
    id: "noise-rings",
    label: "Concentric Noise Rings",
    note: "A stack of closed curves at growing radii, wobbled by noise.",
    params: [
      int("count", "Ring count", 46, 2, 400),
      num("amplitude", "Wobble", 13, 0, 120),
      num("noiseRadius", "Wobble detail", 1.6, 0.1, 12),
      num("innerRadius", "Inner radius", 26, 1, 2000),
      int("segments", "Smoothness", 160, 12, 720),
      num("strokeWidth", "Stroke width", 1, 0.1, 20),
    ],
    build: (w, h, p) => {
      const outer = (Math.min(w, h) / 2) * 0.9;
      return {
        nodes: [
          node("radii", "linspace", { count: p.count, from: p.innerRadius, to: Math.max(p.innerRadius + 1, outer) }),
          node("ring", "noise-circle", {
            amplitude: p.amplitude, noiseRadius: p.noiseRadius, scaleR: 0.02,
            segments: p.segments, seed: p.seed,
            renderMode: RENDER.STROKE, strokeWidth: p.strokeWidth,
          }),
          node("sheet", "stack", {}),
          node("out", "canvas", { width: w, height: h }),
        ],
        connections: [
          wire("radii", "values", "ring", "radius"),
          wire("ring", "svg", "sheet", "items"),
          wire("sheet", "svg", "out", "svg"),
        ],
      };
    },
  },

  {
    id: "organic-rings",
    label: "Organic Cells",
    note: "Noise-modulated closed curves arranged on a ring.",
    params: [
      int("count", "Cell count", 28, 1, 200),
      num("cellSize", "Cell size", 62, 4, 600),
      num("amplitude", "Wobble", 0.38, 0, 1, 3),
      num("noiseScale", "Wobble detail", 1.8, 0.1, 12),
      int("octaves", "Octaves", 3, 1, 8),
      num("strokeWidth", "Stroke width", 1.2, 0.1, 20),
    ],
    build: (w, h, p) => {
      const radius = (Math.min(w, h) / 2) * 0.58;
      return {
        nodes: [
          node("ring", "circle-points", { count: p.count, radius, spread: 360 }),
          node("spin", "random", { seed: p.seed, min: 0, max: 360 }),
          node("blob", "organic-cell", {
            width: p.cellSize, height: p.cellSize,
            amplitude: p.amplitude, noiseScale: p.noiseScale,
            octaves: p.octaves, roughness: 0.55, nuclei: 0, seed: p.seed + 1,
            renderMode: RENDER.STROKE, strokeWidth: p.strokeWidth,
          }),
          node("fan", "repeat", { count: p.count }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h }),
        ],
        connections: [
          wire("blob", "svg", "fan", "svg"),
          wire("fan", "items", "sheet", "items"),
          wire("ring", "x", "sheet", "x"),
          wire("ring", "y", "sheet", "y"),
          wire("ring", "points", "spin", "input"),
          wire("spin", "value", "sheet", "rotation"),
          wire("sheet", "svg", "out", "svg"),
        ],
      };
    },
  },

  {
    id: "packed-blocks",
    label: "Packed Blocks",
    note: "Greedy rectangle packing over a cell lattice.",
    params: [
      num("spacing", "Cell size", 40, 6, 400),
      int("maxWidth", "Max block width", 4, 1, 12),
      int("maxHeight", "Max block height", 4, 1, 12),
      num("inset", "Block inset", 8, 0, 60),
      num("strokeWidth", "Stroke width", 1.3, 0.1, 20),
    ],
    build: (w, h, p) => {
      const cols = fit(w * 0.92, p.spacing);
      const rows = fit(h * 0.92, p.spacing);
      return {
        nodes: [
          node("pack", "packed-grid", {
            cols, rows, spacingX: p.spacing, spacingY: p.spacing,
            maxWidth: p.maxWidth, maxHeight: p.maxHeight, seed: p.seed,
          }),
          node("insetW", "add", { amount: -p.inset }),
          node("insetH", "add", { amount: -p.inset }),
          node("block", "rect", { renderMode: RENDER.STROKE, strokeWidth: p.strokeWidth }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h }),
        ],
        connections: [
          wire("pack", "width", "insetW", "value"),
          wire("pack", "height", "insetH", "value"),
          wire("insetW", "result", "block", "width"),
          wire("insetH", "result", "block", "height"),
          wire("block", "svg", "sheet", "items"),
          wire("pack", "x", "sheet", "x"),
          wire("pack", "y", "sheet", "y"),
          wire("sheet", "svg", "out", "svg"),
        ],
      };
    },
  },

  {
    id: "iso-lattice",
    label: "Isometric Lattice",
    note: "Nested diamonds on a 2:1 projected lattice.",
    params: [
      num("spacing", "Lattice spacing", 40, 6, 400),
      num("cellSize", "Diamond size", 30, 2, 400),
      num("minScale", "Min scale", 0.35, 0.02, 1, 3),
      num("maxScale", "Max scale", 1, 0.02, 4, 3),
      num("strokeWidth", "Stroke width", 1.2, 0.1, 20),
    ],
    build: (w, h, p) => {
      const side = isoCover(w, h, p.spacing);
      const cols = side;
      const rows = side;
      return {
        nodes: [
          node("lattice", "isometric-grid-points", { cols, rows, spacing: p.spacing }),
          node("scaleRoll", "random", { seed: p.seed, min: p.minScale, max: p.maxScale }),
          node("cell", "diamond", {
            width: p.cellSize, height: p.cellSize,
            renderMode: RENDER.STROKE, strokeWidth: p.strokeWidth,
          }),
          node("fan", "repeat", { count: cols * rows }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h }),
        ],
        connections: [
          wire("cell", "svg", "fan", "svg"),
          wire("fan", "items", "sheet", "items"),
          wire("lattice", "x", "sheet", "x"),
          wire("lattice", "y", "sheet", "y"),
          wire("lattice", "points", "scaleRoll", "input"),
          wire("scaleRoll", "value", "sheet", "scale"),
          wire("sheet", "svg", "out", "svg"),
        ],
      };
    },
  },

  {
    id: "iso-city",
    label: "Isometric City",
    note: "Stacked cubes drawn back to front, so near ones occlude far ones.",
    params: [
      num("spacing", "Plot spacing", 54, 8, 400),
      num("blockSize", "Block footprint", 30, 2, 300),
      num("minHeight", "Min height", 16, 1, 600),
      num("maxHeight", "Max height", 74, 1, 600),
      num("strokeWidth", "Stroke width", 1.2, 0.1, 20),
    ],
    build: (w, h, p) => {
      // The towers grow upward from the plan, so the lattice only has to cover
      // the canvas less the height the tallest one adds.
      const cols = isoCover(w, Math.max(p.spacing, h - p.maxHeight), p.spacing);
      return {
        nodes: [
          node("plan", "isometric-positions", { count: cols * cols, cols, spacing: p.spacing }),
          node("heightRoll", "random", { seed: p.seed, min: p.minHeight, max: p.maxHeight }),
          node("depthOrder", "add2", {}),
          node("block", "isometric-cube", {
            width: p.blockSize, depth: p.blockSize, angle: 30, strokeWidth: p.strokeWidth,
            topFace: FACE.BOTH, frontFace: FACE.BOTH, rightFace: FACE.BOTH,
            leftFace: FACE.OFF, backFace: FACE.OFF, bottomFace: FACE.OFF,
          }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h }),
        ],
        connections: [
          wire("plan", "index", "heightRoll", "input"),
          wire("heightRoll", "value", "block", "height"),
          wire("block", "svg", "sheet", "items"),
          wire("plan", "x", "sheet", "x"),
          wire("plan", "y", "sheet", "y"),
          wire("plan", "row", "depthOrder", "a"),
          wire("plan", "col", "depthOrder", "b"),
          wire("depthOrder", "result", "sheet", "depth"),
          wire("sheet", "svg", "out", "svg"),
        ],
      };
    },
  },

  {
    id: "mesh-weave",
    label: "Mesh Weave",
    note: "A warped quad meshed into its own lattice of edges.",
    params: [
      int("cols", "Columns", 16, 2, 80),
      int("rows", "Rows", 16, 2, 80),
      num("jitter", "Warp", 13, 0, 120),
      num("noiseScale", "Warp detail", 0.014, 0.0005, 0.2, 4),
      num("strokeWidth", "Stroke width", 1, 0.1, 20),
    ],
    build: (w, h, p) => {
      // The quad is the canvas pulled slightly out of square, which is what
      // gives the weave its drift.
      const hw = (w / 2) * 0.82;
      const hh = (h / 2) * 0.82;
      const skew = Math.min(hw, hh) * 0.09;
      return {
        nodes: [
          node("quadGrid", "quad-grid-points", {
            p1: [-hw, -hh + skew], p2: [hw + skew, -hh],
            p3: [hw - skew, hh], p4: [-hw, hh - skew],
            cols: p.cols, rows: p.rows,
          }),
          node("warp", "jitter-points", { amount: p.jitter, scale: p.noiseScale, seed: p.seed, mode: 1 }),
          node("edges", "mesh-lines", { cols: p.cols, rows: p.rows, mode: 0 }),
          node("stroke", "line", { strokeWidth: p.strokeWidth }),
          node("sheet", "stack", {}),
          node("out", "canvas", { width: w, height: h }),
        ],
        connections: [
          wire("quadGrid", "points", "warp", "points"),
          wire("warp", "points", "edges", "points"),
          wire("edges", "start", "stroke", "start"),
          wire("edges", "end", "stroke", "end"),
          wire("stroke", "svg", "sheet", "items"),
          wire("sheet", "svg", "out", "svg"),
        ],
      };
    },
  },
];

export const PATTERN_LABELS = PATTERNS.map((pattern) => pattern.label);

/** Every param's default, plus the seed each pattern shares. */
export function defaultsFor(pattern) {
  const values = { seed: 5105 };
  for (const param of pattern.params) values[param.key] = param.def;
  return values;
}
