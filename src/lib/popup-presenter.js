"use strict";

(function initPopupPresenter(globalObject) {
  const ACTION_LABELS = {
    click: "クリック",
    input: "入力",
    message: "メッセージ",
    navigate: "遷移",
    screenshot: "スクリーンショット",
    memo: "メモ"
  };

  const ACTION_CLASS_NAMES = {
    click: "step step-click",
    input: "step step-input",
    message: "step step-message",
    navigate: "step step-navigate",
    screenshot: "step step-screenshot",
    memo: "step step-memo"
  };

  function stepActionLabel(action) {
    return ACTION_LABELS[action] || action || "不明";
  }

  function stepCardClassName(action) {
    return ACTION_CLASS_NAMES[action] || "step";
  }

  function buildSummaryItems(steps) {
    const counts = new Map();
    for (const step of steps) {
      const label = stepActionLabel(step.action);
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
  }

  function buildActionFeedbackText(label) {
    const normalized = typeof label === "string" ? label.trim() : "";
    return normalized ? `${normalized}しました` : "実行しました";
  }

  const api = {
    buildActionFeedbackText,
    buildSummaryItems,
    stepActionLabel,
    stepCardClassName
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (globalObject) {
    globalObject.PopupPresenter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this);
