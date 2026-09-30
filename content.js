// 役割: ユーザー操作/メッセージ/遷移を検知して background へイベント送信する
"use strict";

const STORAGE_KEY = "etrState";
const CLICK_TARGET_SELECTOR = "button,a,[role=button],input[type=submit],input[type=button],input[type=checkbox],input[type=radio],select,[onclick]";
const MESSAGE_SELECTORS = "[role=alert],[role=status],[aria-live=polite],[aria-live=assertive]";
const MESSAGE_CLASS_PATTERN = /(alert|error|toast|message|notification|snackbar|invalid-feedback|help-block|form-error|flash)/i;
const MESSAGE_DEDUPE_WINDOW_MS = 1500;

let isRecording = false;
let isPaused = false;
let lastRecordedUrl = location.href;
const messageCache = new Map();

function normalizeText(text) {
  if (typeof text !== "string") {
    return "";
  }
  return text.replace(/\s+/g, " ").trim();
}

function isVisibleElement(element) {
  if (!(element instanceof Element)) {
    return false;
  }
  let current = element;
  while (current && current instanceof Element) {
    if (current.getAttribute("aria-hidden") === "true") {
      return false;
    }
    const style = window.getComputedStyle(current);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function getSelector(element) {
  if (!(element instanceof Element)) {
    return "";
  }
  if (element.id) {
    return `#${cssEscape(element.id)}`;
  }
  const parts = [];
  let current = element;
  while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    const parent = current.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }
    const siblings = Array.from(parent.children).filter((el) => el.tagName === current.tagName);
    const index = siblings.indexOf(current) + 1;
    parts.unshift(`${tag}:nth-of-type(${index})`);
    current = parent;
  }
  return parts.join(" > ");
}

function makeTarget(element) {
  return {
    tag: element ? element.tagName.toLowerCase() : "",
    type: element && "type" in element ? String(element.type || "") : "",
    selector: getSelector(element)
  };
}

function getInputFallbackLabel(element) {
  const tag = element.tagName.toLowerCase();
  const type = String(element.type || "").toLowerCase();
  if (tag === "textarea") {
    return "テキストエリア";
  }
  if (tag === "select") {
    return "セレクトボックス";
  }
  if (tag === "input" && type === "password") {
    return "パスワードのテキストボックス";
  }
  if (tag === "input" && type === "email") {
    return "メールアドレスのテキストボックス";
  }
  return "入力欄";
}

function resolveLabel(element) {
  const id = element.id;
  if (id) {
    const forLabel = document.querySelector(`label[for="${cssEscape(id)}"]`);
    if (forLabel) {
      const text = normalizeText(forLabel.textContent);
      if (text) {
        return text;
      }
    }
  }

  const wrappingLabel = element.closest("label");
  if (wrappingLabel) {
    const text = normalizeText(wrappingLabel.textContent);
    if (text) {
      return text;
    }
  }

  const ariaLabel = normalizeText(element.getAttribute("aria-label"));
  if (ariaLabel) {
    return ariaLabel;
  }

  const labelledBy = normalizeText(element.getAttribute("aria-labelledby"));
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/).filter(Boolean);
    const joined = normalizeText(
      ids
        .map((labelId) => {
          const target = document.getElementById(labelId);
          return target ? target.textContent || "" : "";
        })
        .join(" ")
    );
    if (joined) {
      return joined;
    }
  }

  const placeholder = normalizeText(element.getAttribute("placeholder"));
  if (placeholder) {
    return placeholder;
  }

  const title = normalizeText(element.getAttribute("title"));
  if (title) {
    return title;
  }

  return getInputFallbackLabel(element);
}

function getClickableLabel(element) {
  const text = normalizeText(element.textContent || element.value || "");
  if (text) {
    return text;
  }
  return resolveLabel(element);
}

function buildClickDescription(element) {
  const tag = element.tagName.toLowerCase();
  const type = String(element.type || "").toLowerCase();
  const label = getClickableLabel(element);

  const isButtonLike = tag === "button" || tag === "a" || element.getAttribute("role") === "button" || type === "submit" || type === "button";
  if (isButtonLike && label) {
    return `『${label}』ボタンをクリック`;
  }
  if (label) {
    return `${label}をクリック`;
  }
  return "要素をクリック";
}

function buildInputInfo(element) {
  const tag = element.tagName.toLowerCase();
  const type = String(element.type || "").toLowerCase();
  const label = resolveLabel(element);

  if (tag === "select") {
    const selectedOption = element.options[element.selectedIndex];
    const optionText = normalizeText(selectedOption ? selectedOption.text : "");
    return {
      value: optionText,
      description: `${label}で「${optionText}」を選択`
    };
  }

  if (type === "checkbox") {
    return {
      value: element.checked ? "オン" : "オフ",
      description: `${label}を${element.checked ? "オン" : "オフ"}にした`
    };
  }

  if (type === "radio") {
    const optionLabel = normalizeText(element.value || element.getAttribute("aria-label") || "");
    return {
      value: optionLabel,
      description: `${label}で「${optionLabel}」を選択`
    };
  }

  const value = String(element.value || "");
  return {
    value,
    description: `${label}に「${value}」と入力`
  };
}

function shouldRecordMessage(text, url, nowMs) {
  const key = `${text}@@${url}`;
  const last = messageCache.get(key);
  if (typeof last === "number" && nowMs - last <= MESSAGE_DEDUPE_WINDOW_MS) {
    return false;
  }
  messageCache.set(key, nowMs);
  return true;
}

function sendEvent(event) {
  return chrome.runtime.sendMessage({ type: "etr:add-event", event });
}

function postEvent(event) {
  return sendEvent({
    ...event,
    timestamp: event.timestamp || new Date().toISOString()
  });
}

function shouldHandleRecording() {
  return isRecording && !isPaused;
}

function maybeRecordNavigate(url) {
  if (!shouldHandleRecording() || !url || lastRecordedUrl === url) {
    return;
  }
  lastRecordedUrl = url;
  postEvent({
    action: "navigate",
    description: `ページ遷移: ${url}`,
    url,
    target: { tag: "body", type: "", selector: "body" }
  });
}

function handleClick(event) {
  if (!shouldHandleRecording()) {
    return;
  }
  const rawTarget = event.target;
  if (!(rawTarget instanceof Element)) {
    return;
  }
  const target = rawTarget.closest(CLICK_TARGET_SELECTOR);
  if (!target) {
    return;
  }
  postEvent({
    action: "click",
    description: buildClickDescription(target),
    target: makeTarget(target)
  });
}

function handleChange(event) {
  if (!shouldHandleRecording()) {
    return;
  }
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
    return;
  }
  if (target instanceof HTMLInputElement && target.type === "radio" && !target.checked) {
    return;
  }
  const info = buildInputInfo(target);
  postEvent({
    action: "input",
    description: info.description,
    value: info.value,
    target: makeTarget(target)
  });
}

function collectMessageCandidates(node) {
  const results = [];
  if (node instanceof Element) {
    if (node.matches(MESSAGE_SELECTORS) || MESSAGE_CLASS_PATTERN.test(node.className || "")) {
      results.push(node);
    }
    results.push(...node.querySelectorAll(MESSAGE_SELECTORS));
    results.push(
      ...Array.from(node.querySelectorAll("[class]")).filter((el) => MESSAGE_CLASS_PATTERN.test(el.className || ""))
    );
  } else if (node && node.parentElement) {
    results.push(...collectMessageCandidates(node.parentElement));
  }
  return results;
}

function handlePossibleMessage(element) {
  if (!shouldHandleRecording() || !isVisibleElement(element)) {
    return;
  }
  const text = normalizeText(element.textContent || "");
  if (!text) {
    return;
  }
  const now = Date.now();
  if (!shouldRecordMessage(text, location.href, now)) {
    return;
  }
  postEvent({
    action: "message",
    description: `「${text}」と表示された`,
    text,
    target: makeTarget(element)
  });
}

function initMessageObserver() {
  const observer = new MutationObserver((mutations) => {
    if (!shouldHandleRecording()) {
      return;
    }
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        const candidates = collectMessageCandidates(node);
        for (const candidate of candidates) {
          handlePossibleMessage(candidate);
        }
      }
      if (mutation.type === "characterData" || mutation.type === "attributes") {
        const candidates = collectMessageCandidates(mutation.target);
        for (const candidate of candidates) {
          handlePossibleMessage(candidate);
        }
      }
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["role", "aria-live", "class"]
  });
}

async function loadInitialRecordingState() {
  const loaded = await chrome.storage.local.get(STORAGE_KEY);
  const state = loaded[STORAGE_KEY];
  isRecording = Boolean(state && state.recording);
  isPaused = Boolean(state && state.pausedAt);
}

async function syncReinjectionNavigate() {
  if (!isRecording) {
    return;
  }
  const response = await chrome.runtime.sendMessage({ type: "etr:get-tab-last-url" });
  if (!response || !response.ok) {
    return;
  }
  lastRecordedUrl = response.url || location.href;
  if (response.url && response.url !== location.href) {
    maybeRecordNavigate(location.href);
  }
}

function bindStorageSync() {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    if (changes[STORAGE_KEY] && changes[STORAGE_KEY].newValue) {
      isRecording = Boolean(changes[STORAGE_KEY].newValue.recording);
      isPaused = Boolean(changes[STORAGE_KEY].newValue.pausedAt);
    }
  });
}

async function init() {
  await loadInitialRecordingState();
  bindStorageSync();
  initMessageObserver();

  window.addEventListener("etr:navigate", (event) => {
    maybeRecordNavigate(event.detail && event.detail.url);
  });
  window.addEventListener("popstate", () => {
    maybeRecordNavigate(location.href);
  });
  document.addEventListener("click", handleClick, true);
  document.addEventListener("change", handleChange, true);

  await syncReinjectionNavigate();
}

if (!window.__etrContentInitialized) {
  window.__etrContentInitialized = true;
  init().catch((error) => {
    console.error("ExploRec content init failed:", error);
  });
}
