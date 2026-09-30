"use strict";

const MESSAGE_DEDUPE_WINDOW_MS = 1500;
const SCREENSHOT_DESCRIPTION_BASE = "スクリーンショットを取得";

function shouldRecordMessage(cache, text, url, nowMs) {
  const key = `${text}@@${url}`;
  const last = cache.get(key);
  if (typeof last === "number" && nowMs - last <= MESSAGE_DEDUPE_WINDOW_MS) {
    return false;
  }
  cache.set(key, nowMs);
  return true;
}

function shouldRecordNavigate(lastUrl, nextUrl) {
  if (!nextUrl || lastUrl === nextUrl) {
    return false;
  }
  return true;
}

function makeStepPayload(action, data) {
  const payload = {
    action,
    description: data.description,
    target: data.target || { tag: "", type: "", selector: "" },
    timestamp: data.timestamp || new Date().toISOString()
  };

  if (data.tabId !== undefined) {
    payload.tabId = data.tabId;
  }

  assignActionField(payload, action, data);

  return payload;
}

function buildScreenshotDescription(note) {
  const normalized = normalizeMemo(note);
  if (!normalized) {
    return SCREENSHOT_DESCRIPTION_BASE;
  }
  return `${SCREENSHOT_DESCRIPTION_BASE}（メモ: ${normalized}）`;
}

function normalizeMemo(note) {
  if (typeof note !== "string") {
    return "";
  }
  return note.replace(/\s+/g, " ").trim();
}

function assignActionField(payload, action, data) {
  if (action === "input" && data.value !== undefined) {
    payload.value = data.value;
    return;
  }
  if (action === "message" && data.text !== undefined) {
    payload.text = data.text;
    return;
  }
  if (action === "navigate" && data.url !== undefined) {
    payload.url = data.url;
    return;
  }
  if (action === "screenshot" && data.screenshot !== undefined) {
    payload.screenshot = data.screenshot;
    if (data.note !== undefined) {
      payload.note = data.note;
    }
    return;
  }
  if (action === "memo" && data.note !== undefined) {
    payload.note = data.note;
  }
}

module.exports = {
  buildScreenshotDescription,
  MESSAGE_DEDUPE_WINDOW_MS,
  makeStepPayload,
  shouldRecordMessage,
  shouldRecordNavigate
};
