# Hello World

The two-line script that proves the Scripts panel works. Useful as a first thing
to install when checking a setup, and as the smallest possible example of what
an Affinity script looks like.

- **Library title:** `Hello World`
- **File to install:** [`helloworldexample.js`](helloworldexample.js)
- **Current version:** 1.0.0
- **Tested against:** Affinity 3.2 (April 2026)

> Inherited from the upstream repo, kept as-is.

---

## Version history

### 1.0.0 — inherited

As received from [rabidgremlin/affinity-scripting](https://github.com/rabidgremlin/affinity-scripting).
Moved into `scripts/` in this fork; otherwise unchanged.

---

## Dependencies

**None beyond Affinity.** One built-in module:

| Module | Used for |
|---|---|
| `/application.js` | `app.alert` |

No document needs to be open. No settings need enabling.

To install it over MCP rather than pasting, you need `@modelcontextprotocol/sdk`
(`npm install` at the repo root) and the Affinity AI connector enabled.

---

## Installing

### Option A — paste it

Copy [`helloworldexample.js`](helloworldexample.js) into a new script in
**Window > General > Scripts**.

### Option B — install over MCP

```bash
node script_mgr.js add --title "Hello World" --description "Says Hello World" --file scripts/hello-world/helloworldexample.js
```

---

## Sharing it

Send the file, or just the two lines. There is nothing else to it.

---

## Using it

Run it from the Scripts panel. An alert saying `Hello, World!` appears.

---

## How it works

```js
const { app } = require('/application');
app.alert('Hello, World!');
```

`require('/application')` reaches Affinity's built-in SDK — the leading slash is
what marks it as an SDK module rather than a file. `app.alert` shows a modal.

That is the whole shape of an Affinity script: require what you need from the
SDK, then call it. Scripts run top to bottom and must be directly executable —
no `module.exports.main = main` wrapper, even though some of the SDK's own
examples use one.
