# Window Chrome

Turns each selected rectangle into an empty desktop window — title bar, window
buttons, border and drop shadow — in the interface style you pick. Eight styles
across macOS, Windows and Linux, light or dark, drawn as ordinary shapes and
curves you can keep editing.

- **Library title:** `Window Chrome`
- **File to install:** [`window_chrome.js`](window_chrome.js)
- **Current version:** 1.1.0
- **Tested against:** Affinity 3.3 (Mid September 2026)

## Version history

### 1.1.0 — 2026-09-22
Rectangles only, and the rectangle's history no longer leaks into the window.
- **Only rectangles are accepted.** 1.0.0 took the bounding box of whatever was
  selected, so an ellipse or a logo was silently turned into a window. A live
  rectangle shape qualifies, rounded corners and all, and so does a curve that
  is geometrically a rectangle — four straight sides and four right angles —
  which is what an expanded or converted rectangle becomes. Everything else is
  left untouched and counted in the status line.
- **Only the rectangle's dimensions are used.** A rectangle that had been
  duplicated and stretched carried its transform into the window, so the title
  bar, buttons and corners were stretched with it. Nothing carries a transform
  now: the rectangle contributes its measured width, height and centre, and the
  chrome is drawn at the size it should be. A fresh 560×700 draw and a 560×280
  rectangle stretched 2.5× on Y now produce identical windows.
- **Rotation is no longer carried over**, which follows from the above. A
  rotated rectangle gives an upright window of the same width and height, at the
  same centre; rotate the finished group if you want it at an angle.

### 1.0.0 — 2026-09-17
First release.
- Eight interface styles: macOS (Big Sur–Sequoia), macOS (Yosemite–Catalina),
  Mac OS X Aqua, Windows XP Luna, Windows 7 Aero, Windows 11 Fluent, GNOME
  Adwaita and KDE Breeze.
- Light and dark palette for every style.
- Chrome is drawn at the interface's own measurements — a 28 pt macOS title bar,
  a 46 pt GNOME header bar — scaled by one **UI scale** control.
- Optional window buttons, title placeholder and drop shadow, with the shadow
  colour and strength adjustable.
- Live preview while the dialog is open; the original rectangle is replaced
  unless you say otherwise.
- Rotated and scaled rectangles produce rotated and scaled windows, with the
  chrome still the size you asked for. *(Withdrawn in 1.1.0.)*

## Dependencies

### To run the script
Nothing to install. Affinity 3.2 or later, a document open, and at least one rectangle
selected. The SDK modules it requires:

| Module | Used for |
|---|---|
| `/document.js` | current document, selection, command execution, previews |
| `/commands.js` | `AddChildNodesCommandBuilder`, `CompoundCommandBuilder`, `DocumentCommand` |
| `/nodes.js` | `ShapeNodeDefinition`, `PolyCurveNodeDefinition`, `ContainerNodeDefinition` |
| `/shapes.js` | `ShapeRectangle`, `ShapeCornerType` — live, editable corner radii |
| `/geometry.js` | `Curve`, `PolyCurve`, `Rectangle`, `Transform` |
| `/fills.js`, `/colours.js` | solid and gradient fills, `Gradient`, `Colour` |
| `/linestyle.js` | stroke weight, join, cap and alignment |
| `/layereffects.js` | `OuterShadowLayerEffect` |
| `/selections.js` | building the selection of originals to replace |
| `/dialog.js`, `/units.js` | the options dialog |
| `affinity:common` | `BlendMode` |

No filesystem, network or AI permission is needed.

### To install over MCP instead of pasting
`@modelcontextprotocol/sdk` and the Affinity AI connector, per the root README.

## Installing

### Option A — paste it
Copy [`window_chrome.js`](window_chrome.js), open **Window > General >
Scripts**, add a script titled `Window Chrome` and paste.

### Option B — install over MCP
```bash
node script_mgr.js add --title "Window Chrome" --description "Turns each selected rectangle into an empty OS window, in the chosen interface style." --file scripts/window-chrome/window_chrome.js
```

## Sharing it

Send `window_chrome.js` on its own. The recipient needs Affinity 3.2 or later and
nothing else — no document setup, no fonts, no styles, no permissions.

The one trap is the selection: it really does mean rectangles. A live rectangle
from the Rectangle tool works, rounded corners and all, and so does a rectangle
that has been converted or expanded to curves. An ellipse, a rounded curve whose
corners are no longer square, a group, a picture frame or a piece of artwork
does not, and is left exactly as it was — the status line says how many were
skipped. A selection with no rectangle in it gets *"Select at least one
rectangle. Only rectangles are used — other shapes, curves, groups and images
are left alone."*

## Using it

Draw a rectangle the size the window should be, select it, and run the script.
Everything previews live on the canvas while the dialog is open; **OK** commits
it, **Cancel** leaves the document untouched. Each rectangle becomes one layer
named after the style, holding the window's parts as separate editable objects.

The rectangle supplies its width, height and position and nothing else. Its
fill, stroke, corner radius and rotation are all ignored, and so is how it got
to its current size — a rectangle duplicated and stretched gives exactly the
same window as one drawn at that size from scratch. A rotated rectangle gives an
upright window; rotate the finished group afterwards if you want it at an
angle.

### Interface
| Control | What it does |
|---|---|
| Style | Which interface to draw. See the table below. |
| Theme | Light or dark palette for that interface. |
| UI scale % | Multiplies every chrome measurement. 100% means a macOS title bar really is 28 pt tall, which is right when the rectangle is the window's pixel size. |

| Style | What you get |
|---|---|
| macOS — Big Sur to Sequoia | 11 pt corners all round, flat 28 pt title bar, hairline separator, three flat traffic lights. |
| macOS — Yosemite to Catalina | 6 pt corners, 22 pt title bar with a subtle vertical gradient and a darker bottom edge. |
| Mac OS X — Aqua (Snow Leopard) | Rounded top, square bottom, brushed 22 pt title bar, glossy traffic-light gems with specular highlights. |
| Windows XP — Luna | 4 pt blue frame, rounded top, 29 pt Luna-blue gradient caption, three rounded caption buttons with a red close. |
| Windows 7 — Aero | 8 pt translucent glass frame, 30 pt caption, glass minimise/maximise and a wide red glossy close. |
| Windows 11 — Fluent | 8 pt corners all round, 32 pt Mica title bar, thin-stroke caption glyphs in 46 pt hit areas. |
| Linux — GNOME (Adwaita) | 12 pt corners, 46 pt header bar, one circular close button — GNOME's default. |
| Linux — KDE (Breeze) | Rounded top, 30 pt title bar, three stroked chevron/cross glyphs. |

### Details
| Control | What it does |
|---|---|
| Window buttons | Off leaves a completely bare title bar. |
| Title placeholder | A grey pill where the window title would sit, positioned and aligned the way that interface does it. Off by default. |

### Drop shadow
| Control | What it does |
|---|---|
| Drop shadow | The outer shadow on the window group. Off draws none. |
| Shadow strength % | Scales the style's own radius, offset and opacity together. Each style has its own starting point — Aqua's is tight and dark, GNOME's is wide and soft. |
| Shadow colour | Black suits a neutral background; a dark tint of the background colour usually looks better over a coloured one. |

### Output
| Control | What it does |
|---|---|
| Replace the selected rectangles | On, the source rectangles are deleted once the windows are drawn. Off keeps them underneath. |

The status line reports how many windows will be drawn, the style's title bar
height, the scale in force, and how many selected objects were skipped.

## How it works

### Measurements, not proportions
Window chrome is not proportional. A macOS title bar is 28 pt whether the window
is 400 pt wide or 2000; a traffic light is 12 pt across with 20 pt between
centres. The catalogue therefore stores each interface's real measurements at
100%, and a single **UI scale** multiplies them. Drawing chrome as a fraction of
the rectangle is what makes a mock-up look wrong, and it is the thing this
script deliberately does not do.

The default scale is 100% unless the rectangle is too small to carry full-size
chrome, in which case it drops so the title bar stays under about 28% of the
window's height and the buttons still fit across it. Changing style re-suggests
a scale — a 46 pt GNOME header bar needs a different one from a 22 pt Aqua title
bar — but a scale you have typed yourself is left alone.

### Measuring the rectangle, not inheriting it
1.0.0 built every part in the rectangle's own coordinate space and gave it the
rectangle's `baseToSpreadTransform`, which carried rotation and scale through
for free. It also carried *non-uniform* scale through, and that is not free: a
rectangle duplicated and stretched on one axis produced a window whose title
bar, buttons and corner radii were stretched with it. Compensating for a uniform
scale, as 1.0.0 did, cannot fix that — there is no single factor to divide by.

So nothing carries a transform now. The rectangle is measured instead:

- **A rectangle shape** is measured from its base box pushed through its
  transform one axis at a time. That gives the length of each edge rather than
  the box around them, so a rotated rectangle reports its real width and height.
- **A curve rectangle** is transformed into spread space and measured from its
  four corners directly.

Either way the result is a width, a height and a centre. Whichever edge lies
closer to horizontal becomes the width, so a rectangle turned on its side is a
tall window rather than a wide one drawn sideways. Every part is then built in
spread coordinates at full size, and the drop shadow — which applies in spread
space anyway — needs no compensation either.

### Deciding what is a rectangle
A live rectangle shape is identified by `shapeType`, so its corner radii do not
matter: a rounded rectangle from the Rectangle tool is still a rectangle.

Anything else has to be judged geometrically, because an expanded or converted
rectangle is just a curve. The test is four straight sides and four right
angles: control points lying on their chord within a fraction of the chord's own
length, and consecutive edges perpendicular to within about a degree. Four right
angles makes opposite sides equal by construction, so there is nothing else to
check. A closed path may or may not store the final edge back to its start, so
both spellings are folded to the same four corners before the test runs.

### Corner radii
Corners use `ShapeRectangle` with `useSingleRadius = false` and
`setAbsoluteSizes(true, w, h)`, so the radii are real units rather than a
percentage of the shape, and each corner is set independently. That is what lets
a title bar be rounded at the top and square where it meets the window body, and
it leaves the corner handles live in Affinity afterwards. A corner's type has to
be set to `Round` *before* its radius will stick — setting the radius alone is
silently ignored.

### Gradients
A gradient fill's geometry lives in the unit square: the first stop sits at
`(0, 0)` and the last at `(1, 0)`, and the fill descriptor's transform maps that
square into the node's space. A vertical ramp across a rectangle is therefore
the matrix that sends the u axis down the rectangle's height and the v axis
across its width. Luna's five-stop caption, Aero's glass and Aqua's gems are all
that one helper.

### Grouping, effects and replacement
Everything is one compound command, so a window is one undo step.

`AddChildNodesCommandBuilder.createCommand(true)` adds the group *and* selects
it, which does two jobs: the parts added by the next command land inside it,
because they are built with no insertion target, and the outer shadow command —
which takes the current selection when it is passed none — lands on the group
rather than on any single part. The shadow is applied to the group so it is cast
by the window's silhouette, not by each piece separately.

Replacement is the last command in the compound, deleting an explicit selection
of the original rectangles built before anything else was added.

### Preview
The dialog rebuilds the whole command on every control change and hands it to
`executeCommand(cmd, true)`, which Affinity rolls back itself; `clearPreviews()`
drops it. Nothing is added and deleted by hand, so Cancel costs nothing and
there is no bookkeeping to get out of step. Re-suggesting the UI scale writes to
a control from inside the control-changed handler, so that one path is guarded
against re-entering.

### What it does not do
- **No text.** The title placeholder is a pill, not a string. Real titles need a
  font choice, and a wrong one is worse than an obvious placeholder.
- **Windows XP and Aqua had no dark mode.** Their dark palettes are an
  interpretation, kept for consistency rather than accuracy.
- **GNOME gets one button.** A plain libadwaita window shows close and nothing
  else; the other two only appear when an app asks for them.
- **No rotated windows.** Dropped in 2.0.0 along with the rest of the source
  rectangle's transform. Rotating the finished group does the same job and keeps
  the chrome honest.
