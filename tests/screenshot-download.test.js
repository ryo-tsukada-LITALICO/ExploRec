const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildScreenshotDownloadOptions,
  downloadScreenshotImage
} = require("../src/lib/screenshot-download");

test("buildScreenshotDownloadOptions returns download payload with deterministic filename", () => {
  const options = buildScreenshotDownloadOptions({
    dataUrl: "data:image/png;base64,aaa",
    now: "2026-06-05T07:30:45.123Z"
  });

  assert.deepEqual(options, {
    url: "data:image/png;base64,aaa",
    filename: "ExploRec_20260605_073045.png",
    saveAs: false,
    conflictAction: "uniquify"
  });
});

test("buildScreenshotDownloadOptions uses memo text for filename when present", () => {
  const options = buildScreenshotDownloadOptions({
    dataUrl: "data:image/png;base64,xyz",
    note: "ログイン: 異常系/再現?*",
    now: "2026-06-05T07:30:45.123Z"
  });

  assert.equal(options.filename, "ExploRec_ログイン_異常系_再現.png");
});

test("downloadScreenshotImage delegates to downloads API", async () => {
  const calls = [];
  const downloadsApi = {
    async download(options) {
      calls.push(options);
      return 10;
    }
  };
  const options = buildScreenshotDownloadOptions({
    dataUrl: "data:image/png;base64,bbb",
    now: "2026-06-05T07:30:45.123Z"
  });

  const downloadId = await downloadScreenshotImage(downloadsApi, options);

  assert.equal(downloadId, 10);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], options);
});

test("downloadScreenshotImage throws when API is unavailable", async () => {
  await assert.rejects(
    () => downloadScreenshotImage(null, { url: "data:image/png;base64,ccc" }),
    /downloads API/
  );
});
