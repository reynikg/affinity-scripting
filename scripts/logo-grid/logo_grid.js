/**
 * name: Logo Grid
 * description: Draws anchor points, Bezier handles and a derived construction grid over the selected artwork.
 * version: 3.0.0
 * original author: JiriKrblich
 * modified by: Robert Reynik | Claude Opus 5
 */

'use strict';

const { BlendMode } = require('affinity:common');
const { AddChildNodesCommandBuilder, CompoundCommandBuilder, DocumentCommand } = require('/commands.js');
const { Colour, SVG11 } = require('/colours.js');
const { Dialog, DialogResult } = require('/dialog.js');
const { Document } = require('/document.js');
const { FillDescriptor } = require('/fills.js');
const { Curve, PolyCurve, Rectangle, unionRects } = require('/geometry.js');
const { LineStyleDescriptor } = require('/linestyle.js');
const { ContainerNodeDefinition, PolyCurveNodeDefinition } = require('/nodes.js');
const { UnitType } = require('/units.js');

const LAYER_NAME = 'Logo Grid';
// Handles shorter than this (in spread units) count as retracted, so a point
// with two dead handles reads as a sharp corner rather than a zero-length line.
const RETRACTED = 1e-4;
// cos(angle) between the two handles at or below this means they are collinear
// and opposed, i.e. a smooth point. -0.9995 is about 1.8 degrees of slack.
const SMOOTH_COS = -0.9995;
// Sample positions along a segment, used for the circle fit and the span test.
const ARC_SAMPLES = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];

function isOk(result) {
    return (result?.value ?? result) == DialogResult.Ok.value;
}

function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function samePoint(a, b) {
    return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}

// ---------------------------------------------------------------- curve reading

// Decomposes a curve into anchors carrying their incoming (left) and outgoing
// (right) handle positions. A retracted handle sits exactly on its anchor.
// Closed curves whose last segment returns to the start are not double-counted.
function decompose(curve) {
    const bez = curve.beziers.toArray();
    if (bez.length == 0)
        return [];
    const wraps = curve.isClosed && samePoint(bez[bez.length - 1].end, bez[0].start);
    const pts = bez.map(b => ({ anchor: b.start, left: null, right: b.c1 }));
    if (!wraps)
        pts.push({ anchor: bez[bez.length - 1].end, left: null, right: null });
    for (let i = 0; i < bez.length; ++i)
        pts[(i + 1) % pts.length].left = bez[i].c2;
    for (const p of pts) {
        p.left ??= p.anchor;
        p.right ??= p.anchor;
    }
    return pts;
}

function isLive(handle, anchor) {
    return dist(handle, anchor) > RETRACTED;
}

// A smooth point has two live handles pointing in opposite directions.
function isSmooth(p) {
    if (!isLive(p.left, p.anchor) || !isLive(p.right, p.anchor))
        return false;
    const ax = p.left.x - p.anchor.x, ay = p.left.y - p.anchor.y;
    const bx = p.right.x - p.anchor.x, by = p.right.y - p.anchor.y;
    return ((ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by))) <= SMOOTH_COS;
}

// Every selected vector or text object, read as a poly curve in spread space.
// Spread space keeps the markers a uniform size no matter how the source
// objects are scaled.
function readSpreadCurves(nodes) {
    const out = [];
    for (const node of nodes) {
        const ci = node.curvesInterface;
        if (!ci)
            continue;
        const poly = ci.polyCurve.clone();
        poly.transform(node.baseToSpreadTransform);
        if (poly.curveCount > 0)
            out.push(poly);
    }
    return out;
}

function boundsOf(polyCurves) {
    let box = null;
    for (const poly of polyCurves) {
        const b = poly.boundingBox;
        if (b)
            box = box ? unionRects(box, b) : b;
    }
    return box;
}

function collectSegments(polyCurves) {
    const segs = [];
    for (const poly of polyCurves)
        for (const curve of poly.curves)
            segs.push(...curve.beziers.toArray());
    return segs;
}

// Flattens the selection into the point lists the overlay is drawn from.
function analyse(polyCurves) {
    const smooth = [], corner = [], handleDots = [], handleLines = [];
    for (const poly of polyCurves) {
        for (const curve of poly.curves) {
            for (const p of decompose(curve)) {
                (isSmooth(p) ? smooth : corner).push(p.anchor);
                for (const h of [p.left, p.right]) {
                    if (!isLive(h, p.anchor))
                        continue;
                    handleLines.push({ a: p.anchor, b: h });
                    handleDots.push(h);
                }
            }
        }
    }
    return { smooth, corner, handleDots, handleLines };
}

// ---------------------------------------------------------------- construction

function pointLineDistance(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12)
        return dist(p, a);
    return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

// A segment is straight when both handles lie on the chord. The tolerance is a
// fraction of the segment's own length, not of the artwork, so a short segment
// is not called straight just because it is short.
function isStraight(bez, relTol, floor) {
    const tol = Math.max(dist(bez.start, bez.end) * relTol, floor);
    return pointLineDistance(bez.c1, bez.start, bez.end) <= tol
        && pointLineDistance(bez.c2, bez.start, bez.end) <= tol;
}

// Kasa algebraic circle fit: least squares on x^2+y^2-2ax-2by+c, which is linear
// in the unknowns and so needs no iteration. Null when the points are collinear.
function fitCircle(pts) {
    const n = pts.length;
    if (n < 3)
        return null;
    let mx = 0, my = 0;
    for (const p of pts) { mx += p.x; my += p.y; }
    mx /= n; my /= n;
    let Suu = 0, Suv = 0, Svv = 0, Suuu = 0, Svvv = 0, Suvv = 0, Svuu = 0;
    for (const p of pts) {
        const u = p.x - mx, v = p.y - my;
        Suu += u * u; Suv += u * v; Svv += v * v;
        Suuu += u * u * u; Svvv += v * v * v;
        Suvv += u * v * v; Svuu += v * u * u;
    }
    const det = Suu * Svv - Suv * Suv;
    if (Math.abs(det) < 1e-12)
        return null;
    const bx = 0.5 * (Suuu + Suvv), by = 0.5 * (Svvv + Svuu);
    const uc = (bx * Svv - by * Suv) / det;
    const vc = (by * Suu - bx * Suv) / det;
    const r2 = uc * uc + vc * vc + (Suu + Svv) / n;
    if (!(r2 > 0))
        return null;
    return { x: mx + uc, y: my + vc, r: Math.sqrt(r2) };
}

function worstRadialError(pts, c) {
    let worst = 0;
    for (const p of pts)
        worst = Math.max(worst, Math.abs(dist(p, c) - c.r));
    return worst;
}

// How much of the circle the evidence covers, in degrees: a full turn minus the
// widest gap between sample angles, so two arcs on opposite sides of the same
// circle still count as wide coverage.
function angularSpan(pts, c) {
    const angles = pts.map(p => Math.atan2(p.y - c.y, p.x - c.x)).sort((a, b) => a - b);
    if (angles.length < 2)
        return 0;
    let widest = angles[0] + 2 * Math.PI - angles[angles.length - 1];
    for (let i = 1; i < angles.length; ++i)
        widest = Math.max(widest, angles[i] - angles[i - 1]);
    return (2 * Math.PI - widest) * 180 / Math.PI;
}

// The circles the artwork's arcs lie on. Every arc-like segment is fitted, then
// near-identical fits are merged and refitted from their combined samples, so a
// circle drawn as four Beziers comes back as one circle rather than four.
function circlesFromSegments(segs, scale, cfg) {
    const minR = scale * 0.005, maxR = scale * 25;
    const groups = [];
    for (const bez of segs) {
        if (bez.length < cfg.minFeature || isStraight(bez, 1e-3, scale * 1e-5))
            continue;
        const pts = ARC_SAMPLES.map(t => bez.evaluate(t));
        const c = fitCircle(pts);
        if (!c || !(c.r > minR && c.r < maxR))
            continue;
        if (worstRadialError(pts, c) > cfg.tolerance * c.r)
            continue;
        const near = groups.find(g =>
            dist(g.c, c) <= cfg.clusterTol && Math.abs(g.c.r - c.r) <= cfg.clusterTol);
        if (near) {
            near.pts.push(...pts);
            near.c = fitCircle(near.pts) ?? near.c;
        } else {
            groups.push({ c, pts: pts.slice() });
        }
    }
    return groups.filter(g => angularSpan(g.pts, g.c) >= cfg.minSpan).map(g => g.c);
}

// A line in normal form, with a canonical sign so a segment and its reverse
// produce the same key.
function lineForm(a, b) {
    const len = dist(a, b);
    const dx = (b.x - a.x) / len, dy = (b.y - a.y) / len;
    let nx = -dy, ny = dx;
    if (ny < -1e-12 || (Math.abs(ny) <= 1e-12 && nx < 0)) { nx = -nx; ny = -ny; }
    return { nx, ny, d: nx * a.x + ny * a.y };
}

// The lines the artwork's straight edges lie on, with collinear edges merged.
function linesFromSegments(segs, scale, cfg) {
    const angleTol = Math.sin(cfg.tolerance * 2);
    const out = [];
    for (const bez of segs) {
        if (dist(bez.start, bez.end) < cfg.minFeature)
            continue;
        if (!isStraight(bez, cfg.tolerance, scale * 1e-4))
            continue;
        const l = lineForm(bez.start, bez.end);
        const near = out.find(o =>
            Math.abs(o.nx * l.ny - o.ny * l.nx) <= angleTol && Math.abs(o.d - l.d) <= cfg.clusterTol);
        if (!near)
            out.push(l);
    }
    return out;
}

// Clips an infinite line to a box, as the two points where it crosses.
function clipLineToRect(l, rc) {
    const px = l.nx * l.d, py = l.ny * l.d;
    const dx = -l.ny, dy = l.nx;
    let t0 = -Infinity, t1 = Infinity;
    const slab = (p, d, lo, hi) => {
        if (Math.abs(d) < 1e-12)
            return p >= lo && p <= hi;
        const a = (lo - p) / d, b = (hi - p) / d;
        t0 = Math.max(t0, Math.min(a, b));
        t1 = Math.min(t1, Math.max(a, b));
        return true;
    };
    if (!slab(px, dx, rc.x, rc.x + rc.width) || !slab(py, dy, rc.y, rc.y + rc.height))
        return null;
    if (!(t1 > t0))
        return null;
    return { a: { x: px + dx * t0, y: py + dy * t0 }, b: { x: px + dx * t1, y: py + dy * t1 } };
}

function buildConstruction(segs, box, opts) {
    const scale = Math.hypot(box.width, box.height);
    const cfg = {
        tolerance: opts.tolerance,
        minFeature: opts.minFeature,
        minSpan: opts.minSpan,
        clusterTol: scale * opts.tolerance * 0.75
    };
    const circles = opts.circles ? circlesFromSegments(segs, scale, cfg) : [];
    const lines = [];
    if (opts.lines) {
        const pad = scale * opts.extend;
        const field = new Rectangle(box.x - pad, box.y - pad, box.width + 2 * pad, box.height + 2 * pad);
        for (const l of linesFromSegments(segs, scale, cfg)) {
            const seg = clipLineToRect(l, field);
            if (seg)
                lines.push(seg);
        }
    }
    return { circles, lines, centres: opts.centres ? circles.map(c => ({ x: c.x, y: c.y })) : [] };
}

// ---------------------------------------------------------------- overlay build

function linesPoly(lines) {
    const poly = PolyCurve.create();
    for (const l of lines)
        poly.addCurve(Curve.createLineXY(l.a.x, l.a.y, l.b.x, l.b.y));
    return poly;
}

function circlesPoly(points, size) {
    const poly = PolyCurve.create();
    const r = size / 2;
    for (const p of points)
        poly.addCurve(Curve.createEllipse(new Rectangle(p.x - r, p.y - r, size, size)));
    return poly;
}

function squaresPoly(points, size) {
    const poly = PolyCurve.create();
    const r = size / 2;
    for (const p of points)
        poly.addCurve(Curve.createRectangle(new Rectangle(p.x - r, p.y - r, size, size)));
    return poly;
}

function fittedCirclesPoly(circles) {
    const poly = PolyCurve.create();
    for (const c of circles)
        poly.addCurve(Curve.createEllipse(new Rectangle(c.x - c.r, c.y - c.r, 2 * c.r, 2 * c.r)));
    return poly;
}

function crossesPoly(points, size) {
    const poly = PolyCurve.create();
    const r = size / 2;
    for (const p of points) {
        poly.addCurve(Curve.createLineXY(p.x - r, p.y, p.x + r, p.y));
        poly.addCurve(Curve.createLineXY(p.x, p.y - r, p.x, p.y + r));
    }
    return poly;
}

function outlinePoly(polyCurves) {
    const poly = PolyCurve.create();
    for (const src of polyCurves)
        for (const curve of src.curves)
            poly.addCurve(curve.clone());
    return poly;
}

// Argument order is (curves, brushFill, lineFill, lineStyle, transparencyFill).
function addPart(defs, name, poly, brushFill, lineFill, lineStyle, noFill) {
    if (poly.curveCount == 0)
        return;
    const def = PolyCurveNodeDefinition.create(poly, brushFill, lineFill, lineStyle, noFill);
    def.userDescription = name;
    defs.push(def);
}

function buildDefinitions(polyCurves, geom, construction, opts) {
    const noFill = FillDescriptor.createNone();
    const accent = FillDescriptor.createSolid(opts.colour, BlendMode.Normal);
    const grid = FillDescriptor.createSolid(opts.gridColour, BlendMode.Normal);
    const centre = opts.opaqueCentres
        ? FillDescriptor.createSolid(SVG11.white, BlendMode.Normal)
        : noFill;
    const stroke = LineStyleDescriptor.createDefault(opts.lineWidth);
    const gridStroke = LineStyleDescriptor.createDefault(opts.gridWidth);
    const defs = [];

    // Built back to front: grid, outline, handles, then the points on top.
    addPart(defs, 'Construction circles', fittedCirclesPoly(construction.circles), noFill, grid, gridStroke, noFill);
    addPart(defs, 'Construction lines', linesPoly(construction.lines), noFill, grid, gridStroke, noFill);
    addPart(defs, 'Construction centres', crossesPoly(construction.centres, opts.pointSize), noFill, grid, gridStroke, noFill);

    if (opts.drawOutline)
        addPart(defs, 'Path outline', outlinePoly(polyCurves), noFill, accent, stroke, noFill);
    if (opts.drawHandles) {
        addPart(defs, 'Handle lines', linesPoly(geom.handleLines), noFill, accent, stroke, noFill);
        addPart(defs, 'Handle dots', circlesPoly(geom.handleDots, opts.handleSize), accent, noFill, stroke, noFill);
    }
    if (opts.drawPoints) {
        if (opts.distinguish) {
            addPart(defs, 'Smooth points', circlesPoly(geom.smooth, opts.pointSize), centre, accent, stroke, noFill);
            addPart(defs, 'Corner points', squaresPoly(geom.corner, opts.pointSize), centre, accent, stroke, noFill);
        } else {
            addPart(defs, 'Points', squaresPoly(geom.smooth.concat(geom.corner), opts.pointSize), centre, accent, stroke, noFill);
        }
    }
    return defs;
}

// Adds a layer, selects it, then adds the parts with no insertion target so they
// land inside it. Mirrors the printers-marks example.
function createOverlayCommand(polyCurves, geom, construction, originalSelection, opts) {
    const defs = buildDefinitions(polyCurves, geom, construction, opts);
    if (defs.length == 0)
        return null;
    const layer = AddChildNodesCommandBuilder.create();
    layer.addNode(ContainerNodeDefinition.create(LAYER_NAME));
    const parts = AddChildNodesCommandBuilder.create();
    for (const def of defs)
        parts.addNode(def);
    const compound = CompoundCommandBuilder.create()
        .addCommand(layer.createCommand(true))
        .addCommand(parts.createCommand(false));
    if (opts.keepSelection)
        compound.addCommand(DocumentCommand.createSetSelection(originalSelection));
    return compound.createCommand();
}

// ---------------------------------------------------------------- dialog

// Marker sizes that suit the artwork rather than the document, so a logo and a
// full-page drawing both come out looking right on the first run.
function suggestedSizes(box) {
    const diag = box ? Math.hypot(box.width, box.height) : 100;
    const point = Math.min(Math.max(diag * 0.018, 1), 400);
    return {
        point,
        handle: point * 0.75,
        line: Math.max(point * 0.16, 0.1),
        grid: Math.max(point * 0.1, 0.1),
        feature: diag * 0.02
    };
}

function enableBy(toggle, controls) {
    const update = () => controls.forEach(c => c.isEnabled = toggle.value);
    toggle.onValueChangedHandler = update;
    update();
}

function buildDialog(doc, sizes) {
    const dlg = Dialog.create('Logo Grid');
    dlg.initialWidth = 460;
    const col = dlg.addColumn();

    const style = col.addGroup('Style');
    dlg.colour = style.addColourPicker('Point colour',
        Colour.createRGBAuf({ r: 0xD7 / 255, g: 0x19 / 255, b: 0x20 / 255, alpha: 1 }));
    dlg.gridColour = style.addColourPicker('Grid colour',
        Colour.createRGBAuf({ r: 0x27 / 255, g: 0x6E / 255, b: 0xF3 / 255, alpha: 1 }));
    dlg.pointSize = style.addUnitValueEditor('Point size', UnitType.Pixel, doc.units, sizes.point, 0.1)
        .setNoMaxValue().setShowPopupSlider().setPrecision(2);
    dlg.lineWidth = style.addUnitValueEditor('Point line width', UnitType.Pixel, doc.units, sizes.line, 0.01)
        .setNoMaxValue().setShowPopupSlider().setPrecision(2);

    const points = col.addGroup('Points');
    dlg.drawPoints = points.addSwitch('Draw anchor points', true);
    dlg.distinguish = points.addSwitch('Round smooth points, square corner points', true);
    dlg.opaqueCentres = points.addSwitch('Opaque point centres', true);
    enableBy(dlg.drawPoints, [dlg.distinguish, dlg.opaqueCentres]);

    const handles = col.addGroup('Handles');
    dlg.drawHandles = handles.addSwitch('Draw handles', true);
    dlg.handleSize = handles.addUnitValueEditor('Handle dot size', UnitType.Pixel, doc.units, sizes.handle, 0.1)
        .setNoMaxValue().setShowPopupSlider().setPrecision(2);
    enableBy(dlg.drawHandles, [dlg.handleSize]);

    const grid = col.addGroup('Construction grid');
    dlg.drawGrid = grid.addSwitch('Draw construction grid', true);
    dlg.gridCircles = grid.addSwitch('Circles through the arcs', true);
    dlg.gridLines = grid.addSwitch('Lines along the straight edges', true);
    dlg.gridCentres = grid.addSwitch('Mark circle centres', true);
    dlg.gridWidth = grid.addUnitValueEditor('Grid line width', UnitType.Pixel, doc.units, sizes.grid, 0.01)
        .setNoMaxValue().setShowPopupSlider().setPrecision(2);
    dlg.tolerance = grid.addUnitValueEditor('Tolerance %', UnitType.Number, UnitType.Number, 1, 0.01, 20)
        .setShowPopupSlider().setPrecision(2);
    dlg.minFeature = grid.addUnitValueEditor('Ignore features shorter than', UnitType.Pixel, doc.units, sizes.feature, 0)
        .setNoMaxValue().setShowPopupSlider().setPrecision(2);
    dlg.minSpan = grid.addUnitValueEditor('Minimum arc span', UnitType.Degree, UnitType.Degree, 20, 0, 360)
        .setShowPopupSlider().setPrecision(0);
    dlg.extend = grid.addUnitValueEditor('Extend lines beyond artwork %', UnitType.Number, UnitType.Number, 6, 0, 200)
        .setShowPopupSlider().setPrecision(0);
    enableBy(dlg.drawGrid, [dlg.gridCircles, dlg.gridLines, dlg.gridCentres, dlg.gridWidth,
        dlg.tolerance, dlg.minFeature, dlg.minSpan, dlg.extend]);

    const opts = col.addGroup('Options');
    dlg.drawOutline = opts.addSwitch('Trace the path outline', false);
    dlg.keepSelection = opts.addSwitch('Keep current selection', false);
    dlg.status = opts.addStaticText('', '');
    dlg.status.isFullWidth = true;
    return dlg;
}

function readOptions(dlg) {
    const on = dlg.drawGrid.value;
    return {
        colour: dlg.colour.value ?? SVG11.black,
        gridColour: dlg.gridColour.value ?? SVG11.black,
        pointSize: dlg.pointSize.value,
        handleSize: dlg.handleSize.value,
        lineWidth: dlg.lineWidth.value,
        gridWidth: dlg.gridWidth.value,
        drawPoints: dlg.drawPoints.value,
        distinguish: dlg.distinguish.value,
        opaqueCentres: dlg.opaqueCentres.value,
        drawHandles: dlg.drawHandles.value,
        drawOutline: dlg.drawOutline.value,
        keepSelection: dlg.keepSelection.value,
        circles: on && dlg.gridCircles.value,
        lines: on && dlg.gridLines.value,
        centres: on && dlg.gridCentres.value && dlg.gridCircles.value,
        tolerance: dlg.tolerance.value / 100,
        minFeature: dlg.minFeature.value,
        minSpan: dlg.minSpan.value,
        extend: dlg.extend.value / 100
    };
}

// ---------------------------------------------------------------- entry point

function main() {
    const doc = Document.current;
    if (!doc) {
        alert('This script requires an open document');
        return;
    }
    const originalSelection = doc.selection;
    const nodes = originalSelection.nodes.filter(n => !!n.curvesInterface).toArray();
    if (nodes.length == 0) {
        alert('Select one or more curves, shapes or text objects');
        return;
    }
    const polyCurves = readSpreadCurves(nodes);
    const box = boundsOf(polyCurves);
    const geom = analyse(polyCurves);
    if (!box || geom.smooth.length + geom.corner.length == 0) {
        alert('No curve points were found on the selection');
        return;
    }
    // Segments are read once; only the fitting is redone as the sliders move.
    const segs = collectSegments(polyCurves);

    const dlg = buildDialog(doc, suggestedSizes(box));

    // Preview mode lets Affinity roll the overlay back itself between edits, so
    // nothing has to be added and deleted by hand while the dialog is open.
    const update = (preview) => {
        const opts = readOptions(dlg);
        const construction = buildConstruction(segs, box, opts);
        const cmd = createOverlayCommand(polyCurves, geom, construction, originalSelection, opts);
        dlg.status.text = `${geom.smooth.length + geom.corner.length} points, `
            + `${geom.handleDots.length} handles, ${construction.circles.length} circles, `
            + `${construction.lines.length} lines`;
        if (cmd)
            doc.executeCommand(cmd, preview);
        else
            doc.clearPreviews();
        return cmd != null;
    };
    dlg.onControlValueChangedHandler = () => update(true);
    update(true);

    while (isOk(dlg.runModal())) {
        if (update(false))
            break;
        alert('Nothing would be drawn — turn on points, handles, the grid or the outline');
    }
    doc.clearPreviews();
}

main();
