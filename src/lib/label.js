"use strict";

const SELECT_TYPES = new Set(["select-one", "select-multiple"]);

function resolveHumanLabel(candidates) {
  const ordered = [
    candidates.byFor,
    candidates.byWrap,
    candidates.byAriaLabel,
    candidates.byAriaLabelledBy,
    candidates.byPlaceholder,
    candidates.byTitle
  ];
  for (const label of ordered) {
    const normalized = normalizeText(label);
    if (normalized) {
      return normalized;
    }
  }
  return fallbackByType(candidates.tagName, candidates.type);
}

function buildClickDescription({ targetTag, label }) {
  const normalizedLabel = normalizeText(label);
  if (isButtonLike(targetTag) && normalizedLabel) {
    return `『${normalizedLabel}』ボタンをクリック`;
  }
  if (normalizedLabel) {
    return `${normalizedLabel}をクリック`;
  }
  return "要素をクリック";
}

function buildInputDescription({ type, label, value, checked }) {
  const normalizedType = String(type || "").toLowerCase();
  const normalizedLabel = normalizeText(label) || fallbackByType("input", type);
  if (normalizedType === "checkbox") {
    return `${normalizedLabel}を${checked ? "オン" : "オフ"}にした`;
  }
  if (normalizedType === "radio") {
    return `${normalizedLabel}で「${value || ""}」を選択`;
  }
  if (SELECT_TYPES.has(normalizedType)) {
    return `${normalizedLabel}で「${value || ""}」を選択`;
  }
  return `${normalizedLabel}に「${value || ""}」と入力`;
}

function fallbackByType(tagName, type) {
  const tag = String(tagName || "").toLowerCase();
  const inputType = String(type || "").toLowerCase();
  if (tag === "textarea") {
    return "テキストエリア";
  }
  if (tag === "select") {
    return "セレクトボックス";
  }
  if (tag === "input" && inputType === "password") {
    return "パスワードのテキストボックス";
  }
  if (tag === "input" && inputType === "email") {
    return "メールアドレスのテキストボックス";
  }
  return "入力欄";
}

function isButtonLike(tagName) {
  return String(tagName || "").toLowerCase() === "button";
}

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }
  const text = value.replace(/\s+/g, " ").trim();
  return text;
}

module.exports = {
  buildClickDescription,
  buildInputDescription,
  resolveHumanLabel
};
