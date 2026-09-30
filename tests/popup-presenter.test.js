const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildSummaryItems,
  stepActionLabel,
  stepCardClassName,
  buildActionFeedbackText
} = require("../src/lib/popup-presenter");

test("buildSummaryItems returns action counts", () => {
  const items = buildSummaryItems([
    { action: "click" },
    { action: "click" },
    { action: "input" },
    { action: "message" }
  ]);

  assert.deepEqual(items, [
    { label: "クリック", count: 2 },
    { label: "入力", count: 1 },
    { label: "メッセージ", count: 1 }
  ]);
});

test("stepActionLabel maps known action names", () => {
  assert.equal(stepActionLabel("navigate"), "遷移");
  assert.equal(stepActionLabel("screenshot"), "スクリーンショット");
  assert.equal(stepActionLabel("memo"), "メモ");
});

test("stepCardClassName maps action to style class", () => {
  assert.equal(stepCardClassName("click"), "step step-click");
  assert.equal(stepCardClassName("message"), "step step-message");
  assert.equal(stepCardClassName("unknown"), "step");
});

test("buildActionFeedbackText returns visible completion text", () => {
  assert.equal(buildActionFeedbackText("セッション目的を保存"), "セッション目的を保存しました");
  assert.equal(buildActionFeedbackText(""), "実行しました");
});
