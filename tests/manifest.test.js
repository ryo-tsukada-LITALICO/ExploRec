const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("required extension files exist", () => {
  const required = [
    "manifest.json",
    "background.js",
    "content.js",
    "inject_main.js",
    "popup.html",
    "popup.js"
  ];
  for (const file of required) {
    assert.equal(fs.existsSync(path.join(root, file)), true, `${file} is missing`);
  }
});

test("manifest has MV3, required permissions, commands, and content script worlds", () => {
  const manifestPath = path.join(root, "manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, "background.js");
  assert.equal(manifest.side_panel.default_path, "popup.html");
  assert.equal(manifest.action.default_popup, undefined);

  assert.deepEqual(
    manifest.permissions.slice().sort(),
    ["downloads", "scripting", "sidePanel", "storage", "tabs"].sort()
  );
  assert.equal(manifest.host_permissions.includes("<all_urls>"), true);

  assert.equal(manifest.commands["toggle-recording"].suggested_key.default, "Ctrl+Shift+E");
  assert.equal(manifest.commands["take-screenshot"].suggested_key.default, "Ctrl+Shift+Y");

  const worlds = manifest.content_scripts.map((script) => script.world).sort();
  assert.deepEqual(worlds, ["ISOLATED", "MAIN"].sort());
});
