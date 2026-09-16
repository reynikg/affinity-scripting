# Affinity Scripting

Scripts for [Affinity by Canva](https://www.affinity.studio/) that create
interesting visuals, plus the tooling used to build them.

This is a private fork of
[rabidgremlin/affinity-scripting](https://github.com/rabidgremlin/affinity-scripting).
The LookSee findings and the four tools at the repo root come from there; the
scripts under `scripts/` are the work this fork is for.

Everything here targets the **April 2026 (3.2)** release of Affinity.

---

## The scripts

| Script | What it does | Install |
|---|---|---|
| [**Logo Grid**](scripts/logo-grid/) | Anchor points, Bezier handles and a derived construction grid over the selected artwork, as editable curves | [`logo_grid.js`](scripts/logo-grid/logo_grid.js) |
| [**Pattern Generator**](scripts/pattern-generator/) | Eleven generative patterns as native editable curves, at a chosen aspect ratio | [`pattern_generator.js`](scripts/pattern-generator/pattern_generator.js) |
| [**Window Creator**](scripts/window-creator/) | Turns the selected rectangles into empty macOS, Windows or Linux windows, as editable shapes | [`window_creator.js`](scripts/window-creator/window_creator.js) |
| [**Markdown Import to Text Frame**](scripts/markdown-import/) | Imports a Markdown file into the selected text frame, mapped onto text styles | [`markdown_import_to_text_frame.js`](scripts/markdown-import/markdown_import_to_text_frame.js) |
| [**Hello World**](scripts/hello-world/) | The smallest possible script; useful for checking a setup | [`helloworldexample.js`](scripts/hello-world/helloworldexample.js) |

Each folder has its own README covering version history, dependencies,
installing, sharing, and how the script works. **Read that one, not this one,
if you just want to use a script.**

---

## Running a script — the short version

Every script in this repo installs the same way, and none of them needs this
repo checked out, Node.js, or anything installed.

1. Open the script's `.js` file and copy all of it.
2. In Affinity, open **Window > General > Scripts**.
3. Add a new script, paste, and give it the title listed in its README.
4. Open a document and click the script to run it.

That is the whole thing. The rest of this file is about *developing* scripts.

> **Why paste?** Affinity's Scripts panel can run scripts but cannot show, edit
> or create their code. `script_mgr.js` below installs them over the MCP
> connector instead, which is quicker once you have the connector set up.

---

## How this repo is organised

```
scripts/<script-name>/        one folder per script, named after the script
  README.md                   version history, dependencies, install, share, how it works
  <script>.js                 the file you paste or install
  src/, build.js              only if the script is built rather than written directly

extract_docs.js               repo tooling, see Tools below
script_mgr.js
search_sdk.js
run_script.js
docs/                         extracted SDK docs (git-ignored)
```

### The rules

- **One folder per script**, under `scripts/`, named in kebab-case after the
  script — `pattern-generator`, not `PatternGenerator` or `pattern_generator`.
- **Every script folder has a `README.md`** with the five sections below. If
  someone clones this repo, that file is the only thing they should need.
- **The installable `.js` lives in the folder** and is committed, even when it
  is generated. Nobody should have to run a build to use a script.
- **Generated files say so** in a header comment naming the command that
  rebuilds them, and their sources live in `src/` beside them.
- **Tools stay at the repo root.** `extract_docs.js`, `script_mgr.js`,
  `search_sdk.js` and `run_script.js` are development tooling, not Affinity
  scripts, and upstream's docs and commands refer to them by those paths.

### The README template

Copy this into `scripts/<new-script>/README.md` when starting a script.

````markdown
# <Script Name>

<One or two sentences: what it does and what you get.>

- **Library title:** `<exact title used in the Scripts panel>`
- **File to install:** [`<file>.js`](<file>.js)
- **Current version:** 1.0.0
- **Tested against:** Affinity 3.2 (April 2026)

## Version history

### 1.0.0 — YYYY-MM-DD
First release.
- <what it does, as bullets>

## Dependencies

<Lead with whether it needs anything to RUN — usually it does not.>

### To run the script
<Table of the Affinity SDK modules it requires and what each is for.
 Then anything else it assumes: a document open, a selection, named styles,
 filesystem or AI permission enabled in Affinity's settings.>

### To rebuild it
<Only if generated: Node.js, esbuild, any sibling project. Omit otherwise.>

### To install over MCP instead of pasting
<`@modelcontextprotocol/sdk` and the Affinity connector.>

## Installing
### Option A — paste it
### Option B — install over MCP
<The exact `script_mgr.js add` command, with the real title and path.>

## Sharing it

<Which file(s) to send, what the recipient needs, and any trap that is easy to
 miss — a required document setup, a permission, a style that must exist.>

## Using it

<What to select or open first, then what the controls do and what you get.>

## How it works

<The design, not a line-by-line reading. Why it is built this way, what the
 pipeline is, and anything surprising a future reader would otherwise trip on.>
````

### Versioning

Plain semver, tracked in the script's own README, not in git tags:

- **patch** — a fix, no change to what the controls do
- **minor** — new patterns, parameters or options; old settings still work
- **major** — output or controls change in a way that breaks existing use

Date each entry. A script inherited from upstream starts at `1.0.0 — inherited`,
because there is no history before this fork.

### Adding a new script

1. `mkdir scripts/<script-name>` and copy the README template into it.
2. Write the script. `run_script.js` runs it in Affinity without installing it,
   which is far quicker than reinstalling on every change — but a script under
   test must not open a dialog, because `runModal()` blocks with nothing there
   to dismiss it.
3. Read the SDK docs as you go: `node extract_docs.js` writes all 142 topics
   into `docs/`, including the SDK's own example scripts under `docs/examples/`.
4. Fill in the README's five sections. The **Dependencies** one matters most —
   it is what tells a future reader whether they can just paste the file.
5. Install it with `script_mgr.js add` and check it from the Scripts panel.

If a script needs a build step, put its sources in `src/` beside a `build.js`,
commit the built file, and give it a header comment naming the rebuild command.
`scripts/pattern-generator/` is the worked example.

---

## Findings
- The MCP server has access to a bunch of documentation that an AI agent can use as reference for creating scripts etc. The `extract_docs.js` script below can extract all these docs and save them locally so you can take a look at them. This includes some example affinity scripts.
- Affinity has a scripts panel (Window > General > Scripts) which lets you see and run scripts created by the AI. However you cannot see the actual script's code, edit it or create your own scripts in the UI. The `script_mgr.js` script below can be used to manage scripts in the library (add, list, save to disk). 
- The documentation tells the AI agent to use `search_sdk_skills` to search for solutions before creating its own. This doesn't actually exist in the list of MCP tools but there is a `search_sdk_hints` tool. The `search_sdk.js` script below can be used to call this tool, just pass it a search query. In my testing the returned results are not that accurate but they will no doubt get better over time, because the description for that tool says _Search a global pool of SDK hints from millions of other MCP sessions. Use it to check for existing solutions to problems you are facing._
- There is a `add_sdk_hint` tool in the MCP which I'm guessing goes hand in hand with `search_sdk_hints` but it's documentation seems to indicate that actually updates the `preamble` doc. 


## Prerequisites

**To use a script:** Affinity 3.2. Nothing else — see *Running a script* above.

**To use the tooling in this repo, or to build a script:**

- The Affinity AI connector enabled:
  https://www.affinity.studio/help/ai-connector-setup/#configure-affinity
  (you do **not** need to set up Claude or the Claude connector)
- Node.js installed
- `npm install` at the repo root — this pulls in `@modelcontextprotocol/sdk`
  for the tools, and `esbuild` for building bundled scripts
- The MCP server reachable at `http://localhost:6767/sse`

## MCP Inspector
To look at the Affinity MCP server and see what it can do, you can use the MCP Inspector tool:

```bash
npx @modelcontextprotocol/inspector --sse http://localhost:6767/sse
```

## Tools

Development tooling, at the repo root. None of it is needed to *use* a script.

### `extract_docs.js`

Downloads all SDK documentation topics from MCP and saves them under `docs/`, preserving any nested paths returned by the server.

The server refuses every topic until `preamble` has been read in that session, so the extractor requests it first — otherwise everything sorting before `preamble` comes back as an error stub.

Run:

```bash
node extract_docs.js
```

### `search_sdk.js`

Searches SDK hints using MCP and prints the response to the console.

Run:

```bash
node search_sdk.js "blend mode"
```

### `script_mgr.js`

Manages scripts in the Affinity script library.

Commands:

```bash
node script_mgr.js list
node script_mgr.js add --title "Hello World" --description "Says Hello World" --file scripts/hello-world/helloworldexample.js
node script_mgr.js save --title "Hello World"
node script_mgr.js save --title "Hello World" --out exports/hello-world.js
```

- `list`: lists installed library scripts
- `add`: adds a script from a local file
- `save`: reads a library script and saves it to disk

**NOTE**: You cannot delete a script via the MCP so you will need to delete them in Affinity in the scripts panel.

### `run_script.js`

Runs JavaScript inside Affinity without installing it to the library, and can render the spread afterwards. This is the fast loop while developing a script.

```bash
node run_script.js --code "console.log(require('/document.js').Document.current.title)"
node run_script.js --file scripts/pattern-generator/smoke_test.js
node run_script.js --file draft.js --render out/preview.jpg
```

A script run this way must not open a dialog — `runModal()` blocks until it is dismissed, and nothing is there to dismiss it.

## Using Codex with the Affinity MCP
You need to register the Affinity MCP server with Codex. It does have issues accessing the MCP server over SSE so you need to proxy it via stdio.

```bash
codex mcp add affinity -- uvx mcp-proxy --transport sse http://localhost:6767/sse
```

You will need python and `uv` installed for this to work

## Notes
- The tooling at the repo root and the two inherited scripts came from upstream,
  thrown together with Codex while tinkering, so don't expect masterful coding
  there. The scripts under `scripts/` are held to the conventions above.
- Don't use this code or the MCP to do dumb and/or illegal things!