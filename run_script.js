// Run JavaScript inside Affinity via the MCP server, and optionally render the
// result. Handy while developing: `script_mgr.js add` installs a script, but
// this runs one straight away without touching the library.
//
//   node run_script.js --file some_script.js
//   node run_script.js --code "console.log(require('/document.js').Document.current.title)"
//   node run_script.js --file draft.js --render out/preview.jpg
//
// The dialog in a finished script blocks until dismissed, so scripts run this
// way should not open one.

const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");
const { CallToolResultSchema } = require("@modelcontextprotocol/sdk/types.js");
const fs = require("node:fs");
const path = require("node:path");

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};

function textOf(result) {
  return (result.content || [])
    .filter((c) => c?.type === "text" && typeof c.text === "string")
    .map((c) => c.text)
    .join("\n");
}

async function main() {
  const file = flag("--file");
  const code = file ? fs.readFileSync(file, "utf8") : flag("--code");
  if (!code) {
    console.error("Usage: node run_script.js (--file <path> | --code <js>) [--render <out.jpg>]");
    process.exit(1);
  }

  const client = new Client({ name: "affinity-script-runner", version: "1.0.0" });
  const transport = new SSEClientTransport(new URL("http://localhost:6767/sse"));
  const call = (name, args) =>
    client.request({ method: "tools/call", params: { name, arguments: args } }, CallToolResultSchema);

  try {
    await client.connect(transport);
    // The server refuses every other tool until the preamble has been read.
    await call("read_sdk_documentation_topic", { filename: "preamble" });

    const result = await call("execute_script", { script: code });
    const output = textOf(result);
    console.log(output || "(no output)");
    if (result.isError) process.exitCode = 1;

    const render = flag("--render");
    if (render) {
      // render_spread identifies the document by session UUID, so ask Affinity
      // which document is current rather than guessing.
      const uuidResult = await call("execute_script", {
        script: "console.log(require('/document.js').Document.current?.sessionUuid ?? '');",
      });
      const uuid = textOf(uuidResult).trim();
      if (!uuid) throw new Error("No document is open to render.");
      const shot = await call("render_spread", {
        document_session_uuid: uuid,
        spread_index: Number(flag("--spread") ?? 0),
      });
      const image = (shot.content || []).find((c) => c?.type === "image");
      if (!image) {
        console.error("render_spread returned no image");
        process.exitCode = 1;
      } else {
        fs.mkdirSync(path.dirname(path.resolve(render)), { recursive: true });
        fs.writeFileSync(render, Buffer.from(image.data, "base64"));
        console.log(`Rendered spread to ${render}`);
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    try { await transport.close(); } catch (_) { /* keep the real error */ }
  }
}

main();
