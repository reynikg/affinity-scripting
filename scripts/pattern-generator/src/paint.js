// Resolve the paint strings the engine emits into concrete RGB.
//
// The engine paints through four CSS variables rather than literal colours, so
// one rendered pattern can be recoloured without re-running it:
//
//   --stroke-color      every stroked edge
//   --fill-color        every filled shape
//   --occlusion-color   the faces that hide what is behind them (isometric cubes)
//   --bg-color          the sheet behind everything
//
// Anything else that reaches here is a literal, because `custom-shape` and the
// canvas background can carry one.

const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX6 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX8 = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGB_FN = /^rgba?\(([^)]*)\)$/i;

const VAR_ROLE = {
  "--stroke-color": "stroke",
  "--fill-color": "fill",
  "--occlusion-color": "occlusion",
  "--bg-color": "background",
};

/** A handful of literals the engine or a pasted shape may use by name. */
const NAMED = {
  black: { r: 0, g: 0, b: 0 },
  white: { r: 255, g: 255, b: 255 },
  red: { r: 255, g: 0, b: 0 },
  green: { r: 0, g: 128, b: 0 },
  blue: { r: 0, g: 0, b: 255 },
  grey: { r: 128, g: 128, b: 128 },
  gray: { r: 128, g: 128, b: 128 },
  currentcolor: null,   // no colour of its own: fall through to the palette
};

function parseLiteral(text) {
  const value = text.trim();

  let m = HEX8.exec(value);
  if (m) {
    return {
      r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16),
      alpha: parseInt(m[4], 16),
    };
  }
  m = HEX6.exec(value);
  if (m) return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16), alpha: 255 };
  m = HEX3.exec(value);
  if (m) {
    return {
      r: parseInt(m[1] + m[1], 16), g: parseInt(m[2] + m[2], 16), b: parseInt(m[3] + m[3], 16),
      alpha: 255,
    };
  }
  m = RGB_FN.exec(value);
  if (m) {
    const n = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
    if (n.length >= 3 && n.every(Number.isFinite)) {
      return {
        r: clamp8(n[0]), g: clamp8(n[1]), b: clamp8(n[2]),
        alpha: n.length > 3 ? clamp8(n[3] <= 1 ? n[3] * 255 : n[3]) : 255,
      };
    }
  }

  const named = NAMED[value.toLowerCase()];
  if (named) return { ...named, alpha: 255 };
  return undefined;
}

const clamp8 = (v) => Math.max(0, Math.min(255, Math.round(v)));

/**
 * Resolve one `fill` or `stroke` attribute value.
 *
 * `palette` maps the four roles to `{ r, g, b, alpha }`. Returns null for
 * anything that paints nothing, so the caller can leave that fill empty.
 */
export function resolvePaint(value, palette) {
  if (value == null) return null;
  const text = String(value).trim();
  if (text === "" || text === "none" || text === "transparent") return null;

  // `var(--name, fallback)` — take the role if we know it, else the fallback,
  // which may itself be another var().
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

  // An unrecognised colour is likelier to be a shade we should draw than one we
  // should drop, so it becomes the fill rather than disappearing.
  return palette.fill ?? null;
}

/** Only shapes that paint something are worth building curves for. */
export function isVisible(shape, palette) {
  return resolvePaint(shape.fill, palette) !== null
    || resolvePaint(shape.stroke, palette) !== null;
}

// Shapes filled with the sheet colour exist to hide what is behind them, so a
// pattern containing any of them depends on the order its objects are drawn in.
const OCCLUDING_VAR = /--occlusion-color|--bg-color/;

/** Does this pattern rely on paint order to read correctly? */
export function usesOcclusion(shapes) {
  return shapes.some((shape) => shape.fill && OCCLUDING_VAR.test(String(shape.fill)));
}
