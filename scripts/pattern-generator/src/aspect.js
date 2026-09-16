// Aspect ratios offered in the dialog, and the canvas size each one resolves to.

import { Document } from "./sdk.js";

// `artboard` has no fixed ratio — it is read from the document when chosen.
export const ASPECTS = [
  { id: "1:1", label: "1:1  Square", w: 1, h: 1 },
  { id: "2:3", label: "2:3  Portrait", w: 2, h: 3 },
  { id: "3:4", label: "3:4  Portrait", w: 3, h: 4 },
  { id: "9:16", label: "9:16  Tall", w: 9, h: 16 },
  { id: "artboard", label: "Artboard  (current canvas)", w: null, h: null },
];

export const ASPECT_LABELS = ASPECTS.map((a) => a.label);
export const DEFAULT_ASPECT = 0;

/**
 * The document's own proportions, for the "artboard" option.
 *
 * A document may hold several artboards; the first one is the sensible target
 * because that is what `doc.artboards` orders first and what the user sees on
 * opening. With no artboards at all, the spread itself is the canvas.
 */
export function documentBox(doc = Document.current) {
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

/**
 * Turn a chosen ratio and a long-edge length into a canvas size.
 *
 * `size` is always the LONGER edge, so a pattern keeps its visual weight as you
 * switch between portrait and square rather than shrinking on one axis.
 */
export function resolveSize(aspectIndex, size, doc) {
  const aspect = ASPECTS[aspectIndex] ?? ASPECTS[0];

  if (aspect.id === "artboard") {
    const box = documentBox(doc);
    if (!box) return { width: size, height: size, aspect };
    // The artboard is used at its true size, so the pattern lands 1:1 on it.
    return { width: box.width, height: box.height, aspect, box };
  }

  const long = Math.max(aspect.w, aspect.h);
  return {
    width: Math.round((size * aspect.w) / long),
    height: Math.round((size * aspect.h) / long),
    aspect,
  };
}

/** The ratio as it appears in the layer name — "3:4", or the real one for an artboard. */
export function aspectName(aspect, width, height) {
  if (aspect.id !== "artboard") return aspect.id;
  const g = gcd(Math.round(width), Math.round(height));
  return g > 1 ? `${Math.round(width) / g}:${Math.round(height) / g}` : `${Math.round(width)}x${Math.round(height)}`;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}
