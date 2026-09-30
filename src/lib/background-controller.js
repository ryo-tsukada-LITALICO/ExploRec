"use strict";

const {
  appendStep,
  clearRecordingData,
  createInitialState,
  pauseRecordingState,
  resumeRecordingState,
  startRecordingState,
  stopRecordingState,
  updateSessionContext
} = require("./state");

function reduceMessage(currentState, message) {
  const state = currentState || createInitialState();
  const type = message && message.type;

  if (type === "etr:start-recording") {
    return makeChanged(startRecordingState(state, message.startUrl, message.nowIso));
  }

  if (type === "etr:stop-recording") {
    return makeChanged(stopRecordingState(state));
  }

  if (type === "etr:toggle-recording") {
    if (state.recording) {
      return makeChanged(stopRecordingState(state));
    }
    return makeChanged(startRecordingState(clearRecordingData(state), message.startUrl, message.nowIso));
  }

  if (type === "etr:clear") {
    return makeChanged(clearRecordingData(state));
  }

  if (type === "etr:add-event") {
    if (!state.recording || state.pausedAt || !message.event) {
      return { state, changed: false };
    }
    return makeChanged(appendStep(state, message.event));
  }

  if (type === "etr:add-note") {
    if (!state.recording || state.pausedAt) {
      return { state, changed: false };
    }
    const note = normalizeMemo(message.note);
    if (!note) {
      return { state, changed: false };
    }
    return makeChanged(
      appendStep(state, {
        action: "memo",
        description: `メモを追加: ${note}`,
        note,
        target: { tag: "window", type: "", selector: "window" },
        timestamp: message.timestamp
      })
    );
  }

  if (type === "etr:update-session-context") {
    return makeChanged(
      updateSessionContext(state, {
        testPurpose: message.testPurpose,
        sessionFocus: message.sessionFocus
      })
    );
  }

  if (type === "etr:pause-recording") {
    if (!state.recording || state.pausedAt) {
      return { state, changed: false };
    }
    return makeChanged(pauseRecordingState(state, message.pausedAt));
  }

  if (type === "etr:resume-recording") {
    if (!state.recording || !state.pausedAt) {
      return { state, changed: false };
    }
    return makeChanged(resumeRecordingState(state));
  }

  return { state, changed: false };
}

function makeChanged(state) {
  return { state, changed: true };
}

function normalizeMemo(note) {
  if (typeof note !== "string") {
    return "";
  }
  return note.replace(/\s+/g, " ").trim();
}

module.exports = {
  reduceMessage
};
