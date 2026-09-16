// Pattern Generator for Affinity — GENERATED, do not edit.
// Source: scripts/pattern-generator/src/*.js plus the pattern-generator engine.
// Rebuild with: node scripts/pattern-generator/build.js


// scripts/pattern-generator/src/sdk.js
var req = require;
var { app } = req("/application.js");
var { Document } = req("/document.js");
var { Dialog, DialogResult } = req("/dialog.js");
var { Colour } = req("/colours.js");
var { FillDescriptor } = req("/fills.js");
var { LineStyleDescriptor } = req("/linestyle.js");
var { CurveBuilder, PolyCurve, Transform } = req("/geometry.js");
var { ContainerNodeDefinition, PolyCurveNodeDefinition } = req("/nodes.js");
var { AddChildNodesCommandBuilder, CompoundCommandBuilder } = req("/commands.js");
var { UnitType } = req("/units.js");
var { BlendMode } = req("affinity:common");

// ../pattern-generator/src/rng.js
function makeRng(seed = 42) {
  let s = Math.floor(seed) | 0 || 1;
  return () => {
    s = s * 1103515245 + 12345 & 2147483647;
    return s / 2147483647;
  };
}
function hash1(i, seed) {
  let h = (i | 0) * 374761393 + (seed | 0) * 668265263;
  h = (h ^ h >>> 13) * 1274126177;
  return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function hash2(x, y, seed) {
  return hash1((x | 0) * 73856093 ^ (y | 0) * 19349663, seed);
}
var smooth = (t) => t * t * (3 - 2 * t);
function noise1(x, seed = 42) {
  const i = Math.floor(x);
  const t = x - i;
  const a = hash1(i, seed) * 2 - 1;
  const b = hash1(i + 1, seed) * 2 - 1;
  return a + smooth(t) * (b - a);
}
function noise2(x, y, seed = 42) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const g = (dx, dy) => hash2(ix + dx, iy + dy, seed) * 2 - 1;
  const top = g(0, 0) + fx * (g(1, 0) - g(0, 0));
  const bot = g(0, 1) + fx * (g(1, 1) - g(0, 1));
  return top + fy * (bot - top);
}
function fbm2(x, y, { octaves = 3, roughness = 0.5, seed = 42 } = {}) {
  let sum = 0;
  let amp = 1;
  let norm2 = 0;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += noise2(x * freq, y * freq, seed + o * 101) * amp;
    norm2 += amp;
    amp *= roughness;
    freq *= 2;
  }
  return norm2 === 0 ? 0 : sum / norm2;
}

// ../pattern-generator/src/nodes/util.js
var fmt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? (Math.round(n * 100) / 100).toString() : "0";
};
var asArray = (v) => Array.isArray(v) ? v : v == null ? [] : [v];
var isNum = (v) => typeof v === "number" && Number.isFinite(v);
var isPoint = (v) => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
var isPointList = (v) => Array.isArray(v) && v.length > 0 && isPoint(v[0]);
var isPointGroups = (v) => Array.isArray(v) && v.length > 0 && isPointList(v[0]);
var pick = (list, i, fallback) => {
  if (Array.isArray(list)) return list.length ? list[i % list.length] : fallback;
  return list ?? fallback;
};
var toNum = (v, fallback = 0) => {
  if (isNum(v)) return v;
  if (Array.isArray(v) && isNum(v[0])) return v[0];
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
var num = (id, def5, extra = {}) => ({ id, type: ["number", "number[]"], default: def5, ...extra });
var scalar = (id, def5, extra = {}) => ({ id, type: "number", default: def5, ...extra });
var arr = (id, def5 = []) => ({ id, type: "number[]", default: def5 });
var pts = (id, def5 = []) => ({ id, type: "point[]", default: def5 });
var svgIn = (id = "svg") => ({ id, type: "svg", default: "" });
var svgList = (id = "items") => ({ id, type: "svg[]", default: [] });
var bool = (id, def5 = false) => ({ id, type: "boolean", default: def5 });
var str = (id, def5 = "") => ({ id, type: "string", default: def5 });
function fanout(args, keys, defaults = {}) {
  let count = 1;
  let isArray = false;
  for (const k of keys) {
    if (Array.isArray(args[k])) {
      isArray = true;
      count = Math.max(count, args[k].length);
    }
  }
  return {
    isArray,
    count,
    get(key, i) {
      const v = args[key];
      if (Array.isArray(v)) return v.length ? v[i % v.length] : defaults[key];
      return v ?? defaults[key];
    }
  };
}
var RENDER = { FILL: 0, STROKE: 1, BOTH: 2 };
function paint(mode = 0, strokeWidth = 2) {
  const fill = `var(--fill-color, currentColor)`;
  const stroke = `var(--stroke-color, currentColor)`;
  const sw = `stroke-width="${fmt(strokeWidth)}" vector-effect="non-scaling-stroke"`;
  if (mode === RENDER.STROKE) return `fill="none" stroke="${stroke}" ${sw} stroke-linecap="round" stroke-linejoin="round"`;
  if (mode === RENDER.BOTH) return `fill="${fill}" stroke="${stroke}" ${sw}`;
  return `fill="${fill}" stroke="none"`;
}
var strokeOnly = (w = 2) => `fill="none" stroke="var(--stroke-color, currentColor)" stroke-width="${fmt(w)}" stroke-linecap="round" stroke-linejoin="round"`;
function group(transform, inner) {
  if (!inner) return "";
  return transform ? `<g transform="${transform}">${inner}</g>` : inner;
}

// ../pattern-generator/src/nodes/input.js
var inputNodes = {
  number: {
    type: "number",
    label: "Number",
    category: "input",
    inputs: [scalar("value", 0)],
    outputs: [{ id: "value", type: "number" }],
    compute: (a) => ({ value: toNum(a.value, 0) })
  },
  sequence: {
    type: "sequence",
    label: "Sequence",
    category: "input",
    inputs: [scalar("count", 10), scalar("start", 0), scalar("step", 1)],
    outputs: [{ id: "values", type: "number[]" }, { id: "count", type: "number" }],
    compute: (a) => {
      const n = Math.max(0, Math.floor(toNum(a.count, 10)));
      const values = Array.from({ length: n }, (_, i) => toNum(a.start, 0) + i * toNum(a.step, 1));
      return { values, count: n };
    }
  },
  linspace: {
    type: "linspace",
    label: "Linspace",
    category: "input",
    inputs: [scalar("count", 10), scalar("from", 0), scalar("to", 1)],
    outputs: [{ id: "values", type: "number[]" }, { id: "count", type: "number" }],
    compute: (a) => {
      const n = Math.max(1, Math.floor(toNum(a.count, 10)));
      const from = toNum(a.from, 0);
      const to = toNum(a.to, 1);
      const values = n === 1 ? [from] : Array.from({ length: n }, (_, i) => from + (to - from) * i / (n - 1));
      return { values, count: n };
    }
  },
  random: {
    type: "random",
    label: "Random",
    category: "input",
    inputs: [
      { id: "input", type: ["number", "number[]"], default: null },
      scalar("seed", 42),
      scalar("min", 0),
      scalar("max", 1),
      scalar("mode", 0),
      scalar("perlinScale", 0.1)
    ],
    outputs: [{ id: "value", type: ["number", "number[]"] }],
    compute: (a) => {
      const min = toNum(a.min, 0);
      const span = toNum(a.max, 1) - min;
      const seed = toNum(a.seed, 42);
      const rng = makeRng(seed);
      const perlin = (i) => (noise1(i * toNum(a.perlinScale, 0.1), seed) + 1) / 2;
      const roll = (i) => min + (a.mode === 1 ? perlin(i) : rng()) * span;
      if (Array.isArray(a.input)) return { value: a.input.map((_, i) => roll(i)) };
      return { value: roll(toNum(a.input, 0)) };
    }
  },
  oscillator: {
    type: "oscillator",
    label: "Oscillator",
    category: "input",
    inputs: [
      num("x", 0),
      scalar("time", 0),
      scalar("amplitude", 1),
      scalar("frequency", 1),
      scalar("phase", 0),
      scalar("shape", 0)
    ],
    outputs: [{ id: "value", type: ["number", "number[]"] }],
    compute: (a) => {
      const amp = toNum(a.amplitude, 1);
      const freq = toNum(a.frequency, 1);
      const phase = toNum(a.phase, 0) + toNum(a.time, 0);
      const wave = (p) => {
        const t = (p % 1 + 1) % 1;
        switch (a.shape ?? 0) {
          case 1:
            return 4 * Math.abs(t - 0.5) - 1;
          // triangle
          case 2:
            return t < 0.5 ? 1 : -1;
          // square
          case 3:
            return 2 * t - 1;
          // saw
          default:
            return Math.sin(t * Math.PI * 2);
        }
      };
      const f = (x) => wave(toNum(x, 0) * freq + phase) * amp;
      if (Array.isArray(a.x)) return { value: a.x.map(f) };
      return { value: f(a.x) };
    }
  },
  noise: {
    type: "noise",
    label: "Noise",
    category: "input",
    inputs: [
      num("x", 0),
      num("y", 0),
      scalar("time", 0),
      scalar("amplitude", 1),
      scalar("scale", 1),
      scalar("speed", 1),
      scalar("seed", 42)
    ],
    outputs: [
      { id: "noiseA", type: ["number", "number[]"] },
      { id: "noiseB", type: ["number", "number[]"] },
      { id: "values", type: "number[]" }
    ],
    compute: (a) => {
      const s = toNum(a.scale, 1);
      const amp = toNum(a.amplitude, 1);
      const seed = toNum(a.seed, 42);
      const drift = toNum(a.time, 0) * toNum(a.speed, 1);
      const sample = (x, y, salt) => noise2(toNum(x, 0) * s + drift, toNum(y, 0) * s, seed + salt) * amp;
      if (Array.isArray(a.x) || Array.isArray(a.y)) {
        const xs = asArray(a.x);
        const ys = asArray(a.y);
        const n = Math.max(xs.length, ys.length, 1);
        const A2 = [];
        const B = [];
        for (let i = 0; i < n; i++) {
          const x = xs.length ? xs[i % xs.length] : 0;
          const y = ys.length ? ys[i % ys.length] : 0;
          A2.push(sample(x, y, 0));
          B.push(sample(x, y, 977));
        }
        return { noiseA: A2, noiseB: B, values: A2 };
      }
      const A = sample(a.x, a.y, 0);
      return { noiseA: A, noiseB: sample(a.x, a.y, 977), values: [A] };
    }
  },
  color: {
    type: "color",
    label: "Color",
    category: "input",
    inputs: [{ id: "value", type: "color", default: "#cccccc" }],
    outputs: [{ id: "color", type: "color" }],
    compute: (a) => ({ color: a.value ?? "#cccccc" })
  },
  time: {
    type: "time",
    label: "Time",
    category: "input",
    inputs: [scalar("speed", 1), scalar("offset", 0)],
    outputs: [{ id: "time", type: "number" }],
    // Headless rendering has no clock. `frame` is supplied per render so an
    // animation is a deterministic function of the frame number, not wall time.
    compute: (a, ctx = {}) => ({
      time: (ctx.frame ?? 0) * toNum(a.speed, 1) + toNum(a.offset, 0)
    })
  },
  debug: {
    type: "debug",
    label: "Debug",
    category: "input",
    inputs: [{ id: "value", type: "any", default: 0 }],
    outputs: [{ id: "out", type: "any" }, { id: "svg", type: "svg" }],
    compute: (a, ctx = {}) => {
      const v = a.value;
      const text = Array.isArray(v) ? `[${v.length}] ${JSON.stringify(v.slice(0, 4))}${v.length > 4 ? "\u2026" : ""}` : JSON.stringify(v);
      if (ctx.onDebug) ctx.onDebug(text, v);
      return { out: v, svg: "" };
    }
  },
  notes: {
    type: "notes",
    label: "Notes",
    category: "input",
    inputs: [str("text", "")],
    outputs: [],
    compute: () => ({})
  }
};

// ../pattern-generator/src/nodes/math.js
var OUT = [{ id: "result", type: ["number", "number[]"] }];
function lift(v, fn) {
  if (Array.isArray(v)) {
    const result2 = v.map((x) => fn(toNum(x, 0)));
    return { result: result2, values: result2, value: result2[0] };
  }
  const result = fn(toNum(v, 0));
  return { result, values: [result], value: result };
}
function lift2(a, b, fn) {
  if (Array.isArray(a) || Array.isArray(b)) {
    const A = asArray(a);
    const B = asArray(b);
    const n = Math.max(A.length, B.length);
    const result2 = Array.from({ length: n }, (_, i) => fn(toNum(A.length ? A[i % A.length] : 0, 0), toNum(B.length ? B[i % B.length] : 0, 0)));
    return { result: result2, values: result2, value: result2[0] };
  }
  const result = fn(toNum(a, 0), toNum(b, 0));
  return { result, values: [result], value: result };
}
var mathNodes = {};
var def = (d) => {
  mathNodes[d.type] = d;
};
var SCALAR_OPS = {
  add: (v, k) => v + k,
  multiply: (v, k) => v * k,
  power: (v, k) => Math.pow(v, k),
  mod: (v, k) => k === 0 ? 0 : v % k
};
for (const [type, fn] of Object.entries(SCALAR_OPS)) {
  def({
    type,
    label: type,
    category: "math",
    inputs: [num("value", 0), scalar("amount", type === "multiply" || type === "power" ? 1 : 0)],
    outputs: OUT,
    compute: (a) => lift(a.value, (v) => fn(v, toNum(a.amount, 0)))
  });
}
var BINARY = {
  add2: (a, b) => a + b,
  multiply2: (a, b) => a * b,
  subtract2: (a, b) => a - b,
  divide: (a, b) => b === 0 ? 0 : a / b,
  min: Math.min,
  max: Math.max
};
for (const [type, fn] of Object.entries(BINARY)) {
  def({
    type,
    label: type,
    category: "math",
    inputs: [num("a", 0), num("b", type === "multiply2" ? 1 : 0)],
    outputs: OUT,
    compute: (a) => lift2(a.a, a.b, fn)
  });
}
var UNARY = {
  negate: (v) => -v,
  abs: Math.abs,
  sqrt: (v) => Math.sqrt(Math.max(0, v)),
  sin: Math.sin,
  cos: Math.cos,
  floor: Math.floor,
  round: Math.round,
  exp: Math.exp
};
for (const [type, fn] of Object.entries(UNARY)) {
  def({
    type,
    label: type,
    category: "math",
    inputs: [num("value", 0)],
    outputs: OUT,
    compute: (a) => lift(a.value, fn)
  });
}
def({
  type: "clamp",
  label: "Clamp",
  category: "math",
  inputs: [num("value", 0), scalar("min", 0), scalar("max", 1)],
  outputs: OUT,
  compute: (a) => {
    const lo = toNum(a.min, 0);
    const hi = toNum(a.max, 1);
    return lift(a.value, (v) => Math.min(hi, Math.max(lo, v)));
  }
});
def({
  type: "remap",
  label: "Remap",
  category: "math",
  inputs: [num("value", 0), scalar("inMin", 0), scalar("inMax", 1), scalar("outMin", 0), scalar("outMax", 1)],
  outputs: OUT,
  compute: (a) => {
    const inMin = toNum(a.inMin, 0);
    const span = toNum(a.inMax, 1) - inMin;
    const outMin = toNum(a.outMin, 0);
    const outSpan = toNum(a.outMax, 1) - outMin;
    return lift(a.value, (v) => span === 0 ? outMin : outMin + (v - inMin) / span * outSpan);
  }
});
def({
  type: "lerp",
  label: "Lerp",
  category: "math",
  inputs: [num("a", 0), num("b", 1), num("t", 0.5)],
  outputs: OUT,
  compute: (a) => {
    const A = asArray(a.a);
    const B = asArray(a.b);
    const T = asArray(a.t);
    const anyArray = Array.isArray(a.a) || Array.isArray(a.b) || Array.isArray(a.t);
    const n = Math.max(A.length, B.length, T.length, 1);
    const at = (list, i, d) => list.length ? toNum(list[i % list.length], d) : d;
    const out = Array.from({ length: n }, (_, i) => at(A, i, 0) + (at(B, i, 1) - at(A, i, 0)) * at(T, i, 0.5));
    return anyArray ? { result: out, values: out, value: out[0] } : { result: out[0], values: out, value: out[0] };
  }
});
def({
  type: "select",
  label: "Select",
  category: "math",
  inputs: [num("condition", 0), num("a", 1), num("b", 0), scalar("threshold", 0.5)],
  outputs: OUT,
  compute: (a) => {
    const thr = toNum(a.threshold, 0.5);
    const A = asArray(a.a);
    const B = asArray(a.b);
    const pickOne = (c, i) => c >= thr ? A.length ? toNum(A[i % A.length], 1) : 1 : B.length ? toNum(B[i % B.length], 0) : 0;
    if (Array.isArray(a.condition)) {
      const out = a.condition.map((c, i) => pickOne(toNum(c, 0), i));
      return { result: out, values: out, value: out[0] };
    }
    const r = pickOne(toNum(a.condition, 0), 0);
    return { result: r, values: [r], value: r };
  }
});
def({
  type: "distance",
  label: "Distance",
  category: "math",
  inputs: [num("x", 0), num("y", 0)],
  outputs: OUT,
  compute: (a) => lift2(a.x, a.y, (x, y) => Math.hypot(x, y))
});
def({
  type: "polar-to-xy",
  label: "Polar to XY",
  category: "math",
  inputs: [num("angle", 0), num("radius", 1)],
  outputs: [
    { id: "x", type: ["number", "number[]"] },
    { id: "y", type: ["number", "number[]"] },
    { id: "points", type: "point[]" }
  ],
  compute: (a) => {
    const A = asArray(a.angle);
    const R = asArray(a.radius);
    const anyArray = Array.isArray(a.angle) || Array.isArray(a.radius);
    const n = Math.max(A.length, R.length, 1);
    const xs = [];
    const ys = [];
    const points = [];
    for (let i = 0; i < n; i++) {
      const ang = (A.length ? toNum(A[i % A.length], 0) : 0) * Math.PI / 180;
      const r = R.length ? toNum(R[i % R.length], 1) : 1;
      const x = Math.cos(ang) * r;
      const y = Math.sin(ang) * r;
      xs.push(x);
      ys.push(y);
      points.push([x, y]);
    }
    return anyArray ? { x: xs, y: ys, points } : { x: xs[0], y: ys[0], points };
  }
});
var EASE = {
  0: (t) => t * t * (3 - 2 * t),
  // smoothstep
  1: (t, k) => Math.pow(t, k),
  // ease in
  2: (t, k) => 1 - Math.pow(1 - t, k),
  // ease out
  3: (t, k) => t < 0.5 ? Math.pow(2 * t, k) / 2 : 1 - Math.pow(2 - 2 * t, k) / 2
};
def({
  type: "ease",
  label: "Ease",
  category: "math",
  inputs: [num("value", 0.5), scalar("mode", 0), scalar("exponent", 2)],
  outputs: OUT,
  compute: (a) => {
    const fn = EASE[a.mode ?? 0] ?? EASE[0];
    const k = toNum(a.exponent, 2);
    return lift(a.value, (v) => fn(Math.min(1, Math.max(0, v)), k));
  }
});
def({
  type: "cumsum",
  label: "Cumulative Sum",
  category: "math",
  inputs: [num("values", 0)],
  outputs: OUT,
  compute: (a) => {
    if (!Array.isArray(a.values)) {
      const v = toNum(a.values, 0);
      return { result: v, values: [v], value: v };
    }
    let running = 0;
    const out = a.values.map((v) => running += toNum(v, 0));
    return { result: out, values: out, value: out[0] };
  }
});
var REDUCERS = {
  0: (v) => v.reduce((s, x) => s + x, 0),
  1: (v) => Math.min(...v),
  2: (v) => Math.max(...v),
  3: (v) => v.reduce((s, x) => s + x, 0) / v.length,
  4: (v) => v[v.length - 1]
};
def({
  type: "array-reduce",
  label: "Array Reduce",
  category: "math",
  inputs: [num("values", 0), scalar("mode", 0)],
  outputs: [{ id: "result", type: "number" }],
  compute: (a) => {
    if (!Array.isArray(a.values)) return { result: toNum(a.values, 0) };
    const nums = a.values.map((v) => toNum(v, 0));
    if (!nums.length) return { result: 0 };
    return { result: (REDUCERS[a.mode ?? 0] ?? REDUCERS[0])(nums) };
  }
});

// ../pattern-generator/src/expr.js
var FUNCS = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  abs: Math.abs,
  sign: Math.sign,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sqrt: (v) => Math.sqrt(Math.max(0, v)),
  log: (v) => v > 0 ? Math.log(v) : 0
};
var FUNCS2 = {
  atan2: Math.atan2,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  mod: (a, b) => b === 0 ? 0 : a % b,
  hypot: Math.hypot
};
var CONSTS = { pi: Math.PI, PI: Math.PI, e: Math.E, tau: Math.PI * 2 };
function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      out.push({ kind: "num", value: parseFloat(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ kind: "name", value: src.slice(i, j) });
      i = j;
      continue;
    }
    if ("+-*/%^(),".includes(c)) {
      out.push({ kind: "op", value: c });
      i++;
      continue;
    }
    return null;
  }
  return out;
}
function compileExpr(src, scope = {}) {
  const toks = tokenize(src ?? "");
  if (!toks || toks.length === 0) return null;
  let pos = 0;
  let failed = false;
  const peek = () => toks[pos];
  const isOp = (v) => peek()?.kind === "op" && peek().value === v;
  const eat = (v) => isOp(v) ? (pos++, true) : false;
  const fail = () => {
    failed = true;
    return () => 0;
  };
  function sum() {
    let left = product();
    for (; ; ) {
      if (eat("+")) {
        const r = product(), l = left;
        left = (x, y) => l(x, y) + r(x, y);
      } else if (eat("-")) {
        const r = product(), l = left;
        left = (x, y) => l(x, y) - r(x, y);
      } else return left;
    }
  }
  function product() {
    let left = unary();
    for (; ; ) {
      if (eat("*")) {
        const r = unary(), l = left;
        left = (x, y) => l(x, y) * r(x, y);
      } else if (eat("/")) {
        const r = unary(), l = left;
        left = (x, y) => {
          const d = r(x, y);
          return d === 0 ? 0 : l(x, y) / d;
        };
      } else if (eat("%")) {
        const r = unary(), l = left;
        left = (x, y) => {
          const d = r(x, y);
          return d === 0 ? 0 : l(x, y) % d;
        };
      } else return left;
    }
  }
  function unary() {
    if (eat("-")) {
      const v = unary();
      return (x, y) => -v(x, y);
    }
    if (eat("+")) return unary();
    return power();
  }
  function power() {
    const base = atom();
    if (eat("^")) {
      const exp = unary();
      return (x, y) => Math.pow(base(x, y), exp(x, y));
    }
    return base;
  }
  function atom() {
    const t = peek();
    if (!t) return fail();
    if (t.kind === "num") {
      pos++;
      const v = t.value;
      return () => v;
    }
    if (eat("(")) {
      const inner = sum();
      if (!eat(")")) return fail();
      return inner;
    }
    if (t.kind === "name") {
      pos++;
      const name = t.value;
      if (eat("(")) {
        const args = [sum()];
        while (eat(",")) args.push(sum());
        if (!eat(")")) return fail();
        if (args.length === 1 && FUNCS[name]) {
          const f = FUNCS[name], a = args[0];
          return (x, y) => f(a(x, y));
        }
        if (args.length === 2 && FUNCS2[name]) {
          const f = FUNCS2[name], [a, b] = args;
          return (x, y) => f(a(x, y), b(x, y));
        }
        return fail();
      }
      if (name === "x") return (x) => x;
      if (name === "y") return (_x, y) => y;
      if (name === "r") return (x, y) => Math.hypot(x, y);
      if (name === "t") return (x, y) => Math.atan2(y, x);
      if (name in CONSTS) {
        const v = CONSTS[name];
        return () => v;
      }
      if (name in scope) {
        const v = scope[name];
        return () => v;
      }
      return fail();
    }
    return fail();
  }
  const fn = sum();
  if (failed || pos !== toks.length) return null;
  return (x, y) => {
    const v = fn(x, y);
    return Number.isFinite(v) ? v : 0;
  };
}

// ../pattern-generator/src/geom.js
function simplify(points, epsilon) {
  if (epsilon <= 0 || points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const eps2 = epsilon * epsilon;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    if (hi - lo < 2) continue;
    const [ax, ay] = points[lo];
    const [bx, by] = points[hi];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let far = -1;
    let farDist = 0;
    for (let i = lo + 1; i < hi; i++) {
      const [px, py] = points[i];
      let d2;
      if (len2 === 0) {
        d2 = (px - ax) ** 2 + (py - ay) ** 2;
      } else {
        let t = ((px - ax) * dx + (py - ay) * dy) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        d2 = (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
      }
      if (d2 > farDist) {
        farDist = d2;
        far = i;
      }
    }
    if (far > 0 && farDist > eps2) {
      keep[far] = 1;
      stack.push([lo, far], [far, hi]);
    }
  }
  return points.filter((_, i) => keep[i]);
}
var SpatialHash = class {
  constructor(cellSize) {
    this.cell = Math.max(1e-6, cellSize);
    this.buckets = /* @__PURE__ */ new Map();
  }
  #key(x, y) {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)}`;
  }
  insert(x, y) {
    const k = this.#key(x, y);
    let b = this.buckets.get(k);
    if (!b) this.buckets.set(k, b = []);
    b.push(x, y);
  }
  /** True if some inserted point lies strictly within `radius` of (x, y). */
  hasNear(x, y, radius) {
    const r22 = radius * radius;
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const b = this.buckets.get(`${gx},${gy}`);
        if (!b) continue;
        for (let i = 0; i < b.length; i += 2) {
          const dx = b[i] - x;
          const dy = b[i + 1] - y;
          if (dx * dx + dy * dy < r22) return true;
        }
      }
    }
    return false;
  }
};
function streamlines({
  fieldX,
  fieldY,
  halfWidth,
  halfHeight,
  separation = 0.186,
  stopDistance = 0.036,
  timeStep = 0.04,
  minLength = 0.3,
  simplifyEps = 0.2,
  maxLines = 300,
  seed = 5105,
  startAt = [0, 0],
  localSeparation = null,
  extraSeeds = []
}) {
  const stop = Math.min(separation, Math.max(5e-4, stopDistance));
  const inside = (x, y) => x >= -halfWidth && x <= halfWidth && y >= -halfHeight && y <= halfHeight;
  const dir = (x, y) => {
    const vx = fieldX(x, y);
    const vy = fieldY(x, y);
    const m = Math.hypot(vx, vy);
    if (!Number.isFinite(m) || m < 1e-9) return null;
    return [vx / m, vy / m];
  };
  const grid = new SpatialHash(stop);
  const maxSteps = Math.ceil(4 * (halfWidth + halfHeight) / timeStep);
  const sepAt = localSeparation ? (x, y) => {
    const v = localSeparation(x, y);
    return Number.isFinite(v) ? Math.min(separation * 4, Math.max(stop, v)) : separation;
  } : () => separation;
  function integrate(sx, sy, sign) {
    const pts2 = [[sx, sy]];
    let x = sx;
    let y = sy;
    for (let step = 0; step < maxSteps; step++) {
      const k1 = dir(x, y);
      if (!k1) break;
      const k2 = dir(x + sign * timeStep * k1[0] / 2, y + sign * timeStep * k1[1] / 2);
      if (!k2) break;
      const k3 = dir(x + sign * timeStep * k2[0] / 2, y + sign * timeStep * k2[1] / 2);
      if (!k3) break;
      const k4 = dir(x + sign * timeStep * k3[0], y + sign * timeStep * k3[1]);
      if (!k4) break;
      const nx = x + sign * timeStep * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]) / 6;
      const ny = y + sign * timeStep * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]) / 6;
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) break;
      if (!inside(nx, ny)) break;
      if (grid.hasNear(nx, ny, stop)) break;
      x = nx;
      y = ny;
      pts2.push([x, y]);
    }
    return pts2;
  }
  const lines = [];
  const queue = [startAt, ...extraSeeds];
  let guard = 0;
  const guardLimit = maxLines * 400 + 5e3;
  while (queue.length && lines.length < maxLines && guard++ < guardLimit) {
    const [sx, sy] = queue.shift();
    if (!inside(sx, sy)) continue;
    if (grid.hasNear(sx, sy, sepAt(sx, sy))) continue;
    const back = integrate(sx, sy, -1).reverse();
    const fwd = integrate(sx, sy, 1);
    const line = back.concat(fwd.slice(1));
    if (line.length < 2) continue;
    let length = 0;
    for (let i = 1; i < line.length; i++) {
      length += Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
    }
    if (length < minLength) continue;
    for (const [px, py] of line) grid.insert(px, py);
    lines.push(simplify(line, simplifyEps * stop));
    const stride = Math.max(1, Math.floor(separation / timeStep));
    for (let i = 0; i < line.length; i += stride) {
      const a = line[Math.max(0, i - 1)];
      const b = line[Math.min(line.length - 1, i + 1)];
      const tx = b[0] - a[0];
      const ty = b[1] - a[1];
      const m = Math.hypot(tx, ty);
      if (m < 1e-9) continue;
      const nx = -ty / m;
      const ny = tx / m;
      const d = sepAt(line[i][0], line[i][1]);
      queue.push(
        [line[i][0] + nx * d, line[i][1] + ny * d],
        [line[i][0] - nx * d, line[i][1] - ny * d]
      );
    }
  }
  return lines;
}
function smoothPath(points, tension = 0.5, closed = false) {
  const n = points.length;
  if (n < 3) return polyPath(points, closed);
  const at = (i) => points[closed ? (i + n) % n : Math.min(n - 1, Math.max(0, i))];
  let d = `M ${fmt2(points[0][0])} ${fmt2(points[0][1])}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const k = tension / 3;
    const c1 = [p1[0] + (p2[0] - p0[0]) * k, p1[1] + (p2[1] - p0[1]) * k];
    const c2 = [p2[0] - (p3[0] - p1[0]) * k, p2[1] - (p3[1] - p1[1]) * k];
    d += ` C ${fmt2(c1[0])} ${fmt2(c1[1])}, ${fmt2(c2[0])} ${fmt2(c2[1])}, ${fmt2(p2[0])} ${fmt2(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}
var fmt2 = (v) => (Math.round(v * 100) / 100).toString();
function polyPath(points, closed = false) {
  if (!points.length) return "";
  let d = `M ${fmt2(points[0][0])} ${fmt2(points[0][1])}`;
  for (let i = 1; i < points.length; i++) d += ` L ${fmt2(points[i][0])} ${fmt2(points[i][1])}`;
  return closed ? `${d} Z` : d;
}

// ../pattern-generator/src/nodes/points.js
var spread = (points) => ({ points, x: points.map((p) => p[0]), y: points.map((p) => p[1]), count: points.length });
function cellOutputs(cells) {
  const out = { cellCount: cells.length };
  for (let c = 0; c < 4; c++) {
    out[`cellP${c + 1}x`] = cells.map((cell) => cell[c][0]);
    out[`cellP${c + 1}y`] = cells.map((cell) => cell[c][1]);
  }
  return out;
}
var pointNodes = {};
var def2 = (d) => {
  pointNodes[d.type] = d;
};
def2({
  type: "grid-points",
  label: "Grid Points",
  category: "points",
  inputs: [scalar("cols", 5), scalar("rows", 5), scalar("spacingX", 20), scalar("spacingY", 20)],
  outputs: [
    { id: "points", type: "point[]" },
    { id: "count", type: "number" },
    { id: "index", type: "number[]" },
    { id: "row", type: "number[]" },
    { id: "col", type: "number[]" }
  ],
  compute: (a) => {
    const cols = Math.max(1, Math.floor(toNum(a.cols, 5)));
    const rows = Math.max(1, Math.floor(toNum(a.rows, 5)));
    const sx = toNum(a.spacingX, 20);
    const sy = toNum(a.spacingY, 20);
    const ox = (cols - 1) * sx / 2;
    const oy = (rows - 1) * sy / 2;
    const points = [];
    const index = [];
    const row = [];
    const col = [];
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * sx - ox;
        const y = r * sy - oy;
        points.push([x, y]);
        index.push(points.length - 1);
        row.push(r);
        col.push(c);
        cells.push([
          [x - sx / 2, y - sy / 2],
          [x + sx / 2, y - sy / 2],
          [x + sx / 2, y + sy / 2],
          [x - sx / 2, y + sy / 2]
        ]);
      }
    }
    return { ...spread(points), index, row, col, ...cellOutputs(cells) };
  }
});
def2({
  type: "isometric-grid-points",
  label: "Isometric Grid Points",
  category: "points",
  inputs: [scalar("cols", 10), scalar("rows", 10), scalar("spacing", 20)],
  outputs: [
    { id: "points", type: "point[]" },
    { id: "x", type: "number[]" },
    { id: "y", type: "number[]" },
    { id: "count", type: "number" },
    { id: "index", type: "number[]" },
    { id: "row", type: "number[]" },
    { id: "col", type: "number[]" }
  ],
  compute: (a) => {
    const cols = Math.max(1, Math.floor(toNum(a.cols, 10)));
    const rows = Math.max(1, Math.floor(toNum(a.rows, 10)));
    const s = toNum(a.spacing, 20);
    const hx = s * Math.cos(Math.PI / 6);
    const hy = s * 0.5;
    const points = [];
    const index = [];
    const row = [];
    const col = [];
    const cells = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - r) * hx;
        const y = (c + r) * hy;
        points.push([x, y]);
        index.push(points.length - 1);
        row.push(r);
        col.push(c);
        cells.push([[x, y - hy], [x + hx, y], [x, y + hy], [x - hx, y]]);
      }
    }
    const cx = points.reduce((t, p) => t + p[0], 0) / points.length;
    const cy = points.reduce((t, p) => t + p[1], 0) / points.length;
    const centred = points.map(([x, y]) => [x - cx, y - cy]);
    const centredCells = cells.map((cell) => cell.map(([x, y]) => [x - cx, y - cy]));
    return { ...spread(centred), index, row, col, ...cellOutputs(centredCells) };
  }
});
def2({
  type: "circle-points",
  label: "Circle Points",
  category: "points",
  inputs: [scalar("count", 12), scalar("radius", 100), scalar("startAngle", 0), scalar("spread", 360)],
  outputs: [
    { id: "points", type: "point[]" },
    { id: "count", type: "number" },
    { id: "angle", type: "number[]" },
    { id: "index", type: "number[]" }
  ],
  compute: (a) => {
    const n = Math.max(1, Math.floor(toNum(a.count, 12)));
    const radius = toNum(a.radius, 100);
    const spreadDeg = toNum(a.spread, 360);
    const start = toNum(a.startAngle, 0) * Math.PI / 180;
    const sweep = spreadDeg * Math.PI / 180;
    const full = Math.abs(spreadDeg % 360) < 1e-9 && spreadDeg !== 0;
    const points = [];
    const angle = [];
    for (let i = 0; i < n; i++) {
      const t = full ? i / n : n === 1 ? 0 : i / (n - 1);
      const ang = start + t * sweep;
      points.push([Math.cos(ang) * radius, Math.sin(ang) * radius]);
      angle.push(ang * 180 / Math.PI);
    }
    return { ...spread(points), angle, index: points.map((_, i) => i) };
  }
});
def2({
  type: "make-point",
  label: "Make Point",
  category: "points",
  inputs: [num("x", 0), num("y", 0)],
  outputs: [{ id: "point", type: ["point", "point[]"] }],
  compute: (a) => {
    if (Array.isArray(a.x) || Array.isArray(a.y)) {
      const X = asArray(a.x);
      const Y = asArray(a.y);
      const n = Math.max(X.length, Y.length, 1);
      const points = Array.from({ length: n }, (_, i) => [
        X.length ? toNum(X[i % X.length], 0) : 0,
        Y.length ? toNum(Y[i % Y.length], 0) : 0
      ]);
      return { point: points, points };
    }
    const p = [toNum(a.x, 0), toNum(a.y, 0)];
    return { point: p, points: [p] };
  }
});
def2({
  type: "unpack-points",
  label: "Unpack Points",
  category: "points",
  inputs: [pts("points")],
  outputs: [{ id: "x", type: "number[]" }, { id: "y", type: "number[]" }, { id: "count", type: "number" }],
  compute: (a) => {
    const p = asArray(a.points).filter(isPoint);
    return { x: p.map((q) => q[0]), y: p.map((q) => q[1]), count: p.length };
  }
});
def2({
  type: "pack-points",
  label: "Pack Points",
  category: "points",
  inputs: [{ id: "x", type: "number[]", default: [] }, { id: "y", type: "number[]", default: [] }],
  outputs: [{ id: "points", type: "point[]" }, { id: "count", type: "number" }],
  compute: (a) => {
    const X = asArray(a.x);
    const Y = asArray(a.y);
    const n = Math.max(X.length, Y.length);
    const points = Array.from({ length: n }, (_, i) => [
      X.length ? toNum(X[i % X.length], 0) : 0,
      Y.length ? toNum(Y[i % Y.length], 0) : 0
    ]);
    return { points, count: points.length };
  }
});
def2({
  type: "split-points",
  label: "Split Points",
  category: "points",
  inputs: [pts("points"), scalar("chunkSize", 5)],
  outputs: [{ id: "groups", type: "point[][]" }, { id: "count", type: "number" }],
  compute: (a) => {
    const p = asArray(a.points).filter(isPoint);
    const size = Math.max(1, Math.floor(toNum(a.chunkSize, 5)));
    const groups = [];
    for (let i = 0; i < p.length; i += size) groups.push(p.slice(i, i + size));
    return { groups, count: groups.length };
  }
});
def2({
  type: "transform-points",
  label: "Transform Points",
  category: "points",
  inputs: [pts("points"), scalar("translateX", 0), scalar("translateY", 0), scalar("scale", 1), scalar("rotation", 0)],
  outputs: [{ id: "points", type: "point[]" }, { id: "count", type: "number" }],
  compute: (a) => {
    const s = toNum(a.scale, 1);
    const rot = toNum(a.rotation, 0) * Math.PI / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const tx = toNum(a.translateX, 0);
    const ty = toNum(a.translateY, 0);
    const points = asArray(a.points).filter(isPoint).map(([x, y]) => {
      const sx = x * s;
      const sy = y * s;
      return [sx * cos - sy * sin + tx, sx * sin + sy * cos + ty];
    });
    return { points, count: points.length };
  }
});
def2({
  type: "jitter-points",
  label: "Jitter Points",
  category: "points",
  inputs: [pts("points"), scalar("amount", 10), scalar("scale", 0.1), scalar("seed", 42), scalar("mode", 0)],
  outputs: [{ id: "points", type: "point[]" }, { id: "count", type: "number" }],
  compute: (a) => {
    const seed = toNum(a.seed, 42);
    const rng = makeRng(seed);
    const amt = toNum(a.amount, 10);
    const s = toNum(a.scale, 0.1);
    const points = asArray(a.points).filter(isPoint).map(([x, y]) => a.mode === 1 ? [x + noise2(x * s, y * s, seed) * amt, y + noise2(x * s, y * s, seed + 977) * amt] : [x + (rng() * 2 - 1) * amt, y + (rng() * 2 - 1) * amt]);
    return { points, count: points.length };
  }
});
def2({
  type: "lerp-points",
  label: "Lerp Points",
  category: "points",
  inputs: [pts("a"), pts("b"), num("t", 0.5)],
  outputs: [{ id: "points", type: "point[]" }, { id: "count", type: "number" }],
  compute: (a) => {
    const A = asArray(a.a).filter(isPoint);
    const B = asArray(a.b).filter(isPoint);
    const T = asArray(a.t);
    const n = Math.max(A.length, B.length);
    const points = Array.from({ length: n }, (_, i) => {
      const p = A.length ? A[i % A.length] : [0, 0];
      const q = B.length ? B[i % B.length] : [0, 0];
      const t = T.length ? toNum(T[i % T.length], 0.5) : toNum(a.t, 0.5);
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    });
    return { points, count: points.length };
  }
});
function resampleOutline(corners, count, cornerRadius = 0, closed = false) {
  let path = corners;
  if (cornerRadius > 0) {
    path = [];
    const n2 = corners.length;
    for (let i = 0; i < n2; i++) {
      const prev = corners[(i - 1 + n2) % n2];
      const cur = corners[i];
      const next = corners[(i + 1) % n2];
      const inDir = norm(sub(cur, prev));
      const outDir = norm(sub(next, cur));
      const rIn = Math.min(cornerRadius, len(sub(cur, prev)) / 2);
      const rOut = Math.min(cornerRadius, len(sub(next, cur)) / 2);
      const start = [cur[0] - inDir[0] * rIn, cur[1] - inDir[1] * rIn];
      const end = [cur[0] + outDir[0] * rOut, cur[1] + outDir[1] * rOut];
      const steps2 = 8;
      for (let k = 0; k <= steps2; k++) {
        const t = k / steps2;
        const u = 1 - t;
        path.push([
          u * u * start[0] + 2 * u * t * cur[0] + t * t * end[0],
          u * u * start[1] + 2 * u * t * cur[1] + t * t * end[1]
        ]);
      }
    }
  }
  const ring = path.concat([path[0]]);
  const seg = [];
  let total = 0;
  for (let i = 1; i < ring.length; i++) {
    const d = len(sub(ring[i], ring[i - 1]));
    seg.push(d);
    total += d;
  }
  const out = [];
  const n = Math.max(2, Math.floor(count));
  const steps = closed ? n : n;
  for (let i = 0; i < steps; i++) {
    let target = total * i / n;
    let k = 0;
    while (k < seg.length - 1 && target > seg[k]) {
      target -= seg[k];
      k++;
    }
    const t = seg[k] === 0 ? 0 : target / seg[k];
    out.push([
      ring[k][0] + (ring[k + 1][0] - ring[k][0]) * t,
      ring[k][1] + (ring[k + 1][1] - ring[k][1]) * t
    ]);
  }
  if (closed) out.push(out[0]);
  return out;
}
var sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
var len = (v) => Math.hypot(v[0], v[1]);
var norm = (v) => {
  const m = len(v) || 1;
  return [v[0] / m, v[1] / m];
};
def2({
  type: "rect-points",
  label: "Rect Points",
  category: "points",
  inputs: [scalar("width", 100), scalar("height", 100), scalar("cornerRadius", 0), scalar("count", 40), bool("closed", false)],
  outputs: [{ id: "points", type: "point[]" }, { id: "count", type: "number" }],
  compute: (a) => {
    const w = toNum(a.width, 100) / 2;
    const h = toNum(a.height, 100) / 2;
    const corners = [[-w, -h], [w, -h], [w, h], [-w, h]];
    const points = resampleOutline(
      corners,
      Math.max(4, Math.floor(toNum(a.count, 40))),
      toNum(a.cornerRadius, 0),
      a.closed ?? false
    );
    return { points, count: points.length };
  }
});
def2({
  type: "polygon-points",
  label: "Polygon Points",
  category: "points",
  inputs: [scalar("sides", 6), scalar("radius", 50), scalar("cornerRadius", 0), scalar("count", 40), bool("closed", false)],
  outputs: [{ id: "points", type: "point[]" }, { id: "count", type: "number" }],
  compute: (a) => {
    const sides = Math.max(3, Math.floor(toNum(a.sides, 6)));
    const r = toNum(a.radius, 50);
    const corners = Array.from({ length: sides }, (_, i) => {
      const ang = i / sides * Math.PI * 2 - Math.PI / 2;
      return [Math.cos(ang) * r, Math.sin(ang) * r];
    });
    const points = resampleOutline(
      corners,
      Math.max(3, Math.floor(toNum(a.count, 40))),
      toNum(a.cornerRadius, 0),
      a.closed ?? false
    );
    return { points, count: points.length };
  }
});
def2({
  type: "quad-grid-points",
  label: "Quad Grid Points",
  category: "points",
  inputs: [
    { id: "p1", type: "point", default: [-50, -50] },
    { id: "p2", type: "point", default: [50, -50] },
    { id: "p3", type: "point", default: [50, 50] },
    { id: "p4", type: "point", default: [-50, 50] },
    scalar("cols", 5),
    scalar("rows", 5)
  ],
  outputs: [
    { id: "points", type: "point[]" },
    { id: "count", type: "number" },
    { id: "index", type: "number[]" },
    { id: "row", type: "number[]" },
    { id: "col", type: "number[]" }
  ],
  compute: (a) => {
    const P = (v, d) => isPoint(v) ? v : d;
    const p1 = P(a.p1, [-50, -50]);
    const p2 = P(a.p2, [50, -50]);
    const p3 = P(a.p3, [50, 50]);
    const p4 = P(a.p4, [-50, 50]);
    const cols = Math.max(2, Math.floor(toNum(a.cols, 5)));
    const rows = Math.max(2, Math.floor(toNum(a.rows, 5)));
    const points = [];
    const index = [];
    const row = [];
    const col = [];
    for (let r = 0; r < rows; r++) {
      const v = r / (rows - 1);
      for (let c = 0; c < cols; c++) {
        const u = c / (cols - 1);
        const top = [p1[0] + (p2[0] - p1[0]) * u, p1[1] + (p2[1] - p1[1]) * u];
        const bot = [p4[0] + (p3[0] - p4[0]) * u, p4[1] + (p3[1] - p4[1]) * u];
        points.push([top[0] + (bot[0] - top[0]) * v, top[1] + (bot[1] - top[1]) * v]);
        index.push(points.length - 1);
        row.push(r);
        col.push(c);
      }
    }
    return { ...spread(points), index, row, col };
  }
});
def2({
  type: "mesh-lines",
  label: "Mesh Lines",
  category: "points",
  inputs: [pts("points"), scalar("cols", 5), scalar("rows", 5), scalar("mode", 0), bool("closedRows", false)],
  outputs: [
    { id: "x1", type: "number[]" },
    { id: "y1", type: "number[]" },
    { id: "x2", type: "number[]" },
    { id: "y2", type: "number[]" },
    { id: "start", type: "point[]" },
    { id: "end", type: "point[]" },
    { id: "count", type: "number" },
    { id: "isHorizontal", type: "number[]" },
    { id: "direction", type: "number[]" }
  ],
  compute: (a) => {
    const p = asArray(a.points).filter(isPoint);
    const cols = Math.max(1, Math.floor(toNum(a.cols, 5)));
    const rows = Math.max(1, Math.floor(toNum(a.rows, 5)));
    const at = (r, c) => p[r * cols + c];
    const mode = a.mode ?? 0;
    const start = [];
    const end = [];
    const isHorizontal = [];
    const wrap = a.closedRows ?? false;
    const edge = (p1, p2, horiz) => {
      if (!p1 || !p2) return;
      start.push(p1);
      end.push(p2);
      isHorizontal.push(horiz);
    };
    if (mode === 0 || mode === 1) {
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols - 1; c++) edge(at(r, c), at(r, c + 1), 1);
        if (wrap && cols > 2) edge(at(r, cols - 1), at(r, 0), 1);
      }
    }
    if (mode === 0 || mode === 2) {
      for (let c = 0; c < cols; c++) for (let r = 0; r < rows - 1; r++) edge(at(r, c), at(r + 1, c), 0);
    }
    if (mode === 3) {
      for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
          edge(at(r, c), at(r + 1, c + 1), 0);
          edge(at(r, c + 1), at(r + 1, c), 0);
        }
      }
    }
    const cells = [];
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const q = [at(r, c), at(r, c + 1), at(r + 1, c + 1), at(r + 1, c)];
        if (q.every(Boolean)) cells.push(q);
      }
    }
    return {
      x1: start.map((q) => q[0]),
      y1: start.map((q) => q[1]),
      x2: end.map((q) => q[0]),
      y2: end.map((q) => q[1]),
      start,
      end,
      count: start.length,
      isHorizontal,
      direction: start.map((q, i) => Math.atan2(end[i][1] - q[1], end[i][0] - q[0]) * 180 / Math.PI),
      ...cellOutputs(cells)
    };
  }
});
def2({
  type: "flow-lines",
  label: "Flow Lines",
  category: "points",
  inputs: [
    str("fieldX", "cos(cos(y) - x * y)"),
    str("fieldY", "x"),
    pts("seeds"),
    pts("poles"),
    { id: "poleKind", type: "number[]", default: [] },
    { id: "poleStrength", type: "number[]", default: [] },
    scalar("poleCore", 0.25),
    str("density", "1"),
    scalar("densityGain", 1),
    scalar("a", 1),
    scalar("b", 0),
    scalar("width", 400),
    scalar("height", 400),
    scalar("domain", 5),
    scalar("separation", 0.186),
    scalar("stopDistance", 0.036),
    scalar("timeStep", 0.04),
    scalar("simplify", 0.2),
    scalar("dotSpacing", 0.12),
    scalar("minLength", 0.3),
    scalar("seed", 5105),
    scalar("maxLines", 300)
  ],
  outputs: [{ id: "groups", type: "point[][]" }, { id: "points", type: "point[]" }, { id: "count", type: "number" }],
  compute: (a) => {
    const w = Math.max(1, toNum(a.width, 400));
    const h = Math.max(1, toNum(a.height, 400));
    const domain = Math.max(0.01, toNum(a.domain, 5));
    const scale = Math.min(w, h) / (2 * domain);
    const halfW = w / (2 * scale);
    const halfH = h / (2 * scale);
    const scope = { a: toNum(a.a, 1), b: toNum(a.b, 0), hx: halfW, hy: halfH };
    const baseX = compileExpr(a.fieldX ?? "", scope);
    const baseY = compileExpr(a.fieldY ?? "", scope);
    const density = compileExpr(a.density || "1", scope);
    if (!baseX || !baseY || !density) return { groups: [], points: [], count: 0 };
    const poles = asArray(a.poles).filter(isPoint);
    const kinds = asArray(a.poleKind);
    const strengths = asArray(a.poleStrength);
    const core = Math.max(1e-3, toNum(a.poleCore, 0.25));
    const core2 = core * core;
    const withPoles = (fn, isY) => {
      if (!poles.length) return fn;
      return (x, y) => {
        let v = fn(x, y);
        for (let i = 0; i < poles.length; i++) {
          const dx = x - poles[i][0];
          const dy = y - poles[i][1];
          const d2 = dx * dx + dy * dy + core2;
          const s = pick(strengths, i, 1) ?? 1;
          const kind = pick(kinds, i, 0) ?? 0;
          v += kind === 1 ? s * (isY ? dx : -dy) / d2 : s * (isY ? dy : dx) / d2;
        }
        return v;
      };
    };
    const gain = toNum(a.densityGain, 1);
    const rng = makeRng(toNum(a.seed, 5105));
    const sep = Math.max(1e-3, toNum(a.separation, 0.186));
    const lines = streamlines({
      fieldX: withPoles(baseX, false),
      fieldY: withPoles(baseY, true),
      halfWidth: halfW,
      halfHeight: halfH,
      separation: sep,
      stopDistance: toNum(a.stopDistance, 0.036),
      timeStep: Math.max(1e-3, toNum(a.timeStep, 0.04)),
      minLength: Math.max(0, toNum(a.minLength, 0.3)),
      simplifyEps: Math.max(0, toNum(a.simplify, 0.2)),
      maxLines: Math.max(1, Math.floor(toNum(a.maxLines, 300))),
      // A density formula above 1 packs lines closer at that point.
      localSeparation: gain === 0 ? null : (x, y) => sep / Math.max(0.15, Math.pow(Math.max(0.01, density(x, y)), gain)),
      extraSeeds: asArray(a.seeds).filter(isPoint),
      startAt: [(rng() - 0.5) * sep, (rng() - 0.5) * sep]
    });
    const groups = lines.map((l) => l.map(([x, y]) => [x * scale, y * scale]));
    const spacing = Math.max(0.01, toNum(a.dotSpacing, 0.12)) * scale;
    const dots = [];
    for (const line of groups) {
      let carry = 0;
      for (let i = 1; i < line.length; i++) {
        const segLen = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]);
        let t = spacing - carry;
        while (t <= segLen) {
          const u = t / segLen;
          dots.push([
            line[i - 1][0] + (line[i][0] - line[i - 1][0]) * u,
            line[i - 1][1] + (line[i][1] - line[i - 1][1]) * u
          ]);
          t += spacing;
        }
        carry = (carry + segLen) % spacing;
      }
    }
    return { groups, points: dots, count: groups.length };
  }
});

// ../pattern-generator/src/font.js
var r2 = (v) => Math.round(v * 100) / 100;
function contoursToPath(contours, scale, offsetX = 0, offsetY = 0) {
  let d = "";
  for (const raw of contours) {
    if (raw.length === 0) continue;
    const pts2 = [];
    for (let i = 0; i < raw.length; i++) {
      const cur = raw[i];
      const next = raw[(i + 1) % raw.length];
      pts2.push(cur);
      if (!cur.onCurve && !next.onCurve) {
        pts2.push({ x: (cur.x + next.x) / 2, y: (cur.y + next.y) / 2, onCurve: true });
      }
    }
    const startIdx = pts2.findIndex((p) => p.onCurve);
    if (startIdx === -1) continue;
    const ring = pts2.slice(startIdx).concat(pts2.slice(0, startIdx));
    const X = (p) => r2(p.x * scale + offsetX);
    const Y = (p) => r2(p.y * scale + offsetY);
    d += `M ${X(ring[0])} ${Y(ring[0])}`;
    for (let i = 1; i < ring.length; ) {
      const p = ring[i];
      if (p.onCurve) {
        d += ` L ${X(p)} ${Y(p)}`;
        i += 1;
      } else {
        const anchor = ring[i + 1] ?? ring[0];
        d += ` Q ${X(p)} ${Y(p)}, ${X(anchor)} ${Y(anchor)}`;
        i += 2;
      }
    }
    d += " Z";
  }
  return d;
}
function bbox(contours, scale) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of contours) {
    for (const p of c) {
      minX = Math.min(minX, p.x * scale);
      maxX = Math.max(maxX, p.x * scale);
      minY = Math.min(minY, p.y * scale);
      maxY = Math.max(maxY, p.y * scale);
    }
  }
  if (minX === Infinity) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
var current = null;
function getFont() {
  return current;
}
function glyphPath(char, fontSize) {
  if (!current) return null;
  const gid = current.glyphId(char.charAt(0) || "A");
  const { contours, advance } = current.glyphContours(gid);
  const scale = fontSize / current.unitsPerEm;
  if (!contours.length) return { pathData: "", width: advance * scale, height: fontSize };
  const box = bbox(contours, scale);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  return {
    pathData: contoursToPath(contours, scale, -cx, -cy),
    width: box.width,
    height: box.height
  };
}
function textPath(text, fontSize, letterSpacing = 0) {
  if (!current) return null;
  const scale = fontSize / current.unitsPerEm;
  const gids = [...text].map((ch) => current.glyphId(ch));
  const placed = [];
  let pen = 0;
  for (let i = 0; i < gids.length; i++) {
    const { contours, advance } = current.glyphContours(gids[i]);
    for (const c of contours) placed.push(c.map((p) => ({ ...p, x: p.x + pen / scale })));
    const kern = i < gids.length - 1 ? current.kerning(gids[i], gids[i + 1]) * scale : 0;
    pen += advance * scale + kern + letterSpacing;
  }
  if (!placed.length) return { pathData: "", width: pen, height: fontSize };
  const box = bbox(placed, scale);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  return {
    pathData: contoursToPath(placed, scale, -cx, -cy),
    width: box.width,
    height: box.height
  };
}

// ../pattern-generator/src/nodes/primitives.js
var SVG_OUT = [{ id: "svg", type: ["svg", "svg[]"] }];
var modeIn = () => [scalar("renderMode", 0), scalar("strokeWidth", 2)];
var primitiveNodes = {};
var def3 = (d) => {
  primitiveNodes[d.type] = d;
};
function shapeNode(type, label, inputs, sizeKeys, defaults, draw) {
  def3({
    type,
    label,
    category: "primitives",
    inputs: [...inputs, ...modeIn()],
    outputs: SVG_OUT,
    compute: (a) => {
      const f = fanout(a, sizeKeys, defaults);
      const attrs = paint(a.renderMode ?? 0, toNum(a.strokeWidth, 2));
      const out = [];
      for (let i = 0; i < f.count; i++) out.push(draw(f, i, attrs, a));
      const kept = out.filter(Boolean);
      return { svg: f.isArray ? kept : kept[0] ?? "" };
    }
  });
}
shapeNode(
  "circle",
  "Circle",
  [num("radius", 25)],
  ["radius"],
  { radius: 25 },
  (f, i, attrs) => {
    const r = Math.abs(toNum(f.get("radius", i), 25));
    return r > 0 ? `<circle cx="0" cy="0" r="${fmt(r)}" ${attrs} />` : "";
  }
);
shapeNode(
  "rect",
  "Rect",
  [num("width", 50), num("height", 50), num("cornerRadius", 0)],
  ["width", "height", "cornerRadius"],
  { width: 50, height: 50, cornerRadius: 0 },
  (f, i, attrs) => {
    const w = Math.abs(toNum(f.get("width", i), 50));
    const h = Math.abs(toNum(f.get("height", i), 50));
    if (w <= 0 || h <= 0) return "";
    const r = Math.min(toNum(f.get("cornerRadius", i), 0), Math.min(w, h) / 2);
    const rx = r > 0 ? ` rx="${fmt(r)}"` : "";
    return `<rect x="${fmt(-w / 2)}" y="${fmt(-h / 2)}" width="${fmt(w)}" height="${fmt(h)}"${rx} ${attrs} />`;
  }
);
shapeNode(
  "polygon",
  "Polygon",
  [num("sides", 6), num("radius", 30)],
  ["sides", "radius"],
  { sides: 6, radius: 30 },
  (f, i, attrs) => {
    const sides = Math.max(3, Math.floor(toNum(f.get("sides", i), 6)));
    const r = Math.abs(toNum(f.get("radius", i), 30));
    if (r <= 0) return "";
    const corners = Array.from({ length: sides }, (_, k) => {
      const ang = k / sides * Math.PI * 2 - Math.PI / 2;
      return [Math.cos(ang) * r, Math.sin(ang) * r];
    });
    return `<path d="${polyPath(corners, true)}" ${attrs} />`;
  }
);
def3({
  type: "arc",
  label: "Arc",
  category: "primitives",
  inputs: [
    num("radius", 50),
    num("angle", 90),
    num("rotation", 0),
    num("innerRadius", 0),
    bool("stableCenter", false),
    ...modeIn()
  ],
  outputs: SVG_OUT,
  compute: (a) => {
    const f = fanout(
      a,
      ["radius", "angle", "rotation", "innerRadius"],
      { radius: 50, angle: 90, rotation: 0, innerRadius: 0 }
    );
    const mode = a.renderMode ?? 0;
    const attrs = paint(mode, toNum(a.strokeWidth, 2));
    const out = [];
    for (let i = 0; i < f.count; i++) {
      const r = Math.abs(toNum(f.get("radius", i), 50));
      const sweepDeg = toNum(f.get("angle", i), 90);
      const rot = toNum(f.get("rotation", i), 0) * Math.PI / 180;
      const inner = Math.min(r, Math.abs(toNum(f.get("innerRadius", i), 0)));
      if (r <= 0 || Math.abs(sweepDeg) < 1e-6) {
        out.push("");
        continue;
      }
      if (Math.abs(sweepDeg) >= 360) {
        out.push(inner > 0 ? `<path d="M ${fmt(-r)} 0 A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(r)} 0 A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(-r)} 0 Z M ${fmt(-inner)} 0 A ${fmt(inner)} ${fmt(inner)} 0 1 1 ${fmt(inner)} 0 A ${fmt(inner)} ${fmt(inner)} 0 1 1 ${fmt(-inner)} 0 Z" fill-rule="evenodd" ${attrs} />` : `<circle cx="0" cy="0" r="${fmt(r)}" ${attrs} />`);
        continue;
      }
      const start = a.stableCenter ? rot - sweepDeg * Math.PI / 360 : rot;
      const end = start + sweepDeg * Math.PI / 180;
      const large = Math.abs(sweepDeg) > 180 ? 1 : 0;
      const dir = sweepDeg > 0 ? 1 : 0;
      const P = (ang, rad) => `${fmt(Math.cos(ang) * rad)} ${fmt(Math.sin(ang) * rad)}`;
      if (mode === 1 && inner === 0) {
        out.push(`<path d="M ${P(start, r)} A ${fmt(r)} ${fmt(r)} 0 ${large} ${dir} ${P(end, r)}" ${strokeOnly(toNum(a.strokeWidth, 2))} />`);
      } else if (inner > 0) {
        out.push(`<path d="M ${P(start, r)} A ${fmt(r)} ${fmt(r)} 0 ${large} ${dir} ${P(end, r)} L ${P(end, inner)} A ${fmt(inner)} ${fmt(inner)} 0 ${large} ${dir ? 0 : 1} ${P(start, inner)} Z" ${attrs} />`);
      } else {
        out.push(`<path d="M 0 0 L ${P(start, r)} A ${fmt(r)} ${fmt(r)} 0 ${large} ${dir} ${P(end, r)} Z" ${attrs} />`);
      }
    }
    const kept = out.filter(Boolean);
    return { svg: f.isArray ? kept : kept[0] ?? "" };
  }
});
def3({
  type: "line",
  label: "Line",
  category: "primitives",
  inputs: [
    { id: "start", type: ["point", "point[]"], default: [-50, 0] },
    { id: "end", type: ["point", "point[]"], default: [50, 0] },
    num("x1", -50),
    num("y1", 0),
    num("x2", 50),
    num("y2", 0),
    scalar("strokeWidth", 2)
  ],
  outputs: SVG_OUT,
  compute: (a) => {
    const attrs = strokeOnly(toNum(a.strokeWidth, 2));
    const starts = isPointList(a.start) ? a.start : isPoint(a.start) ? [a.start] : null;
    const ends = isPointList(a.end) ? a.end : isPoint(a.end) ? [a.end] : null;
    let pairs;
    if (starts && ends) {
      const n = Math.max(starts.length, ends.length);
      pairs = Array.from({ length: n }, (_, i) => [starts[i % starts.length], ends[i % ends.length]]);
    } else {
      const f = fanout(a, ["x1", "y1", "x2", "y2"], { x1: -50, y1: 0, x2: 50, y2: 0 });
      pairs = Array.from({ length: f.count }, (_, i) => [
        [toNum(f.get("x1", i), -50), toNum(f.get("y1", i), 0)],
        [toNum(f.get("x2", i), 50), toNum(f.get("y2", i), 0)]
      ]);
    }
    const svg = pairs.map(([p, q]) => `<line x1="${fmt(p[0])}" y1="${fmt(p[1])}" x2="${fmt(q[0])}" y2="${fmt(q[1])}" ${attrs} />`);
    const many = starts && (starts.length > 1 || ends.length > 1) || svg.length > 1;
    return { svg: many ? svg : svg[0] ?? "" };
  }
});
def3({
  type: "polyline",
  label: "Polyline",
  category: "primitives",
  inputs: [
    { id: "points", type: ["point[]", "point[][]"], default: [] },
    { id: "x", type: "number[]", default: [] },
    { id: "y", type: "number[]", default: [] },
    bool("smooth", false),
    scalar("tension", 0.5),
    bool("closed", false),
    scalar("strokeWidth", 2)
  ],
  outputs: SVG_OUT,
  compute: (a) => {
    const attrs = strokeOnly(toNum(a.strokeWidth, 2));
    const draw = (line) => {
      if (!line || line.length < 2) return "";
      const d = a.smooth ? smoothPath(line, toNum(a.tension, 0.5), a.closed) : polyPath(line, a.closed);
      return `<path d="${d}" ${attrs} />`;
    };
    if (isPointGroups(a.points)) return { svg: a.points.map(draw).filter(Boolean) };
    if (isPointList(a.points)) return { svg: draw(a.points) };
    const X = asArray(a.x);
    const Y = asArray(a.y);
    return { svg: draw(X.map((x, i) => [toNum(x, 0), toNum(Y[i], 0)])) };
  }
});
def3({
  type: "quad",
  label: "Quad",
  category: "primitives",
  inputs: [
    { id: "p1", type: ["point", "point[]"], default: [-25, -20] },
    { id: "p2", type: ["point", "point[]"], default: [25, -20] },
    { id: "p3", type: ["point", "point[]"], default: [25, 20] },
    { id: "p4", type: ["point", "point[]"], default: [-25, 20] },
    num("p1x", -25),
    num("p1y", -20),
    num("p2x", 25),
    num("p2y", -20),
    num("p3x", 25),
    num("p3y", 20),
    num("p4x", -25),
    num("p4y", 20),
    ...modeIn()
  ],
  outputs: SVG_OUT,
  compute: (a) => {
    const attrs = paint(a.renderMode ?? 0, toNum(a.strokeWidth, 2));
    const keys = ["p1", "p2", "p3", "p4"];
    const lists = keys.map((k) => isPointList(a[k]) ? a[k] : isPoint(a[k]) ? [a[k]] : null);
    if (lists.every(Boolean)) {
      const n = Math.max(...lists.map((l) => l.length));
      const svg2 = Array.from({ length: n }, (_, i) => `<path d="${polyPath(lists.map((l) => l[i % l.length]), true)}" ${attrs} />`);
      const many = lists.some((l) => l.length > 1);
      return { svg: many ? svg2 : svg2[0] ?? "" };
    }
    const comps = ["p1x", "p1y", "p2x", "p2y", "p3x", "p3y", "p4x", "p4y"];
    const f = fanout(a, comps, { p1x: -25, p1y: -20, p2x: 25, p2y: -20, p3x: 25, p3y: 20, p4x: -25, p4y: 20 });
    const svg = Array.from({ length: f.count }, (_, i) => {
      const corners = [
        [f.get("p1x", i), f.get("p1y", i)],
        [f.get("p2x", i), f.get("p2y", i)],
        [f.get("p3x", i), f.get("p3y", i)],
        [f.get("p4x", i), f.get("p4y", i)]
      ].map(([x, y]) => [toNum(x, 0), toNum(y, 0)]);
      return `<path d="${polyPath(corners, true)}" ${attrs} />`;
    });
    return { svg: f.isArray ? svg : svg[0] ?? "" };
  }
});
var TRI = {
  0: (w, h) => [[0, h / 2], [-w / 2, -h / 2], [w / 2, -h / 2]],
  // up
  1: (w, h) => [[0, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]],
  // down
  2: (w, h) => [[-w / 2, 0], [w / 2, h / 2], [w / 2, -h / 2]],
  // left
  3: (w, h) => [[w / 2, 0], [-w / 2, -h / 2], [-w / 2, h / 2]]
  // right
};
def3({
  type: "triangle",
  label: "Triangle",
  category: "primitives",
  inputs: [num("width", 50), num("height", 50), scalar("orientation", 0), ...modeIn()],
  outputs: SVG_OUT,
  compute: (a) => {
    const f = fanout(a, ["width", "height"], { width: 50, height: 50 });
    const attrs = paint(a.renderMode ?? 0, toNum(a.strokeWidth, 2));
    const shape = TRI[a.orientation ?? 0] ?? TRI[0];
    const svg = Array.from({ length: f.count }, (_, i) => {
      const w = toNum(f.get("width", i), 50);
      const h = toNum(f.get("height", i), 50);
      return w && h ? `<path d="${polyPath(shape(w, h), true)}" ${attrs} />` : "";
    }).filter(Boolean);
    return { svg: f.isArray ? svg : svg[0] ?? "" };
  }
});
shapeNode(
  "diamond",
  "Diamond",
  [num("width", 50), num("height", 50)],
  ["width", "height"],
  { width: 50, height: 50 },
  (f, i, attrs) => {
    const w = toNum(f.get("width", i), 50);
    const h = toNum(f.get("height", i), 50);
    if (!w || !h) return "";
    return `<path d="${polyPath([[0, h / 2], [w / 2, 0], [0, -h / 2], [-w / 2, 0]], true)}" ${attrs} />`;
  }
);
shapeNode(
  "parallelogram",
  "Parallelogram",
  [num("width", 50), num("height", 40), num("skew", 30)],
  ["width", "height", "skew"],
  { width: 50, height: 40, skew: 30 },
  (f, i, attrs) => {
    const w = toNum(f.get("width", i), 50);
    const h = toNum(f.get("height", i), 40);
    if (!w || !h) return "";
    const off = Math.tan(toNum(f.get("skew", i), 30) * Math.PI / 180) * (h / 2);
    const corners = [[-w / 2 - off, -h / 2], [w / 2 - off, -h / 2], [w / 2 + off, h / 2], [-w / 2 + off, h / 2]];
    return `<path d="${polyPath(corners, true)}" ${attrs} />`;
  }
);
function waveSamples(width, segments, envelope, amplitudeAt, yAt) {
  const env = asArray(envelope);
  const n = Math.max(2, Math.floor(segments));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const scale = env.length ? toNum(env[Math.min(env.length - 1, Math.round(t * (env.length - 1)))], 1) : 1;
    out.push([-width / 2 + t * width, yAt(t) + amplitudeAt(t) * scale]);
  }
  return out;
}
def3({
  type: "sine",
  label: "Sine",
  category: "primitives",
  inputs: [
    num("width", 200),
    num("amplitude", 50),
    num("frequency", 2),
    num("phase", 0),
    { id: "envelope", type: "number[]", default: [] },
    num("segments", 64),
    scalar("strokeWidth", 2)
  ],
  outputs: SVG_OUT,
  compute: (a) => {
    const f = fanout(
      a,
      ["width", "amplitude", "frequency", "phase", "segments"],
      { width: 200, amplitude: 50, frequency: 2, phase: 0, segments: 64 }
    );
    const attrs = strokeOnly(toNum(a.strokeWidth, 2));
    const svg = Array.from({ length: f.count }, (_, i) => {
      const w = toNum(f.get("width", i), 200);
      const amp = toNum(f.get("amplitude", i), 50);
      const freq = toNum(f.get("frequency", i), 2);
      const phase = toNum(f.get("phase", i), 0) * Math.PI / 180;
      const pts2 = waveSamples(
        w,
        toNum(f.get("segments", i), 64),
        a.envelope,
        (t) => Math.sin(t * Math.PI * 2 * freq + phase) * amp,
        () => 0
      );
      return `<path d="${polyPath(pts2)}" ${attrs} />`;
    });
    return { svg: f.isArray ? svg : svg[0] ?? "" };
  }
});
def3({
  type: "noise-wave",
  label: "Noise Wave",
  category: "primitives",
  inputs: [
    scalar("width", 200),
    num("amplitude", 50),
    scalar("scaleX", 1),
    scalar("scaleY", 1),
    num("y", 0),
    { id: "envelope", type: "number[]", default: [] },
    scalar("segments", 64),
    scalar("strokeWidth", 2),
    scalar("speed", 0),
    scalar("time", 0),
    bool("unipolar", false),
    scalar("seed", 42)
  ],
  outputs: SVG_OUT,
  compute: (a) => {
    const f = fanout(a, ["amplitude", "y"], { amplitude: 50, y: 0 });
    const attrs = strokeOnly(toNum(a.strokeWidth, 2));
    const w = toNum(a.width, 200);
    const sx = toNum(a.scaleX, 1);
    const sy = toNum(a.scaleY, 1);
    const drift = toNum(a.time, 0) * toNum(a.speed, 0);
    const seed = toNum(a.seed, 42);
    const svg = Array.from({ length: f.count }, (_, i) => {
      const amp = toNum(f.get("amplitude", i), 50);
      const baseY = toNum(f.get("y", i), 0);
      const lane = i * 7.13 * sy;
      const pts2 = waveSamples(w, toNum(a.segments, 64), a.envelope, (t) => {
        const n = noise2(t * 10 * sx + drift, lane, seed);
        return (a.unipolar ? (n + 1) / 2 : n) * amp;
      }, () => baseY);
      return `<path d="${polyPath(pts2)}" ${attrs} />`;
    });
    return { svg: f.isArray ? svg : svg[0] ?? "" };
  }
});
def3({
  type: "noise-circle",
  label: "Noise Circle",
  category: "primitives",
  inputs: [
    num("radius", 50),
    scalar("amplitude", 20),
    scalar("noiseRadius", 2),
    scalar("scaleR", 0.1),
    { id: "envelope", type: "number[]", default: [] },
    scalar("segments", 64),
    scalar("strokeWidth", 2),
    scalar("speed", 0),
    scalar("time", 0),
    scalar("seed", 42),
    ...modeIn()
  ],
  outputs: SVG_OUT,
  compute: (a) => {
    const f = fanout(a, ["radius"], { radius: 50 });
    const mode = a.renderMode ?? 0;
    const attrs = mode === 0 && a.renderMode === void 0 ? strokeOnly(toNum(a.strokeWidth, 2)) : paint(mode, toNum(a.strokeWidth, 2));
    const segs = Math.max(16, Math.floor(toNum(a.segments, 64)));
    const amp = toNum(a.amplitude, 20);
    const nr = toNum(a.noiseRadius, 2);
    const drift = toNum(a.time, 0) * toNum(a.speed, 0);
    const seed = toNum(a.seed, 42);
    const env = asArray(a.envelope);
    const svg = Array.from({ length: f.count }, (_, i) => {
      const r = toNum(f.get("radius", i), 50);
      const lane = i * toNum(a.scaleR, 0.1) * 10;
      const pts2 = Array.from({ length: segs }, (_2, k) => {
        const t = k / segs;
        const ang = t * Math.PI * 2;
        const n = noise2(Math.cos(ang) * nr + drift, Math.sin(ang) * nr + lane, seed);
        const scale = env.length ? toNum(env[Math.min(env.length - 1, Math.round(t * (env.length - 1)))], 1) : 1;
        const rr = r + n * amp * scale;
        return [Math.cos(ang) * rr, Math.sin(ang) * rr];
      });
      return `<path d="${smoothPath(pts2, 0.5, true)}" ${attrs} />`;
    });
    return { svg: f.isArray ? svg : svg[0] ?? "" };
  }
});
def3({
  type: "organic-cell",
  label: "Organic Cell",
  category: "primitives",
  inputs: [
    num("width", 50),
    num("height", 50),
    scalar("amplitude", 0.25),
    scalar("noiseScale", 1.5),
    scalar("octaves", 2),
    scalar("roughness", 0.5),
    scalar("nuclei", 2),
    scalar("nucleusSize", 0.15),
    scalar("seed", 0),
    scalar("segments", 64),
    ...modeIn()
  ],
  outputs: SVG_OUT,
  compute: (a) => {
    const f = fanout(a, ["width", "height"], { width: 50, height: 50 });
    const attrs = paint(a.renderMode ?? 0, toNum(a.strokeWidth, 2));
    const segs = Math.max(16, Math.floor(toNum(a.segments, 64)));
    const seed = toNum(a.seed, 0);
    const scale = toNum(a.noiseScale, 1.5);
    const octaves = Math.max(1, Math.floor(toNum(a.octaves, 2)));
    const roughness = toNum(a.roughness, 0.5);
    const amp = toNum(a.amplitude, 0.25);
    const nuclei = Math.floor(toNum(a.nuclei, 2));
    const nucleusSize = toNum(a.nucleusSize, 0.15);
    const svg = Array.from({ length: f.count }, (_, i) => {
      const rx = toNum(f.get("width", i), 50) / 2;
      const ry = toNum(f.get("height", i), 50) / 2;
      const ring = Array.from({ length: segs }, (_2, k) => {
        const ang = k / segs * Math.PI * 2;
        const n = fbm2(Math.cos(ang) * scale, Math.sin(ang) * scale, { octaves, roughness, seed: seed + i });
        const m = 1 + n * amp;
        return [Math.cos(ang) * rx * m, Math.sin(ang) * ry * m];
      });
      let body = `<path d="${smoothPath(ring, 0.5, true)}" ${attrs} />`;
      for (let k = 0; k < nuclei; k++) {
        const ang = k / Math.max(1, nuclei) * Math.PI * 2 + noise1(k + seed, seed) * 2;
        const dist = 0.35 + 0.2 * noise1(k * 3.1 + seed, seed + 11);
        body += `<ellipse cx="${fmt(Math.cos(ang) * rx * dist)}" cy="${fmt(Math.sin(ang) * ry * dist)}" rx="${fmt(rx * nucleusSize)}" ry="${fmt(ry * nucleusSize)}" ${attrs} />`;
      }
      return body;
    });
    return { svg: f.isArray ? svg : svg[0] ?? "" };
  }
});
var FACE = { OFF: 0, FILL: 1, STROKE: 2, BOTH: 3 };
function facePaint(mode, strokeWidth, colour) {
  if (mode === FACE.OFF) return null;
  const fill = colour || "var(--occlusion-color, var(--bg-color, #000))";
  const stroke = `var(--stroke-color, currentColor)`;
  const sw = `stroke-width="${fmt(strokeWidth)}" stroke-linejoin="round" vector-effect="non-scaling-stroke"`;
  if (mode === FACE.FILL) return `fill="${fill}" stroke="none"`;
  if (mode === FACE.STROKE) return `fill="none" stroke="${stroke}" ${sw}`;
  return `fill="${fill}" stroke="${stroke}" ${sw}`;
}
def3({
  type: "isometric-cube",
  label: "Isometric Cube",
  category: "primitives",
  inputs: [
    num("width", 40),
    num("depth", 40),
    num("height", 40),
    scalar("angle", 30),
    scalar("topFace", 1),
    scalar("bottomFace", 1),
    scalar("frontFace", 2),
    scalar("backFace", 2),
    scalar("leftFace", 2),
    scalar("rightFace", 2),
    scalar("strokeWidth", 1.5),
    { id: "topColor", type: "color", default: "" },
    { id: "bottomColor", type: "color", default: "" },
    { id: "frontColor", type: "color", default: "" },
    { id: "backColor", type: "color", default: "" },
    { id: "leftColor", type: "color", default: "" },
    { id: "rightColor", type: "color", default: "" }
  ],
  outputs: SVG_OUT,
  compute: (a) => {
    const f = fanout(a, ["width", "depth", "height"], { width: 40, depth: 40, height: 40 });
    const ang = toNum(a.angle, 30) * Math.PI / 180;
    const sw = toNum(a.strokeWidth, 1.5);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const svg = Array.from({ length: f.count }, (_, i) => {
      const w = toNum(f.get("width", i), 40);
      const d = toNum(f.get("depth", i), 40);
      const h = toNum(f.get("height", i), 40);
      const P = (x, y, z) => [(x - y) * cos, (x + y) * sin + z];
      const c = [
        P(0, 0, 0),
        P(w, 0, 0),
        P(w, d, 0),
        P(0, d, 0),
        // 0-3 bottom
        P(0, 0, h),
        P(w, 0, h),
        P(w, d, h),
        P(0, d, h)
        // 4-7 top
      ];
      const centre = c.reduce((t, p) => [t[0] + p[0] / 8, t[1] + p[1] / 8], [0, 0]);
      const face = (idx) => polyPath(idx.map((k) => [c[k][0] - centre[0], c[k][1] - centre[1]]), true);
      const faces = [
        ["bottomFace", "bottomColor", [0, 1, 2, 3]],
        ["backFace", "backColor", [3, 2, 6, 7]],
        ["leftFace", "leftColor", [0, 3, 7, 4]],
        ["rightFace", "rightColor", [1, 2, 6, 5]],
        ["frontFace", "frontColor", [0, 1, 5, 4]],
        ["topFace", "topColor", [4, 5, 6, 7]]
      ];
      let body = "";
      for (const [modeKey, colourKey, idx] of faces) {
        const attrs = facePaint(a[modeKey] ?? 0, sw, a[colourKey]);
        if (attrs) body += `<path d="${face(idx)}" ${attrs} />`;
      }
      return body;
    });
    return { svg: f.isArray ? svg : svg[0] ?? "" };
  }
});
function textFallback(content, fontSize, attrs) {
  return `<g transform="scale(1,-1)"><text x="0" y="0" font-size="${fmt(fontSize)}" font-family="sans-serif" text-anchor="middle" dominant-baseline="central" ${attrs}>${String(content).replace(/[<&>]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[ch])}</text></g>`;
}
def3({
  type: "letter",
  label: "Letter",
  category: "primitives",
  inputs: [str("char", "A"), num("fontSize", 72), ...modeIn()],
  outputs: SVG_OUT,
  compute: (a) => {
    const f = fanout(a, ["fontSize"], { fontSize: 72 });
    const attrs = paint(a.renderMode ?? 0, toNum(a.strokeWidth, 2));
    const ch = (a.char ?? "A").charAt(0) || "A";
    const svg = Array.from({ length: f.count }, (_, i) => {
      const size = toNum(f.get("fontSize", i), 72);
      const g = getFont() ? glyphPath(ch, size) : null;
      if (!g) return textFallback(ch, size, attrs);
      return g.pathData ? `<path d="${g.pathData}" ${attrs} />` : "";
    });
    return { svg: f.isArray ? svg : svg[0] ?? "" };
  }
});
def3({
  type: "word",
  label: "Word",
  category: "primitives",
  inputs: [str("text", "Hello"), num("fontSize", 72), scalar("letterSpacing", 0), ...modeIn()],
  outputs: [{ id: "svg", type: ["svg", "svg[]"] }, { id: "letters", type: "svg[]" }, { id: "count", type: "number" }],
  compute: (a) => {
    const f = fanout(a, ["fontSize"], { fontSize: 72 });
    const attrs = paint(a.renderMode ?? 0, toNum(a.strokeWidth, 2));
    const text = a.text ?? "Hello";
    const spacing = toNum(a.letterSpacing, 0);
    const svg = Array.from({ length: f.count }, (_, i) => {
      const size = toNum(f.get("fontSize", i), 72);
      const w = getFont() ? textPath(text, size, spacing) : null;
      if (!w) return textFallback(text, size, attrs);
      return w.pathData ? `<path d="${w.pathData}" ${attrs} />` : "";
    });
    const size0 = toNum(f.get("fontSize", 0), 72);
    const letters = [...text].map((ch) => {
      const g = getFont() ? glyphPath(ch, size0) : null;
      return g?.pathData ? `<path d="${g.pathData}" ${attrs} />` : g ? "" : textFallback(ch, size0, attrs);
    });
    return { svg: f.isArray ? svg : svg[0] ?? "", letters, count: letters.length };
  }
});

// ../pattern-generator/src/nodes/transforms.js
var OUT2 = [{ id: "svg", type: "svg" }];
var transformNodes = {
  scale: {
    type: "scale",
    label: "Scale",
    category: "transforms",
    inputs: [svgIn(), scalar("amount", 1)],
    outputs: OUT2,
    compute: (a) => ({ svg: group(`scale(${fmt(toNum(a.amount, 1))})`, a.svg) })
  },
  rotate: {
    type: "rotate",
    label: "Rotate",
    category: "transforms",
    inputs: [svgIn(), scalar("amount", 0)],
    outputs: OUT2,
    compute: (a) => ({ svg: group(`rotate(${fmt(toNum(a.amount, 0))})`, a.svg) })
  },
  translate: {
    type: "translate",
    label: "Translate",
    category: "transforms",
    inputs: [svgIn(), scalar("x", 0), scalar("y", 0)],
    outputs: OUT2,
    compute: (a) => ({ svg: group(`translate(${fmt(toNum(a.x, 0))}, ${fmt(toNum(a.y, 0))})`, a.svg) })
  },
  skew: {
    type: "skew",
    label: "Skew",
    category: "transforms",
    inputs: [svgIn(), scalar("skewX", 0), scalar("skewY", 0)],
    outputs: OUT2,
    compute: (a) => {
      const sx = toNum(a.skewX, 0);
      const sy = toNum(a.skewY, 0);
      const t = [sx ? `skewX(${fmt(sx)})` : "", sy ? `skewY(${fmt(sy)})` : ""].filter(Boolean).join(" ");
      return { svg: group(t, a.svg) };
    }
  },
  mirror: {
    type: "mirror",
    label: "Mirror",
    category: "transforms",
    inputs: [svgIn(), scalar("axis", 0), scalar("keepOriginal", 1)],
    outputs: OUT2,
    compute: (a) => {
      if (!a.svg) return { svg: "" };
      const flips = a.axis === 2 ? ["scale(-1,1)", "scale(1,-1)", "scale(-1,-1)"] : [a.axis === 1 ? "scale(1,-1)" : "scale(-1,1)"];
      const parts = a.keepOriginal ? [a.svg] : [];
      for (const t of flips) parts.push(`<g transform="${t}">${a.svg}</g>`);
      return { svg: parts.join("") };
    }
  },
  "iso-translate": {
    type: "iso-translate",
    label: "Iso Translate",
    category: "transforms",
    inputs: [svgIn(), scalar("x", 0), scalar("y", 0), scalar("z", 0), scalar("angle", 30)],
    outputs: OUT2,
    compute: (a) => ({ svg: group(isoTransform(a.x, a.y, a.z, a.angle), a.svg) })
  }
};
function isoTransform(x, y, z, angleDeg) {
  const ang = toNum(angleDeg, 30) * Math.PI / 180;
  const X = toNum(x, 0);
  const Y = toNum(y, 0);
  const Z = toNum(z, 0);
  const px = (X - Y) * Math.cos(ang);
  const py = (X + Y) * Math.sin(ang) + Z;
  return px || py ? `translate(${fmt(px)}, ${fmt(py)})` : "";
}

// ../pattern-generator/src/nodes/layout.js
var layoutNodes = {};
var def4 = (d) => {
  layoutNodes[d.type] = d;
};
var place = (x, y, inner, scale = 1, rotation = 0) => {
  if (!inner) return "";
  let t = `translate(${fmt(x)}, ${fmt(y)})`;
  if (scale !== 1) t += ` scale(${Number(scale).toFixed(4)})`;
  if (rotation) t += ` rotate(${fmt(rotation)})`;
  return `<g transform="${t}">${inner}</g>`;
};
def4({
  type: "compose",
  label: "Compose",
  category: "layout",
  inputs: [svgList(), arr("x"), arr("y"), arr("scale"), arr("rotation"), arr("depth")],
  outputs: [{ id: "svg", type: "svg" }],
  compute: (a) => {
    const items = asArray(a.items);
    if (!items.length) return { svg: "" };
    const xs = asArray(a.x);
    const ys = asArray(a.y);
    const scales = asArray(a.scale);
    const rots = asArray(a.rotation);
    const depth = asArray(a.depth);
    const n = xs.length || ys.length ? Math.min(items.length, Math.max(xs.length, ys.length)) : items.length;
    let order = Array.from({ length: n }, (_, i) => i);
    if (depth.length) order = order.sort((i, j) => toNum(depth[i], 0) - toNum(depth[j], 0));
    const parts = order.map((i) => {
      const s = scales.length ? toNum(pick(scales, i, 1), 1) : 1;
      if (s === 0) return "";
      return place(
        toNum(pick(xs, i, 0), 0),
        toNum(pick(ys, i, 0), 0),
        items[i],
        s,
        rots.length ? toNum(pick(rots, i, 0), 0) : 0
      );
    });
    return { svg: parts.join("") };
  }
});
def4({
  type: "stack",
  label: "Stack",
  category: "layout",
  inputs: [svgList()],
  outputs: [{ id: "svg", type: "svg" }],
  // Everything at the origin, in order — the simplest possible overlay.
  compute: (a) => ({ svg: asArray(a.items).filter(Boolean).join("") })
});
def4({
  type: "grid",
  label: "Grid",
  category: "layout",
  inputs: [svgList(), scalar("cols", 3), scalar("spacingX", 60), scalar("spacingY", 60)],
  outputs: [{ id: "svg", type: "svg" }],
  compute: (a) => {
    const items = asArray(a.items);
    if (!items.length) return { svg: "" };
    const cols = Math.max(1, Math.floor(toNum(a.cols, 3)));
    const rows = Math.ceil(items.length / cols);
    const sx = toNum(a.spacingX, 60);
    const sy = toNum(a.spacingY, 60);
    const ox = (cols - 1) * sx / 2;
    const oy = (rows - 1) * sy / 2;
    const svg = items.map((item, i) => place(i % cols * sx - ox, Math.floor(i / cols) * sy - oy, item)).join("");
    return { svg };
  }
});
def4({
  type: "circular",
  label: "Circular",
  category: "layout",
  inputs: [
    svgList(),
    scalar("count", 6),
    scalar("radius", 100),
    scalar("startAngle", 0),
    { id: "rotateItems", type: "boolean", default: true }
  ],
  outputs: [{ id: "svg", type: "svg" }],
  compute: (a) => {
    const items = asArray(a.items);
    if (!items.length) return { svg: "" };
    const n = Math.max(1, Math.floor(toNum(a.count, 6)));
    const r = toNum(a.radius, 100);
    const start = toNum(a.startAngle, 0);
    const parts = [];
    for (let i = 0; i < n; i++) {
      const deg = start + 360 * i / n;
      const rad = deg * Math.PI / 180;
      parts.push(place(
        Math.cos(rad) * r,
        Math.sin(rad) * r,
        items[i % items.length],
        1,
        a.rotateItems === false ? 0 : deg
      ));
    }
    return { svg: parts.join("") };
  }
});
var positionOutputs = [
  { id: "items", type: "svg[]" },
  { id: "x", type: "number[]" },
  { id: "y", type: "number[]" },
  { id: "row", type: "number[]" },
  { id: "col", type: "number[]" },
  { id: "index", type: "number[]" },
  { id: "normalizedX", type: "number[]" },
  { id: "normalizedY", type: "number[]" }
];
var fit = (items, count) => items.length ? Array.from({ length: count }, (_, i) => items[i % items.length]) : [];
def4({
  type: "grid-positions",
  label: "Grid Positions",
  category: "layout",
  inputs: [
    svgList(),
    scalar("count", 9),
    scalar("cols", 3),
    scalar("spacingX", 60),
    scalar("spacingY", 60),
    scalar("offset", 0)
  ],
  outputs: positionOutputs,
  compute: (a) => {
    const count = Math.max(1, Math.floor(toNum(a.count, 9)));
    const cols = Math.max(1, Math.floor(toNum(a.cols, 3)));
    const rows = Math.ceil(count / cols);
    const sx = toNum(a.spacingX, 60);
    const sy = toNum(a.spacingY, 60);
    const ox = (cols - 1) * sx / 2;
    const oy = (rows - 1) * sy / 2;
    const x = [];
    const y = [];
    const row = [];
    const col = [];
    const index = [];
    const normalizedX = [];
    const normalizedY = [];
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const shift = a.offset === 1 && r % 2 === 1 ? sx / 2 : 0;
      x.push(c * sx - ox + shift);
      y.push(r * sy - oy);
      row.push(r);
      col.push(c);
      index.push(i);
      normalizedX.push(cols === 1 ? 0 : c / (cols - 1));
      normalizedY.push(rows === 1 ? 0 : r / (rows - 1));
    }
    return { items: fit(asArray(a.items), count), x, y, row, col, index, normalizedX, normalizedY, count };
  }
});
def4({
  type: "isometric-positions",
  label: "Isometric Positions",
  category: "layout",
  inputs: [svgList(), scalar("count", 9), scalar("cols", 3), scalar("spacing", 60)],
  outputs: positionOutputs,
  compute: (a) => {
    const count = Math.max(1, Math.floor(toNum(a.count, 9)));
    const cols = Math.max(1, Math.floor(toNum(a.cols, 3)));
    const rows = Math.ceil(count / cols);
    const s = toNum(a.spacing, 60);
    const hx = s * Math.cos(Math.PI / 6);
    const hy = s * 0.5;
    const x = [];
    const y = [];
    const row = [];
    const col = [];
    const index = [];
    const normalizedX = [];
    const normalizedY = [];
    for (let i = 0; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      x.push((c - r) * hx);
      y.push((c + r) * hy);
      row.push(r);
      col.push(c);
      index.push(i);
      normalizedX.push(cols === 1 ? 0 : c / (cols - 1));
      normalizedY.push(rows === 1 ? 0 : r / (rows - 1));
    }
    const cx = x.reduce((t, v) => t + v, 0) / count;
    const cy = y.reduce((t, v) => t + v, 0) / count;
    return {
      items: fit(asArray(a.items), count),
      x: x.map((v) => v - cx),
      y: y.map((v) => v - cy),
      row,
      col,
      index,
      normalizedX,
      normalizedY,
      count
    };
  }
});
def4({
  type: "circular-positions",
  label: "Circular Positions",
  category: "layout",
  inputs: [svgList(), scalar("count", 8), scalar("radius", 100), scalar("startAngle", 0), scalar("spread", 360)],
  outputs: [
    { id: "items", type: "svg[]" },
    { id: "x", type: "number[]" },
    { id: "y", type: "number[]" },
    { id: "angle", type: "number[]" },
    { id: "normalizedAngle", type: "number[]" },
    { id: "index", type: "number[]" }
  ],
  compute: (a) => {
    const n = Math.max(1, Math.floor(toNum(a.count, 8)));
    const r = toNum(a.radius, 100);
    const start = toNum(a.startAngle, 0);
    const spread2 = toNum(a.spread, 360);
    const full = Math.abs(spread2 % 360) < 1e-9 && spread2 !== 0;
    const x = [];
    const y = [];
    const angle = [];
    const normalizedAngle = [];
    for (let i = 0; i < n; i++) {
      const t = full ? i / n : n === 1 ? 0 : i / (n - 1);
      const deg = start + t * spread2;
      const rad = deg * Math.PI / 180;
      x.push(Math.cos(rad) * r);
      y.push(Math.sin(rad) * r);
      angle.push(deg);
      normalizedAngle.push(t);
    }
    return { items: fit(asArray(a.items), n), x, y, angle, normalizedAngle, index: x.map((_, i) => i), count: n };
  }
});
def4({
  type: "grid-lines",
  label: "Grid Lines",
  category: "layout",
  inputs: [
    scalar("cols", 5),
    scalar("rows", 5),
    scalar("width", 200),
    scalar("height", 200),
    scalar("horizontals", 1),
    scalar("verticals", 1)
  ],
  outputs: [
    { id: "x1", type: "number[]" },
    { id: "y1", type: "number[]" },
    { id: "x2", type: "number[]" },
    { id: "y2", type: "number[]" },
    { id: "count", type: "number" },
    { id: "index", type: "number[]" },
    { id: "isHorizontal", type: "number[]" }
  ],
  compute: (a) => {
    const cols = Math.max(1, Math.floor(toNum(a.cols, 5)));
    const rows = Math.max(1, Math.floor(toNum(a.rows, 5)));
    const w = toNum(a.width, 200);
    const h = toNum(a.height, 200);
    const x1 = [];
    const y1 = [];
    const x2 = [];
    const y2 = [];
    const isHorizontal = [];
    if (a.horizontals !== 0) {
      for (let r = 0; r <= rows; r++) {
        const y = -h / 2 + h * r / rows;
        x1.push(-w / 2);
        y1.push(y);
        x2.push(w / 2);
        y2.push(y);
        isHorizontal.push(1);
      }
    }
    if (a.verticals !== 0) {
      for (let c = 0; c <= cols; c++) {
        const x = -w / 2 + w * c / cols;
        x1.push(x);
        y1.push(-h / 2);
        x2.push(x);
        y2.push(h / 2);
        isHorizontal.push(0);
      }
    }
    return { x1, y1, x2, y2, count: x1.length, index: x1.map((_, i) => i), isHorizontal };
  }
});
def4({
  type: "packed-grid",
  label: "Packed Grid",
  category: "layout",
  inputs: [
    svgList(),
    scalar("cols", 8),
    scalar("rows", 6),
    scalar("spacingX", 50),
    scalar("spacingY", 50),
    scalar("maxWidth", 3),
    scalar("maxHeight", 3),
    scalar("seed", 42)
  ],
  outputs: [
    { id: "items", type: "svg[]" },
    { id: "x", type: "number[]" },
    { id: "y", type: "number[]" },
    { id: "width", type: "number[]" },
    { id: "height", type: "number[]" },
    { id: "area", type: "number[]" },
    { id: "cellCols", type: "number[]" },
    { id: "cellRows", type: "number[]" },
    { id: "count", type: "number" }
  ],
  compute: (a) => {
    const cols = Math.max(1, Math.floor(toNum(a.cols, 8)));
    const rows = Math.max(1, Math.floor(toNum(a.rows, 6)));
    const sx = toNum(a.spacingX, 50);
    const sy = toNum(a.spacingY, 50);
    const maxW = Math.max(1, Math.floor(toNum(a.maxWidth, 3)));
    const maxH = Math.max(1, Math.floor(toNum(a.maxHeight, 3)));
    const rng = makeRng(toNum(a.seed, 42));
    const taken = new Uint8Array(cols * rows);
    const out = { x: [], y: [], width: [], height: [], area: [], cellCols: [], cellRows: [] };
    const ox = (cols - 1) * sx / 2;
    const oy = (rows - 1) * sy / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (taken[r * cols + c]) continue;
        let w = 1 + Math.floor(rng() * maxW);
        let h = 1 + Math.floor(rng() * maxH);
        w = Math.min(w, cols - c);
        h = Math.min(h, rows - r);
        let fits = false;
        while (!fits && w > 0 && h > 0) {
          fits = true;
          for (let rr = r; rr < r + h && fits; rr++)
            for (let cc = c; cc < c + w && fits; cc++)
              if (taken[rr * cols + cc]) fits = false;
          if (!fits) {
            if (w >= h) w--;
            else h--;
          }
        }
        if (w <= 0 || h <= 0) {
          w = 1;
          h = 1;
        }
        for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) taken[rr * cols + cc] = 1;
        out.x.push((c + (w - 1) / 2) * sx - ox);
        out.y.push((r + (h - 1) / 2) * sy - oy);
        out.width.push(w * sx);
        out.height.push(h * sy);
        out.area.push(w * h);
        out.cellCols.push(w);
        out.cellRows.push(h);
      }
    }
    return { ...out, items: fit(asArray(a.items), out.x.length), count: out.x.length };
  }
});
def4({
  type: "recursive-subdivide",
  label: "Recursive Subdivide",
  category: "layout",
  inputs: [
    scalar("width", 500),
    scalar("height", 500),
    scalar("maxDepth", 6),
    scalar("splitChance", 0.85),
    scalar("depthDecay", 0.12),
    scalar("seed", 42)
  ],
  outputs: [
    { id: "x", type: "number[]" },
    { id: "y", type: "number[]" },
    { id: "width", type: "number[]" },
    { id: "height", type: "number[]" },
    { id: "depth", type: "number[]" },
    { id: "count", type: "number" },
    { id: "points", type: "point[]" }
  ],
  compute: (a) => {
    const rng = makeRng(toNum(a.seed, 42));
    const maxDepth = Math.max(1, Math.floor(toNum(a.maxDepth, 6)));
    const chance0 = toNum(a.splitChance, 0.85);
    const decay = toNum(a.depthDecay, 0.12);
    const out = { x: [], y: [], width: [], height: [], depth: [] };
    const walk = (x, y, w, h, depth) => {
      if (depth >= maxDepth || rng() > chance0 - depth * decay || w < 4 || h < 4) {
        out.x.push(x + w / 2);
        out.y.push(y + h / 2);
        out.width.push(w);
        out.height.push(h);
        out.depth.push(depth);
        return;
      }
      const cut = 0.35 + rng() * 0.3;
      if (w >= h) {
        walk(x, y, w * cut, h, depth + 1);
        walk(x + w * cut, y, w * (1 - cut), h, depth + 1);
      } else {
        walk(x, y, w, h * cut, depth + 1);
        walk(x, y + h * cut, w, h * (1 - cut), depth + 1);
      }
    };
    const W = toNum(a.width, 500);
    const H = toNum(a.height, 500);
    walk(-W / 2, -H / 2, W, H, 0);
    return { ...out, points: out.x.map((x, i) => [x, out.y[i]]), count: out.x.length };
  }
});

// ../pattern-generator/src/nodes/effects.js
var effectNodes = {
  "radial-falloff": {
    type: "radial-falloff",
    label: "Radial Falloff",
    category: "effects",
    inputs: [
      arr("x"),
      arr("y"),
      scalar("centerX", 0),
      scalar("centerY", 0),
      scalar("strength", 1),
      scalar("falloff", 100)
    ],
    outputs: [
      { id: "x", type: "number[]" },
      { id: "y", type: "number[]" },
      { id: "scale", type: "number[]" },
      { id: "distance", type: "number[]" }
    ],
    compute: (a) => {
      const X = asArray(a.x);
      const Y = asArray(a.y);
      const cx = toNum(a.centerX, 0);
      const cy = toNum(a.centerY, 0);
      const strength = toNum(a.strength, 1);
      const falloff = Math.max(1, toNum(a.falloff, 100));
      const n = Math.max(X.length, Y.length);
      const outX = [];
      const outY = [];
      const scale = [];
      const distance = [];
      for (let i = 0; i < n; i++) {
        const x = toNum(X[i % (X.length || 1)], 0);
        const y = toNum(Y[i % (Y.length || 1)], 0);
        const dx = x - cx;
        const dy = y - cy;
        const d = Math.hypot(dx, dy);
        const t = Math.min(1, d / falloff);
        const k = 1 - t * t * (3 - 2 * t);
        const push = k * strength;
        const m = d === 0 ? 0 : push / d;
        outX.push(x + dx * m);
        outY.push(y + dy * m);
        scale.push(k);
        distance.push(d);
      }
      return { x: outX, y: outY, scale, distance };
    }
  }
};

// ../pattern-generator/src/nodes/iteration.js
var ITEMS_OUT = [{ id: "items", type: "svg[]" }];
var FILTER_MODE = { EVENS: 0, ODDS: 1, FIRST_N: 2, LAST_N: 3, EVERY_NTH: 4 };
function filterPredicate(filter, total) {
  if (!filter || typeof filter !== "object") return () => true;
  const n = Math.max(1, Math.floor(toNum(filter.n, 2)));
  switch (filter.mode) {
    case FILTER_MODE.EVENS:
      return (i) => i % 2 === 0;
    case FILTER_MODE.ODDS:
      return (i) => i % 2 === 1;
    case FILTER_MODE.FIRST_N:
      return (i) => i < n;
    case FILTER_MODE.LAST_N:
      return (i) => i >= total - n;
    case FILTER_MODE.EVERY_NTH:
      return (i) => i % n === 0;
    default:
      return () => true;
  }
}
function mapNode(type, label, extraInputs, transform) {
  return {
    type,
    label,
    category: "iteration",
    inputs: [svgList(), ...extraInputs, { id: "filter", type: "filter", default: null }],
    outputs: ITEMS_OUT,
    compute: (a) => {
      const items = asArray(a.items);
      const keep = filterPredicate(a.filter, items.length);
      return {
        items: items.map((item, i) => {
          if (!keep(i) || !item) return item;
          const t = transform(a, i);
          return t ? `<g transform="${t}">${item}</g>` : item;
        })
      };
    }
  };
}
var iterationNodes = {
  collect: {
    type: "collect",
    label: "Collect",
    category: "iteration",
    inputs: [
      { id: "items", type: "svg[]", default: [], multiConnection: true },
      svgList("items1"),
      svgList("items2"),
      svgList("items3"),
      svgList("items4"),
      scalar("mode", 0),
      scalar("seed", 12345)
    ],
    outputs: ITEMS_OUT,
    compute: (a) => {
      const groups = [a.items, a.items1, a.items2, a.items3, a.items4].map(asArray).filter((g) => g.length);
      if (!groups.length) return { items: [] };
      if (a.mode === 1) {
        const rng = makeRng(toNum(a.seed, 12345));
        const cursors = groups.map(() => 0);
        const out2 = [];
        const total = groups.reduce((t, g) => t + g.length, 0);
        while (out2.length < total) {
          const live = groups.map((g2, i) => cursors[i] < g2.length ? i : -1).filter((i) => i >= 0);
          const g = live[Math.floor(rng() * live.length)];
          out2.push(groups[g][cursors[g]++]);
        }
        return { items: out2 };
      }
      const out = [];
      const longest = Math.max(...groups.map((g) => g.length));
      for (let i = 0; i < longest; i++) for (const g of groups) if (i < g.length) out.push(g[i]);
      return { items: out };
    }
  },
  repeat: {
    type: "repeat",
    label: "Repeat",
    category: "iteration",
    inputs: [svgIn(), scalar("count", 5)],
    outputs: [{ id: "items", type: "svg[]" }, { id: "indices", type: "number[]" }],
    compute: (a) => {
      const n = Math.max(1, Math.floor(toNum(a.count, 5)));
      return {
        items: a.svg ? new Array(n).fill(a.svg) : [],
        indices: Array.from({ length: n }, (_, i) => i)
      };
    }
  },
  "repeat-each": {
    type: "repeat-each",
    label: "Repeat Each",
    category: "iteration",
    inputs: [{ id: "values", type: "any", default: [] }, scalar("count", 2)],
    outputs: [{ id: "result", type: "any" }],
    compute: (a) => {
      const n = Math.max(1, Math.floor(toNum(a.count, 2)));
      const list = asArray(a.values);
      const result = list.flatMap((v) => new Array(n).fill(v));
      return { result, items: result, values: result };
    }
  },
  tile: {
    type: "tile",
    label: "Tile",
    category: "iteration",
    inputs: [{ id: "values", type: "any", default: [] }, scalar("count", 2)],
    outputs: [{ id: "result", type: "any" }],
    compute: (a) => {
      const n = Math.max(1, Math.floor(toNum(a.count, 2)));
      const list = asArray(a.values);
      const result = [];
      for (let i = 0; i < n; i++) result.push(...list);
      return { result, items: result, values: result };
    }
  },
  filter: {
    type: "filter",
    label: "Filter",
    category: "iteration",
    inputs: [svgList(), scalar("mode", FILTER_MODE.FIRST_N), scalar("n", 2)],
    outputs: [{ id: "items", type: "svg[]" }, { id: "filter", type: "filter" }],
    compute: (a) => {
      const items = asArray(a.items);
      const descriptor = { mode: a.mode ?? FILTER_MODE.FIRST_N, n: Math.max(1, Math.floor(toNum(a.n, 2))) };
      const keep = filterPredicate(descriptor, items.length);
      return { items: items.filter((_, i) => keep(i)), filter: descriptor };
    }
  },
  shuffle: {
    type: "shuffle",
    label: "Shuffle",
    category: "iteration",
    inputs: [svgList(), scalar("seed", 42)],
    outputs: ITEMS_OUT,
    compute: (a) => {
      const items = asArray(a.items).slice();
      const rng = makeRng(toNum(a.seed, 42));
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      return { items };
    }
  },
  "map-rotate": mapNode(
    "map-rotate",
    "Map Rotate",
    [{ id: "angles", type: "number[]", default: [] }],
    (a, i) => {
      const v = toNum(pick(asArray(a.angles), i, 0), 0);
      return v ? `rotate(${fmt(v)})` : "";
    }
  ),
  "map-scale": mapNode(
    "map-scale",
    "Map Scale",
    [{ id: "scales", type: "number[]", default: [] }],
    (a, i) => {
      const v = toNum(pick(asArray(a.scales), i, 1), 1);
      return v === 1 ? "" : `scale(${v.toFixed(4)})`;
    }
  ),
  "map-translate": mapNode(
    "map-translate",
    "Map Translate",
    [{ id: "x", type: "number[]", default: [] }, { id: "y", type: "number[]", default: [] }],
    (a, i) => {
      const x = toNum(pick(asArray(a.x), i, 0), 0);
      const y = toNum(pick(asArray(a.y), i, 0), 0);
      return x || y ? `translate(${fmt(x)}, ${fmt(y)})` : "";
    }
  ),
  "map-iso-translate": mapNode(
    "map-iso-translate",
    "Map Iso Translate",
    [
      { id: "x", type: "number[]", default: [] },
      { id: "y", type: "number[]", default: [] },
      { id: "z", type: "number[]", default: [] },
      scalar("angle", 30)
    ],
    (a, i) => isoTransform(pick(asArray(a.x), i, 0), pick(asArray(a.y), i, 0), pick(asArray(a.z), i, 0), a.angle)
  ),
  "map-mask": {
    type: "map-mask",
    label: "Map Mask",
    category: "iteration",
    inputs: [
      svgList(),
      num("width", 50),
      num("height", 50),
      num("offsetX", 0),
      num("offsetY", 0),
      { id: "filter", type: "filter", default: null }
    ],
    outputs: ITEMS_OUT,
    compute: (a, ctx = {}) => {
      const items = asArray(a.items);
      const keep = filterPredicate(a.filter, items.length);
      const nextId = ctx.nextId ?? ((p) => `${p}-${Math.random().toString(36).slice(2, 8)}`);
      return {
        items: items.map((item, i) => {
          if (!keep(i) || !item) return item;
          const w = toNum(pick(asArray(a.width), i, a.width), 50);
          const h = toNum(pick(asArray(a.height), i, a.height), 50);
          const ox = toNum(pick(asArray(a.offsetX), i, a.offsetX), 0);
          const oy = toNum(pick(asArray(a.offsetY), i, a.offsetY), 0);
          const id = nextId("mask");
          return `<g><defs><clipPath id="${id}"><rect x="${fmt(ox - w / 2)}" y="${fmt(oy - h / 2)}" width="${fmt(w)}" height="${fmt(h)}"/></clipPath></defs><g clip-path="url(#${id})">${item}</g></g>`;
        })
      };
    }
  }
};

// ../pattern-generator/src/nodes/svgnodes.js
var DEFAULTS = {
  stroke: "#e8e6e1",
  fill: "#e8e6e1",
  background: "#111110",
  occlusion: "#111110"
};
var svgNodes = {
  mask: {
    type: "mask",
    label: "Mask",
    category: "svg",
    inputs: [svgIn(), scalar("width", 100), scalar("height", 100), scalar("offsetX", 0), scalar("offsetY", 0)],
    outputs: [{ id: "svg", type: "svg" }],
    compute: (a, ctx = {}) => {
      if (!a.svg) return { svg: "" };
      const w = toNum(a.width, 100);
      const h = toNum(a.height, 100);
      const ox = toNum(a.offsetX, 0);
      const oy = toNum(a.offsetY, 0);
      const id = (ctx.nextId ?? ((p) => `${p}-0`))("mask");
      return {
        svg: `<g><defs><clipPath id="${id}"><rect x="${fmt(ox - w / 2)}" y="${fmt(oy - h / 2)}" width="${fmt(w)}" height="${fmt(h)}"/></clipPath></defs><g clip-path="url(#${id})">${a.svg}</g></g>`
      };
    }
  },
  "custom-shape": {
    type: "custom-shape",
    label: "Custom Shape",
    category: "svg",
    inputs: [
      str("code", ""),
      scalar("scale", 1),
      scalar("offsetX", 0),
      scalar("offsetY", 0),
      scalar("renderMode", 0),
      scalar("strokeWidth", 2)
    ],
    outputs: [{ id: "svg", type: "svg" }],
    compute: (a) => {
      const code = (a.code ?? "").trim();
      if (!code) return { svg: "" };
      const viewBox = /viewBox\s*=\s*"([^"]+)"/i.exec(code);
      let inner = code;
      const doc = /<svg[^>]*>([\s\S]*)<\/svg>/i.exec(code);
      if (doc) inner = doc[1];
      let normalise = 1;
      let cx = 0;
      let cy = 0;
      if (viewBox) {
        const [vx, vy, vw, vh] = viewBox[1].trim().split(/[\s,]+/).map(Number);
        if (Number.isFinite(vw) && Number.isFinite(vh) && vw > 0 && vh > 0) {
          normalise = 80 / Math.max(vw, vh);
          cx = vx + vw / 2;
          cy = vy + vh / 2;
        }
      }
      const stripped = inner.replace(/\s+fill="[^"]*"/gi, "").replace(/\s+stroke="[^"]*"/gi, "").replace(/\s+stroke-width="[^"]*"/gi, "").replace(/\s+vector-effect="[^"]*"/gi, "");
      const mode = a.renderMode ?? 0;
      const sw = toNum(a.strokeWidth, 2);
      const paintAttrs = mode === 1 ? `fill="none" stroke="var(--stroke-color, currentColor)" stroke-width="${fmt(sw)}" vector-effect="non-scaling-stroke"` : mode === 2 ? `fill="var(--fill-color, currentColor)" stroke="var(--stroke-color, currentColor)" stroke-width="${fmt(sw)}" vector-effect="non-scaling-stroke"` : `fill="var(--fill-color, currentColor)"`;
      const painted = stripped.replace(
        /<(path|circle|rect|polygon|ellipse|line|polyline)(\s|\/|>)/gi,
        `<$1 ${paintAttrs}$2`
      );
      const s = normalise * toNum(a.scale, 1);
      const t = `translate(${fmt(toNum(a.offsetX, 0))}, ${fmt(toNum(a.offsetY, 0))}) scale(${s.toFixed(4)}, ${(-s).toFixed(4)}) translate(${fmt(-cx)}, ${fmt(-cy)})`;
      return { svg: `<g transform="${t}">${painted}</g>` };
    }
  },
  crop: {
    type: "crop",
    label: "Crop",
    category: "svg",
    inputs: [svgIn(), scalar("padding", 0)],
    outputs: [{ id: "svg", type: "svg" }, { id: "width", type: "number" }, { id: "height", type: "number" }],
    // A true crop needs a measured bounding box, which only a DOM provides.
    // Headless, the padding is carried forward for the canvas to apply.
    compute: (a) => ({ svg: a.svg ?? "", padding: toNum(a.padding, 0), width: 0, height: 0 })
  },
  canvas: {
    type: "canvas",
    label: "Canvas",
    category: "output",
    inputs: [
      svgIn(),
      scalar("width", 500),
      scalar("height", 500),
      { id: "strokeColor", type: "color", default: DEFAULTS.stroke },
      { id: "fillColor", type: "color", default: DEFAULTS.fill },
      { id: "backgroundColor", type: "color", default: DEFAULTS.background },
      { id: "occlusionColor", type: "color", default: DEFAULTS.occlusion }
    ],
    outputs: [{ id: "svg", type: "svg" }, { id: "width", type: "number" }, { id: "height", type: "number" }],
    compute: (a) => {
      const w = toNum(a.width, 500);
      const h = toNum(a.height, 500);
      const bg = a.backgroundColor ?? DEFAULTS.background;
      const vars = [
        `--stroke-color:${a.strokeColor ?? DEFAULTS.stroke}`,
        `--fill-color:${a.fillColor ?? DEFAULTS.fill}`,
        `--bg-color:${bg}`,
        `--occlusion-color:${a.occlusionColor ?? bg}`
      ].join(";");
      const background = bg === "transparent" ? "" : `<rect x="0" y="0" width="${fmt(w)}" height="${fmt(h)}" fill="${bg}"/>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w)}" height="${fmt(h)}" viewBox="0 0 ${fmt(w)} ${fmt(h)}" style="${vars}">` + background + `<g transform="translate(${fmt(w / 2)}, ${fmt(h / 2)}) scale(1,-1)">${a.svg ?? ""}</g></svg>`;
      return { svg, width: w, height: h };
    }
  }
};

// ../pattern-generator/src/nodes/subgraph.js
var subgraphNodes = {
  "subgraph-input": {
    type: "subgraph-input",
    label: "Sub-Graph Input",
    category: "subgraphs",
    inputs: [str("portName", "input")],
    outputs: [{ id: "value", type: "any" }],
    // `bindings` is injected by the subgraph host; standalone it yields nothing.
    compute: (a, ctx = {}) => ({ value: ctx.bindings?.[a.portName ?? "input"] })
  },
  "subgraph-output": {
    type: "subgraph-output",
    label: "Sub-Graph Output",
    category: "subgraphs",
    inputs: [str("portName", "output"), { id: "value", type: "any", default: null }],
    outputs: [],
    compute: (a, ctx = {}) => {
      if (ctx.collect) ctx.collect(a.portName ?? "output", a.value);
      return { value: a.value };
    }
  }
};

// ../pattern-generator/src/nodes/index.js
var NODES = {
  ...inputNodes,
  ...mathNodes,
  ...pointNodes,
  ...primitiveNodes,
  ...transformNodes,
  ...layoutNodes,
  ...effectNodes,
  ...iterationNodes,
  ...svgNodes,
  ...subgraphNodes
};
var NODE_TYPES = Object.keys(NODES).sort();
var CATEGORIES = Object.values(NODES).reduce((acc, def5) => {
  (acc[def5.category] ??= []).push(def5.type);
  return acc;
}, {});

// ../pattern-generator/src/graph.js
function topoSort(nodes, connections) {
  const indegree = new Map(nodes.map((n) => [n.id, 0]));
  const downstream = new Map(nodes.map((n) => [n.id, []]));
  for (const c of connections) {
    if (!indegree.has(c.source.nodeId) || !indegree.has(c.target.nodeId)) continue;
    downstream.get(c.source.nodeId).push(c.target.nodeId);
    indegree.set(c.target.nodeId, indegree.get(c.target.nodeId) + 1);
  }
  const queue = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const next of downstream.get(id)) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) queue.push(next);
    }
  }
  if (order.length !== nodes.length) {
    const seen = new Set(order);
    const stuck = nodes.filter((n) => !seen.has(n.id)).map((n) => n.id);
    throw new Error(`Cycle in graph, involving: ${stuck.join(", ")}`);
  }
  return order;
}
var typeList = (t) => Array.isArray(t) ? t : [t ?? "any"];
var isArrayType = (x) => typeof x === "string" && x.endsWith("[]");
var isPointPort = (t) => typeList(t).includes("point");
var isAnyPort = (t) => typeList(t).includes("any");
var looksLikePoint = (v) => Array.isArray(v) && v.length === 2 && typeof v[0] === "number" && typeof v[1] === "number";
function coerce(value, port) {
  if (value === void 0) return void 0;
  if (isAnyPort(port.type)) return value;
  const types = typeList(port.type);
  const acceptsArray = types.some(isArrayType);
  const acceptsScalar = types.some((t) => !isArrayType(t));
  if (isPointPort(port.type) && !acceptsArray) {
    if (Array.isArray(value) && Array.isArray(value[0])) return value[0];
    return value;
  }
  if (acceptsArray && types.includes("point[]") && looksLikePoint(value)) return [value];
  if (Array.isArray(value)) {
    if (acceptsArray) return value;
    return value.length ? value[0] : void 0;
  }
  if (acceptsScalar) return value;
  if (acceptsArray) return value == null ? [] : [value];
  return value;
}
function pickUnknown(inputs, def5) {
  const known = new Set((def5.inputs ?? []).map((p) => p.id));
  const extra = {};
  for (const [k, v] of Object.entries(inputs)) if (!known.has(k)) extra[k] = v;
  return extra;
}
function evaluate(graph, options = {}) {
  const { overrides = {}, frame = 0, bindings = null, onDebug = null } = options;
  const nodes = graph.nodes ?? [];
  const connections = graph.connections ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const results = /* @__PURE__ */ new Map();
  let idCounter = 0;
  const collected = {};
  const ctx = {
    frame,
    bindings,
    onDebug,
    nextId: (prefix) => `${prefix}-${(idCounter++).toString(36)}`,
    collect: (name, value) => {
      collected[name] = value;
    }
  };
  const incoming = /* @__PURE__ */ new Map();
  for (const c of connections) {
    const key = `${c.target.nodeId}|${c.target.portId}`;
    if (!incoming.has(key)) incoming.set(key, []);
    incoming.get(key).push(c.source);
  }
  for (const id of topoSort(nodes, connections)) {
    const node2 = byId.get(id);
    const def5 = NODES[node2.type];
    if (!def5) {
      results.set(id, {});
      continue;
    }
    const args = {};
    for (const port of def5.inputs ?? []) {
      const sources = incoming.get(`${id}|${port.id}`) ?? [];
      if (sources.length > 1 || port.multiConnection && sources.length) {
        const merged = [];
        for (const src of sources) {
          const v = results.get(src.nodeId)?.[src.portId];
          if (Array.isArray(v)) merged.push(...v);
          else if (v != null) merged.push(v);
        }
        args[port.id] = merged;
      } else if (sources.length === 1) {
        const src = sources[0];
        args[port.id] = coerce(results.get(src.nodeId)?.[src.portId], port);
      }
      if (args[port.id] === void 0) {
        args[port.id] = node2.inputs?.[port.id] ?? port.default;
      }
    }
    Object.assign(args, node2.inputs ? pickUnknown(node2.inputs, def5) : {}, overrides[id] ?? {});
    try {
      results.set(id, def5.compute(args, ctx) ?? {});
    } catch (err) {
      throw new Error(`Node "${node2.label ?? id}" (${node2.type}) failed: ${err.message}`);
    }
  }
  results.subgraphOutputs = collected;
  return results;
}
function render(graph, options = {}) {
  const opts = options.overrides || options.frame !== void 0 ? options : { overrides: options };
  const results = evaluate(graph, opts);
  const canvas = (graph.nodes ?? []).find((n) => n.type === "canvas");
  if (!canvas) throw new Error("Graph has no canvas node to render from.");
  const out = results.get(canvas.id);
  if (!out?.svg) throw new Error("Canvas produced no SVG.");
  return out.svg;
}

// scripts/pattern-generator/src/catalogue.js
var node = (id, type, inputs = {}) => ({ id, type, inputs });
var wire = (from, fromPort, to, toPort) => ({
  source: { nodeId: from, portId: fromPort },
  target: { nodeId: to, portId: toPort }
});
var RENDER2 = { FILL: 0, STROKE: 1, BOTH: 2 };
var FACE2 = { OFF: 0, FILL: 1, STROKE: 2, BOTH: 3 };
var int = (key, label, def5, min, max) => ({ key, label, def: def5, min, max, kind: "int" });
var num2 = (key, label, def5, min, max, precision = 2) => ({ key, label, def: def5, min, max, kind: "num", precision });
var fit2 = (span, spacing) => Math.max(1, Math.round(span / spacing));
var ISO_RATIO = Math.cos(Math.PI / 6) / 0.5;
function isoCover(w, h, spacing) {
  const span = Math.max(w / (ISO_RATIO * spacing), h / spacing);
  return Math.max(2, Math.ceil(span) + 1);
}
var PATTERNS = [
  {
    id: "flow-lines",
    label: "Flow Lines",
    note: "Evenly spaced streamlines through a vector field.",
    params: [
      num2("separation", "Line spacing", 0.186, 0.02, 1, 3),
      num2("stopDistance", "Break distance", 0.036, 5e-3, 0.5, 3),
      num2("a", "Field warp A", 1.1, -4, 4),
      num2("b", "Field warp B", 0.25, -4, 4),
      num2("domain", "Field zoom", 5, 0.5, 20, 2),
      int("maxLines", "Max lines", 220, 10, 2e3),
      num2("strokeWidth", "Stroke width", 1, 0.1, 20)
    ],
    build: (w, h, p) => ({
      nodes: [
        node("field", "flow-lines", {
          fieldX: "cos(cos(y) - a * x * y)",
          fieldY: "x + b * sin(y)",
          a: p.a,
          b: p.b,
          width: w,
          height: h,
          domain: p.domain,
          separation: p.separation,
          stopDistance: p.stopDistance,
          simplify: 0.2,
          minLength: 0.4,
          maxLines: p.maxLines,
          seed: p.seed
        }),
        node("pen", "polyline", { strokeWidth: p.strokeWidth }),
        node("sheet", "compose", {}),
        node("out", "canvas", { width: w, height: h })
      ],
      connections: [
        wire("field", "groups", "pen", "points"),
        wire("pen", "svg", "sheet", "items"),
        wire("sheet", "svg", "out", "svg")
      ]
    })
  },
  {
    id: "flow-dots",
    label: "Flow Dots",
    note: "The same field, sampled as dots along each streamline.",
    params: [
      num2("separation", "Line spacing", 0.12, 0.02, 1, 3),
      num2("dotSpacing", "Dot spacing", 0.09, 0.01, 0.5, 3),
      num2("radius", "Dot radius", 1.6, 0.2, 20),
      num2("a", "Field warp A", 0.45, -4, 4),
      num2("b", "Field warp B", 1.3, -4, 4),
      num2("domain", "Field zoom", 4.5, 0.5, 20, 2),
      int("maxLines", "Max lines", 260, 10, 2e3)
    ],
    build: (w, h, p) => ({
      nodes: [
        node("field", "flow-lines", {
          fieldX: "sin(y) - a * x",
          fieldY: "cos(x * b) + y * 0.2",
          a: p.a,
          b: p.b,
          width: w,
          height: h,
          domain: p.domain,
          separation: p.separation,
          stopDistance: 0.03,
          dotSpacing: p.dotSpacing,
          minLength: 0.5,
          maxLines: p.maxLines,
          seed: p.seed
        }),
        node("unpack", "unpack-points", {}),
        node("dot", "circle", { radius: p.radius, renderMode: RENDER2.FILL }),
        // The fan only has to be long enough; surplus copies get no position.
        node("fan", "repeat", { count: 2e4 }),
        node("sheet", "compose", {}),
        node("out", "canvas", { width: w, height: h })
      ],
      connections: [
        wire("dot", "svg", "fan", "svg"),
        wire("fan", "items", "sheet", "items"),
        wire("field", "points", "unpack", "points"),
        wire("unpack", "x", "sheet", "x"),
        wire("unpack", "y", "sheet", "y"),
        wire("sheet", "svg", "out", "svg")
      ]
    })
  },
  {
    id: "truchet-arcs",
    label: "Truchet Arcs",
    note: "One quarter-arc tile, turned a random quarter turn per cell.",
    params: [
      num2("spacing", "Tile size", 40, 6, 400),
      num2("strokeWidth", "Stroke width", 2, 0.1, 20)
    ],
    build: (w, h, p) => {
      const cols = fit2(w, p.spacing);
      const rows = fit2(h, p.spacing);
      return {
        nodes: [
          node("cells", "grid-points", { cols, rows, spacingX: p.spacing, spacingY: p.spacing }),
          node("roll", "random", { seed: p.seed, min: 0, max: 4 }),
          node("quantise", "floor", {}),
          node("angle", "multiply", { amount: 90 }),
          node("tile", "arc", {
            radius: p.spacing / 2,
            angle: 90,
            rotation: 0,
            renderMode: RENDER2.STROKE,
            strokeWidth: p.strokeWidth
          }),
          node("fan", "repeat", { count: cols * rows }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h })
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
          wire("sheet", "svg", "out", "svg")
        ]
      };
    }
  },
  {
    id: "noise-field",
    label: "Noise Field",
    note: "A dot grid displaced and resized by 2D value noise.",
    params: [
      num2("spacing", "Dot spacing", 14, 3, 200),
      num2("radius", "Dot radius", 2, 0.2, 20),
      num2("jitter", "Displacement", 9, 0, 120),
      num2("noiseScale", "Noise scale", 0.012, 5e-4, 0.2, 4),
      num2("sizeVariation", "Size variation", 1.15, 0, 4)
    ],
    build: (w, h, p) => {
      const cols = fit2(w, p.spacing);
      const rows = fit2(h, p.spacing);
      return {
        nodes: [
          node("cells", "grid-points", { cols, rows, spacingX: p.spacing, spacingY: p.spacing }),
          node("warp", "jitter-points", { amount: p.jitter, scale: p.noiseScale, seed: p.seed, mode: 1 }),
          node("split", "unpack-points", {}),
          node("size", "noise", { scale: p.noiseScale, amplitude: p.sizeVariation, seed: p.seed + 1 }),
          node("bias", "add", { amount: 1.45 }),
          node("dot", "circle", { radius: p.radius, renderMode: RENDER2.FILL }),
          node("fan", "repeat", { count: cols * rows }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h })
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
          wire("sheet", "svg", "out", "svg")
        ]
      };
    }
  },
  {
    id: "subdivide",
    label: "Subdivide",
    note: "The sheet split recursively along its longer axis.",
    params: [
      int("maxDepth", "Max depth", 7, 1, 12),
      num2("splitChance", "Split chance", 0.92, 0, 1, 3),
      num2("depthDecay", "Depth decay", 0.1, 0, 1, 3),
      num2("inset", "Cell inset", 9, 0, 60),
      num2("cornerRadius", "Corner radius", 2, 0, 60),
      num2("strokeWidth", "Stroke width", 1.2, 0.1, 20)
    ],
    build: (w, h, p) => {
      const margin = 0.9;
      return {
        nodes: [
          node("split", "recursive-subdivide", {
            width: w * margin,
            height: h * margin,
            maxDepth: p.maxDepth,
            splitChance: p.splitChance,
            depthDecay: p.depthDecay,
            seed: p.seed
          }),
          node("insetW", "add", { amount: -p.inset }),
          node("insetH", "add", { amount: -p.inset }),
          node("cell", "rect", {
            renderMode: RENDER2.STROKE,
            strokeWidth: p.strokeWidth,
            cornerRadius: p.cornerRadius
          }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h })
        ],
        connections: [
          wire("split", "width", "insetW", "value"),
          wire("split", "height", "insetH", "value"),
          wire("insetW", "result", "cell", "width"),
          wire("insetH", "result", "cell", "height"),
          wire("cell", "svg", "sheet", "items"),
          wire("split", "x", "sheet", "x"),
          wire("split", "y", "sheet", "y"),
          wire("sheet", "svg", "out", "svg")
        ]
      };
    }
  },
  {
    id: "noise-rings",
    label: "Concentric Noise Rings",
    note: "A stack of closed curves at growing radii, wobbled by noise.",
    params: [
      int("count", "Ring count", 46, 2, 400),
      num2("amplitude", "Wobble", 13, 0, 120),
      num2("noiseRadius", "Wobble detail", 1.6, 0.1, 12),
      num2("innerRadius", "Inner radius", 26, 1, 2e3),
      int("segments", "Smoothness", 160, 12, 720),
      num2("strokeWidth", "Stroke width", 1, 0.1, 20)
    ],
    build: (w, h, p) => {
      const outer = Math.min(w, h) / 2 * 0.9;
      return {
        nodes: [
          node("radii", "linspace", { count: p.count, from: p.innerRadius, to: Math.max(p.innerRadius + 1, outer) }),
          node("ring", "noise-circle", {
            amplitude: p.amplitude,
            noiseRadius: p.noiseRadius,
            scaleR: 0.02,
            segments: p.segments,
            seed: p.seed,
            renderMode: RENDER2.STROKE,
            strokeWidth: p.strokeWidth
          }),
          node("sheet", "stack", {}),
          node("out", "canvas", { width: w, height: h })
        ],
        connections: [
          wire("radii", "values", "ring", "radius"),
          wire("ring", "svg", "sheet", "items"),
          wire("sheet", "svg", "out", "svg")
        ]
      };
    }
  },
  {
    id: "organic-rings",
    label: "Organic Cells",
    note: "Noise-modulated closed curves arranged on a ring.",
    params: [
      int("count", "Cell count", 28, 1, 200),
      num2("cellSize", "Cell size", 62, 4, 600),
      num2("amplitude", "Wobble", 0.38, 0, 1, 3),
      num2("noiseScale", "Wobble detail", 1.8, 0.1, 12),
      int("octaves", "Octaves", 3, 1, 8),
      num2("strokeWidth", "Stroke width", 1.2, 0.1, 20)
    ],
    build: (w, h, p) => {
      const radius = Math.min(w, h) / 2 * 0.58;
      return {
        nodes: [
          node("ring", "circle-points", { count: p.count, radius, spread: 360 }),
          node("spin", "random", { seed: p.seed, min: 0, max: 360 }),
          node("blob", "organic-cell", {
            width: p.cellSize,
            height: p.cellSize,
            amplitude: p.amplitude,
            noiseScale: p.noiseScale,
            octaves: p.octaves,
            roughness: 0.55,
            nuclei: 0,
            seed: p.seed + 1,
            renderMode: RENDER2.STROKE,
            strokeWidth: p.strokeWidth
          }),
          node("fan", "repeat", { count: p.count }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h })
        ],
        connections: [
          wire("blob", "svg", "fan", "svg"),
          wire("fan", "items", "sheet", "items"),
          wire("ring", "x", "sheet", "x"),
          wire("ring", "y", "sheet", "y"),
          wire("ring", "points", "spin", "input"),
          wire("spin", "value", "sheet", "rotation"),
          wire("sheet", "svg", "out", "svg")
        ]
      };
    }
  },
  {
    id: "packed-blocks",
    label: "Packed Blocks",
    note: "Greedy rectangle packing over a cell lattice.",
    params: [
      num2("spacing", "Cell size", 40, 6, 400),
      int("maxWidth", "Max block width", 4, 1, 12),
      int("maxHeight", "Max block height", 4, 1, 12),
      num2("inset", "Block inset", 8, 0, 60),
      num2("strokeWidth", "Stroke width", 1.3, 0.1, 20)
    ],
    build: (w, h, p) => {
      const cols = fit2(w * 0.92, p.spacing);
      const rows = fit2(h * 0.92, p.spacing);
      return {
        nodes: [
          node("pack", "packed-grid", {
            cols,
            rows,
            spacingX: p.spacing,
            spacingY: p.spacing,
            maxWidth: p.maxWidth,
            maxHeight: p.maxHeight,
            seed: p.seed
          }),
          node("insetW", "add", { amount: -p.inset }),
          node("insetH", "add", { amount: -p.inset }),
          node("block", "rect", { renderMode: RENDER2.STROKE, strokeWidth: p.strokeWidth }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h })
        ],
        connections: [
          wire("pack", "width", "insetW", "value"),
          wire("pack", "height", "insetH", "value"),
          wire("insetW", "result", "block", "width"),
          wire("insetH", "result", "block", "height"),
          wire("block", "svg", "sheet", "items"),
          wire("pack", "x", "sheet", "x"),
          wire("pack", "y", "sheet", "y"),
          wire("sheet", "svg", "out", "svg")
        ]
      };
    }
  },
  {
    id: "iso-lattice",
    label: "Isometric Lattice",
    note: "Nested diamonds on a 2:1 projected lattice.",
    params: [
      num2("spacing", "Lattice spacing", 40, 6, 400),
      num2("cellSize", "Diamond size", 30, 2, 400),
      num2("minScale", "Min scale", 0.35, 0.02, 1, 3),
      num2("maxScale", "Max scale", 1, 0.02, 4, 3),
      num2("strokeWidth", "Stroke width", 1.2, 0.1, 20)
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
            width: p.cellSize,
            height: p.cellSize,
            renderMode: RENDER2.STROKE,
            strokeWidth: p.strokeWidth
          }),
          node("fan", "repeat", { count: cols * rows }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h })
        ],
        connections: [
          wire("cell", "svg", "fan", "svg"),
          wire("fan", "items", "sheet", "items"),
          wire("lattice", "x", "sheet", "x"),
          wire("lattice", "y", "sheet", "y"),
          wire("lattice", "points", "scaleRoll", "input"),
          wire("scaleRoll", "value", "sheet", "scale"),
          wire("sheet", "svg", "out", "svg")
        ]
      };
    }
  },
  {
    id: "iso-city",
    label: "Isometric City",
    note: "Stacked cubes drawn back to front, so near ones occlude far ones.",
    params: [
      num2("spacing", "Plot spacing", 54, 8, 400),
      num2("blockSize", "Block footprint", 30, 2, 300),
      num2("minHeight", "Min height", 16, 1, 600),
      num2("maxHeight", "Max height", 74, 1, 600),
      num2("strokeWidth", "Stroke width", 1.2, 0.1, 20)
    ],
    build: (w, h, p) => {
      const cols = isoCover(w, Math.max(p.spacing, h - p.maxHeight), p.spacing);
      return {
        nodes: [
          node("plan", "isometric-positions", { count: cols * cols, cols, spacing: p.spacing }),
          node("heightRoll", "random", { seed: p.seed, min: p.minHeight, max: p.maxHeight }),
          node("depthOrder", "add2", {}),
          node("block", "isometric-cube", {
            width: p.blockSize,
            depth: p.blockSize,
            angle: 30,
            strokeWidth: p.strokeWidth,
            topFace: FACE2.BOTH,
            frontFace: FACE2.BOTH,
            rightFace: FACE2.BOTH,
            leftFace: FACE2.OFF,
            backFace: FACE2.OFF,
            bottomFace: FACE2.OFF
          }),
          node("sheet", "compose", {}),
          node("out", "canvas", { width: w, height: h })
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
          wire("sheet", "svg", "out", "svg")
        ]
      };
    }
  },
  {
    id: "mesh-weave",
    label: "Mesh Weave",
    note: "A warped quad meshed into its own lattice of edges.",
    params: [
      int("cols", "Columns", 16, 2, 80),
      int("rows", "Rows", 16, 2, 80),
      num2("jitter", "Warp", 13, 0, 120),
      num2("noiseScale", "Warp detail", 0.014, 5e-4, 0.2, 4),
      num2("strokeWidth", "Stroke width", 1, 0.1, 20)
    ],
    build: (w, h, p) => {
      const hw = w / 2 * 0.82;
      const hh = h / 2 * 0.82;
      const skew = Math.min(hw, hh) * 0.09;
      return {
        nodes: [
          node("quadGrid", "quad-grid-points", {
            p1: [-hw, -hh + skew],
            p2: [hw + skew, -hh],
            p3: [hw - skew, hh],
            p4: [-hw, hh - skew],
            cols: p.cols,
            rows: p.rows
          }),
          node("warp", "jitter-points", { amount: p.jitter, scale: p.noiseScale, seed: p.seed, mode: 1 }),
          node("edges", "mesh-lines", { cols: p.cols, rows: p.rows, mode: 0 }),
          node("stroke", "line", { strokeWidth: p.strokeWidth }),
          node("sheet", "stack", {}),
          node("out", "canvas", { width: w, height: h })
        ],
        connections: [
          wire("quadGrid", "points", "warp", "points"),
          wire("warp", "points", "edges", "points"),
          wire("edges", "start", "stroke", "start"),
          wire("edges", "end", "stroke", "end"),
          wire("stroke", "svg", "sheet", "items"),
          wire("sheet", "svg", "out", "svg")
        ]
      };
    }
  }
];
var PATTERN_LABELS = PATTERNS.map((pattern) => pattern.label);
function defaultsFor(pattern) {
  const values = { seed: 5105 };
  for (const param of pattern.params) values[param.key] = param.def;
  return values;
}

// scripts/pattern-generator/src/aspect.js
var ASPECTS = [
  { id: "1:1", label: "1:1  Square", w: 1, h: 1 },
  { id: "2:3", label: "2:3  Portrait", w: 2, h: 3 },
  { id: "3:4", label: "3:4  Portrait", w: 3, h: 4 },
  { id: "9:16", label: "9:16  Tall", w: 9, h: 16 },
  { id: "artboard", label: "Artboard  (current canvas)", w: null, h: null }
];
var ASPECT_LABELS = ASPECTS.map((a) => a.label);
var DEFAULT_ASPECT = 0;
function documentBox(doc = Document.current) {
  if (!doc) return null;
  if (doc.hasArtboards) {
    const board = doc.artboards?.first;
    const box = board?.spreadBaseBox ?? board?.baseBox;
    if (box && box.width > 0 && box.height > 0) {
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }
  }
  return { x: 0, y: 0, width: doc.widthPixels, height: doc.heightPixels };
}
function resolveSize(aspectIndex, size, doc) {
  const aspect = ASPECTS[aspectIndex] ?? ASPECTS[0];
  if (aspect.id === "artboard") {
    const box = documentBox(doc);
    if (!box) return { width: size, height: size, aspect };
    return { width: box.width, height: box.height, aspect, box };
  }
  const long = Math.max(aspect.w, aspect.h);
  return {
    width: Math.round(size * aspect.w / long),
    height: Math.round(size * aspect.h / long),
    aspect
  };
}
function aspectName(aspect, width, height) {
  if (aspect.id !== "artboard") return aspect.id;
  const g = gcd(Math.round(width), Math.round(height));
  return g > 1 ? `${Math.round(width) / g}:${Math.round(height) / g}` : `${Math.round(width)}x${Math.round(height)}`;
}
function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

// scripts/pattern-generator/src/svg-to-shapes.js
var ELEMENT = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
var ATTR = /([a-zA-Z_:][-\w:.]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][-\w:.]*)\s*=\s*'([^']*)'/g;
var NUMBERS = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;
var KAPPA = 0.5522847498307936;
var IDENTITY = [1, 0, 0, 1, 0, 0];
function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ];
}
var apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
function parseTransform(text) {
  let m = IDENTITY;
  if (!text) return m;
  const OPS = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let op;
  while ((op = OPS.exec(text)) !== null) {
    const v = (op[2].match(NUMBERS) ?? []).map(Number);
    const rad = (deg) => deg * Math.PI / 180;
    switch (op[1]) {
      case "translate":
        m = multiply(m, [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0]);
        break;
      case "scale":
        m = multiply(m, [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0]);
        break;
      case "rotate": {
        const c = Math.cos(rad(v[0] ?? 0));
        const s = Math.sin(rad(v[0] ?? 0));
        if (v.length >= 3) m = multiply(m, [1, 0, 0, 1, v[1], v[2]]);
        m = multiply(m, [c, s, -s, c, 0, 0]);
        if (v.length >= 3) m = multiply(m, [1, 0, 0, 1, -v[1], -v[2]]);
        break;
      }
      case "skewX":
        m = multiply(m, [1, 0, Math.tan(rad(v[0] ?? 0)), 1, 0, 0]);
        break;
      case "skewY":
        m = multiply(m, [1, Math.tan(rad(v[0] ?? 0)), 0, 1, 0, 0]);
        break;
      case "matrix":
        if (v.length >= 6) m = multiply(m, v.slice(0, 6));
        break;
      default:
        break;
    }
  }
  return m;
}
function parseAttrs(text) {
  const out = {};
  let a;
  ATTR.lastIndex = 0;
  while ((a = ATTR.exec(text)) !== null) {
    if (a[1] !== void 0) out[a[1]] = a[2];
    else out[a[3]] = a[4];
  }
  return out;
}
var PathSink = class {
  constructor(matrix) {
    this.m = matrix;
    this.subpaths = [];
    this.current = null;
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
  }
  #note(x, y) {
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
  }
  moveTo(x, y) {
    const [px, py] = apply(this.m, x, y);
    this.#note(px, py);
    this.current = { start: [px, py], segments: [], closed: false };
    this.subpaths.push(this.current);
  }
  lineTo(x, y) {
    if (!this.current) this.moveTo(x, y);
    else {
      const p = apply(this.m, x, y);
      this.#note(p[0], p[1]);
      this.current.segments.push(["L", p[0], p[1]]);
    }
  }
  cubicTo(c1x, c1y, c2x, c2y, x, y) {
    if (!this.current) this.moveTo(x, y);
    else {
      const a = apply(this.m, c1x, c1y);
      const b = apply(this.m, c2x, c2y);
      const e = apply(this.m, x, y);
      this.#note(a[0], a[1]);
      this.#note(b[0], b[1]);
      this.#note(e[0], e[1]);
      this.current.segments.push(["C", a[0], a[1], b[0], b[1], e[0], e[1]]);
    }
  }
  close() {
    if (this.current) this.current.closed = true;
  }
  /** Subpaths with at least one segment — a lone moveto draws nothing. */
  result() {
    return this.subpaths.filter((sp) => sp.segments.length > 0);
  }
};
function ellipseInto(sink, cx, cy, rx, ry) {
  const ox = rx * KAPPA;
  const oy = ry * KAPPA;
  sink.moveTo(cx + rx, cy);
  sink.cubicTo(cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry);
  sink.cubicTo(cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy);
  sink.cubicTo(cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry);
  sink.cubicTo(cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy);
  sink.close();
}
function rectInto(sink, x, y, w, h, rx, ry) {
  if (!(rx > 0) && !(ry > 0)) {
    sink.moveTo(x, y);
    sink.lineTo(x + w, y);
    sink.lineTo(x + w, y + h);
    sink.lineTo(x, y + h);
    sink.close();
    return;
  }
  const a = Math.min(rx > 0 ? rx : ry, w / 2);
  const b = Math.min(ry > 0 ? ry : rx, h / 2);
  const ox = a * KAPPA;
  const oy = b * KAPPA;
  sink.moveTo(x + a, y);
  sink.lineTo(x + w - a, y);
  sink.cubicTo(x + w - a + ox, y, x + w, y + b - oy, x + w, y + b);
  sink.lineTo(x + w, y + h - b);
  sink.cubicTo(x + w, y + h - b + oy, x + w - a + ox, y + h, x + w - a, y + h);
  sink.lineTo(x + a, y + h);
  sink.cubicTo(x + a - ox, y + h, x, y + h - b + oy, x, y + h - b);
  sink.lineTo(x, y + b);
  sink.cubicTo(x, y + b - oy, x + a - ox, y, x + a, y);
  sink.close();
}
function arcInto(sink, x0, y0, rx, ry, xAxisDeg, largeArc, sweep, x1, y1) {
  if (!(rx > 0) || !(ry > 0)) {
    sink.lineTo(x1, y1);
    return;
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = xAxisDeg * Math.PI / 180;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dx2 = (x0 - x1) / 2;
  const dy2 = (y0 - y1) / 2;
  const x1p = cosP * dx2 + sinP * dy2;
  const y1p = -sinP * dx2 + cosP * dy2;
  const lambda = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }
  const sign = largeArc === sweep ? -1 : 1;
  const num3 = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num3 / den));
  const cxp = co * rx * y1p / ry;
  const cyp = -co * ry * x1p / rx;
  const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2;
  const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2;
  const angleOf = (ux, uy) => Math.atan2(uy, ux);
  const theta0 = angleOf((x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angleOf((-x1p - cxp) / rx, (-y1p - cyp) / ry) - theta0;
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;
  const pieces = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const step = dTheta / pieces;
  const k = 4 / 3 * Math.tan(step / 4);
  let theta = theta0;
  for (let i = 0; i < pieces; i++) {
    const next = theta + step;
    const cos0 = Math.cos(theta), sin0 = Math.sin(theta);
    const cos1 = Math.cos(next), sin1 = Math.sin(next);
    const point = (c, s) => [
      cx + rx * cosP * c - ry * sinP * s,
      cy + rx * sinP * c + ry * cosP * s
    ];
    const [px0, py0] = point(cos0, sin0);
    const [px1, py1] = point(cos1, sin1);
    const [tx0, ty0] = [rx * cosP * -sin0 - ry * sinP * cos0, rx * sinP * -sin0 + ry * cosP * cos0];
    const [tx1, ty1] = [rx * cosP * -sin1 - ry * sinP * cos1, rx * sinP * -sin1 + ry * cosP * cos1];
    sink.cubicTo(px0 + k * tx0, py0 + k * ty0, px1 - k * tx1, py1 - k * ty1, px1, py1);
    theta = next;
  }
}
function pathInto(sink, d) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  let i = 0;
  let cmd = "";
  let x = 0, y = 0;
  let sx = 0, sy = 0;
  let rcx = null, rcy = null;
  const nextNum = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    else if (cmd === "M") cmd = "L";
    else if (cmd === "m") cmd = "l";
    if (i > tokens.length) break;
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M": {
        x = ox + nextNum();
        y = oy + nextNum();
        sx = x;
        sy = y;
        sink.moveTo(x, y);
        rcx = rcy = null;
        break;
      }
      case "L": {
        x = ox + nextNum();
        y = oy + nextNum();
        sink.lineTo(x, y);
        rcx = rcy = null;
        break;
      }
      case "H": {
        x = ox + nextNum();
        sink.lineTo(x, y);
        rcx = rcy = null;
        break;
      }
      case "V": {
        y = oy + nextNum();
        sink.lineTo(x, y);
        rcx = rcy = null;
        break;
      }
      case "C": {
        const c1x = ox + nextNum(), c1y = oy + nextNum();
        const c2x = ox + nextNum(), c2y = oy + nextNum();
        const ex = ox + nextNum(), ey = oy + nextNum();
        sink.cubicTo(c1x, c1y, c2x, c2y, ex, ey);
        rcx = c2x;
        rcy = c2y;
        x = ex;
        y = ey;
        break;
      }
      case "S": {
        const c1x = rcx === null ? x : 2 * x - rcx;
        const c1y = rcy === null ? y : 2 * y - rcy;
        const c2x = ox + nextNum(), c2y = oy + nextNum();
        const ex = ox + nextNum(), ey = oy + nextNum();
        sink.cubicTo(c1x, c1y, c2x, c2y, ex, ey);
        rcx = c2x;
        rcy = c2y;
        x = ex;
        y = ey;
        break;
      }
      case "Q": {
        const qx = ox + nextNum(), qy = oy + nextNum();
        const ex = ox + nextNum(), ey = oy + nextNum();
        sink.cubicTo(
          x + 2 / 3 * (qx - x),
          y + 2 / 3 * (qy - y),
          ex + 2 / 3 * (qx - ex),
          ey + 2 / 3 * (qy - ey),
          ex,
          ey
        );
        rcx = qx;
        rcy = qy;
        x = ex;
        y = ey;
        break;
      }
      case "T": {
        const qx = rcx === null ? x : 2 * x - rcx;
        const qy = rcy === null ? y : 2 * y - rcy;
        const ex = ox + nextNum(), ey = oy + nextNum();
        sink.cubicTo(
          x + 2 / 3 * (qx - x),
          y + 2 / 3 * (qy - y),
          ex + 2 / 3 * (qx - ex),
          ey + 2 / 3 * (qy - ey),
          ex,
          ey
        );
        rcx = qx;
        rcy = qy;
        x = ex;
        y = ey;
        break;
      }
      case "A": {
        const rx = nextNum(), ry = nextNum(), rot = nextNum();
        const large = nextNum() !== 0, sweep = nextNum() !== 0;
        const ex = ox + nextNum(), ey = oy + nextNum();
        arcInto(sink, x, y, rx, ry, rot, large, sweep, ex, ey);
        x = ex;
        y = ey;
        rcx = rcy = null;
        break;
      }
      case "Z": {
        sink.close();
        x = sx;
        y = sy;
        rcx = rcy = null;
        break;
      }
      default:
        i++;
        break;
    }
  }
}
var numOr = (text, fallback) => {
  const v = parseFloat(text);
  return Number.isFinite(v) ? v : fallback;
};
function svgToShapes(svg) {
  const root = /<svg\b([^>]*)>/i.exec(svg);
  const rootAttrs = root ? parseAttrs(root[1]) : {};
  const viewBox = (rootAttrs.viewBox ?? "").match(NUMBERS)?.map(Number);
  const width = numOr(rootAttrs.width, viewBox?.[2] ?? 0);
  const height = numOr(rootAttrs.height, viewBox?.[3] ?? 0);
  const shapes = [];
  const stack = [{ m: IDENTITY, fill: null, stroke: null, strokeWidth: null }];
  let skipDepth = 0;
  let el;
  ELEMENT.lastIndex = 0;
  while ((el = ELEMENT.exec(svg)) !== null) {
    const [, closing, rawTag, attrText, selfClosing] = el;
    const tag = rawTag.toLowerCase();
    const isClose = closing === "/";
    const isSelfClosed = selfClosing === "/";
    if (skipDepth > 0) {
      if (!isClose && !isSelfClosed && (tag === "defs" || tag === "clippath")) skipDepth++;
      else if (isClose && (tag === "defs" || tag === "clippath")) skipDepth--;
      continue;
    }
    if (!isClose && !isSelfClosed && (tag === "defs" || tag === "clippath")) {
      skipDepth = 1;
      continue;
    }
    if (isClose) {
      if ((tag === "g" || tag === "svg") && stack.length > 1) stack.pop();
      continue;
    }
    const attrs = parseAttrs(attrText);
    const parent = stack[stack.length - 1];
    const state = {
      m: attrs.transform ? multiply(parent.m, parseTransform(attrs.transform)) : parent.m,
      fill: attrs.fill ?? parent.fill,
      stroke: attrs.stroke ?? parent.stroke,
      strokeWidth: attrs["stroke-width"] !== void 0 ? parseFloat(attrs["stroke-width"]) : parent.strokeWidth
    };
    if (tag === "g" || tag === "svg") {
      if (!isSelfClosed) stack.push(state);
      continue;
    }
    const sink = new PathSink(state.m);
    switch (tag) {
      case "circle": {
        const r = numOr(attrs.r, 0);
        if (r <= 0) continue;
        ellipseInto(sink, numOr(attrs.cx, 0), numOr(attrs.cy, 0), r, r);
        break;
      }
      case "ellipse": {
        const rx = numOr(attrs.rx, 0), ry = numOr(attrs.ry, 0);
        if (rx <= 0 || ry <= 0) continue;
        ellipseInto(sink, numOr(attrs.cx, 0), numOr(attrs.cy, 0), rx, ry);
        break;
      }
      case "rect": {
        const w = numOr(attrs.width, 0), h = numOr(attrs.height, 0);
        if (w <= 0 || h <= 0) continue;
        rectInto(
          sink,
          numOr(attrs.x, 0),
          numOr(attrs.y, 0),
          w,
          h,
          numOr(attrs.rx, 0),
          numOr(attrs.ry, 0)
        );
        break;
      }
      case "line": {
        sink.moveTo(numOr(attrs.x1, 0), numOr(attrs.y1, 0));
        sink.lineTo(numOr(attrs.x2, 0), numOr(attrs.y2, 0));
        break;
      }
      case "polyline":
      case "polygon": {
        const v = (attrs.points ?? "").match(NUMBERS)?.map(Number) ?? [];
        if (v.length < 4) continue;
        sink.moveTo(v[0], v[1]);
        for (let k = 2; k + 1 < v.length; k += 2) sink.lineTo(v[k], v[k + 1]);
        if (tag === "polygon") sink.close();
        break;
      }
      case "path": {
        if (!attrs.d) continue;
        pathInto(sink, attrs.d);
        break;
      }
      default:
        continue;
    }
    const subpaths = sink.result();
    if (subpaths.length === 0) continue;
    shapes.push({
      subpaths,
      fill: state.fill,
      stroke: state.stroke,
      strokeWidth: state.strokeWidth ?? 1,
      bounds: { minX: sink.minX, minY: sink.minY, maxX: sink.maxX, maxY: sink.maxY }
    });
  }
  return { width, height, shapes };
}
function trimToCanvas(shapes, width, height) {
  return shapes.filter((shape) => {
    const b = shape.bounds;
    if (!b) return true;
    const slack = (shape.strokeWidth ?? 1) / 2;
    return b.maxX >= -slack && b.minX <= width + slack && b.maxY >= -slack && b.minY <= height + slack;
  });
}

// scripts/pattern-generator/src/paint.js
var HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
var HEX6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
var HEX8 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
var RGB_FN = /^rgba?\(([^)]*)\)$/i;
var VAR_ROLE = {
  "--stroke-color": "stroke",
  "--fill-color": "fill",
  "--occlusion-color": "occlusion",
  "--bg-color": "background"
};
var NAMED = {
  black: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 128, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  grey: { r: 128, g: 128, b: 128 },
  gray: { r: 128, g: 128, b: 128 },
  currentcolor: null
  // no colour of its own: fall through to the palette
};
function parseLiteral(text) {
  const value = text.trim();
  let m = HEX8.exec(value);
  if (m) {
    return {
      r: parseInt(m[1], 16),
      g: parseInt(m[2], 16),
      b: parseInt(m[3], 16),
      alpha: parseInt(m[4], 16)
    };
  }
  m = HEX6.exec(value);
  if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16), alpha: 255 };
  m = HEX3.exec(value);
  if (m) {
    return {
      r: parseInt(m[1] + m[1], 16),
      g: parseInt(m[2] + m[2], 16),
      b: parseInt(m[3] + m[3], 16),
      alpha: 255
    };
  }
  m = RGB_FN.exec(value);
  if (m) {
    const n = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (n.length >= 3 && n.every(Number.isFinite)) {
      return {
        r: clamp8(n[0]),
        g: clamp8(n[1]),
        b: clamp8(n[2]),
        alpha: n.length > 3 ? clamp8(n[3] <= 1 ? n[3] * 255 : n[3]) : 255
      };
    }
  }
  const named = NAMED[value.toLowerCase()];
  if (named) return { ...named, alpha: 255 };
  return void 0;
}
var clamp8 = (v) => Math.max(0, Math.min(255, Math.round(v)));
function resolvePaint(value, palette) {
  if (value == null) return null;
  const text = String(value).trim();
  if (text === "" || text === "none" || text === "transparent") return null;
  if (text.startsWith("var(")) {
    const inner = text.slice(4, text.lastIndexOf(")"));
    const comma = inner.indexOf(",");
    const name = (comma === -1 ? inner : inner.slice(0, comma)).trim();
    const role = VAR_ROLE[name];
    if (role && palette[role]) return palette[role];
    const fallback = comma === -1 ? "" : inner.slice(comma + 1).trim();
    return fallback ? resolvePaint(fallback, palette) : null;
  }
  const literal = parseLiteral(text);
  if (literal) return literal;
  return palette.fill ?? null;
}
var OCCLUDING_VAR = /--occlusion-color|--bg-color/;
function usesOcclusion(shapes) {
  return shapes.some((shape) => shape.fill && OCCLUDING_VAR.test(String(shape.fill)));
}

// scripts/pattern-generator/src/shapes-to-affinity.js
var colourOf = (c) => Colour.createRGBA8({ r: c.r, g: c.g, b: c.b, alpha: c.alpha ?? 255 });
function buildCurve(subpath, dx, dy) {
  const builder = CurveBuilder.create();
  builder.beginXY(subpath.start[0] + dx, subpath.start[1] + dy);
  for (const seg of subpath.segments) {
    if (seg[0] === "L") builder.lineToXY(seg[1] + dx, seg[2] + dy);
    else builder.addBezierXY(seg[1] + dx, seg[2] + dy, seg[3] + dx, seg[4] + dy, seg[5] + dx, seg[6] + dy);
  }
  if (subpath.closed) builder.close();
  return builder.createCurve();
}
function styleKey(fill, stroke, width) {
  const part = (c) => c ? `${c.r},${c.g},${c.b},${c.alpha ?? 255}` : "-";
  return `${part(fill)}|${part(stroke)}|${stroke ? width : 0}`;
}
function definitionFor(polyCurve, fill, stroke, width, name) {
  const noFill = FillDescriptor.createNone();
  const def5 = PolyCurveNodeDefinition.create(
    polyCurve,
    fill ? FillDescriptor.createSolid(colourOf(fill), BlendMode.Normal) : noFill,
    stroke ? FillDescriptor.createSolid(colourOf(stroke), BlendMode.Normal) : noFill,
    LineStyleDescriptor.createDefault(stroke ? width : 0),
    noFill
  );
  def5.userDescription = name;
  return def5;
}
function buildDefinitions(shapes, palette, { merge = true, offset = { x: 0, y: 0 }, name = "Pattern" } = {}) {
  merge = canMerge(shapes, merge);
  const dx = offset.x;
  const dy = offset.y;
  const defs = [];
  const groups = /* @__PURE__ */ new Map();
  for (const shape of shapes) {
    const fill = resolvePaint(shape.fill, palette);
    const stroke = resolvePaint(shape.stroke, palette);
    if (!fill && !stroke) continue;
    const width = shape.strokeWidth ?? 1;
    if (!merge) {
      const poly = PolyCurve.create();
      for (const subpath of shape.subpaths) poly.addCurve(buildCurve(subpath, dx, dy));
      defs.push(definitionFor(poly, fill, stroke, width, name));
      continue;
    }
    const key = styleKey(fill, stroke, width);
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = { poly: PolyCurve.create(), fill, stroke, width, count: 0 };
      groups.set(key, bucket);
    }
    for (const subpath of shape.subpaths) bucket.poly.addCurve(buildCurve(subpath, dx, dy));
    bucket.count++;
  }
  if (merge) {
    let index = 1;
    for (const bucket of groups.values()) {
      const label = groups.size > 1 ? `${name} ${index++}` : name;
      defs.push(definitionFor(bucket.poly, bucket.fill, bucket.stroke, bucket.width, label));
    }
  }
  return defs;
}
function canMerge(shapes, requested = true) {
  return requested && !usesOcclusion(shapes);
}
function countObjects(shapes, palette, merge) {
  merge = canMerge(shapes, merge);
  if (!merge) return shapes.filter((s) => resolvePaint(s.fill, palette) || resolvePaint(s.stroke, palette)).length;
  const keys = /* @__PURE__ */ new Set();
  for (const shape of shapes) {
    const fill = resolvePaint(shape.fill, palette);
    const stroke = resolvePaint(shape.stroke, palette);
    if (!fill && !stroke) continue;
    keys.add(styleKey(fill, stroke, shape.strokeWidth ?? 1));
  }
  return keys.size;
}

// scripts/pattern-generator/src/ui.js
var SEED_MAX = 999999;
var PALETTE_DEFAULTS = {
  stroke: { r: 26, g: 26, b: 25, alpha: 255 },
  fill: { r: 26, g: 26, b: 25, alpha: 255 },
  background: { r: 255, g: 255, b: 255, alpha: 255 }
};
function buildDialog(doc, colours) {
  const dlg = Dialog.create("Pattern Generator");
  const column = dlg.addColumn();
  const patternGroup = column.addGroup("Pattern");
  dlg.pattern = patternGroup.addComboBox("Design", PATTERN_LABELS, 0).setIsFullWidth();
  dlg.note = patternGroup.addStaticText(null, PATTERNS[0].note).setIsFullWidth();
  const sizeGroup = column.addGroup("Size");
  dlg.aspect = sizeGroup.addComboBox("Aspect ratio", ASPECT_LABELS, DEFAULT_ASPECT).setIsFullWidth();
  dlg.size = sizeGroup.addUnitValueEditor("Long edge", UnitType.Pixel, doc.units, defaultLongEdge(doc), 16).setNoMaxValue().setPrecision(0);
  dlg.sizeNote = sizeGroup.addStaticText(null, "").setIsFullWidth();
  dlg.paramGroups = [];
  dlg.paramControls = [];
  for (const pattern of PATTERNS) {
    const group2 = column.addGroup(`${pattern.label} settings`);
    const controls = {};
    for (const param of pattern.params) {
      controls[param.key] = group2.addUnitValueEditor(
        param.label,
        UnitType.Number,
        UnitType.Number,
        param.def,
        param.min,
        param.max
      ).setShowPopupSlider(true).setPrecision(param.kind === "int" ? 0 : param.precision ?? 2);
    }
    controls.seed = group2.addUnitValueEditor("Seed", UnitType.Number, UnitType.Number, defaultsFor(pattern).seed, 0, SEED_MAX).setPrecision(0);
    dlg.paramGroups.push(group2);
    dlg.paramControls.push(controls);
  }
  const styleGroup = column.addGroup("Colours");
  dlg.strokeColour = styleGroup.addColourPicker("Stroke", colours.stroke);
  dlg.fillColour = styleGroup.addColourPicker("Fill", colours.fill);
  dlg.backgroundColour = styleGroup.addColourPicker("Background", colours.background);
  dlg.drawBackground = styleGroup.addSwitch("Draw background rectangle", false);
  const outputGroup = column.addGroup("Output");
  dlg.separate = outputGroup.addSwitch("One object per shape", false);
  dlg.readout = outputGroup.addStaticText(null, "").setIsFullWidth();
  dlg.initialWidth = 460;
  showOnly(dlg, 0);
  return dlg;
}
function defaultLongEdge(doc) {
  const longest = Math.max(doc.widthPixels, doc.heightPixels);
  return Math.max(16, Math.round(longest * 0.8));
}
function showOnly(dlg, index) {
  dlg.paramGroups.forEach((group2, i) => group2.setIsVisible(i === index));
  dlg.note.text = PATTERNS[index].note;
}
function readParams(dlg, index) {
  const pattern = PATTERNS[index];
  const controls = dlg.paramControls[index];
  const values = { seed: Math.round(controls.seed.value) };
  for (const param of pattern.params) {
    const raw = controls[param.key].value;
    values[param.key] = param.kind === "int" ? Math.round(raw) : raw;
  }
  return values;
}
function readPalette(dlg) {
  const background = toRGBA(dlg.backgroundColour.value, PALETTE_DEFAULTS.background);
  return {
    stroke: toRGBA(dlg.strokeColour.value, PALETTE_DEFAULTS.stroke),
    fill: toRGBA(dlg.fillColour.value, PALETTE_DEFAULTS.fill),
    // Occlusion is what hides geometry behind a face, so it tracks the sheet.
    occlusion: background,
    background
  };
}
function toRGBA(colour, fallback) {
  if (!colour) return fallback;
  try {
    const c = colour.rgba8;
    if (!c) return fallback;
    return { r: c.r, g: c.g, b: c.b, alpha: c.alpha ?? 255 };
  } catch (_) {
    return fallback;
  }
}

// scripts/pattern-generator/src/main.js
var SEPARATE_WARN_AT = 1500;
var rgba = (c) => Colour.createRGBA8({ r: c.r, g: c.g, b: c.b, alpha: c.alpha ?? 255 });
var isOk = (result) => (result?.value ?? result) === DialogResult.Ok.value;
var ARTBOARD_ASPECT = ASPECTS.findIndex((a) => a.id === "artboard");
function generate(dlg, doc) {
  const index = dlg.pattern.selectedIndex;
  const pattern = PATTERNS[index];
  const params = readParams(dlg, index);
  const palette = readPalette(dlg);
  const { width, height, aspect, box } = resolveSize(dlg.aspect.selectedIndex, dlg.size.value, doc);
  if (!(width > 0) || !(height > 0)) return { error: "That size produces an empty canvas." };
  const graph = pattern.build(width, height, params);
  const canvas = graph.nodes.find((n) => n.type === "canvas");
  if (canvas) {
    const bg = palette.background;
    canvas.inputs.backgroundColor = dlg.drawBackground.value ? `rgb(${bg.r},${bg.g},${bg.b})` : "transparent";
    canvas.inputs.occlusionColor = `rgb(${bg.r},${bg.g},${bg.b})`;
  }
  let svg;
  try {
    svg = render(graph);
  } catch (err) {
    return { error: `${pattern.label} could not be generated:
${err.message}` };
  }
  const parsed = svgToShapes(svg);
  const rendered = parsed.shapes.length;
  parsed.shapes = trimToCanvas(parsed.shapes, parsed.width, parsed.height);
  if (parsed.shapes.length === 0) {
    return { error: "These settings produce nothing to draw. Try a smaller spacing or a larger size." };
  }
  const page = documentBox(doc) ?? { x: 0, y: 0, width, height };
  const offset = box ? { x: box.x, y: box.y } : { x: page.x + (page.width - width) / 2, y: page.y + (page.height - height) / 2 };
  return {
    pattern,
    palette,
    width,
    height,
    parsed,
    offset,
    rendered,
    name: `${pattern.label} ${aspectName(aspect, width, height)}`,
    merge: !dlg.separate.value
  };
}
function createCommand(run) {
  const defs = buildDefinitions(run.parsed.shapes, run.palette, {
    merge: run.merge,
    offset: run.offset,
    name: run.pattern.label
  });
  if (defs.length === 0) return null;
  const groupBuilder = AddChildNodesCommandBuilder.create();
  groupBuilder.addNode(ContainerNodeDefinition.create(run.name));
  const curveBuilder = AddChildNodesCommandBuilder.create();
  for (const def5 of defs) curveBuilder.addNode(def5);
  return CompoundCommandBuilder.create().addCommand(groupBuilder.createCommand(true)).addCommand(curveBuilder.createCommand(false)).createCommand();
}
function main() {
  const doc = Document.current;
  if (!doc) {
    app.alert("Open a document before running Pattern Generator.");
    return;
  }
  const dlg = buildDialog(doc, {
    stroke: rgba(PALETTE_DEFAULTS.stroke),
    fill: rgba(PALETTE_DEFAULTS.fill),
    background: rgba(PALETTE_DEFAULTS.background)
  });
  let lastPattern = dlg.pattern.selectedIndex;
  let run = null;
  let busy = false;
  function update() {
    if (busy) return;
    busy = true;
    try {
      if (dlg.pattern.selectedIndex !== lastPattern) {
        lastPattern = dlg.pattern.selectedIndex;
        showOnly(dlg, lastPattern);
      }
      dlg.size.isEnabled = dlg.aspect.selectedIndex !== ARTBOARD_ASPECT;
      run = generate(dlg, doc);
      if (run.error) {
        dlg.sizeNote.text = "";
        dlg.readout.text = run.error;
        return;
      }
      const objects = countObjects(run.parsed.shapes, run.palette, run.merge);
      dlg.sizeNote.text = `Canvas ${Math.round(run.width)} x ${Math.round(run.height)} px`;
      const trimmed = run.rendered - run.parsed.shapes.length;
      dlg.readout.text = `${run.parsed.shapes.length} shapes -> ${objects} curve object${objects === 1 ? "" : "s"}` + (trimmed > 0 ? `  (${trimmed} off-canvas dropped)` : "") + "\n" + (run.merge && objects === run.parsed.shapes.length && objects > 1 ? `Kept separate: this pattern depends on the order it is drawn in.
` : "") + `Group: "${run.name}"`;
    } catch (err) {
      run = { error: String(err) };
      dlg.readout.text = String(err);
    } finally {
      busy = false;
    }
  }
  dlg.onControlValueChangedHandler = update;
  update();
  while (isOk(dlg.runModal())) {
    if (!run || run.error) {
      app.alert(run?.error ?? "Choose settings that produce a pattern.");
      continue;
    }
    const objects = countObjects(run.parsed.shapes, run.palette, run.merge);
    if (!run.merge && objects > SEPARATE_WARN_AT) {
      app.alert(
        `This would create ${objects} separate objects, which Affinity will be slow to handle.

Turn off "One object per shape", or reduce the pattern's detail, then try again.`
      );
      continue;
    }
    const command = createCommand(run);
    if (!command) {
      app.alert("These settings produce nothing to draw.");
      continue;
    }
    doc.executeCommand(command, false);
    return;
  }
}
main();
