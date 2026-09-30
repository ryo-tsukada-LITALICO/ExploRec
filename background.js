// 役割: 記録状態の唯一の正を管理し、ステップ採番と保存を行う service worker
"use strict";

const STORAGE_KEY = "etrState";
const SCREENSHOT_DESCRIPTION_BASE = "スクリーンショットを取得";

function createSidePanelConfig(defaultPath) {
  return {
    openPanelOnActionClick: true
  };
}

function createDefaultState() {
  return {
    recording: false,
    startedAt: null,
    startUrl: null,
    pausedAt: null,
    testPurpose: "",
    sessionFocus: "",
    steps: []
  };
}

async function loadState() {
  const loaded = await chrome.storage.local.get(STORAGE_KEY);
  return loaded[STORAGE_KEY] || createDefaultState();
}

async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function sanitizeTarget(target) {
  return {
    tag: (target && target.tag) || "",
    type: (target && target.type) || "",
    selector: (target && target.selector) || ""
  };
}

function appendStep(state, event) {
  const step = {
    step: state.steps.length + 1,
    action: event.action,
    description: event.description,
    target: sanitizeTarget(event.target),
    timestamp: event.timestamp || new Date().toISOString()
  };

  assignOptionalFields(step, event, ["tabId", "value", "text", "url", "screenshot", "note"]);

  return { ...state, steps: [...state.steps, step] };
}

function getLastTabNavigateUrl(state, tabId) {
  for (let i = state.steps.length - 1; i >= 0; i -= 1) {
    const step = state.steps[i];
    if (step.action === "navigate" && step.tabId === tabId && typeof step.url === "string") {
      return step.url;
    }
  }
  return null;
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function toggleRecording() {
  const state = await loadState();
  if (state.recording) {
    const next = { ...state, recording: false };
    await saveState(next);
    return next;
  }

  const activeTab = await getActiveTab();
  await ensureRecordingScriptsInjected(activeTab && activeTab.id);
  const now = new Date().toISOString();
  const next = {
    ...state,
    recording: true,
    startedAt: now,
    startUrl: (activeTab && activeTab.url) || null,
    steps: []
  };
  await saveState(next);
  return next;
}

function buildScreenshotDescription(note) {
  const normalized = normalizeText(note);
  if (!normalized) {
    return SCREENSHOT_DESCRIPTION_BASE;
  }
  return `${SCREENSHOT_DESCRIPTION_BASE}（メモ: ${normalized}）`;
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

async function takeScreenshot(note) {
  const state = await loadState();
  if (!state.recording) {
    return state;
  }
  const activeTab = await getActiveTab();
  if (!activeTab || activeTab.windowId === undefined) {
    throw new Error("アクティブタブを取得できませんでした");
  }
  const normalizedNote = normalizeText(note);
  const dataUrl = await chrome.tabs.captureVisibleTab(activeTab.windowId, { format: "png" });
  const next = appendStep(state, {
    action: "screenshot",
    description: buildScreenshotDescription(normalizedNote),
    note: normalizedNote,
    screenshot: dataUrl,
    tabId: activeTab.id,
    target: { tag: "window", type: "", selector: "window" }
  });
  await saveState(next);
  try {
    await downloadScreenshotImage(dataUrl, normalizedNote, new Date());
  } catch (error) {
    throw new Error(`スクリーンショットの記録は完了しましたが、画像ダウンロードに失敗しました: ${error.message}`);
  }
  return next;
}

async function addMemo(note) {
  const state = await loadState();
  if (!state.recording || state.pausedAt) {
    return state;
  }
  const normalizedNote = normalizeText(note);
  if (!normalizedNote) {
    return state;
  }
  const activeTab = await getActiveTab();
  const next = appendStep(state, {
    action: "memo",
    description: `メモを追加: ${normalizedNote}`,
    note: normalizedNote,
    tabId: activeTab && activeTab.id !== undefined ? activeTab.id : undefined,
    target: { tag: "window", type: "", selector: "window" }
  });
  await saveState(next);
  return next;
}

async function updateSessionContext(testPurpose, sessionFocus) {
  const state = await loadState();
  const next = {
    ...state,
    testPurpose: normalizeText(testPurpose),
    sessionFocus: normalizeText(sessionFocus)
  };
  await saveState(next);
  return next;
}

function assignOptionalFields(target, source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined) {
      target[key] = source[key];
    }
  }
}

async function downloadScreenshotImage(dataUrl, note, now) {
  const options = buildScreenshotDownloadOptions(dataUrl, note, now);
  if (!chrome.downloads || typeof chrome.downloads.download !== "function") {
    throw new Error("downloads APIを利用できません");
  }
  await chrome.downloads.download(options);
}

function buildScreenshotDownloadOptions(dataUrl, note, now) {
  if (typeof dataUrl !== "string" || dataUrl.length === 0) {
    throw new Error("スクリーンショットのData URLが不正です");
  }
  const filenameBase = buildDownloadFilenameBase(note, now);
  return {
    url: dataUrl,
    filename: `ExploRec_${filenameBase}.png`,
    saveAs: false,
    conflictAction: "uniquify"
  };
}

function formatDownloadTimestamp(now) {
  const base = now instanceof Date ? now : new Date(now || Date.now());
  if (Number.isNaN(base.getTime())) {
    throw new Error("スクリーンショット保存時刻が不正です");
  }
  const year = String(base.getUTCFullYear());
  const month = String(base.getUTCMonth() + 1).padStart(2, "0");
  const day = String(base.getUTCDate()).padStart(2, "0");
  const hour = String(base.getUTCHours()).padStart(2, "0");
  const minute = String(base.getUTCMinutes()).padStart(2, "0");
  const second = String(base.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hour}${minute}${second}`;
}

function buildDownloadFilenameBase(note, now) {
  const fromNote = sanitizeDownloadFilenameText(note);
  if (fromNote) {
    return fromNote;
  }
  return formatDownloadTimestamp(now);
}

function sanitizeDownloadFilenameText(note) {
  if (typeof note !== "string") {
    return "";
  }
  const normalized = note.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }
  const replaced = normalized
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/[. ]+$/g, "")
    .trim();
  if (!replaced) {
    return "";
  }
  return replaced.slice(0, 80);
}

async function ensureRecordingScriptsInjected(tabId) {
  if (tabId === undefined) {
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["inject_main.js"],
      world: "MAIN"
    });
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
      world: "ISOLATED"
    });
  } catch (error) {
    console.warn("ExploRec script injection skipped:", error);
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior(createSidePanelConfig());
  const loaded = await chrome.storage.local.get(STORAGE_KEY);
  if (!loaded[STORAGE_KEY]) {
    await saveState(createDefaultState());
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-recording") {
    await toggleRecording();
    return;
  }
  if (command === "take-screenshot") {
    await takeScreenshot("");
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const type = message && message.type;

    if (type === "etr:get-state") {
      sendResponse({ ok: true, state: await loadState() });
      return;
    }

    if (type === "etr:get-tab-last-url") {
      const state = await loadState();
      const tabId = sender && sender.tab ? sender.tab.id : undefined;
      sendResponse({
        ok: true,
        url: tabId === undefined ? null : getLastTabNavigateUrl(state, tabId)
      });
      return;
    }

    if (type === "etr:toggle-recording") {
      sendResponse({ ok: true, state: await toggleRecording() });
      return;
    }

    if (type === "etr:start-recording") {
      const state = await loadState();
      if (state.recording) {
        sendResponse({ ok: true, state });
        return;
      }
      const activeTab = await getActiveTab();
      await ensureRecordingScriptsInjected(activeTab && activeTab.id);
      const next = {
        ...state,
        recording: true,
        startedAt: new Date().toISOString(),
        startUrl: (activeTab && activeTab.url) || null,
        steps: []
      };
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }

    if (type === "etr:stop-recording") {
      const state = await loadState();
      const next = { ...state, recording: false };
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }

    if (type === "etr:clear") {
      const next = createDefaultState();
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }

    if (type === "etr:take-screenshot") {
      sendResponse({ ok: true, state: await takeScreenshot(message.note) });
      return;
    }

    if (type === "etr:add-note") {
      sendResponse({ ok: true, state: await addMemo(message.note) });
      return;
    }

    if (type === "etr:update-session-context") {
      sendResponse({
        ok: true,
        state: await updateSessionContext(message.testPurpose, message.sessionFocus)
      });
      return;
    }

    if (type === "etr:pause-recording") {
      const state = await loadState();
      if (!state.recording || state.pausedAt) {
        sendResponse({ ok: true, skipped: true });
        return;
      }
      const next = {
        ...state,
        pausedAt: new Date().toISOString()
      };
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }

    if (type === "etr:resume-recording") {
      const state = await loadState();
      if (!state.recording || !state.pausedAt) {
        sendResponse({ ok: true, skipped: true });
        return;
      }
      const next = {
        ...state,
        pausedAt: null
      };
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }

    if (type === "etr:add-event") {
      const state = await loadState();
      if (!state.recording || state.pausedAt) {
        sendResponse({ ok: true, skipped: true });
        return;
      }
      const tabId = sender && sender.tab ? sender.tab.id : undefined;
      const next = appendStep(state, {
        ...message.event,
        tabId: message.event.tabId !== undefined ? message.event.tabId : tabId
      });
      await saveState(next);
      sendResponse({ ok: true, state: next });
      return;
    }

    sendResponse({ ok: false, error: "unknown message" });
  })().catch((error) => {
    sendResponse({ ok: false, error: error.message });
  });

  return true;
});
