# Markdown Import to Text Frame

Imports a Markdown file into the selected text frame, mapping Markdown elements
onto Affinity's text styles.

- **Library title:** `Markdown import to selected text frame`
- **File to install:** [`markdown_import_to_text_frame.js`](markdown_import_to_text_frame.js)
- **Current version:** 1.0.0
- **Tested against:** Affinity 3.2 (April 2026)

> Inherited from the upstream repo — written by rabidgremlin via Codex, not by
> this fork. It is kept here as-is.

---

## Version history

### 1.0.0 — inherited

As received from [rabidgremlin/affinity-scripting](https://github.com/rabidgremlin/affinity-scripting).
No changes have been made in this fork beyond moving it into `scripts/`.

Upstream did not version it, so there is no history before this point.

---

## Dependencies

### To run the script

Affinity's own modules only — no bundling, no build step. The file is plain
source and is installed exactly as it sits here.

| Module | Used for |
|---|---|
| `/application.js` | alerts, the Desktop path |
| `/fs.js` | reading the Markdown file |
| `/document.js` | the current document |
| `/selections.js` | the selected frame, text ranges |
| `/commands.js` | applying the text as a command |
| `/storydelta.js` | building the text edit |
| `/paragraphatts.js`, `/glyphatts.js` | applying paragraph and character styles |
| `affinity:story` | `StoryRange` |

It also needs, in the document itself:

- **A frame text object, selected.** Exactly one, and it must be a frame text
  node — not art text.
- **Text styles by name.** It looks for `Heading 1`…`Heading N`, `Body`,
  `Quote`, `Bullet 1`, `Numbered 1`, `Strong`, `Emphasis`, `Strong Emphasis`,
  falling back down the list when one is missing. A document without these
  styles imports as plain text.

And from Affinity's settings:

- **Filesystem access for scripts**, or the Markdown file must be on your
  **Desktop** — scripts can only reach Desktop files otherwise. The script says
  so if it hits `PERMISSION_DENIED`.

### To install over MCP instead of pasting

| Dependency | Why |
|---|---|
| `@modelcontextprotocol/sdk` | `npm install` at the repo root |
| The Affinity AI connector, enabled | `script_mgr.js` talks to it on `localhost:6767` |

---

## Installing

### Option A — paste it

Copy [`markdown_import_to_text_frame.js`](markdown_import_to_text_frame.js) into
a new script in **Window > General > Scripts**.

### Option B — install over MCP

```bash
node script_mgr.js add --title "Markdown import to selected text frame" --description "Imports a Markdown file into the selected text frame" --file scripts/markdown-import/markdown_import_to_text_frame.js
```

---

## Sharing it

Send the single `.js` file. The recipient pastes it into their Scripts panel.
Tell them about the two requirements that are easy to miss: the document needs
the named text styles, and the Markdown file needs to be on the Desktop unless
they have enabled filesystem access for scripts.

---

## Using it

1. Select a single frame text object in Affinity.
2. Run the script from the Scripts panel.
3. Pick a Markdown file when prompted.

The frame's contents are replaced with the styled Markdown.

---

## How it works

The script parses the Markdown itself — there is no library — into blocks
(headings, body paragraphs, bullets, numbered items, quotes) and inline runs
(strong, emphasis, both).

Each block picks a paragraph style from an ordered list of candidates, so
`Heading 4` falls back to `Heading 2` and then to `Body` if the document does not
define it. Inline runs pick character styles the same way.

The result is applied through a `StoryDelta` on the frame's story, as one
document command — so it is a single undo step.
