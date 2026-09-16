// Flatten the engine's SVG into transformed paths Affinity can build curves from.
//
// This is deliberately not a general SVG reader. The engine emits a narrow,
// known subset — `g` with a transform, `circle`, `ellipse`, `rect`, `line`,
// `polyline`, `polygon` and `path` — and this handles exactly that. Everything
// becomes line and cubic segments with the current transform already applied,
// because an affine transform maps a cubic's control points directly, so one
// flattening pass removes the whole group hierarchy.

const ELEMENT = /<(\/?)([a-zA-Z][\w-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
const ATTR = /([a-zA-Z_:][-\w:.]*)\s*=\s*"([^"]*)"|([a-zA-Z_:][-\w:.]*)\s*=\s*'([^']*)'/g;
const NUMBERS = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

// The circular arc a cubic approximates best over a quarter turn.
const KAPPA = 0.5522847498307936;

/** Identity, as [a b c d e f] mapping (x,y) -> (a x + c y + e, b x + d y + f). */
const IDENTITY = [1, 0, 0, 1, 0, 0];

function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Parse an SVG transform list into one matrix. */
export function parseTransform(text) {
  let m = IDENTITY;
  if (!text) return m;
  const OPS = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let op;
  while ((op = OPS.exec(text)) !== null) {
    const v = (op[2].match(NUMBERS) ?? []).map(Number);
    const rad = (deg) => (deg * Math.PI) / 180;
    switch (op[1]) {
      case "translate": m = multiply(m, [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0]); break;
      case "scale": m = multiply(m, [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0]); break;
      case "rotate": {
        const c = Math.cos(rad(v[0] ?? 0));
        const s = Math.sin(rad(v[0] ?? 0));
        // A three-argument rotate turns about a point, not the origin.
        if (v.length >= 3) m = multiply(m, [1, 0, 0, 1, v[1], v[2]]);
        m = multiply(m, [c, s, -s, c, 0, 0]);
        if (v.length >= 3) m = multiply(m, [1, 0, 0, 1, -v[1], -v[2]]);
        break;
      }
      case "skewX": m = multiply(m, [1, 0, Math.tan(rad(v[0] ?? 0)), 1, 0, 0]); break;
      case "skewY": m = multiply(m, [1, Math.tan(rad(v[0] ?? 0)), 0, 1, 0, 0]); break;
      case "matrix": if (v.length >= 6) m = multiply(m, v.slice(0, 6)); break;
      default: break;
    }
  }
  return m;
}

function parseAttrs(text) {
  const out = {};
  let a;
  ATTR.lastIndex = 0;
  while ((a = ATTR.exec(text)) !== null) {
    if (a[1] !== undefined) out[a[1]] = a[2];
    else out[a[3]] = a[4];
  }
  return out;
}

/**
 * A subpath being built: a start point and the segments after it.
 * Segments are `["L", x, y]` or `["C", c1x, c1y, c2x, c2y, x, y]`, already
 * in the coordinate space of the emitted document.
 */
class PathSink {
  constructor(matrix) {
    this.m = matrix;
    this.subpaths = [];
    this.current = null;
    // Control-point bounds: never tighter than the curve, which is all the
    // caller needs to decide whether a shape is off the canvas entirely.
    this.minX = Infinity; this.minY = Infinity;
    this.maxX = -Infinity; this.maxY = -Infinity;
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
      this.#note(a[0], a[1]); this.#note(b[0], b[1]); this.#note(e[0], e[1]);
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
}

/** An axis-aligned ellipse as four cubic quarters, in the sink's own space. */
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

/** An SVG elliptical arc, as up to four cubic segments. */
function arcInto(sink, x0, y0, rx, ry, xAxisDeg, largeArc, sweep, x1, y1) {
  if (!(rx > 0) || !(ry > 0)) { sink.lineTo(x1, y1); return; }
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  const phi = (xAxisDeg * Math.PI) / 180;
  const cosP = Math.cos(phi);
  const sinP = Math.sin(phi);
  const dx2 = (x0 - x1) / 2;
  const dy2 = (y0 - y1) / 2;
  const x1p = cosP * dx2 + sinP * dy2;
  const y1p = -sinP * dx2 + cosP * dy2;

  // Scale the radii up if they are too small to span the endpoints (F.6.6).
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  const sign = largeArc === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cosP * cxp - sinP * cyp + (x0 + x1) / 2;
  const cy = sinP * cxp + cosP * cyp + (y0 + y1) / 2;

  const angleOf = (ux, uy) => Math.atan2(uy, ux);
  const theta0 = angleOf((x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angleOf((-x1p - cxp) / rx, (-y1p - cyp) / ry) - theta0;
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  // A cubic tracks an arc well up to a quarter turn; split anything longer.
  const pieces = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const step = dTheta / pieces;
  const k = (4 / 3) * Math.tan(step / 4);

  let theta = theta0;
  for (let i = 0; i < pieces; i++) {
    const next = theta + step;
    const cos0 = Math.cos(theta), sin0 = Math.sin(theta);
    const cos1 = Math.cos(next), sin1 = Math.sin(next);
    const point = (c, s) => [
      cx + rx * cosP * c - ry * sinP * s,
      cy + rx * sinP * c + ry * cosP * s,
    ];
    const [px0, py0] = point(cos0, sin0);
    const [px1, py1] = point(cos1, sin1);
    // The tangent at each end, scaled to the cubic's control arm.
    const [tx0, ty0] = [rx * cosP * -sin0 - ry * sinP * cos0, rx * sinP * -sin0 + ry * cosP * cos0];
    const [tx1, ty1] = [rx * cosP * -sin1 - ry * sinP * cos1, rx * sinP * -sin1 + ry * cosP * cos1];
    sink.cubicTo(px0 + k * tx0, py0 + k * ty0, px1 - k * tx1, py1 - k * ty1, px1, py1);
    theta = next;
  }
}

/** Walk a `d` attribute into the sink. */
function pathInto(sink, d) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) ?? [];
  let i = 0;
  let cmd = "";
  let x = 0, y = 0;          // current point
  let sx = 0, sy = 0;        // start of the current subpath
  let rcx = null, rcy = null; // reflected control point for S / T
  const nextNum = () => Number(tokens[i++]);

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    else if (cmd === "M") cmd = "L";      // repeated moveto pairs are linetos
    else if (cmd === "m") cmd = "l";
    if (i > tokens.length) break;

    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;

    switch (cmd.toUpperCase()) {
      case "M": {
        x = ox + nextNum(); y = oy + nextNum();
        sx = x; sy = y;
        sink.moveTo(x, y);
        rcx = rcy = null;
        break;
      }
      case "L": {
        x = ox + nextNum(); y = oy + nextNum();
        sink.lineTo(x, y);
        rcx = rcy = null;
        break;
      }
      case "H": { x = ox + nextNum(); sink.lineTo(x, y); rcx = rcy = null; break; }
      case "V": { y = oy + nextNum(); sink.lineTo(x, y); rcx = rcy = null; break; }
      case "C": {
        const c1x = ox + nextNum(), c1y = oy + nextNum();
        const c2x = ox + nextNum(), c2y = oy + nextNum();
        const ex = ox + nextNum(), ey = oy + nextNum();
        sink.cubicTo(c1x, c1y, c2x, c2y, ex, ey);
        rcx = c2x; rcy = c2y;
        x = ex; y = ey;
        break;
      }
      case "S": {
        const c1x = rcx === null ? x : 2 * x - rcx;
        const c1y = rcy === null ? y : 2 * y - rcy;
        const c2x = ox + nextNum(), c2y = oy + nextNum();
        const ex = ox + nextNum(), ey = oy + nextNum();
        sink.cubicTo(c1x, c1y, c2x, c2y, ex, ey);
        rcx = c2x; rcy = c2y;
        x = ex; y = ey;
        break;
      }
      case "Q": {
        const qx = ox + nextNum(), qy = oy + nextNum();
        const ex = ox + nextNum(), ey = oy + nextNum();
        // A quadratic is an exact cubic with the control arms at two thirds.
        sink.cubicTo(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y),
                     ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
        rcx = qx; rcy = qy;
        x = ex; y = ey;
        break;
      }
      case "T": {
        const qx = rcx === null ? x : 2 * x - rcx;
        const qy = rcy === null ? y : 2 * y - rcy;
        const ex = ox + nextNum(), ey = oy + nextNum();
        sink.cubicTo(x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y),
                     ex + (2 / 3) * (qx - ex), ey + (2 / 3) * (qy - ey), ex, ey);
        rcx = qx; rcy = qy;
        x = ex; y = ey;
        break;
      }
      case "A": {
        const rx = nextNum(), ry = nextNum(), rot = nextNum();
        const large = nextNum() !== 0, sweep = nextNum() !== 0;
        const ex = ox + nextNum(), ey = oy + nextNum();
        arcInto(sink, x, y, rx, ry, rot, large, sweep, ex, ey);
        x = ex; y = ey;
        rcx = rcy = null;
        break;
      }
      case "Z": {
        sink.close();
        x = sx; y = sy;
        rcx = rcy = null;
        break;
      }
      default: i++; break;   // unknown command: step past it rather than loop
    }
  }
}

const numOr = (text, fallback) => {
  const v = parseFloat(text);
  return Number.isFinite(v) ? v : fallback;
};

/**
 * Parse an SVG document into a flat list of shapes.
 *
 * Returns `{ width, height, shapes }`, where each shape is
 * `{ subpaths, fill, stroke, strokeWidth }` with coordinates in the SVG's own
 * pixel space (y down, origin top-left) — the caller places them.
 */
export function svgToShapes(svg) {
  const root = /<svg\b([^>]*)>/i.exec(svg);
  const rootAttrs = root ? parseAttrs(root[1]) : {};
  const viewBox = (rootAttrs.viewBox ?? "").match(NUMBERS)?.map(Number);
  const width = numOr(rootAttrs.width, viewBox?.[2] ?? 0);
  const height = numOr(rootAttrs.height, viewBox?.[3] ?? 0);

  const shapes = [];
  const stack = [{ m: IDENTITY, fill: null, stroke: null, strokeWidth: null }];
  let skipDepth = 0;          // inside <defs>/<clipPath>, which paint nothing
  let el;

  ELEMENT.lastIndex = 0;
  while ((el = ELEMENT.exec(svg)) !== null) {
    const [, closing, rawTag, attrText, selfClosing] = el;
    const tag = rawTag.toLowerCase();
    const isClose = closing === "/";
    const isSelfClosed = selfClosing === "/";

    if (skipDepth > 0) {
      // `defs` and `clipPath` describe paint, not marks; step over their whole
      // subtree. Clipping itself is applied by the caller, not here.
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
      strokeWidth: attrs["stroke-width"] !== undefined
        ? parseFloat(attrs["stroke-width"]) : parent.strokeWidth,
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
        rectInto(sink, numOr(attrs.x, 0), numOr(attrs.y, 0), w, h,
                 numOr(attrs.rx, 0), numOr(attrs.ry, 0));
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
        continue;   // text, title, style and anything else: nothing to draw
    }

    const subpaths = sink.result();
    if (subpaths.length === 0) continue;
    shapes.push({
      subpaths,
      fill: state.fill,
      stroke: state.stroke,
      strokeWidth: state.strokeWidth ?? 1,
      bounds: { minX: sink.minX, minY: sink.minY, maxX: sink.maxX, maxY: sink.maxY },
    });
  }

  return { width, height, shapes };
}

/**
 * Drop shapes that fall entirely outside the canvas.
 *
 * Some patterns are built to overrun their frame — an isometric lattice is a
 * diamond, and covering a rectangle with one means the corners spill past the
 * edges. Keeping that geometry would mean thousands of curve objects sitting
 * off the page. Shapes that straddle an edge are kept whole, so the result can
 * still overhang slightly; mask the group in Affinity for a hard edge.
 */
export function trimToCanvas(shapes, width, height) {
  return shapes.filter((shape) => {
    const b = shape.bounds;
    if (!b) return true;
    const slack = (shape.strokeWidth ?? 1) / 2;
    return b.maxX >= -slack && b.minX <= width + slack
        && b.maxY >= -slack && b.minY <= height + slack;
  });
}
