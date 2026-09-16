// Headless check of the whole pipeline, for running through run_script.js.
//
// It skips the dialog — which would block an automated run — and drives every
// catalogue pattern through render, parse and curve building, then adds one to
// the document so the result can be rendered and looked at.
//
// Build and run with:
//   node scripts/pattern-generator/build.js --entry smoke
//   node run_script.js --file scripts/pattern-generator/smoke_test.js --render out/smoke.jpg

import { Document, ContainerNodeDefinition, AddChildNodesCommandBuilder,
         CompoundCommandBuilder } from "./sdk.js";
import { render } from "pattern-engine";
import { PATTERNS, defaultsFor } from "./catalogue.js";
import { resolveSize, aspectName, documentBox } from "./aspect.js";
import { svgToShapes, trimToCanvas } from "./svg-to-shapes.js";
import { buildDefinitions } from "./shapes-to-affinity.js";
import { buildDialog, showOnly, readParams, readPalette, PALETTE_DEFAULTS } from "./ui.js";
import { Colour } from "./sdk.js";

// A handful of patterns are also laid across the page, each at a different
// aspect ratio, so one rendered spread shows whether sizing and placement work.
const SHOWCASE = [
  { id: "flow-lines", aspect: 0 },
  { id: "truchet-arcs", aspect: 1 },
  { id: "iso-city", aspect: 2 },
  { id: "noise-rings", aspect: 3 },
];

const PALETTE = {
  stroke: PALETTE_DEFAULTS.stroke,
  fill: PALETTE_DEFAULTS.fill,
  occlusion: PALETTE_DEFAULTS.background,
  background: PALETTE_DEFAULTS.background,
};

function run() {
  const doc = Document.current;
  if (!doc) { console.log("FAIL: no document open"); return; }

  let failures = 0;
  const page = documentBox(doc) ?? { x: 0, y: 0, width: 1000, height: 1000 };
  const showcase = [];

  for (const pattern of PATTERNS) {
    for (let aspectIndex = 0; aspectIndex < 4; aspectIndex++) {
      const label = `${pattern.id} @ ${["1:1", "2:3", "3:4", "9:16"][aspectIndex]}`;
      try {
        const { width, height, aspect } = resolveSize(aspectIndex, 900, doc);
        const graph = pattern.build(width, height, defaultsFor(pattern));
        const canvas = graph.nodes.find((n) => n.type === "canvas");
        if (canvas) canvas.inputs.backgroundColor = "transparent";

        const t0 = Date.now();
        const svg = render(graph);
        const parsed = svgToShapes(svg);
        const rendered = parsed.shapes.length;
        parsed.shapes = trimToCanvas(parsed.shapes, parsed.width, parsed.height);
        const tRender = Date.now() - t0;

        if (parsed.shapes.length === 0) throw new Error("no shapes produced");
        if (Math.round(parsed.width) !== Math.round(width)) {
          throw new Error(`canvas width ${parsed.width} != requested ${width}`);
        }

        const t1 = Date.now();
        const defs = buildDefinitions(parsed.shapes, PALETTE, {
          merge: true, offset: { x: 0, y: 0 }, name: pattern.label,
        });
        const tCurves = Date.now() - t1;
        if (defs.length === 0) throw new Error("no curve definitions produced");

        console.log(`OK   ${label.padEnd(26)} ${String(Math.round(width)).padStart(4)}x` +
                    `${String(Math.round(height)).padEnd(4)} ` +
                    `shapes=${String(parsed.shapes.length).padStart(5)}/${String(rendered).padEnd(5)} ` +
                    `objects=${String(defs.length).padStart(2)} ` +
                    `render=${tRender}ms curves=${tCurves}ms`);

        const slot = SHOWCASE.findIndex((s) => s.id === pattern.id && s.aspect === aspectIndex);
        if (slot !== -1) {
          // Two by two across the page, each cell holding one pattern centred.
          const cellW = page.width / 2;
          const cellH = page.height / 2;
          const cellX = page.x + (slot % 2) * cellW;
          const cellY = page.y + Math.floor(slot / 2) * cellH;
          const fit = Math.min(cellW / width, cellH / height) * 0.9;
          showcase[slot] = {
            name: `${pattern.label} ${aspectName(aspect, width, height)}`,
            shapes: parsed.shapes,
            width: width * fit,
            height: height * fit,
            scale: fit,
            offset: {
              x: cellX + (cellW - width * fit) / 2,
              y: cellY + (cellH - height * fit) / 2,
            },
          };
        }
      } catch (err) {
        failures++;
        console.log(`FAIL ${label.padEnd(26)} ${err.message}`);
      }
    }
  }

  for (const entry of showcase) {
    if (!entry) continue;
    // Scale the parsed geometry into its cell before building curves.
    const scaled = entry.shapes.map((shape) => ({
      ...shape,
      strokeWidth: (shape.strokeWidth ?? 1) * entry.scale,
      subpaths: shape.subpaths.map((sp) => ({
        closed: sp.closed,
        start: [sp.start[0] * entry.scale, sp.start[1] * entry.scale],
        segments: sp.segments.map((seg) => [seg[0], ...seg.slice(1).map((v) => v * entry.scale)]),
      })),
    }));
    const defs = buildDefinitions(scaled, PALETTE, {
      merge: true, offset: entry.offset, name: entry.name,
    });
    const groupBuilder = AddChildNodesCommandBuilder.create();
    groupBuilder.addNode(ContainerNodeDefinition.create(entry.name));
    const curveBuilder = AddChildNodesCommandBuilder.create();
    for (const def of defs) curveBuilder.addNode(def);
    doc.executeCommand(
      CompoundCommandBuilder.create()
        .addCommand(groupBuilder.createCommand(true))
        .addCommand(curveBuilder.createCommand(false))
        .createCommand(),
      false);
    console.log(`Added group "${entry.name}" with ${defs.length} curve object(s).`);
  }

  const preview = checkPreview(doc);
  failures += preview.failed;
  failures += checkDialog(doc);
  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} failure(s).`);
}

/**
 * Check that a command executed as a preview shows without committing.
 *
 * This is what the dialog does on every change: execute with preview = true,
 * and let the next preview replace it. Nothing should reach the layer stack or
 * the undo history until OK is pressed.
 */
function checkPreview(doc) {
  try {
    const pattern = PATTERNS.find((p) => p.id === "truchet-arcs");
    const { width, height } = resolveSize(0, 600, doc);
    const graph = pattern.build(width, height, defaultsFor(pattern));
    const canvas = graph.nodes.find((n) => n.type === "canvas");
    if (canvas) canvas.inputs.backgroundColor = "transparent";
    const parsed = svgToShapes(render(graph));
    parsed.shapes = trimToCanvas(parsed.shapes, parsed.width, parsed.height);

    const page = documentBox(doc) ?? { x: 0, y: 0, width, height };
    const defs = buildDefinitions(parsed.shapes, PALETTE, {
      merge: true,
      offset: { x: page.x + (page.width - width) / 2, y: page.y + (page.height - height) / 2 },
      name: pattern.label,
    });
    const groupBuilder = AddChildNodesCommandBuilder.create();
    groupBuilder.addNode(ContainerNodeDefinition.create("Preview check"));
    const curveBuilder = AddChildNodesCommandBuilder.create();
    for (const def of defs) curveBuilder.addNode(def);
    const command = CompoundCommandBuilder.create()
      .addCommand(groupBuilder.createCommand(true))
      .addCommand(curveBuilder.createCommand(false))
      .createCommand();

    const layersBefore = doc.layers.toArray().length;
    const undoBefore = doc.canUndo;

    const t = Date.now();
    doc.executeCommand(command, true);
    const cost = Date.now() - t;

    // A preview must not land in the document or the undo history.
    if (doc.canUndo !== undoBefore) throw new Error("preview reached the undo history");

    console.log(`\nOK   preview: shown in ${cost}ms, undo history untouched.`);
    // Never leave one up: the script is about to end, and an unfinished
    // preview leaves Affinity redrawing it.
    doc.clearPreviews();
    return { failed: 0, layersBefore };
  } catch (err) {
    console.log(`\nFAIL preview: ${err.message}`);
    return { failed: 1 };
  }
}

/**
 * Build the dialog and read it back without showing it.
 *
 * runModal() would block an automated run, but everything up to it — the
 * controls, the per-pattern groups, and reading values out again — is exactly
 * where a wrong API name would bite, so it is worth exercising here.
 */
function checkDialog(doc) {
  const rgba = (c) => Colour.createRGBA8({ r: c.r, g: c.g, b: c.b, alpha: c.alpha ?? 255 });
  try {
    const dlg = buildDialog(doc, {
      stroke: rgba(PALETTE_DEFAULTS.stroke),
      fill: rgba(PALETTE_DEFAULTS.fill),
      background: rgba(PALETTE_DEFAULTS.background),
    });

    if (dlg.paramControls.length !== PATTERNS.length) {
      throw new Error(`${dlg.paramControls.length} control groups for ${PATTERNS.length} patterns`);
    }
    // The button is checked for existence and enablement only. Attaching a
    // click handler to a dialog that is never shown leaves a live callback on
    // an object nothing will ever dispose.
    if (!dlg.refresh) throw new Error("no Update preview button");
    dlg.refresh.isEnabled = true;
    dlg.refresh.isEnabled = false;

    for (let i = 0; i < PATTERNS.length; i++) {
      showOnly(dlg, i);
      const params = readParams(dlg, i);
      const expected = defaultsFor(PATTERNS[i]);
      for (const key of Object.keys(expected)) {
        if (!Number.isFinite(params[key])) {
          throw new Error(`${PATTERNS[i].id}: "${key}" read back as ${params[key]}`);
        }
      }
      // The dialog has to agree with the catalogue, or the sliders drive nothing.
      const drifted = Object.keys(expected).filter((k) => Math.abs(params[k] - expected[k]) > 1e-6);
      if (drifted.length > 0) {
        throw new Error(`${PATTERNS[i].id}: ${drifted.join(", ")} did not round-trip`);
      }
    }

    const palette = readPalette(dlg);
    for (const role of ["stroke", "fill", "occlusion", "background"]) {
      if (!palette[role] || !Number.isFinite(palette[role].r)) {
        throw new Error(`palette.${role} did not resolve`);
      }
    }

    console.log(`\nOK   dialog: ${PATTERNS.length} pattern groups, params and palette read back.`);
    return 0;
  } catch (err) {
    console.log(`\nFAIL dialog: ${err.message}`);
    return 1;
  }
}

run();
