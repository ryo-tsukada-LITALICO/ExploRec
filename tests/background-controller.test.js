const test = require("node:test");
const assert = require("node:assert/strict");

const {
  reduceMessage
} = require("../src/lib/background-controller");

test("reduceMessage toggles recording and keeps startUrl fixed", () => {
  const now = "2026-01-01T00:00:00.000Z";
  const initial = { recording: false, startedAt: null, startUrl: null, steps: [] };

  const started = reduceMessage(initial, { type: "etr:toggle-recording", startUrl: "https://a.test", nowIso: now });
  const stopped = reduceMessage(started.state, { type: "etr:toggle-recording", startUrl: "https://b.test", nowIso: "2026-01-01T00:00:05.000Z" });
  const startedAgain = reduceMessage(stopped.state, { type: "etr:toggle-recording", startUrl: "https://b.test", nowIso: "2026-01-01T00:00:10.000Z" });

  assert.equal(started.state.recording, true);
  assert.equal(stopped.state.recording, false);
  assert.equal(startedAgain.state.startUrl, "https://b.test");
});

test("reduceMessage appends events only while recording", () => {
  const initial = { recording: false, startedAt: null, startUrl: null, steps: [] };

  const skipped = reduceMessage(initial, {
    type: "etr:add-event",
    event: { action: "click", description: "クリック", target: { tag: "button", type: "", selector: "#ok" } }
  });
  assert.equal(skipped.state.steps.length, 0);

  const started = reduceMessage(initial, { type: "etr:start-recording", startUrl: "https://a.test", nowIso: "2026-01-01T00:00:00.000Z" });
  const appended = reduceMessage(started.state, {
    type: "etr:add-event",
    event: { action: "click", description: "クリック", target: { tag: "button", type: "", selector: "#ok" }, timestamp: "2026-01-01T00:00:01.000Z" }
  });

  assert.equal(appended.state.steps.length, 1);
  assert.equal(appended.state.steps[0].step, 1);
});

test("reduceMessage adds memo step only while recording", () => {
  const initial = { recording: false, startedAt: null, startUrl: null, steps: [] };

  const skipped = reduceMessage(initial, { type: "etr:add-note", note: "補足メモ" });
  assert.equal(skipped.state.steps.length, 0);

  const started = reduceMessage(initial, { type: "etr:start-recording", startUrl: "https://a.test", nowIso: "2026-01-01T00:00:00.000Z" });
  const added = reduceMessage(started.state, { type: "etr:add-note", note: "補足メモ", timestamp: "2026-01-01T00:00:01.000Z" });

  assert.equal(added.state.steps.length, 1);
  assert.equal(added.state.steps[0].action, "memo");
  assert.equal(added.state.steps[0].note, "補足メモ");
});

test("reduceMessage updates exploratory session context", () => {
  const initial = { recording: false, startedAt: null, startUrl: null, steps: [], testPurpose: "", sessionFocus: "" };
  const updated = reduceMessage(initial, {
    type: "etr:update-session-context",
    testPurpose: "新規会員登録の探索",
    sessionFocus: "入力バリデーションとエラーメッセージ"
  });

  assert.equal(updated.changed, true);
  assert.equal(updated.state.testPurpose, "新規会員登録の探索");
  assert.equal(updated.state.sessionFocus, "入力バリデーションとエラーメッセージ");
});

test("reduceMessage pauses recording with pausedAt timestamp", () => {
  const initial = { recording: false, startedAt: null, startUrl: null, pausedAt: null, steps: [] };
  const started = reduceMessage(initial, { type: "etr:start-recording", startUrl: "https://a.test", nowIso: "2026-01-01T00:00:00.000Z" });
  
  const paused = reduceMessage(started.state, { 
    type: "etr:pause-recording", 
    pausedAt: "2026-01-01T00:00:10.000Z" 
  });

  assert.equal(paused.changed, true);
  assert.equal(paused.state.recording, true);
  assert.equal(paused.state.pausedAt, "2026-01-01T00:00:10.000Z");
});

test("reduceMessage skips events when paused", () => {
  const initial = { recording: false, startedAt: null, startUrl: null, pausedAt: null, steps: [] };
  const started = reduceMessage(initial, { type: "etr:start-recording", startUrl: "https://a.test", nowIso: "2026-01-01T00:00:00.000Z" });
  const paused = reduceMessage(started.state, { type: "etr:pause-recording", pausedAt: "2026-01-01T00:00:10.000Z" });

  const skipped = reduceMessage(paused.state, {
    type: "etr:add-event",
    event: { action: "click", description: "クリック", target: { tag: "button", type: "", selector: "#ok" } }
  });

  assert.equal(skipped.changed, false);
  assert.equal(skipped.state.steps.length, 0);
});

test("reduceMessage resumes recording and clears pausedAt", () => {
  const initial = { recording: false, startedAt: null, startUrl: null, pausedAt: null, steps: [] };
  const started = reduceMessage(initial, { type: "etr:start-recording", startUrl: "https://a.test", nowIso: "2026-01-01T00:00:00.000Z" });
  const paused = reduceMessage(started.state, { type: "etr:pause-recording", pausedAt: "2026-01-01T00:00:10.000Z" });

  const resumed = reduceMessage(paused.state, { type: "etr:resume-recording" });

  assert.equal(resumed.changed, true);
  assert.equal(resumed.state.recording, true);
  assert.equal(resumed.state.pausedAt, null);
});
