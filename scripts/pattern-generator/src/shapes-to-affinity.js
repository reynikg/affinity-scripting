// Turn parsed shapes into Affinity curve objects.

import {
  BlendMode, Colour, CurveBuilder, FillDescriptor, LineStyleDescriptor,
  PolyCurve, PolyCurveNodeDefinition,
} from "./sdk.js";
import { resolvePaint, usesOcclusion } from "./paint.js";

const colourOf = (c) => Colour.createRGBA8({ r: c.r, g: c.g, b: c.b, alpha: c.alpha ?? 255 });

/** Build one Affinity curve from a parsed subpath, offset into the document. */
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

/** A stable key for shapes that can share one curve object. */
function styleKey(fill, stroke, width) {
  const part = (c) => (c ? `${c.r},${c.g},${c.b},${c.alpha ?? 255}` : "-");
  return `${part(fill)}|${part(stroke)}|${stroke ? width : 0}`;
}

function definitionFor(polyCurve, fill, stroke, width, name) {
  const noFill = FillDescriptor.createNone();
  const def = PolyCurveNodeDefinition.create(
    polyCurve,
    fill ? FillDescriptor.createSolid(colourOf(fill), BlendMode.Normal) : noFill,
    stroke ? FillDescriptor.createSolid(colourOf(stroke), BlendMode.Normal) : noFill,
    LineStyleDescriptor.createDefault(stroke ? width : 0),
    noFill,
  );
  def.userDescription = name;
  return def;
}

/**
 * Build the curve definitions for a parsed pattern.
 *
 * `merge` puts every shape sharing a colour and stroke weight into one curve
 * object. That is the difference between a layer stack of five entries and one
 * of several thousand, and Affinity stays responsive on the former. Turn it off
 * when the shapes are meant to be moved around individually.
 *
 * `offset` places the pattern's top-left corner in document coordinates; both
 * spaces run y-down from the top-left, so this is a plain translation.
 */
export function buildDefinitions(shapes, palette, { merge = true, offset = { x: 0, y: 0 }, name = "Pattern" } = {}) {
  merge = canMerge(shapes, merge);
  const dx = offset.x;
  const dy = offset.y;
  const defs = [];
  const groups = new Map();

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

/**
 * Whether these shapes may be merged.
 *
 * Merging collapses everything of one colour into a single curve object, which
 * is what keeps the layer stack and Affinity itself quick. It cannot be done
 * when the pattern occludes — isometric cubes hide the ones behind them by
 * being painted over them, and objects merged into one lose that order.
 */
export function canMerge(shapes, requested = true) {
  return requested && !usesOcclusion(shapes);
}

/** How many curve objects a run would create, for the dialog's readout. */
export function countObjects(shapes, palette, merge) {
  merge = canMerge(shapes, merge);
  if (!merge) return shapes.filter((s) => resolvePaint(s.fill, palette) || resolvePaint(s.stroke, palette)).length;
  const keys = new Set();
  for (const shape of shapes) {
    const fill = resolvePaint(shape.fill, palette);
    const stroke = resolvePaint(shape.stroke, palette);
    if (!fill && !stroke) continue;
    keys.add(styleKey(fill, stroke, shape.strokeWidth ?? 1));
  }
  return keys.size;
}
