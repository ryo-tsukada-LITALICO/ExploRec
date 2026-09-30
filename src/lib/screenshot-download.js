// 役割: スクリーンショット画像のダウンロード設定を生成し保存実行を統一する
"use strict";

const DOWNLOAD_PREFIX = "ExploRec_";

function buildScreenshotDownloadOptions(input) {
  const dataUrl = input && input.dataUrl;
  if (typeof dataUrl !== "string" || dataUrl.length === 0) {
    throw new Error("スクリーンショットのData URLが不正です");
  }
  const filenameBase = buildFilenameBase(input && input.note, input && input.now);

  return {
    url: dataUrl,
    filename: `${DOWNLOAD_PREFIX}${filenameBase}.png`,
    saveAs: false,
    conflictAction: "uniquify"
  };
}

async function downloadScreenshotImage(downloadsApi, options) {
  if (!downloadsApi || typeof downloadsApi.download !== "function") {
    throw new Error("downloads APIを利用できません");
  }
  return downloadsApi.download(options);
}

function formatFilenameTimestamp(now) {
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

function buildFilenameBase(note, now) {
  const fromNote = sanitizeFilenameText(note);
  if (fromNote) {
    return fromNote;
  }
  return formatFilenameTimestamp(now);
}

function sanitizeFilenameText(note) {
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

module.exports = {
  buildScreenshotDownloadOptions,
  downloadScreenshotImage
};
