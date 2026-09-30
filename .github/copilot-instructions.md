# Copilot Instructions for ExploRec

This repository currently defines product and implementation specs in:

- `requirements.md`
- `acceptance-checklist.md`

Use those files as product-level source of truth when changing behavior.

## Build, test, and lint commands

- **Full tests:** `npm test`
- **Single test file:** `npm run test:single`
- **Lint/build:** currently none
- **Manual acceptance:** use `acceptance-checklist.md` sections `0` through `14` (including section `13` scenarios)

## High-level architecture (from requirements)

ExploRec is designed as a **Chrome Extension (Manifest V3)** with six core files:

- `manifest.json`
- `background.js` (service worker)
- `content.js` (ISOLATED world content script)
- `inject_main.js` (MAIN world content script)
- `popup.html`
- `popup.js`

Big-picture flow:

1. `content.js` observes user actions/events and sends messages only.
2. `inject_main.js` hooks `history.pushState` / `replaceState` and emits navigation events.
3. `background.js` is the **single writer** for session state and steps (step numbering and append happen only here).
4. State is persisted in `chrome.storage.local` as the single source of truth so service worker restarts can recover.
5. `content.js` and `popup.js` both sync state via initial storage read + `chrome.storage.onChanged`.
6. `popup` triggers recording toggle, screenshot, JSON export, and clear actions.

## Key conventions specific to this project

- Add a **Japanese role comment at the top of each file**.
- Human-readable `description` fields must be **natural Japanese text**.
- Use one global recording session across the extension (not per-tab on/off); keep `tabId` per step for traceability.
- Keep `startUrl` fixed to the URL at recording start.
- For label resolution, follow this strict priority:
  `label[for=id]` → wrapping `<label>` → `aria-label` → `aria-labelledby` → `placeholder` → `title` → type-based Japanese fallback.
- Do not use `name` / `id` / CSS selector in human-facing descriptions (only in structured data like `target.selector`).
- Message detection must include deduplication (`text + url`, 1500ms window) and ignore empty/hidden-only text.
- JSON output must match the schema in `requirements.md` section `6`, including action-specific conditional fields.
- Respect explicit v1 out-of-scope items (iframe, Shadow DOM traversal, full-page capture, masking, assertions, icon creation).

## Required implementation process (TDD)

For implementation tasks in this repository, always follow this cycle:

1. Write test code first.
2. Run tests and confirm **RED**.
3. Implement production code.
4. Run tests and confirm **GREEN**.
5. Refactor while keeping tests green.
6. Repeat the RED → GREEN → REFACTOR cycle until the current scope is complete.
7. Run all tests for the current scope.
8. If this run is **RED**, fix the code/tests and return to **GREEN** before finishing.
