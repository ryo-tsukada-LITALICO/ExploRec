const test = require("node:test");
const assert = require("node:assert/strict");

const {
  MESSAGE_DEDUPE_WINDOW_MS,
  shouldRecordMessage,
  makeStepPayload,
  shouldRecordNavigate,
  buildScreenshotDescription
} = require("../src/lib/recording");

test("shouldRecordMessage deduplicates by text+url within 1500ms", () => {
  const cache = new Map();
  const now = 1000;
  assert.equal(shouldRecordMessage(cache, "失敗しました", "https://a.test", now), true);
  assert.equal(shouldRecordMessage(cache, "失敗しました", "https://a.test", now + MESSAGE_DEDUPE_WINDOW_MS - 1), false);
  assert.equal(shouldRecordMessage(cache, "失敗しました", "https://b.test", now + 10), true);
  assert.equal(shouldRecordMessage(cache, "失敗しました", "https://a.test", now + MESSAGE_DEDUPE_WINDOW_MS + 1), true);
});

test("shouldRecordNavigate suppresses same url", () => {
  assert.equal(shouldRecordNavigate("https://a.test", "https://a.test"), false);
  assert.equal(shouldRecordNavigate("https://a.test", "https://b.test"), true);
});

test("makeStepPayload fills action-specific fields", () => {
  const base = {
    description: "ページ遷移: https://a.test",
    target: { tag: "body", type: "", selector: "body" },
    tabId: 10,
    timestamp: "2026-01-01T00:00:00.000Z"
  };

  const nav = makeStepPayload("navigate", { ...base, url: "https://a.test" });
  const input = makeStepPayload("input", { ...base, value: "abc", description: "入力" });
  const message = makeStepPayload("message", { ...base, text: "失敗", description: "表示" });
  const screenshot = makeStepPayload("screenshot", {
    ...base,
    screenshot: "data:image/png;base64,aaa",
    note: "ログイン画面",
    description: "スクリーンショットを取得"
  });
  const memo = makeStepPayload("memo", { ...base, note: "再現手順の補足", description: "メモを追加" });

  assert.equal(nav.url, "https://a.test");
  assert.equal(input.value, "abc");
  assert.equal(message.text, "失敗");
  assert.equal(screenshot.screenshot.startsWith("data:image/png;base64,"), true);
  assert.equal(screenshot.note, "ログイン画面");
  assert.equal(memo.note, "再現手順の補足");
});

test("buildScreenshotDescription appends memo when provided", () => {
  assert.equal(buildScreenshotDescription(""), "スクリーンショットを取得");
  assert.equal(buildScreenshotDescription("  "), "スクリーンショットを取得");
  assert.equal(
    buildScreenshotDescription("ログイン失敗時の画面"),
    "スクリーンショットを取得（メモ: ログイン失敗時の画面）"
  );
});
