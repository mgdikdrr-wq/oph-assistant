# My Ophthalmology Assistant — Developer Notes

Zero-dependency offline PWA. No build step: plain HTML/CSS/JS served as static files.

## Architecture
- `index.html` — shell, loads all scripts in dependency order, registers `sw.js`.
- `sw.js` — precaches every asset (CACHE name = version; bump it on every release to force refresh; skipWaiting + clients.claim, old caches purged on activate). Patient data is NOT in the cache; it lives in IndexedDB, so updates never touch it.
- `manifest.webmanifest` + icons/ — install/standalone metadata (relative paths: works on a GitHub Pages subpath).
- `js/crypto.js` — AES-256-GCM primitives. Device key generated once (`crypto.subtle.generateKey`, non-extractable) and stored in the `kv` store. No key material in source code.
- `js/db.js` — IndexedDB layer (`sessions`, `patients`, `kv`). Patient and session records are sealed (AES-GCM) before write; only id/sessionId/updatedAt stay readable for indexing. Read path transparently decrypts and tolerates legacy plaintext rows.
- `js/app.js` — state, autosave (every edit writes immediately; dirty-map flush on pagehide/background), routing (`go(view)`), boot (opens DB, requests persistent storage).
- `js/data.js` — all medical option lists (factory defaults; user edits persist in `kv.options`).
- `js/ui.js` — quick-pick chips (search, custom entries, lens grading composition).
- `js/patient.js` `js/exam.js` `js/surgery.js` — split view, 7 tabs, dual-eye exam, surgical prep + review checklist.
- `js/slist.js` — surgical list (official column order), pulls live from sheets (operative eye only).
- `js/export-svg.js` — deterministic SVG renderer: sheet A4 portrait, list A4 landscape paginated. RTL text-anchor swap handled in `text()`.
- `js/export.js` — SVG→canvas→PNG/JPEG/PDF (jsPDF vendored in `js/vendor/`). Canvas pixel cap ~16MP for iPadOS Safari; downloads staggered 350ms for iOS.
- `js/transcribe.js` — transcription mode (official-form view, zoom, keep-awake, counters).
- `js/settings.js` — settings + AES-GCM/PBKDF2 (150k iters, random salt/IV) backup export/import; backup carries decrypted data inside its encrypted envelope so restore works after a full wipe.
- `js/lock.js` — optional numeric passcode lock (off by default), auto-lock, privacy cover.

## Conventions
- Patient model: `OPH_DB.newPatient` is the single source of the record shape; extend there.
- Never store clinical data in localStorage or send it anywhere; there are no network calls by design (test asserts zero external requests).
- SVG text: Arabic lines get `direction=rtl` and swapped text-anchor — see `text()` before editing layout.
- Bump `CACHE` in sw.js on every release.

## Tests
`test/suite.py` (Playwright + headless Chromium, serves via `test/server.py` with no-store headers) — 37 checks including offline load, at-rest encryption, wipe/restore, and SW-update data preservation. Run: `python3 test/suite.py`. `test/render.py` regenerates demo exports. Dummy data only.
