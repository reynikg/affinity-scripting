/**
 * name: Window Chrome
 * description: Turns each selected rectangle into an empty OS window, in the chosen interface style.
 * version: 1.0.0
 * author: Robert Reynik | Claude Opus 5
 */

'use strict';

const { BlendMode } = require('affinity:common');
const { AddChildNodesCommandBuilder, CompoundCommandBuilder, DocumentCommand } = require('/commands.js');
const { Colour, Gradient } = require('/colours.js');
const { Dialog, DialogResult } = require('/dialog.js');
const { Document } = require('/document.js');
const { FillDescriptor, GradientFill, GradientFillType } = require('/fills.js');
const { Curve, PolyCurve, Rectangle, Transform } = require('/geometry.js');
const { OuterShadowLayerEffect } = require('/layereffects.js');
const { LineCap, LineJoin, LineStyle, LineStyleDescriptor, StrokeAlignment } = require('/linestyle.js');
const { ContainerNodeDefinition, PolyCurveNodeDefinition, ShapeNodeDefinition } = require('/nodes.js');
const { Selection } = require('/selections.js');
const { ShapeCornerType, ShapeRectangle } = require('/shapes.js');
const { UnitType } = require('/units.js');

// ---------------------------------------------------------------- colour

// '#RGB', '#RRGGBB' and '#RRGGBBAA' all parse. Everything in the catalogue
// below is a string so that shades can be mixed arithmetically before any
// Colour object exists.
function parseHex(text) {
    let s = String(text).replace('#', '');
    if (s.length == 3)
        s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    if (s.length == 6)
        s += 'ff';
    const n = parseInt(s, 16);
    return { r: (n >>> 24) & 255, g: (n >>> 16) & 255, b: (n >>> 8) & 255, a: n & 255 };
}

function colour(text) {
    const c = parseHex(text);
    return Colour.createRGBAuf({ r: c.r / 255, g: c.g / 255, b: c.b / 255, alpha: c.a / 255 });
}

// Linear mix in sRGB. Good enough for picking the lighter half of a glossy
// button, which is all it is used for.
function mix(a, b, t) {
    const x = parseHex(a), y = parseHex(b);
    const at = (p, q) => Math.round(p + (q - p) * t);
    const hh = (v) => v.toString(16).padStart(2, '0');
    return '#' + hh(at(x.r, y.r)) + hh(at(x.g, y.g)) + hh(at(x.b, y.b)) + hh(at(x.a, y.a));
}

function solid(text) {
    return FillDescriptor.createSolid(colour(text), BlendMode.Normal);
}

// A linear gradient running top to bottom across `rc`. The gradient's own space
// is the unit square: (0,0) is the first stop and (1,0) the last, so the matrix
// sends the u axis down the rectangle and the v axis across it.
function gradient(rc, stops) {
    const g = Gradient.create(stops.map(([position, text]) => ({ colour: colour(text), position })));
    const t = new Transform();
    t.data[0] = 0; t.data[1] = rc.width; t.data[2] = rc.x;
    t.data[3] = rc.height; t.data[4] = 0; t.data[5] = rc.y;
    return FillDescriptor.create(GradientFill.create(g, GradientFillType.Linear), false, t, BlendMode.Normal, false);
}

// A fill from either a solid colour string or a [[position, colour], ...] ramp.
function paint(spec, rc) {
    if (!spec)
        return null;
    return Array.isArray(spec) ? gradient(rc, spec) : solid(spec);
}

// ---------------------------------------------------------------- geometry

function lineStyle(weight, align, join = LineJoin.Miter, cap = LineCap.Butt) {
    return LineStyleDescriptor.create(
        LineStyle.create({ weight, join, cap }),
        { strokeAlignment: align ?? StrokeAlignment.Centre });
}

// Per-corner radii, in order [topLeft, topRight, bottomRight, bottomLeft].
// The corner type has to be set to Round before a radius will stick.
function roundedRect(rc, radii) {
    const shape = ShapeRectangle.create();
    shape.useSingleRadius = false;
    shape.setAbsoluteSizes(true, rc.width, rc.height);
    const corners = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
    for (let i = 0; i < 4; ++i) {
        const r = Math.max(0, Math.min(radii[i] ?? 0, Math.min(rc.width, rc.height) / 2));
        shape[corners[i]].cornerType = r > 0 ? ShapeCornerType.Round : ShapeCornerType.Straight;
        shape[corners[i]].setRadius(r, rc.width, rc.height);
    }
    return shape;
}

// ---------------------------------------------------------------- the canvas
//
// Every drawing helper hangs off a canvas so that a part can be placed in
// window-local coordinates — (0,0) is the window's top left corner — while the
// node definition it produces is positioned in the source rectangle's own
// coordinate space and carries that rectangle's transform. A rotated or scaled
// rectangle therefore yields a rotated or scaled window.

function createCanvas(box, transform) {
    return {
        parts: [],
        box,
        transform,
        rect(x, y, w, h) {
            return new Rectangle(this.box.x + x, this.box.y + y, w, h);
        },
        push(def, name) {
            def.userDescription = name;
            if (this.transform)
                def.transform = this.transform;
            this.parts.push(def);
            return def;
        }
    };
}

// `style` is { fill, stroke, weight, align, join, cap }, where fill and stroke
// are colour strings or gradient ramps.
function addRect(canvas, name, x, y, w, h, radii, style) {
    if (!(w > 0) || !(h > 0))
        return;
    const rc = canvas.rect(x, y, w, h);
    const line = style.stroke ? paint(style.stroke, rc) : null;
    canvas.push(ShapeNodeDefinition.create(
        roundedRect(rc, radii), rc,
        paint(style.fill, rc) ?? FillDescriptor.createNone(),
        line ?? FillDescriptor.createNone(),
        line ? lineStyle(style.weight ?? 1, style.align, style.join, style.cap) : null,
        null), name);
}

function addCurves(canvas, name, curves, style) {
    const poly = PolyCurve.create();
    for (const curve of curves)
        poly.addCurve(curve);
    if (poly.curveCount == 0)
        return;
    const rc = poly.boundingBox ?? canvas.rect(0, 0, 1, 1);
    const line = style.stroke ? paint(style.stroke, rc) : null;
    canvas.push(PolyCurveNodeDefinition.create(
        poly,
        paint(style.fill, rc) ?? FillDescriptor.createNone(),
        line ?? FillDescriptor.createNone(),
        lineStyle(style.weight ?? 1, style.align, style.join, style.cap),
        FillDescriptor.createNone()), name);
}

function addCircle(canvas, name, cx, cy, d, style) {
    addCurves(canvas, name, [Curve.createEllipse(canvas.rect(cx - d / 2, cy - d / 2, d, d))], style);
}

function addEllipse(canvas, name, x, y, w, h, style) {
    addCurves(canvas, name, [Curve.createEllipse(canvas.rect(x, y, w, h))], style);
}

function line(canvas, x1, y1, x2, y2) {
    const a = canvas.rect(x1, y1, 0, 0), b = canvas.rect(x2, y2, 0, 0);
    return Curve.createLineXY(a.x, a.y, b.x, b.y);
}

// ---------------------------------------------------------------- glyphs

function glyphClose(canvas, cx, cy, s) {
    const r = s / 2;
    return [line(canvas, cx - r, cy - r, cx + r, cy + r), line(canvas, cx + r, cy - r, cx - r, cy + r)];
}

function glyphMinimise(canvas, cx, cy, s) {
    return [line(canvas, cx - s / 2, cy, cx + s / 2, cy)];
}

function glyphChevron(canvas, cx, cy, s, down) {
    const r = s / 2, k = down ? 1 : -1;
    return [
        line(canvas, cx - r, cy - k * r * 0.5, cx, cy + k * r * 0.5),
        line(canvas, cx, cy + k * r * 0.5, cx + r, cy - k * r * 0.5)
    ];
}

// ---------------------------------------------------------------- families
//
// Each family lays out one window. `ctx` carries the window size in window
// coordinates (w, h), the unit scale u that every catalogue measurement is
// multiplied by, the chosen palette c, the preset's metrics m, and the user's
// switches.

function addTitlePlaceholder(ctx) {
    const { canvas, w, u, c, m, opts } = ctx;
    if (!opts.title || !c.titleText)
        return;
    const bar = m.titleBar * u;
    const height = Math.max(m.titlePill ?? 6, 4) * u;
    const width = Math.max(Math.min(w * (m.titleWidth ?? 0.22), w * 0.45), 8 * u);
    const x = m.titleAlign == 'left' ? (m.titleInset ?? 12) * u : (w - width) / 2;
    addRect(canvas, 'Title placeholder', x, (bar - height) / 2, width, height,
        [height / 2, height / 2, height / 2, height / 2], { fill: c.titleText });
}

function drawMac(ctx) {
    const { canvas, w, h, u, c, m, opts } = ctx;
    const r = m.radius * u;
    const rb = m.squareBottom ? 0 : r;
    const bar = m.titleBar * u;
    const hair = u;

    addRect(canvas, 'Window body', 0, 0, w, h, [r, r, rb, rb], { fill: c.body });
    addRect(canvas, 'Title bar', 0, 0, w, bar, [r, r, 0, 0], { fill: c.title });
    if (c.titleGloss)
        addRect(canvas, 'Title bar highlight', r, 0, w - 2 * r, hair, [0, 0, 0, 0], { fill: c.titleGloss });
    addRect(canvas, 'Title bar separator', 0, bar - hair, w, hair, [0, 0, 0, 0], { fill: c.separator });

    addTitlePlaceholder(ctx);

    if (opts.buttons) {
        const d = m.light * u;
        const cy = bar / 2;
        const names = ['Close', 'Minimise', 'Zoom'];
        for (let i = 0; i < 3; ++i) {
            const cx = (m.firstLight + m.pitch * i) * u;
            const [face, ring] = c.lights[i];
            if (m.gem) {
                // Aqua gems: a vertical ramp from a washed-out top to the true
                // colour, with a specular highlight sitting over the top half.
                addCircle(canvas, names[i], cx, cy, d, {
                    fill: [[0, mix(face, '#FFFFFF', 0.55)], [0.5, face], [1, mix(face, ring, 0.6)]],
                    stroke: ring, weight: hair * 0.75, align: StrokeAlignment.Inside
                });
                addEllipse(canvas, names[i] + ' highlight',
                    cx - d * 0.30, cy - d * 0.38, d * 0.60, d * 0.30, { fill: '#FFFFFFB0' });
            } else {
                addCircle(canvas, names[i], cx, cy, d,
                    { fill: face, stroke: ring, weight: hair * 0.6, align: StrokeAlignment.Inside });
            }
        }
    }

    addRect(canvas, 'Window border', 0, 0, w, h, [r, r, rb, rb],
        { stroke: c.border, weight: hair, align: StrokeAlignment.Inside });
}

function drawLuna(ctx) {
    const { canvas, w, h, u, c, m, opts } = ctx;
    const r = m.radius * u;
    const bar = m.titleBar * u;
    const edge = m.frame * u;
    const hair = u;

    addRect(canvas, 'Window frame', 0, 0, w, h, [r, r, 0, 0], { fill: c.frame });
    addRect(canvas, 'Window body', edge, bar, w - 2 * edge, h - bar - edge, [0, 0, 0, 0], { fill: c.body });
    addRect(canvas, 'Title bar', 0, 0, w, bar, [r, r, 0, 0], { fill: c.title });
    addRect(canvas, 'Title bar highlight', r, hair, w - 2 * r, hair, [0, 0, 0, 0], { fill: c.titleGloss });

    addTitlePlaceholder(ctx);

    if (opts.buttons) {
        const size = 21 * u, gap = 2 * u, cy = bar / 2;
        let right = w - edge - 5 * u;
        const buttons = [['Close', c.close], ['Maximise', c.button], ['Minimise', c.button]];
        for (let i = 0; i < 3; ++i) {
            const [name, face] = buttons[i];
            const x = right - size;
            addRect(canvas, name, x, cy - size / 2, size, size, [3 * u, 3 * u, 3 * u, 3 * u],
                { fill: face, stroke: c.buttonEdge, weight: hair, align: StrokeAlignment.Inside });
            const cx = x + size / 2;
            const g = 7 * u;
            if (name == 'Close')
                addCurves(canvas, 'Close glyph', glyphClose(canvas, cx, cy, g),
                    { stroke: c.glyph, weight: 1.6 * u, cap: LineCap.Square });
            else if (name == 'Maximise')
                addRect(canvas, 'Maximise glyph', cx - g / 2, cy - g / 2, g, g, [0, 0, 0, 0],
                    { stroke: c.glyph, weight: 1.4 * u, align: StrokeAlignment.Centre });
            else
                addCurves(canvas, 'Minimise glyph', glyphMinimise(canvas, cx, cy + g / 2 - u, g * 0.8),
                    { stroke: c.glyph, weight: 2 * u, cap: LineCap.Square });
            right = x - gap;
        }
    }
}

function drawAero(ctx) {
    const { canvas, w, h, u, c, m, opts } = ctx;
    const r = m.radius * u;
    const rb = m.bottomRadius * u;
    const bar = m.titleBar * u;
    const edge = m.frame * u;
    const hair = u;

    addRect(canvas, 'Glass frame', 0, 0, w, h, [r, r, rb, rb], { fill: c.glass });
    addRect(canvas, 'Glass inner light', hair, hair, w - 2 * hair, h - 2 * hair, [r - hair, r - hair, rb, rb],
        { stroke: c.glassInner, weight: hair, align: StrokeAlignment.Inside });
    addRect(canvas, 'Window body', edge, bar, w - 2 * edge, h - bar - edge, [0, 0, 0, 0],
        { fill: c.body, stroke: c.bodyEdge, weight: hair, align: StrokeAlignment.Outside });

    addTitlePlaceholder(ctx);

    if (opts.buttons) {
        const height = 20 * u, top = hair;
        const widths = { Close: 47 * u, Maximise: 27 * u, Minimise: 27 * u };
        let right = w - hair * 2;
        for (const name of ['Close', 'Maximise', 'Minimise']) {
            const width = widths[name];
            const x = right - width;
            const isClose = name == 'Close';
            addRect(canvas, name, x, top, width, height,
                isClose ? [0, r - hair, 4 * u, 0] : [0, 0, 3 * u, 3 * u],
                {
                    fill: isClose ? c.close : c.button,
                    stroke: isClose ? c.closeEdge : c.buttonEdge,
                    weight: hair, align: StrokeAlignment.Inside
                });
            const cx = x + width / 2, cy = top + height / 2, g = 8 * u;
            const ink = isClose ? c.closeGlyph : c.glyph;
            if (isClose)
                addCurves(canvas, 'Close glyph', glyphClose(canvas, cx, cy, g),
                    { stroke: ink, weight: 1.6 * u, cap: LineCap.Square });
            else if (name == 'Maximise')
                addRect(canvas, 'Maximise glyph', cx - g / 2, cy - g / 2, g, g, [0, 0, 0, 0],
                    { stroke: ink, weight: 1.3 * u });
            else
                addCurves(canvas, 'Minimise glyph', glyphMinimise(canvas, cx, cy + g / 2, g),
                    { stroke: ink, weight: 1.6 * u, cap: LineCap.Square });
            right = x;
        }
    }

    addRect(canvas, 'Window border', 0, 0, w, h, [r, r, rb, rb],
        { stroke: c.border, weight: hair, align: StrokeAlignment.Inside });
}

function drawFluent(ctx) {
    const { canvas, w, h, u, c, m, opts } = ctx;
    const r = m.radius * u;
    const bar = m.titleBar * u;
    const hair = u;

    addRect(canvas, 'Window body', 0, 0, w, h, [r, r, r, r], { fill: c.body });
    addRect(canvas, 'Title bar', 0, 0, w, bar, [r, r, 0, 0], { fill: c.title });
    if (c.separator)
        addRect(canvas, 'Title bar separator', 0, bar - hair, w, hair, [0, 0, 0, 0], { fill: c.separator });

    addTitlePlaceholder(ctx);

    if (opts.buttons) {
        const width = 46 * u, cy = bar / 2, g = 10 * u;
        const order = ['Close', 'Maximise', 'Minimise'];
        for (let i = 0; i < 3; ++i) {
            const cx = w - width * (i + 0.5);
            const name = order[i];
            if (name == 'Close')
                addCurves(canvas, 'Close glyph', glyphClose(canvas, cx, cy, g),
                    { stroke: c.glyph, weight: 1.1 * u });
            else if (name == 'Maximise')
                addRect(canvas, 'Maximise glyph', cx - g / 2, cy - g / 2, g, g,
                    [1.5 * u, 1.5 * u, 1.5 * u, 1.5 * u], { stroke: c.glyph, weight: 1.1 * u });
            else
                addCurves(canvas, 'Minimise glyph', glyphMinimise(canvas, cx, cy, g),
                    { stroke: c.glyph, weight: 1.1 * u });
        }
    }

    addRect(canvas, 'Window border', 0, 0, w, h, [r, r, r, r],
        { stroke: c.border, weight: hair, align: StrokeAlignment.Inside });
}

function drawAdwaita(ctx) {
    const { canvas, w, h, u, c, m, opts } = ctx;
    const r = m.radius * u;
    const bar = m.titleBar * u;
    const hair = u;

    addRect(canvas, 'Window body', 0, 0, w, h, [r, r, r, r], { fill: c.body });
    addRect(canvas, 'Header bar', 0, 0, w, bar, [r, r, 0, 0], { fill: c.title });
    addRect(canvas, 'Header bar separator', 0, bar - hair, w, hair, [0, 0, 0, 0], { fill: c.separator });

    addTitlePlaceholder(ctx);

    if (opts.buttons) {
        // GNOME shows a close button and nothing else unless an app asks for
        // more, so that is what a plain window gets.
        const d = 24 * u, cx = w - 18 * u, cy = bar / 2;
        addCircle(canvas, 'Close', cx, cy, d, { fill: c.button });
        addCurves(canvas, 'Close glyph', glyphClose(canvas, cx, cy, 8 * u),
            { stroke: c.glyph, weight: 1.4 * u, cap: LineCap.Round });
    }

    addRect(canvas, 'Window border', 0, 0, w, h, [r, r, r, r],
        { stroke: c.border, weight: hair, align: StrokeAlignment.Inside });
}

function drawBreeze(ctx) {
    const { canvas, w, h, u, c, m, opts } = ctx;
    const r = m.radius * u;
    const bar = m.titleBar * u;
    const hair = u;

    addRect(canvas, 'Window body', 0, 0, w, h, [r, r, 0, 0], { fill: c.body });
    addRect(canvas, 'Title bar', 0, 0, w, bar, [r, r, 0, 0], { fill: c.title });
    if (c.separator)
        addRect(canvas, 'Title bar separator', 0, bar - hair, w, hair, [0, 0, 0, 0], { fill: c.separator });

    addTitlePlaceholder(ctx);

    if (opts.buttons) {
        const cy = bar / 2, g = 8 * u;
        const order = ['Close', 'Maximise', 'Minimise'];
        for (let i = 0; i < 3; ++i) {
            const cx = w - (18 + 24 * i) * u;
            const name = order[i];
            const curves = name == 'Close' ? glyphClose(canvas, cx, cy, g)
                : glyphChevron(canvas, cx, cy, g, name == 'Minimise');
            addCurves(canvas, name, curves,
                { stroke: c.glyph, weight: 1.3 * u, cap: LineCap.Round, join: LineJoin.Round });
        }
    }

    addRect(canvas, 'Window border', 0, 0, w, h, [r, r, 0, 0],
        { stroke: c.border, weight: hair, align: StrokeAlignment.Inside });
}

// ---------------------------------------------------------------- catalogue
//
// Measurements are the interface's own, in points at 100% scale: a 28pt macOS
// title bar, a 46pt GNOME header bar. The UI scale in the dialog multiplies
// them, so a 1200x800 rectangle drawn at 100% gets chrome the size it would be
// on a 1200x800 window.

const TRAFFIC_LIGHTS = [['#FF5F57', '#E0443E'], ['#FEBC2E', '#DEA123'], ['#28C840', '#1AAB29']];

const PRESETS = [
    {
        id: 'mac-modern',
        label: 'macOS — Big Sur to Sequoia',
        draw: drawMac,
        metrics: { radius: 11, titleBar: 28, light: 12, firstLight: 20, pitch: 20, titleAlign: 'centre', titleWidth: 0.24 },
        shadow: { radius: 45, offset: 14, opacity: 0.30 },
        light: {
            body: '#FFFFFF', title: '#ECECEC', separator: '#0000001F', border: '#00000030',
            lights: TRAFFIC_LIGHTS, titleText: '#00000038'
        },
        dark: {
            body: '#1E1E1E', title: '#323232', separator: '#00000099', border: '#FFFFFF1F',
            lights: TRAFFIC_LIGHTS, titleText: '#FFFFFF40'
        }
    },
    {
        id: 'mac-yosemite',
        label: 'macOS — Yosemite to Catalina',
        draw: drawMac,
        metrics: { radius: 6, titleBar: 22, light: 12, firstLight: 20, pitch: 20, titleAlign: 'centre', titleWidth: 0.22 },
        shadow: { radius: 35, offset: 10, opacity: 0.35 },
        light: {
            body: '#FFFFFF', title: [[0, '#E9E9E9'], [1, '#D3D3D3']], titleGloss: '#FBFBFB',
            separator: '#B4B4B4', border: '#00000040',
            lights: [['#FF5F56', '#E0443E'], ['#FFBD2E', '#DEA123'], ['#27C93F', '#1AAB29']],
            titleText: '#00000045'
        },
        dark: {
            body: '#262626', title: [[0, '#3E3E3E'], [1, '#2E2E2E']], titleGloss: '#4C4C4C',
            separator: '#1A1A1A', border: '#000000AA',
            lights: [['#FF5F56', '#E0443E'], ['#FFBD2E', '#DEA123'], ['#27C93F', '#1AAB29']],
            titleText: '#FFFFFF45'
        }
    },
    {
        id: 'mac-aqua',
        label: 'Mac OS X — Aqua (Snow Leopard)',
        draw: drawMac,
        metrics: { radius: 6, squareBottom: true, titleBar: 22, light: 14, firstLight: 20, pitch: 20, gem: true, titleAlign: 'centre', titleWidth: 0.22 },
        shadow: { radius: 30, offset: 8, opacity: 0.45 },
        light: {
            body: '#FFFFFF', title: [[0, '#EDEDED'], [0.5, '#D8D8D8'], [1, '#C6C6C6']], titleGloss: '#FDFDFD',
            separator: '#9A9A9A', border: '#00000070',
            lights: TRAFFIC_LIGHTS, titleText: '#00000050'
        },
        dark: {
            body: '#2A2A2A', title: [[0, '#5A5A5A'], [0.5, '#434343'], [1, '#353535']], titleGloss: '#6E6E6E',
            separator: '#1C1C1C', border: '#000000B0',
            lights: TRAFFIC_LIGHTS, titleText: '#FFFFFF50'
        }
    },
    {
        id: 'win-xp',
        label: 'Windows XP — Luna',
        draw: drawLuna,
        metrics: { radius: 8, titleBar: 29, frame: 4, titleAlign: 'left', titleInset: 26, titleWidth: 0.26, titlePill: 8 },
        shadow: { radius: 14, offset: 5, opacity: 0.35 },
        light: {
            body: '#FFFFFF', frame: '#0F58CE',
            title: [[0, '#4A90F2'], [0.10, '#1550C9'], [0.45, '#0B47BE'], [0.85, '#1B5FD6'], [1, '#4C90EE']],
            titleGloss: '#7FB4F7',
            button: [[0, '#5B9DF5'], [1, '#2C6FD8']], close: [[0, '#EC6B5B'], [1, '#C7381F']],
            buttonEdge: '#FFFFFFA0', glyph: '#FFFFFF', titleText: '#FFFFFFB0'
        },
        dark: {
            body: '#1C1C1C', frame: '#0A3A87',
            title: [[0, '#2E5FA8'], [0.10, '#123A85'], [0.45, '#0B2E70'], [0.85, '#123F8C'], [1, '#2F63AE']],
            titleGloss: '#4B7FC0',
            button: [[0, '#3C6DAE'], [1, '#1E4A8C']], close: [[0, '#B04A3E'], [1, '#832619']],
            buttonEdge: '#FFFFFF70', glyph: '#FFFFFF', titleText: '#FFFFFFA0'
        }
    },
    {
        id: 'win-7',
        label: 'Windows 7 — Aero',
        draw: drawAero,
        metrics: { radius: 8, bottomRadius: 2, titleBar: 30, frame: 8, titleAlign: 'left', titleInset: 32, titleWidth: 0.24, titlePill: 8 },
        shadow: { radius: 30, offset: 10, opacity: 0.40 },
        light: {
            body: '#FFFFFF', bodyEdge: '#8FA8C4',
            glass: [[0, '#EAF2FBD8'], [0.45, '#CADEF2CC'], [0.55, '#B9D2EBCC'], [1, '#D3E4F5D0']],
            glassInner: '#FFFFFFB0', border: '#5A7EA88C',
            button: '#FFFFFF59', buttonEdge: '#FFFFFF99', glyph: '#1F3B5C',
            close: [[0, '#F0796B'], [0.5, '#D8402F'], [1, '#A81B12']], closeEdge: '#FFFFFF8C', closeGlyph: '#FFFFFF',
            titleText: '#1F3B5C80'
        },
        dark: {
            body: '#242424', bodyEdge: '#0F1A26',
            glass: [[0, '#3C4C5EDD'], [0.45, '#2A3746D6'], [0.55, '#212C39D6'], [1, '#31404FD8']],
            glassInner: '#FFFFFF4D', border: '#0A121BB0',
            button: '#FFFFFF2E', buttonEdge: '#FFFFFF66', glyph: '#E8F0F8',
            close: [[0, '#D4685C'], [0.5, '#B03626'], [1, '#821409']], closeEdge: '#FFFFFF66', closeGlyph: '#FFFFFF',
            titleText: '#E8F0F880'
        }
    },
    {
        id: 'win-11',
        label: 'Windows 11 — Fluent',
        draw: drawFluent,
        metrics: { radius: 8, titleBar: 32, titleAlign: 'left', titleInset: 16, titleWidth: 0.2 },
        shadow: { radius: 40, offset: 12, opacity: 0.32 },
        light: {
            body: '#FFFFFF', title: '#F3F3F3', separator: '#00000010', border: '#E5E5E5',
            glyph: '#1A1A1A', titleText: '#00000038'
        },
        dark: {
            body: '#202020', title: '#2B2B2B', separator: '#FFFFFF0F', border: '#3A3A3A',
            glyph: '#FFFFFF', titleText: '#FFFFFF45'
        }
    },
    {
        id: 'linux-adwaita',
        label: 'Linux — GNOME (Adwaita)',
        draw: drawAdwaita,
        metrics: { radius: 12, titleBar: 46, titleAlign: 'centre', titleWidth: 0.2 },
        shadow: { radius: 50, offset: 16, opacity: 0.35 },
        light: {
            body: '#FFFFFF', title: '#EBEBEB', separator: '#00000021', border: '#0000002E',
            button: '#0000001A', glyph: '#2E2E2E', titleText: '#00000055'
        },
        dark: {
            body: '#242424', title: '#303030', separator: '#00000099', border: '#00000099',
            button: '#FFFFFF1A', glyph: '#EEEEEE', titleText: '#FFFFFF66'
        }
    },
    {
        id: 'linux-breeze',
        label: 'Linux — KDE (Breeze)',
        draw: drawBreeze,
        metrics: { radius: 6, titleBar: 30, titleAlign: 'centre', titleWidth: 0.22 },
        shadow: { radius: 28, offset: 8, opacity: 0.35 },
        light: {
            body: '#FCFCFC', title: '#EFF0F1', separator: '#00000014', border: '#BFC3C7',
            glyph: '#232629', titleText: '#23262960'
        },
        dark: {
            body: '#2A2E32', title: '#31363B', separator: '#00000033', border: '#1F2427',
            glyph: '#EFF0F1', titleText: '#EFF0F160'
        }
    }
];

// ---------------------------------------------------------------- assembly

// The x axis of the node's transform tells us how much bigger the rectangle
// looks on the spread than it measures in its own coordinates. Chrome is drawn
// in the node's coordinates, so dividing by that factor keeps the title bar the
// size the user asked for no matter how the rectangle has been scaled.
function transformScale(xf) {
    const s = Math.hypot(xf.data[0], xf.data[3]);
    return s > 1e-6 ? s : 1;
}

function windowParts(target, preset, opts) {
    const c = opts.dark ? preset.dark : preset.light;
    const m = preset.metrics;
    const canvas = createCanvas(target.box, target.transform);
    const ctx = {
        canvas,
        w: target.box.width,
        h: target.box.height,
        u: opts.scale / target.scale,
        c, m, opts
    };
    preset.draw(ctx);
    return canvas.parts;
}

function shadowEffect(preset, opts, spreadUnit) {
    const effect = OuterShadowLayerEffect.create();
    effect.colour = colour(opts.shadowColour);
    effect.radius = preset.shadow.radius * spreadUnit * opts.shadow;
    effect.offset = preset.shadow.offset * spreadUnit * opts.shadow;
    // Zero points right; the shadow of a window on a desktop falls downwards.
    effect.angle = 90;
    effect.opacity = Math.min(1, preset.shadow.opacity * opts.shadow);
    effect.intensity = 0;
    effect.scaleWithObject = false;
    effect.enabled = true;
    return effect;
}

// One group per rectangle. Adding the group with `andSelect` makes it the
// current selection, so the parts that follow land inside it and the shadow
// command — which takes the current selection when passed none — lands on it.
function createCommand(targets, preset, opts) {
    const compound = CompoundCommandBuilder.create();
    let drew = false;

    for (const target of targets) {
        const parts = windowParts(target, preset, opts);
        if (parts.length == 0)
            continue;
        drew = true;

        const group = AddChildNodesCommandBuilder.create();
        group.addNode(ContainerNodeDefinition.create(`Window — ${preset.label}`));
        compound.addCommand(group.createCommand(true));

        const contents = AddChildNodesCommandBuilder.create();
        for (const part of parts)
            contents.addNode(part);
        compound.addCommand(contents.createCommand(false));

        if (opts.shadow > 0)
            compound.addCommand(DocumentCommand.createSetOuterShadowLayerEffect(
                null, shadowEffect(preset, opts, opts.scale * target.scale), 0));
    }

    if (!drew)
        return null;
    const sources = targets.filter(t => t.node);
    if (opts.replace && sources.length > 0)
        compound.addCommand(DocumentCommand.createDeleteSelection(
            Selection.create(sources[0].node.document, sources.map(t => t.node), true), true));
    return compound.createCommand();
}

// ---------------------------------------------------------------- dialog

function isOk(result) {
    return (result?.value ?? result) == DialogResult.Ok.value;
}

// A default that looks right on the first run: 100% unless the rectangle is too
// small to carry full-size chrome, in which case the chrome shrinks to fit
// rather than swallowing the window.
function suggestedScale(targets, preset) {
    let scale = 1;
    for (const target of targets) {
        const w = target.box.width * target.scale;
        const h = target.box.height * target.scale;
        scale = Math.min(scale, h * 0.28 / preset.metrics.titleBar, w / 320);
    }
    return Math.max(Math.round(Math.min(scale, 1) * 1000) / 10, 1);
}

function buildDialog(doc, targets) {
    const dlg = Dialog.create('Window Creator');
    dlg.initialWidth = 460;
    const col = dlg.addColumn();

    const design = col.addGroup('Interface');
    dlg.preset = design.addComboBox('Style', PRESETS.map(p => p.label), 0);
    dlg.preset.isFullWidth = true;
    dlg.theme = design.addButtonSet('Theme', ['Light', 'Dark'], 0);
    dlg.scale = design.addUnitValueEditor('UI scale %', UnitType.Number, UnitType.Number,
        suggestedScale(targets, PRESETS[0]), 5, 2000).setShowPopupSlider().setPrecision(1);

    const parts = col.addGroup('Details');
    dlg.buttons = parts.addSwitch('Window buttons', true);
    dlg.title = parts.addSwitch('Title placeholder', false);

    const shadow = col.addGroup('Drop shadow');
    dlg.dropShadow = shadow.addSwitch('Drop shadow', true);
    dlg.shadowStrength = shadow.addUnitValueEditor('Shadow strength %', UnitType.Number, UnitType.Number,
        100, 0, 300).setShowPopupSlider().setPrecision(0);
    dlg.shadowColour = shadow.addColourPicker('Shadow colour', colour('#000000'));

    const output = col.addGroup('Output');
    dlg.replace = output.addSwitch('Replace the selected rectangles', true);
    dlg.status = output.addStaticText('', '');
    dlg.status.isFullWidth = true;

    return dlg;
}

function hexOf(pickerValue) {
    if (!pickerValue)
        return '#000000';
    const rgba = pickerValue.rgba8;
    const hh = (v) => Math.round(v).toString(16).padStart(2, '0');
    return '#' + hh(rgba.r) + hh(rgba.g) + hh(rgba.b) + hh(rgba.a ?? 255);
}

function readOptions(dlg) {
    return {
        preset: PRESETS[dlg.preset.selectedIndex],
        dark: dlg.theme.selectedIndex == 1,
        scale: Math.max(dlg.scale.value, 1) / 100,
        buttons: dlg.buttons.value,
        title: dlg.title.value,
        shadow: dlg.dropShadow.value ? dlg.shadowStrength.value / 100 : 0,
        shadowColour: hexOf(dlg.shadowColour.value),
        replace: dlg.replace.value
    };
}

// ---------------------------------------------------------------- entry point

// Any selected object with a real bounding box can stand in for the window
// frame; a plain rectangle is the obvious thing to draw, but a rounded one or a
// placed picture frame works the same way.
function readTargets(selection) {
    const targets = [];
    let skipped = 0;
    for (const node of selection.nodes) {
        const box = node.isPhysicalNode ? node.baseBox : null;
        if (!box || !(box.width > 0) || !(box.height > 0)) {
            ++skipped;
            continue;
        }
        const transform = node.baseToSpreadTransform;
        targets.push({ node, box, transform, scale: transformScale(transform) });
    }
    targets.skipped = skipped;
    return targets;
}

function main() {
    const doc = Document.current;
    if (!doc) {
        alert('This script requires an open document');
        return;
    }
    const targets = readTargets(doc.selection);
    if (targets.length == 0) {
        alert('Select at least one rectangle to turn into a window');
        return;
    }

    const dlg = buildDialog(doc, targets);
    let lastPreset = null;
    let suggested = suggestedScale(targets, PRESETS[0]);
    let busy = false;

    // Preview mode lets Affinity roll the windows back itself between edits, so
    // nothing has to be added and deleted by hand while the dialog is open.
    const update = (preview) => {
        if (busy)
            return true;
        busy = true;
        try {
            const opts = readOptions(dlg);
            // Switching style re-suggests a scale, because a 46pt GNOME header
            // bar needs a different one from a 22pt Aqua title bar. A scale the
            // user typed is left alone.
            if (lastPreset != opts.preset) {
                if (Math.abs(dlg.scale.value - suggested) < 0.05) {
                    suggested = suggestedScale(targets, opts.preset);
                    dlg.scale.value = suggested;
                    opts.scale = suggested / 100;
                }
                lastPreset = opts.preset;
            }

            const cmd = createCommand(targets, opts.preset, opts);
            dlg.status.text = `${targets.length} window${targets.length == 1 ? '' : 's'}`
                + ` · ${opts.preset.metrics.titleBar} pt title bar at ${Math.round(opts.scale * 100)}%`
                + (targets.skipped ? ` · ${targets.skipped} selected object(s) skipped` : '');
            if (cmd)
                doc.executeCommand(cmd, preview);
            else
                doc.clearPreviews();
            return cmd != null;
        } finally {
            busy = false;
        }
    };

    dlg.onControlValueChangedHandler = () => update(true);
    update(true);

    while (isOk(dlg.runModal())) {
        if (update(false))
            break;
        alert('Nothing would be drawn from the current selection');
    }
    doc.clearPreviews();
}

main();
