// Pattern Generator — generative SVG patterns as native Affinity curves.
//
// The engine renders a pattern to SVG, that SVG is flattened into transformed
// paths, and each path becomes an Affinity curve inside one named group. The
// result is editable vector art, not a placed image.

import { app, Document, DialogResult, Colour, ContainerNodeDefinition,
         AddChildNodesCommandBuilder, CompoundCommandBuilder } from "./sdk.js";
import { render } from "pattern-engine";
import { PATTERNS } from "./catalogue.js";
import { resolveSize, aspectName, documentBox, ASPECTS } from "./aspect.js";
import { svgToShapes, trimToCanvas } from "./svg-to-shapes.js";
import { buildDefinitions, countObjects } from "./shapes-to-affinity.js";
import { buildDialog, showOnly, readParams, readPalette, PALETTE_DEFAULTS } from "./ui.js";

// Past this many separate objects the layer panel stops being usable and the
// command takes long enough to feel broken, so we ask before going ahead.
const SEPARATE_WARN_AT = 1500;

// How long one preview may take before live updating gets in the way.
//
// The preview itself is nearly free — Affinity draws it lazily — but generating
// the pattern is not, and it runs on the thread the dialog lives on. Ordinary
// settings land around 20-150ms; tighten the spacing far enough and the same
// pattern takes well over a second, at which point every keystroke would stall.
// After one slow pass, previews wait to be asked for.
const PREVIEW_BUDGET_MS = 400;

const rgba = (c) => Colour.createRGBA8({ r: c.r, g: c.g, b: c.b, alpha: c.alpha ?? 255 });

// runModal() hands back an enum object, not the very one on DialogResult, so
// the comparison has to go through its value.
const isOk = (result) => (result?.value ?? result) === DialogResult.Ok.value;

const ARTBOARD_ASPECT = ASPECTS.findIndex((a) => a.id === "artboard");

/** Render the chosen pattern and flatten it, or explain why it could not. */
function generate(dlg, doc) {
  const index = dlg.pattern.selectedIndex;
  const pattern = PATTERNS[index];
  const params = readParams(dlg, index);
  const palette = readPalette(dlg);
  const { width, height, aspect, box } = resolveSize(dlg.aspect.selectedIndex, dlg.size.value, doc);

  if (!(width > 0) || !(height > 0)) return { error: "That size produces an empty canvas." };

  const graph = pattern.build(width, height, params);

  // The engine paints the sheet with a full-bleed rect; only ask for one when
  // the user wants it, otherwise the pattern would sit on an opaque slab.
  const canvas = graph.nodes.find((n) => n.type === "canvas");
  if (canvas) {
    const bg = palette.background;
    canvas.inputs.backgroundColor = dlg.drawBackground.value
      ? `rgb(${bg.r},${bg.g},${bg.b})` : "transparent";
    canvas.inputs.occlusionColor = `rgb(${bg.r},${bg.g},${bg.b})`;
  }

  let svg;
  try {
    svg = render(graph);
  } catch (err) {
    return { error: `${pattern.label} could not be generated:\n${err.message}` };
  }

  const parsed = svgToShapes(svg);
  const rendered = parsed.shapes.length;
  parsed.shapes = trimToCanvas(parsed.shapes, parsed.width, parsed.height);
  if (parsed.shapes.length === 0) {
    return { error: "These settings produce nothing to draw. Try a smaller spacing or a larger size." };
  }

  // Centre the pattern on the page, or land it on the artboard it was sized to.
  const page = documentBox(doc) ?? { x: 0, y: 0, width, height };
  const offset = box
    ? { x: box.x, y: box.y }
    : { x: page.x + (page.width - width) / 2, y: page.y + (page.height - height) / 2 };

  return {
    pattern, palette, width, height, parsed, offset, rendered,
    name: `${pattern.label} ${aspectName(aspect, width, height)}`,
    merge: !dlg.separate.value,
  };
}

/** The add-group-then-fill-it command, as one undoable step. */
function createCommand(run) {
  const defs = buildDefinitions(run.parsed.shapes, run.palette, {
    merge: run.merge,
    offset: run.offset,
    name: run.pattern.label,
  });
  if (defs.length === 0) return null;

  // Add the group and select it, then add the curves with no insertion target
  // so they land inside that selection.
  const groupBuilder = AddChildNodesCommandBuilder.create();
  groupBuilder.addNode(ContainerNodeDefinition.create(run.name));

  const curveBuilder = AddChildNodesCommandBuilder.create();
  for (const def of defs) curveBuilder.addNode(def);

  return CompoundCommandBuilder.create()
    .addCommand(groupBuilder.createCommand(true))
    .addCommand(curveBuilder.createCommand(false))
    .createCommand();
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
    background: rgba(PALETTE_DEFAULTS.background),
  });

  let lastPattern = dlg.pattern.selectedIndex;
  let run = null;
  let busy = false;
  let paused = false;      // last pass was slow: wait to be asked
  let lastCost = 0;

  /** Regenerate, describe the result, and draw it on the canvas as a preview. */
  function update({ force = false } = {}) {
    if (busy) return;

    // Switching pattern has to take effect even when previews are paused, or
    // the dialog would keep showing the previous pattern's settings.
    if (dlg.pattern.selectedIndex !== lastPattern) {
      lastPattern = dlg.pattern.selectedIndex;
      showOnly(dlg, lastPattern);
    }
    dlg.size.isEnabled = dlg.aspect.selectedIndex !== ARTBOARD_ASPECT;

    if (paused && !force) {
      // The counts come from generating, so there is nothing cheap to show.
      run = null;
      dlg.readout.text =
        `Preview paused — the last one took ${(lastCost / 1000).toFixed(1)}s.\n` +
        `Press Update preview to see these settings, or OK to create them.`;
      return;
    }

    busy = true;
    const started = Date.now();
    try {
      run = generate(dlg, doc);
      if (run.error) {
        doc.clearPreviews();
        dlg.sizeNote.text = "";
        dlg.readout.text = run.error;
        return;
      }

      const objects = countObjects(run.parsed.shapes, run.palette, run.merge);
      const command = createCommand(run);
      if (command) doc.executeCommand(command, true);
      else doc.clearPreviews();

      dlg.sizeNote.text = `Canvas ${Math.round(run.width)} x ${Math.round(run.height)} px`;
      const trimmed = run.rendered - run.parsed.shapes.length;
      dlg.readout.text =
        `${run.parsed.shapes.length} shapes -> ${objects} curve object${objects === 1 ? "" : "s"}` +
        (trimmed > 0 ? `  (${trimmed} off-canvas dropped)` : "") + "\n" +
        (run.merge && objects === run.parsed.shapes.length && objects > 1
          ? `Kept separate: this pattern depends on the order it is drawn in.\n` : "") +
        `Group: "${run.name}"  —  previewed on the page`;
    } catch (err) {
      run = { error: String(err) };
      doc.clearPreviews();
      dlg.readout.text = String(err);
    } finally {
      busy = false;
      lastCost = Date.now() - started;
      paused = lastCost > PREVIEW_BUDGET_MS;
      dlg.refresh.isEnabled = paused;
    }
  }

  dlg.onControlValueChangedHandler = () => update();
  dlg.refresh.onClickHandler = () => update({ force: true });
  update();

  while (isOk(dlg.runModal())) {
    // Previews may have been paused, so there may be nothing generated yet.
    if (!run || run.error) {
      update({ force: true });
      if (!run || run.error) {
        app.alert(run?.error ?? "Choose settings that produce a pattern.");
        continue;
      }
    }

    const objects = countObjects(run.parsed.shapes, run.palette, run.merge);
    if (!run.merge && objects > SEPARATE_WARN_AT) {
      app.alert(
        `This would create ${objects} separate objects, which Affinity will be slow to handle.\n\n` +
        `Turn off "One object per shape", or reduce the pattern's detail, then try again.`);
      continue;
    }

    const command = createCommand(run);
    if (!command) {
      app.alert("These settings produce nothing to draw.");
      continue;
    }
    // The preview is replaced by the real thing, as one undo step.
    doc.executeCommand(command, false);
    break;
  }

  // Always, on every way out. A preview left behind when the script ends keeps
  // Affinity redrawing it with nothing left to finish it off.
  doc.clearPreviews();
}

main();
