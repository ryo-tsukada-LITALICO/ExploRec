// 役割: MAIN world で SPA の履歴APIを監視し、URL変化を通知する
"use strict";

(() => {
  if (window.__etrHistoryHooked) {
    return;
  }
  window.__etrHistoryHooked = true;

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  function notifyIfChanged(beforeUrl) {
    const afterUrl = location.href;
    if (beforeUrl !== afterUrl) {
      window.dispatchEvent(new CustomEvent("etr:navigate", { detail: { url: afterUrl } }));
    }
  }

  history.pushState = function pushStateWrapper(...args) {
    const beforeUrl = location.href;
    const result = originalPushState.apply(this, args);
    notifyIfChanged(beforeUrl);
    return result;
  };

  history.replaceState = function replaceStateWrapper(...args) {
    const beforeUrl = location.href;
    const result = originalReplaceState.apply(this, args);
    notifyIfChanged(beforeUrl);
    return result;
  };
})();
