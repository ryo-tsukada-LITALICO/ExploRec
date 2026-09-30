const test = require("node:test");
const assert = require("node:assert/strict");

const { createSidePanelConfig } = require("../src/lib/sidepanel");

test("createSidePanelConfig opens the same UI on action click", () => {
  const config = createSidePanelConfig();

  assert.deepEqual(config, {
    openPanelOnActionClick: true
  });
});
