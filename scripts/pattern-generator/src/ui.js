// The Pattern Generator dialog.
//
// Every pattern has its own parameters, and Affinity builds a dialog once and
// keeps it for the session, so all of them are laid out up front and the ones
// belonging to other patterns are hidden. Switching pattern shows one set and
// hides the rest — no rebuilding, and each pattern remembers what you set.

import { Dialog, UnitType } from "./sdk.js";
import { PATTERNS, PATTERN_LABELS, defaultsFor } from "./catalogue.js";
import { ASPECT_LABELS, ASPECTS, DEFAULT_ASPECT } from "./aspect.js";

export const SEED_MAX = 999999;

// The engine ships a dark-on-light palette for the web. Affinity documents are
// white by default, so these are inverted — otherwise the first run looks empty.
const PALETTE_DEFAULTS = {
  stroke: { r: 26, g: 26, b: 25, alpha: 255 },
  fill: { r: 26, g: 26, b: 25, alpha: 255 },
  background: { r: 255, g: 255, b: 255, alpha: 255 },
};

export function buildDialog(doc, colours) {
  const dlg = Dialog.create("Pattern Generator");
  const column = dlg.addColumn();

  const patternGroup = column.addGroup("Pattern");
  dlg.pattern = patternGroup.addComboBox("Design", PATTERN_LABELS, 0).setIsFullWidth();
  dlg.note = patternGroup.addStaticText(null, PATTERNS[0].note).setIsFullWidth();

  const sizeGroup = column.addGroup("Size");
  dlg.aspect = sizeGroup.addComboBox("Aspect ratio", ASPECT_LABELS, DEFAULT_ASPECT).setIsFullWidth();
  dlg.size = sizeGroup
    .addUnitValueEditor("Long edge", UnitType.Pixel, doc.units, defaultLongEdge(doc), 16)
    .setNoMaxValue()
    .setPrecision(0);
  dlg.sizeNote = sizeGroup.addStaticText(null, "").setIsFullWidth();

  // One group per pattern, all built now and all but the first hidden.
  dlg.paramGroups = [];
  dlg.paramControls = [];
  for (const pattern of PATTERNS) {
    const group = column.addGroup(`${pattern.label} settings`);
    const controls = {};
    for (const param of pattern.params) {
      controls[param.key] = group
        .addUnitValueEditor(param.label, UnitType.Number, UnitType.Number,
                            param.def, param.min, param.max)
        .setShowPopupSlider(true)
        .setPrecision(param.kind === "int" ? 0 : (param.precision ?? 2));
    }
    controls.seed = group
      .addUnitValueEditor("Seed", UnitType.Number, UnitType.Number, defaultsFor(pattern).seed, 0, SEED_MAX)
      .setPrecision(0);
    dlg.paramGroups.push(group);
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

/** A sensible default that fits the document rather than overflowing it. */
function defaultLongEdge(doc) {
  const longest = Math.max(doc.widthPixels, doc.heightPixels);
  return Math.max(16, Math.round(longest * 0.8));
}

/** Show the chosen pattern's settings and hide every other pattern's. */
export function showOnly(dlg, index) {
  dlg.paramGroups.forEach((group, i) => group.setIsVisible(i === index));
  dlg.note.text = PATTERNS[index].note;
}

/** Read the current values for the selected pattern. */
export function readParams(dlg, index) {
  const pattern = PATTERNS[index];
  const controls = dlg.paramControls[index];
  const values = { seed: Math.round(controls.seed.value) };
  for (const param of pattern.params) {
    const raw = controls[param.key].value;
    values[param.key] = param.kind === "int" ? Math.round(raw) : raw;
  }
  return values;
}

/** The colours the engine's CSS variables resolve against. */
export function readPalette(dlg) {
  const background = toRGBA(dlg.backgroundColour.value, PALETTE_DEFAULTS.background);
  return {
    stroke: toRGBA(dlg.strokeColour.value, PALETTE_DEFAULTS.stroke),
    fill: toRGBA(dlg.fillColour.value, PALETTE_DEFAULTS.fill),
    // Occlusion is what hides geometry behind a face, so it tracks the sheet.
    occlusion: background,
    background,
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

export { PALETTE_DEFAULTS };
