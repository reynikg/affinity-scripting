# Logo Grid

Draws the construction of a mark as real, editable curves on a new layer: its
anchor points, its Bezier handles, and the circles and lines its own geometry is
built from. The logo-presentation overlay, generated from the path data rather
than traced by hand.

Modelled on [GridIt](https://www.akrivi.studio/gridit) for Illustrator — this
covers its anchor/handle overlay and its construction grid. An independent
implementation inspired by what GridIt does: no GridIt code was used, and the
two are unconnected.

- **Library title:** `Logo Grid`
- **File to install:** [`logo_grid.js`](logo_grid.js)
- **Current version:** 3.0.0
- **Tested against:** Affinity 3.2 (April 2026)

## Version history

### 3.0.0 — 2026-09-16
Added the construction grid, and renamed from `Curve Mockup Overlay`.
- Fits circles to the artwork's arcs and lines to its straight edges, merging
  near-identical fits so a circle drawn as four Beziers comes back as one.
- Marks the circle centres.
- Tolerance, minimum feature length, minimum arc span and line extension are
  all adjustable, with the point and grid layers coloured separately.
- Anchor points can now be switched off, for a grid-only presentation.
- **Renamed.** The old `Curve Mockup Overlay` entry in the Scripts panel is now
  redundant; Affinity's MCP cannot delete scripts, so remove it by hand from
  **Window > General > Scripts**.

### 2.0.0 — 2026-09-16
Rewritten against the SDK's own `cropMarks.js` / `pathEffects.js` patterns.
- Fixed the argument order in `PolyCurveNodeDefinition.create` — 1.x passed
  `lineStyle` and `lineFill` the wrong way round, so no overlay was ever drawn.
- Preview now uses `executeCommand(cmd, true)` / `clearPreviews()` instead of
  adding and deleting nodes by hand, which is what made 1.x crash while a
  slider was being dragged. The reentrancy guard is gone with it.
- Shapes and text no longer get duplicated and converted: `curvesInterface`
  reads them directly, so the document is never touched to read a path.
- Closed paths keep their final segment; 1.x dropped it.
- Whole selection is processed, not just the first object.
- Native colour picker instead of a HEX text box; marker sizes default to a
  proportion of the artwork rather than a fixed pixel count.
- Added opaque point centres, and an option to trace the path outline.

### 1.x — inherited
Never worked; see above.

## Dependencies

### To run the script
Nothing to install. Affinity 3.2, a document open, and at least one vector or
text object selected. The SDK modules it requires:

| Module | Used for |
|---|---|
| `/document.js` | current document, selection, command execution, previews |
| `/commands.js` | `AddChildNodesCommandBuilder`, `CompoundCommandBuilder`, `DocumentCommand` |
| `/nodes.js` | `PolyCurveNodeDefinition`, `ContainerNodeDefinition` |
| `/geometry.js` | `Curve`, `PolyCurve`, `Rectangle`, `unionRects` |
| `/fills.js`, `/linestyle.js`, `/colours.js` | marker fills, strokes and colour |
| `/dialog.js`, `/units.js` | the options dialog |
| `affinity:common` | `BlendMode` |

It reads curves through `node.curvesInterface`, which exists on every
`VectorNode` (curves and shapes) and on `TextNode`. Anything else in the
selection is ignored.

### To install over MCP instead of pasting
`@modelcontextprotocol/sdk` and the Affinity AI connector, per the root README.

## Installing

### Option A — paste it
Copy [`logo_grid.js`](logo_grid.js), open **Window > General > Scripts**, add a
script titled `Logo Grid` and paste.

### Option B — install over MCP
```bash
node script_mgr.js add --title "Logo Grid" --description "Draws anchor points, Bezier handles and a derived construction grid over the selected artwork." --file scripts/logo-grid/logo_grid.js
```

## Sharing it

Send `logo_grid.js` on its own. The recipient needs Affinity 3.2 and nothing
else — no document setup, no named styles, no permissions. The one trap is the
selection: the script needs vector or text objects, and silently ignores pixel
layers, groups and images, so a selection made entirely of those gets
"Select one or more curves, shapes or text objects".

## Using it

Select the artwork and run the script. Everything previews live on the canvas
while the dialog is open; **OK** commits it into a `Logo Grid` layer and
**Cancel** leaves the document untouched. The result is ordinary curves.

### Style
| Control | What it does |
|---|---|
| Point colour | Anchors, handles and the traced outline. |
| Grid colour | Construction circles, lines and centre marks. |
| Point size | Diameter of the anchor markers, and the size of the centre crosses. |
| Point line width | Stroke weight for the anchor and handle markers. |

### Points and handles
| Control | What it does |
|---|---|
| Draw anchor points | Off leaves just the grid and handles. |
| Round smooth points, square corner points | Off draws every point as a square. |
| Opaque point centres | White-fills the markers so the artwork does not show through. |
| Draw handles | The handle lines and their end dots. |
| Handle dot size | Diameter of the solid dots at the handle ends. |

### Construction grid
| Control | What it does |
|---|---|
| Circles through the arcs | Every circle the artwork's curves sit on. |
| Lines along the straight edges | Every straight edge, extended into a full line. |
| Mark circle centres | A small cross at each circle's centre. |
| Grid line width | Stroke weight for the grid. Thinner than the points reads best. |
| Tolerance % | How close a segment must be to a true arc or a true line to count. Raise it to find more, lower it to find only exact geometry. |
| Ignore features shorter than | Drops short segments, which is the main defence against noise from a traced or hand-drawn path. |
| Minimum arc span | How much of a circle the artwork must actually cover before that circle is drawn. Raising this removes huge circles fitted to nearly-flat curves. |
| Extend lines beyond artwork % | How far past the bounding box the lines run. |

The status line under the options reports what was found: points, handles,
circles and lines. Watch it while moving Tolerance and Minimum arc span — it is
the quickest way to tell whether a setting is finding real geometry or noise.

### Options
| Control | What it does |
|---|---|
| Trace the path outline | A stroked copy of the path itself, for artwork with no outline of its own. |
| Keep current selection | Leaves the original artwork selected instead of the new layer. |

## How it works

### Reading the path
1.x duplicated the selection, converted the copy to curves, read it and deleted
it — a four-command round trip through the document just to look at a path.
That is unnecessary: `curvesInterface` is defined on `VectorNode`, so shapes
expose their curves without being converted, and on `TextNode`, so text does
too. The script clones `curvesInterface.polyCurve` and never writes to the
document to read it.

### Coordinate space
Curves are read in the node's base space and pushed through
`baseToSpreadTransform` into spread space. Markers are then built in spread
space, so a point on a shape scaled to 17% is the same size as one on a shape at
full size. Building them in base space would scale — and, under a non-uniform
transform, skew — every marker.

### Decomposing
`curve.beziers` yields segments, not points, so each anchor's incoming handle
comes from the previous segment's `c2` and its outgoing handle from the next
segment's `c1`. A closed path whose last segment returns to the start would
otherwise count that point twice; `decompose()` detects the wrap and folds it,
which is the `pathEffects.js` approach. A handle sitting on its own anchor is
retracted, and a point is smooth when both handles are live and opposed to
within about two degrees — Affinity exposes no per-point node type, so this is
geometric.

### Fitting the construction grid
Each segment is sampled at nine positions with `bez.evaluate(t)` and fitted with
a Kåsa algebraic circle fit — least squares on `x² + y² − 2ax − 2by + c`, which
is linear in the unknowns and so needs no iteration or starting guess. A fit is
kept when no sample deviates from it by more than the tolerance.

Two things make the output readable rather than a hairball:

- **Merging.** A circle drawn as four Beziers produces four near-identical fits.
  Fits whose centre and radius agree within the cluster tolerance are merged and
  then *refitted from their combined samples*, so the merged circle is more
  accurate than any of its members, not just the first one found.
- **Angular span.** A nearly-flat curve fits an enormous circle perfectly well,
  which is true and useless. Each merged circle is scored by how much of its
  circumference the evidence actually covers — a full turn minus the widest gap
  between sample angles, so two arcs on opposite sides of one circle still count
  as wide coverage — and thin evidence is dropped. This is also what keeps the
  radius bounded, without a separate maximum-size rule.

Straight edges are detected with a tolerance measured against *each segment's
own chord length* rather than against the artwork, so a short segment is not
called straight merely because it is short. Collinear edges are merged in normal
form (`nx·x + ny·y = d`, with a canonical sign so a segment and its reverse
agree), then clipped to the padded bounding box with a slab test.

Segments are read once, before the dialog opens; only the fitting is redone as
the sliders move.

### Preview
This is what made 1.x crash. It drew the overlay by adding nodes, then deleted
and re-added them on every control change; `executeCommand` pumps native events,
so dragging a slider re-entered the handler mid-rebuild and interleaved a delete
with an add. The guard in 1.x treated the symptom. Affinity already has the
right mechanism: `executeCommand(cmd, true)` runs a command as a preview that it
rolls back itself, and `clearPreviews()` drops it. The dialog handler just
rebuilds the command from scratch each time and hands it over — no bookkeeping,
nothing to re-enter, and Cancel is free because a preview was never committed.

### Output
A `ContainerNodeDefinition` layer is added and selected, then the marker nodes
are added with no insertion target so they land inside it. Parts are built back
to front: grid, outline, handle lines, handle dots, then points.
