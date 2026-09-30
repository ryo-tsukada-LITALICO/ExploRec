const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createInitialState,
  startRecordingState,
  appendStep,
  getLastUrlByTab,
  clearRecordingData,
  updateSessionContext,
  pauseRecordingState,
  resumeRecordingState
} = require("../src/lib/state");

test("startRecordingState keeps startUrl fixed after start", () => {
  const initial = createInitialState();
  const started = startRecordingState(initial, "https://example.com/a", "2026-01-01T00:00:00.000Z");
  const restarted = startRecordingState(started, "https://example.com/b", "2026-01-01T00:00:10.000Z");

  assert.equal(started.recording, true);
  assert.equal(started.startUrl, "https://example.com/a");
  assert.equal(restarted.startUrl, "https://example.com/a");
});

test("appendStep increments step and keeps per-tab last navigate url", () => {
  const initial = startRecordingState(createInitialState(), "https://example.com", "2026-01-01T00:00:00.000Z");

  const s1 = appendStep(initial, {
    action: "click",
    description: "『ログイン』ボタンをクリック",
    tabId: 2,
    target: { tag: "button", type: "", selector: "#login" },
    timestamp: "2026-01-01T00:00:01.000Z"
  });
  const s2 = appendStep(s1, {
    action: "navigate",
    description: "ページ遷移: https://example.com/home",
    url: "https://example.com/home",
    tabId: 2,
    target: { tag: "body", type: "", selector: "body" },
    timestamp: "2026-01-01T00:00:02.000Z"
  });

  assert.equal(s2.steps.length, 2);
  assert.equal(s2.steps[0].step, 1);
  assert.equal(s2.steps[1].step, 2);
  assert.equal(getLastUrlByTab(s2, 2), "https://example.com/home");
});

test("clearRecordingData clears session fields and steps", () => {
  const started = startRecordingState(createInitialState(), "https://example.com", "2026-01-01T00:00:00.000Z");
  const appended = appendStep(started, {
    action: "message",
    description: "『エラー』と表示された",
    text: "エラー",
    target: { tag: "div", type: "", selector: ".error" },
    timestamp: "2026-01-01T00:00:01.000Z"
  });

  const cleared = clearRecordingData(appended);
  assert.equal(cleared.recording, false);
  assert.equal(cleared.startedAt, null);
  assert.equal(cleared.startUrl, null);
  assert.equal(cleared.steps.length, 0);
});

test("appendStep keeps screenshot note field", () => {
  const started = startRecordingState(createInitialState(), "https://example.com", "2026-01-01T00:00:00.000Z");
  const appended = appendStep(started, {
    action: "screenshot",
    description: "スクリーンショットを取得（メモ: 失敗直前）",
    note: "失敗直前",
    screenshot: "data:image/png;base64,aaa",
    target: { tag: "window", type: "", selector: "window" },
    timestamp: "2026-01-01T00:00:01.000Z"
  });

  assert.equal(appended.steps[0].note, "失敗直前");
});

test("createInitialState has exploratory session fields", () => {
  const initial = createInitialState();
  assert.equal(initial.testPurpose, "");
  assert.equal(initial.sessionFocus, "");
});

test("updateSessionContext updates purpose and focus", () => {
  const initial = createInitialState();
  const updated = updateSessionContext(initial, {
    testPurpose: "決済フローの探索",
    sessionFocus: "エラー表示と入力制約を重点確認"
  });

  assert.equal(updated.testPurpose, "決済フローの探索");
  assert.equal(updated.sessionFocus, "エラー表示と入力制約を重点確認");
});

test("pauseRecordingState sets pausedAt timestamp while keeping recording true", () => {
  const started = startRecordingState(createInitialState(), "https://example.com", "2026-01-01T00:00:00.000Z");
  assert.equal(started.recording, true);
  assert.equal(started.pausedAt, null);

  const paused = pauseRecordingState(started, "2026-01-01T00:00:10.000Z");
  assert.equal(paused.recording, true);
  assert.equal(paused.pausedAt, "2026-01-01T00:00:10.000Z");
  assert.equal(paused.startUrl, "https://example.com");
  assert.equal(paused.steps.length, 0);
});

test("resumeRecordingState clears pausedAt and resumes recording", () => {
  const started = startRecordingState(createInitialState(), "https://example.com", "2026-01-01T00:00:00.000Z");
  const paused = pauseRecordingState(started, "2026-01-01T00:00:10.000Z");
  assert.equal(paused.pausedAt, "2026-01-01T00:00:10.000Z");

  const resumed = resumeRecordingState(paused);
  assert.equal(resumed.recording, true);
  assert.equal(resumed.pausedAt, null);
  assert.equal(resumed.startUrl, "https://example.com");
});

test("clearRecordingData also clears pausedAt field", () => {
  const started = startRecordingState(createInitialState(), "https://example.com", "2026-01-01T00:00:00.000Z");
  const paused = pauseRecordingState(started, "2026-01-01T00:00:10.000Z");

  const cleared = clearRecordingData(paused);
  assert.equal(cleared.recording, false);
  assert.equal(cleared.pausedAt, null);
  assert.equal(cleared.startedAt, null);
  assert.equal(cleared.startUrl, null);
  assert.equal(cleared.steps.length, 0);
});

test("createInitialState includes pausedAt field set to null", () => {
  const initial = createInitialState();
  assert.equal(initial.pausedAt, null);
});
