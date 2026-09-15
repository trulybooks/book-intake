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

See `ARCHITECTURE.md` for the full breakdown. Short version: `src/app.ts` coordinates UI events and calls into `storage.ts` (localStorage CRUD), `scanner.ts` (zxing-wasm barcode decoding), `isbn.ts` (ISBN normalization/validation), `sync.ts` (fire-and-forget POST to a user-supplied Google Apps Script Web App), and `export.ts` (CSV export). All state lives in browser localStorage under `bookScan_books` — one flat list. There are no collections (removed 2026-09-14 at the shop's request; the old `bookScan_collections` key is no longer read) and no settings screen: the sync endpoint is the `SYNC_WEB_APP_URL` constant in `sync.ts`.

## Key design decision: no book-details lookup

Scanning a barcode records the **ISBN only** — there is deliberately no call to Google Books, OpenLibrary, or any other book-metadata API. Earlier versions did this lookup; it was removed (commit `45e73e1`) after Google cut the keyless quota to zero, and because the lookup added failure modes without benefit to this workflow. The Google Sheet (if sync is enabled) is the system of record for title/author/etc. Manual entry (`modal-add-book`) mirrors this: it's ISBN-only too. A `Book` is just `{ id, isbn, addedDate }`.

Do not reintroduce a book-details API call as a "quick fix" — it was removed on purpose. If you see stale references to fetching book details elsewhere in the repo, that's docs/comments lagging behind this decision; fix the doc, not the code.

## ISBN handling: one parser, canonical ISBN-13

`src/isbn.ts` is the only place that decides whether a string is a usable ISBN.
Both `ScannerService` (barcode results) and `handleAddManualBook` (typed input)
call `parseIsbn()` and store what it returns — never the raw input. It strips
hyphens/spaces/Unicode dashes, verifies the ISBN-10 or EAN-13 check digit,
rejects 13-digit barcodes outside the 978/979 Bookland range, and converts
ISBN-10 to its ISBN-13 equivalent.

The ISBN-10 → ISBN-13 conversion is deliberate: the Sheet is the system of
record, so the same book must produce the same key whether it was scanned or
typed. If a workflow ever needs the ISBN exactly as entered, change the ISBN-10
branch of `parseIsbn` (it is commented) rather than adding a second parser.

## Sync limitation (real, not a bug)

`sync.ts` POSTs with `mode: 'no-cors'` because Apps Script Web Apps don't return readable CORS responses. This means the app can only detect network-level send failures, never whether the Apps Script code actually wrote the row. Don't try to "fix" this by reading the response — it's opaque by design of Apps Script, not this codebase.

The payload is just `{ isbn }` — nothing else. The paired Apps Script is `apps-script/Code.gs`: bound to the shop's Sheet, it writes the ISBN as plain text into columns A (`編號`) and G (`ISBN`) of the `+add` tab at `getLastRow() + 1`, under a script lock, and rejects anything that isn't a 978/979 ISBN-13 (the Web App URL ships in the public bundle, so the script is the only gatekeeper). `src/sync.ts` and `Code.gs` are two halves of one contract — change them together, and redeploy `Code.gs` as a **new version** of the existing deployment, or the live URL keeps running the old code.
