"use strict";

function createInitialState() {
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

function startRecordingState(state, currentUrl, startedAt) {
  if (state.recording) {
    return state;
  }

  return {
    ...state,
    recording: true,
    startedAt: startedAt || new Date().toISOString(),
    startUrl: state.startUrl || currentUrl || null
  };
}

function stopRecordingState(state) {
  return {
    ...state,
    recording: false
  };
}

function clearRecordingData(state) {
  return {
    ...state,
    recording: false,
    startedAt: null,
    startUrl: null,
    pausedAt: null,
    testPurpose: "",
    sessionFocus: "",
    steps: []
  };
}

function updateSessionContext(state, context) {
  return {
    ...state,
    testPurpose: normalizeText(context && context.testPurpose),
    sessionFocus: normalizeText(context && context.sessionFocus)
  };
}

function appendStep(state, stepPayload) {
  const nextStepNumber = state.steps.length + 1;
  const step = {
    step: nextStepNumber,
    action: stepPayload.action,
    description: stepPayload.description,
    target: stepPayload.target || { tag: "", type: "", selector: "" },
    timestamp: stepPayload.timestamp || new Date().toISOString()
  };

  assignOptionalFields(step, stepPayload, ["tabId", "value", "text", "url", "screenshot", "note"]);

  return {
    ...state,
    steps: [...state.steps, step]
  };
}

function assignOptionalFields(target, source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined) {
      target[key] = source[key];
    }
  }
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

function getLastUrlByTab(state, tabId) {
  if (tabId === undefined || tabId === null) {
    return null;
  }

  for (let i = state.steps.length - 1; i >= 0; i -= 1) {
    const step = state.steps[i];
    if (step.action === "navigate" && step.tabId === tabId && typeof step.url === "string") {
      return step.url;
    }
  }
  return null;
}

function pauseRecordingState(state, pausedAt) {
  return {
    ...state,
    recording: true,
    pausedAt: pausedAt || new Date().toISOString()
  };
}

function resumeRecordingState(state) {
  return {
    ...state,
    recording: true,
    pausedAt: null
  };
}

module.exports = {
  appendStep,
  clearRecordingData,
  createInitialState,
  getLastUrlByTab,
  pauseRecordingState,
  resumeRecordingState,
  startRecordingState,
  stopRecordingState,
  updateSessionContext
};
