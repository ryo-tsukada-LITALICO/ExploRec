// 役割: popup UIを状態と同期し、記録操作やJSON出力を実行する
"use strict";

const STORAGE_KEY = "etrState";
const presenter = (typeof window !== "undefined" && window.PopupPresenter) || null;

const statusBadgeEl = document.getElementById("statusBadge");
const metaEl = document.getElementById("meta");
const actionNoticeEl = document.getElementById("actionNotice");
const summaryEl = document.getElementById("summary");
const stepsEl = document.getElementById("steps");
const testPurposeEl = document.getElementById("testPurpose");
const sessionFocusEl = document.getElementById("sessionFocus");
const saveSessionContextButton = document.getElementById("saveSessionContext");
const toggleButton = document.getElementById("toggleRecording");
const pauseResumeButton = document.getElementById("pauseResumeButton");
const screenshotButton = document.getElementById("takeScreenshot");
const screenshotMemoEl = document.getElementById("screenshotMemo");
const saveMemoButton = document.getElementById("saveMemo");
const exportButton = document.getElementById("exportJson");
const clearButton = document.getElementById("clearSteps");

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

function normalizeState(state) {
  return state || createDefaultState();
}

function renderState(rawState) {
  const state = normalizeState(rawState);
  const isPaused = state.recording && state.pausedAt;
  statusBadgeEl.textContent = isPaused ? "一時中断中" : (state.recording ? "記録中" : "停止中");
  statusBadgeEl.className = state.recording ? "status-recording" : "";
  metaEl.textContent = `ステップ数: ${state.steps.length}`;
  if (testPurposeEl) {
    testPurposeEl.value = state.testPurpose || "";
  }
  if (sessionFocusEl) {
    sessionFocusEl.value = state.sessionFocus || "";
  }
  updateButtonStates(state);
  renderSummary(state.steps);
  stepsEl.innerHTML = "";

  for (const step of state.steps) {
    const wrapper = document.createElement("div");
    wrapper.className = getStepCardClassName(step.action);

    const head = document.createElement("div");
    head.className = "step-head";
    const title = document.createElement("div");
    title.textContent = `${step.step}. ${step.description}`;
    const tag = document.createElement("span");
    tag.className = "step-tag";
    tag.textContent = getStepActionLabel(step.action);
    head.appendChild(title);
    head.appendChild(tag);
    wrapper.appendChild(head);

    const sub = document.createElement("div");
    sub.className = "muted";
    sub.textContent = `${step.action} / ${step.timestamp}`;
    wrapper.appendChild(sub);

    if (step.screenshot) {
      const img = document.createElement("img");
      img.className = "thumb";
      img.src = step.screenshot;
      img.alt = "screenshot";
      wrapper.appendChild(img);
    }

    stepsEl.appendChild(wrapper);
  }
}

function updateButtonStates(state) {
  const isPaused = state.recording && state.pausedAt;
  const isRecording = state.recording;
  
  if (toggleButton) {
    toggleButton.textContent = isRecording ? "停止" : "開始";
    toggleButton.disabled = false;
  }
  if (pauseResumeButton) {
    pauseResumeButton.disabled = !isRecording;
    pauseResumeButton.textContent = isPaused ? "再開" : "一時中断";
  }
  if (screenshotButton) {
    screenshotButton.disabled = isPaused;
  }
  if (saveMemoButton) {
    saveMemoButton.disabled = isPaused;
  }
}

function renderSummary(steps) {
  if (!summaryEl) {
    return;
  }
  summaryEl.innerHTML = "";

  const items = presenter ? presenter.buildSummaryItems(steps) : [];
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "summary-item";
    empty.innerHTML = "<strong>0</strong><span class=\"muted\">操作</span>";
    summaryEl.appendChild(empty);
    return;
  }

  for (const item of items.slice(0, 6)) {
    const card = document.createElement("div");
    card.className = "summary-item";
    const strong = document.createElement("strong");
    strong.textContent = String(item.count);
    const label = document.createElement("span");
    label.className = "muted";
    label.textContent = item.label;
    card.appendChild(strong);
    card.appendChild(label);
    summaryEl.appendChild(card);
  }
}

async function getStateFromStorage() {
  const loaded = await chrome.storage.local.get(STORAGE_KEY);
  return normalizeState(loaded[STORAGE_KEY]);
}

function exportAsJson(state) {
  const payload = {
    startedAt: state.startedAt,
    startUrl: state.startUrl,
    testPurpose: state.testPurpose || "",
    sessionFocus: state.sessionFocus || "",
    steps: state.steps
  };
  const text = JSON.stringify(payload, null, 2);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  a.href = url;
  a.download = `explorec-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

toggleButton.addEventListener("click", async () => {
  await runAndRefresh({ type: "etr:toggle-recording" }, { button: toggleButton, buttonLabel: "記録切替", clearScreenshotMemo: false });
});

if (pauseResumeButton) {
  pauseResumeButton.addEventListener("click", async () => {
    const state = await getStateFromStorage();
    const isPaused = state.recording && state.pausedAt;
    
    let payload;
    let buttonLabel;
    if (isPaused) {
      // Paused -> Resume recording
      payload = { type: "etr:resume-recording" };
      buttonLabel = "記録再開";
    } else {
      // Recording -> Pause recording
      payload = { type: "etr:pause-recording", pausedAt: new Date().toISOString() };
      buttonLabel = "一時中断";
    }
    
    await runAndRefresh(payload, { button: pauseResumeButton, buttonLabel, clearScreenshotMemo: false });
  });
}

screenshotButton.addEventListener("click", async () => {
  const note = getScreenshotMemo();
  await runAndRefresh({ type: "etr:take-screenshot", note }, { button: screenshotButton, buttonLabel: "スクリーンショットを取得" });
});

saveMemoButton.addEventListener("click", async () => {
  const note = getScreenshotMemo();
  if (!note) {
    return;
  }
  await runAndRefresh({ type: "etr:add-note", note }, { button: saveMemoButton, buttonLabel: "メモを保存" });
});

saveSessionContextButton.addEventListener("click", async () => {
  await runAndRefresh(
    {
      type: "etr:update-session-context",
      testPurpose: getTestPurpose(),
      sessionFocus: getSessionFocus()
    },
    { clearScreenshotMemo: false, button: saveSessionContextButton, buttonLabel: "セッション目的を保存" }
  );
});

clearButton.addEventListener("click", async () => {
  await runAndRefresh({ type: "etr:clear" }, { button: clearButton, buttonLabel: "クリア" });
});

exportButton.addEventListener("click", async () => {
  exportAsJson(await getStateFromStorage());
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") {
    return;
  }
  if (!changes[STORAGE_KEY]) {
    return;
  }
  renderState(normalizeState(changes[STORAGE_KEY].newValue));
});

getStateFromStorage().then(renderState);

function normalizeMemo(note) {
  if (typeof note !== "string") {
    return "";
  }
  return note.replace(/\s+/g, " ").trim();
}

function getScreenshotMemo() {
  if (!screenshotMemoEl) {
    return "";
  }
  return normalizeMemo(screenshotMemoEl.value);
}

function clearScreenshotMemo() {
  if (screenshotMemoEl) {
    screenshotMemoEl.value = "";
  }
}

function getTestPurpose() {
  if (!testPurposeEl) {
    return "";
  }
  return normalizeMemo(testPurposeEl.value);
}

function getSessionFocus() {
  if (!sessionFocusEl) {
    return "";
  }
  return normalizeMemo(sessionFocusEl.value);
}

async function sendRuntimeMessage(payload) {
  const response = await chrome.runtime.sendMessage(payload);
  if (!response || response.ok !== true) {
    const message = response && response.error ? response.error : "拡張との通信に失敗しました";
    throw new Error(message);
  }
  return response;
}

async function runAndRefresh(payload, options) {
  const mergedOptions = {
    clearScreenshotMemo: true,
    button: null,
    buttonLabel: "",
    ...(options || {})
  };
  const button = mergedOptions.button;
  const originalButtonText = button ? button.textContent : "";
  try {
    setButtonBusy(button, true);
    if (button && mergedOptions.buttonLabel) {
      button.textContent = mergedOptions.buttonLabel;
    }
    let errorMessage = "";
    try {
      await sendRuntimeMessage(payload);
    } catch (error) {
      errorMessage = error && error.message ? error.message : "操作に失敗しました";
    }
    if (mergedOptions.clearScreenshotMemo) {
      clearScreenshotMemo();
    }
    renderState(await getStateFromStorage());
    if (errorMessage) {
      showActionNotice(errorMessage);
    } else {
      showActionNotice(getActionFeedbackText(mergedOptions.buttonLabel || "実行"));
    }
  } finally {
    setButtonBusy(button, false);
    // toggleButton と pauseResumeButton は状態に応じてテキストが変わるため、originalButtonText で復元しない
    if (button && originalButtonText && button.id !== 'toggleRecording' && button.id !== 'pauseResumeButton') {
      button.textContent = originalButtonText;
    }
  }
}

function setButtonBusy(button, isBusy) {
  if (!button) {
    return;
  }
  button.disabled = isBusy;
  button.classList.toggle("button-busy", isBusy);
}

function showActionNotice(text) {
  if (!actionNoticeEl) {
    return;
  }
  actionNoticeEl.textContent = text;
  window.clearTimeout(showActionNotice.timerId);
  showActionNotice.timerId = window.setTimeout(() => {
    actionNoticeEl.textContent = "";
  }, 1400);
}

function getActionFeedbackText(label) {
  if (presenter && typeof presenter.buildActionFeedbackText === "function") {
    return presenter.buildActionFeedbackText(label);
  }
  const normalized = typeof label === "string" ? label.trim() : "";
  return normalized ? `${normalized}しました` : "実行しました";
}

function getStepActionLabel(action) {
  if (presenter) {
    return presenter.stepActionLabel(action);
  }
  return action || "不明";
}

function getStepCardClassName(action) {
  if (presenter) {
    return presenter.stepCardClassName(action);
  }
  return "step";
}
