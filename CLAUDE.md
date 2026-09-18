# BookScan

Mobile-friendly static web app for scanning ISBN barcodes into a local list that is sent automatically to the shop's Google Sheet. No backend, no build-time secrets — TypeScript bundled with esbuild, deployed as static files to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`).

## Commands

```bash
npm install
npm run build   # esbuild bundle to dist/bundle.js + copy zxing_reader.wasm
npm run watch    # same, with --watch
npm run serve    # http-server on :8080
```

No test suite or linter is configured.

## Architecture

See `ARCHITECTURE.md` for the full breakdown. Short version: `src/app.ts` coordinates UI events and calls into `storage.ts` (localStorage CRUD), `scanner.ts` (zxing-wasm barcode decoding), `isbn.ts` (ISBN normalization/validation), `sync.ts` (POST to the shop's Apps Script Web App, reading back the row it wrote), and `export.ts` (CSV export). All state lives in browser localStorage under `bookScan_books` — one flat list. There are no collections (removed 2026-09-14 at the shop's request; the old `bookScan_collections` key is no longer read) and no settings screen: the sync endpoint is the `SYNC_WEB_APP_URL` constant in `sync.ts`.

## Key design decision: no book-details lookup

Scanning a barcode records the **ISBN only** — there is deliberately no call to Google Books, OpenLibrary, or any other book-metadata API. Earlier versions did this lookup; it was removed (commit `45e73e1`) after Google cut the keyless quota to zero, and because the lookup added failure modes without benefit to this workflow. The Google Sheet (if sync is enabled) is the system of record for title/author/etc. Manual entry (`modal-add-book`) mirrors this: it's ISBN-only too. A `Book` is just `{ id, isbn, addedDate }`.

Do not reintroduce a book-details API call as a "quick fix" — it was removed on purpose. If you see stale references to fetching book details elsewhere in the repo, that's docs/comments lagging behind this decision; fix the doc, not the code.

## Barcode handling: one parser, stored as printed

`src/isbn.ts` is the only place that decides whether a string is a usable
barcode. Both `ScannerService` (barcode results) and `handleAddManualBook`
(typed input) call `parseIsbn()` and store what it returns — never the raw
input. It strips hyphens/spaces/Unicode dashes and verifies the check digit of
an ISBN-10, EAN-13, UPC-A or EAN-8.

**Non-book barcodes are recorded on purpose** (changed 2026-09-18 at the shop's
request): the 978/979 Bookland range is not required, because the shop stocks
more than books. Don't reintroduce that restriction. The check digit is still
enforced — on the phone and again in `apps-script/Code.gs`, whose URL is public —
because that is what catches a mistyped number.

The ISBN-10 → ISBN-13 conversion is the one normalization left: the Sheet is the
system of record, so the same book must produce the same key whether it was
scanned or typed. If a workflow ever needs the code exactly as entered, change
the ISBN-10 branch of `parseIsbn` (it is commented) rather than adding a second
parser.

## Sync: confirmed writes, per-book status

`sync.ts` sends an ordinary CORS POST with a `text/plain` body and **reads Code.gs's JSON reply**. A `text/plain` POST is a "simple" request (no preflight, which Apps Script can't answer); the browser follows Apps Script's 302 to `script.googleusercontent.com`, whose response carries `Access-Control-Allow-Origin: *` — verified from the live site on 2026-09-15. Earlier versions of this file claimed the response was opaque and used `mode: 'no-cors'`; that was wrong. Don't switch the Content-Type to `application/json` (it forces a preflight and every sync fails), and don't go back to `no-cors` (it throws away the confirmation).

Each `Book` records the last attempt: `syncStatus` (`pending` / `synced` / `failed`), `syncedRow`, `syncError`, `syncAt`. The book card shows it, and anything not `synced` or `pending` gets a 重傳 button. A `pending` book found at startup was cut off by a reload and is turned into `failed`. Books from before this was tracked have no `syncStatus` and show as unrecorded.

The payload is `{ isbn, id }`. The paired Apps Script is `apps-script/Code.gs`: bound to the shop's Sheet, it writes the ISBN as plain text into columns A (`編號`) and G (`ISBN`) of the `+add` tab at `getLastRow() + 1`, under a script lock, and replies `{status:'ok', row}`. It rejects anything that isn't a 978/979 ISBN-13 (the Web App URL ships in the public bundle, so the script is the only gatekeeper), and remembers each `id` → row for 6 hours in the script cache so a 重傳 of a write whose reply was lost returns the original row instead of adding a duplicate. `src/sync.ts` and `Code.gs` are two halves of one contract — change them together, and redeploy `Code.gs` as a **new version** of the existing deployment, or the live URL keeps running the old code.

## Code.gs also serves /線上書籍更新 (token-protected)

Besides the tokenless scan append, `Code.gs` exposes management actions for the shop's local `scripts/gsheet.py` (the `/線上書籍更新` command): `ping` (returns `version: "books-v1"`), `fill` (find a row by normalized ISBN in column G, write only currently blank A–H cells as text, max 50 items, duplicates → `ambiguous`) and `deleteRows` (re-checks both rows' ISBNs before deleting, bottom-up, never deletes a row another request keeps). Any request with an `action` field must carry `token`, compared against the Script Property `API_TOKEN`; with no property set every action is refused. A request with an `action` never falls through to the scan append, and a scan (no `action`) never needs the token, because the BookScan bundle is public. Bump `VERSION` in `Code.gs` and `gsheet.py` together when the management API changes.
