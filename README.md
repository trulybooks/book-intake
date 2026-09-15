**If not obvious, I'm letting you know this application was vibe-coded in 30 minutes, but it solves my problem and maybe yours too; feel free to improve it to meet your neds. I may look at PRs, but you'll likely just want to fork instead**

# BookScan - Mobile ISBN Scanner

A mobile-friendly web application for scanning ISBN barcodes into a list that is sent automatically to a Google Sheet. Built with TypeScript and HTML5; the list itself is stored locally using localStorage.

## Features

- 📷 **Barcode Scanning**: Scan ISBN/EAN-13 barcodes using device camera
- 🔍 **ISBN Capture**: Scanned ISBNs are recorded directly — no book-details lookup, no third-party book APIs
- ✏️ **Manual Entry**: Add books manually if scanning isn't available
- ✅ **ISBN Validation**: Check digits are verified and everything is stored as a canonical ISBN-13, so a typo never reaches your Sheet
- 📱 **Mobile-First Design**: Touch-friendly interface optimized for small screens
- 💾 **Local Storage**: All data stored locally, no backend required
- 🚀 **Offline-Ready**: Scanning and local storage work without internet (Google Sheet sync needs a connection)
- 🔄 **Google Sheet Sync**: Every scanned/added ISBN is sent automatically to the shop's Google Sheet via a Google Apps Script Web App — nothing to set up on the phone

## Technologies Used

- **TypeScript**: Type-safe JavaScript
- **HTML5 & CSS3**: Modern web standards
- **zxing-wasm**: Barcode scanning via zxing-cpp compiled to WebAssembly (reliable EAN-13 decoding on iOS and Android alike)
- **localStorage**: Client-side data persistence

## Project Structure

```
bookScan/
├── src/
│   ├── app.ts          # Main application logic
│   ├── types.ts        # TypeScript interfaces
│   ├── storage.ts      # localStorage management
│   ├── scanner.ts      # Barcode scanning service
│   ├── isbn.ts         # ISBN normalization/validation
│   ├── export.ts       # CSV export
│   ├── sync.ts         # Google Sheet sync (Apps Script Web App)
│   └── utils.ts        # UI utilities
├── apps-script/
│   └── Code.gs         # Apps Script half of the sync (pasted into the Sheet)
├── dist/               # Compiled JavaScript (generated)
├── index.html          # Main HTML file
├── styles.css          # Mobile-first CSS
├── package.json        # Dependencies
└── tsconfig.json       # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Modern web browser with camera support

### Installation

1. Install dependencies:
```bash
npm install
```

2. Compile TypeScript:
```bash
npm run build
```

### Running the Application

#### Development Mode

Watch for changes and recompile automatically:
```bash
npm run watch
```

Then serve the application using a local web server:
```bash
npm run serve
```

Open your browser to `http://localhost:8080`

#### Production

For production deployment, simply host the following files on any web server:
- `index.html`
- `styles.css`
- `dist/` directory (includes `zxing_reader.wasm`, copied there by `npm run build`)

> **Note**: For camera access, your site must be served over HTTPS (except for localhost during development).

## Usage

### Adding Books

#### Via Barcode Scanning

1. Click "**📷 Scan Book**"
2. Grant camera permissions if prompted
3. Point camera at ISBN barcode
4. The ISBN is added to the top of the list and sent to the Google Sheet

#### Manual Entry

Use this when scanning isn't available (no camera, damaged barcode, etc.).

1. Click "**✏️ Add Manually**"
2. Type the ISBN — hyphens and spaces are fine, and ISBN-10 is accepted
3. Click "**Add Book**" (or just press Enter)

The ISBN is validated before anything is saved: a wrong check digit, a wrong
length, or a non-book barcode is rejected with a message explaining which,
instead of being added to the list and sent to the Sheet.

### Managing Books

- **Delete**: Click the 🗑️ icon on any book card. This only removes it from this device's
  list — the row already sent to the Google Sheet stays there.

## Supported Barcodes

- ISBN-13 (EAN-13) with a `978` or `979` prefix
- ISBN-10 (manual entry; converted to its ISBN-13 equivalent when stored)

The scanner is specifically configured to recognize ISBN barcodes used on books.
Everything is normalized to **ISBN-13, digits only**, before being stored or
synced, so a book scanned from its barcode and the same book typed in by hand
produce an identical value in your Sheet.

A 13-digit barcode outside the `978`/`979` Bookland range is a general retail
product code (in Taiwan, typically one starting `471`), not a book — the scanner
reports it in the status line and keeps scanning rather than recording it. If you
need to stock-take non-book items this way, that check lives in `parseIsbn()` in
`src/isbn.ts`.

## API Usage

There is deliberately **no book-details lookup**: a scan records the ISBN itself (locally
and to the synced Google Sheet). Book metadata lives in the Sheet, which is the system of
record — earlier versions fetched details from Google Books, but Google reduced the
keyless quota to zero and the lookup added failure modes for no benefit to this workflow.

### Google Sheet Sync

BookScan is a static site with no backend, so it can't safely hold a Google service-account
key. Instead, every scanned or typed ISBN is POSTed to a **Google Apps Script Web App**
bound to the shop's Sheet. The script is [`apps-script/Code.gs`](apps-script/Code.gs); the
Web App URL is hardcoded as `SYNC_WEB_APP_URL` in `src/sync.ts`, so there is nothing to
configure on the phone — open the page and scan.

**Where the ISBN lands**: the `+add` tab, in the next empty row (`getLastRow() + 1`), written
into both column A (`編號`) and column G (`ISBN`) as plain text — the same shape as the rows
already there. Every other column is left for the book-details update step to fill in.

**One-time setup**:

1. The spreadsheet must be a native **Google Sheet**. An uploaded `.xlsx` opened in Sheets
   (its URL has `rtpof=true`, and the title shows an `.XLSX` badge) can't host Apps Script —
   use **File → Save as Google Sheets** first, and use the new file from then on.
2. In that Google Sheet: **Extensions → Apps Script**, replace the editor contents with
   `apps-script/Code.gs`, and save.
3. **Deploy → New deployment** → type **Web app** → Execute as **Me** → Who has access
   **Anyone**. Authorize when asked.
4. Open the resulting `.../exec` URL in a browser. It should answer
   `{"status":"ok","sheet":"+add","found":true,...}` — a read-only check that the script can
   see the tab; it writes nothing.
5. Put that URL in `SYNC_WEB_APP_URL` in `src/sync.ts`, then build and deploy.

**Payload sent per book**: just `{ "isbn": "9786267891124" }`. `Code.gs` rejects anything that
isn't a 978/979 ISBN-13, because the Web App URL is in the public JavaScript bundle and anyone
who reads it could POST to it. It also takes a script lock around the write, so two scans a
second apart can't land on the same row.

**When it fires**: `SyncService.syncBook()` is called from `handleScannedISBN()` and
`handleAddManualBook()` in `app.ts`, both *after* the book is saved locally — a failed or slow
sync never blocks adding the book.

**Important limitation**: Apps Script Web Apps don't return browser-readable CORS responses,
so the app sends the request with `mode: 'no-cors'` and can't read the result. A "synced"
toast only confirms the request went out — not that Apps Script actually wrote the row. Check
the Sheet directly if in doubt.

**If you edit `Code.gs` later**: saving the script does *not* update the deployed Web App. Go
to **Deploy → Manage deployments** → edit (pencil icon) → **Version: New version** →
**Deploy**. Editing the existing deployment keeps the same URL; creating a *new* deployment
produces a new URL, which would then have to go into `src/sync.ts`.

## Browser Compatibility

- ✅ Chrome/Edge (Android/Desktop)
- ✅ Safari (iOS/macOS)
- ✅ Firefox (Android/Desktop)
- ⚠️ Requires camera permissions for scanning

## Mobile Optimization

- Minimum tap target size: 48×48px
- Large, easy-to-tap buttons
- Responsive grid layout
- Touch-friendly gestures
- No accidental text selection
- Optimized viewport for mobile devices

## Data Storage

All data is stored in browser localStorage:
- **Key**: `bookScan_books`
- **Format**: JSON array of `{ id, isbn, addedDate }`
- Earlier versions grouped books into collections under `bookScan_collections`; that key is no longer read
- **Persistence**: Data persists until explicitly cleared by user
- **Capacity**: Typically 5-10MB per domain (browser-dependent)

## Remaining Tasks

See TODO.md for detailed implementation tasks and future enhancements.

## Known Limitations

1. **Storage**: Limited by browser localStorage capacity
2. **Offline**: Sync to Google Sheets needs an internet connection (scans still record locally)
3. **Camera**: Requires device with camera and HTTPS connection
4. **Import**: CSV export is supported, but there's no import path back in yet
5. **No book metadata**: scans record the ISBN only — titles/authors etc. live in your Sheet
6. **Sync confirmation**: Google Sheet sync can't confirm the write succeeded (see Google Sheet Sync section above)
7. **Deleting is local only**: removing a book in the app doesn't remove its row from the Sheet

## Future Enhancements

- [ ] Import books from JSON or CSV
- [ ] Barcode scanning from image files
- [ ] Book cover upload for manual entries
- [ ] Search the book list
- [ ] Sort and filter options
- [ ] Statistics and reading progress tracking
- [ ] Dark mode support
- [ ] PWA support for offline functionality
- [ ] Bulk operations (delete multiple books)

## Troubleshooting

### Camera Not Working

- Ensure you're accessing via HTTPS (or localhost)
- Grant camera permissions in browser settings
- Check if other apps can access the camera
- Try a different browser

### Barcode Won't Scan

- Hold the phone steady ~15–20 cm from the barcode and let the camera focus
- Make sure the whole barcode fits inside the scan box
- Improve lighting; avoid glare on glossy covers
- Fall back to "✏️ Add Manually" and type the ISBN

### Storage Full

- Clear browser cache and data
- Export to CSV first (📥 button) to keep a backup
- Remove books you no longer need from the list (the Sheet keeps them)

## License

MIT License - Feel free to use and modify for your projects.

## Contributing

Contributions welcome! Please feel free to submit issues or pull requests.

## Acknowledgments

- [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) / [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp)
