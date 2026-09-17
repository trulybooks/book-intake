/**
 * @OnlyCurrentDoc
 * Limits the authorization prompt to this one spreadsheet instead of all of
 * the owner's spreadsheets. The Web App runs as the owner and is open to
 * Anyone, so it should hold no more access than it needs.
 */

/**
 * 書籍入庫 App ＆ /線上書籍更新 → Google Sheet「+add」分頁
 *
 * 這支 Web App 有兩種呼叫方式：
 *
 * 1. 掃描（沒有 action 欄位，不需要密鑰）
 *    書籍入庫 App 每新增一本書，就 POST {"isbn": "978…", "id": "…"}。
 *    這裡把 ISBN 寫進「+add」分頁的下一個空白列，A 欄（編號）和 G 欄（ISBN）
 *    都填，跟既有資料的格式一致。回覆 {"status":"ok","row":N}，App 據此顯示
 *    「已寫入第 N 列」。同一個 id 在 6 小時內重傳，只回報原本那一列，不會重複寫入。
 *    手機網頁是公開的，放不了密鑰，所以這條路只准做一件事：新增一列格式正確的 ISBN-13。
 *
 * 2. 管理動作（有 action 欄位，一定要帶密鑰）
 *    給本機的 scripts/gsheet.py（/線上書籍更新）用：
 *      ping        確認部署的是這一版
 *      fill        用 ISBN 找列，只補 A–H 欄的空白格
 *      deleteRows  刪除重複列，刪之前逐列核對 ISBN
 *    密鑰放在「專案設定 → 指令碼屬性」的 API_TOKEN。沒有設定時，管理動作一律拒絕。
 *
 * 部署（只需做一次）：
 *   1. 這份試算表必須是「Google 試算表」格式，不能是 .xlsx
 *   2. 擴充功能 → Apps Script → 把這整份貼上 → 儲存
 *   3. 部署 → 新增部署作業 → 類型：網頁應用程式
 *      執行身分：我　／　誰可以存取：所有人
 *   4. 複製產生的 …/exec 網址
 *
 * 之後若修改這份程式：部署 → 管理部署作業 → 編輯（鉛筆）→
 * 版本：新版本 → 部署。只按儲存的話，線上網址仍然跑舊程式；
 * 按「新增部署作業」會產生新的網址，App 和 gsheet.py 都得跟著改。
 *
 * Three clients depend on this file: BookScan's src/sync.ts (scan appends),
 * scripts/gsheet.py (fill / deleteRows / ping) and anyone polling doGet.
 * Change them together.
 */

var SHEET_NAME = '+add';
var ISBN_COLUMNS = [1, 7]; // A = 編號, G = ISBN — what a scan writes
var ISBN_COLUMN = 7;       // G, the key every management action matches on
var FILL_COLUMN = /^[A-H]$/;
var MAX_FILL_ITEMS = 50;
var VERSION = 'books-v1';

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ status: 'error', error: 'bad_json', message: '資料格式錯誤（不是 JSON）' });
  }

  // Anything naming an action is a management call and must never fall
  // through to the tokenless scan path below.
  if (data && data.action) {
    return json_(handleAction_(data));
  }
  return appendScan_(data);
}

/**
 * Read-only health check: open the Web App URL in a browser to confirm the
 * deployment can see the tab. Writes nothing.
 */
function doGet() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  return json_({
    status: sheet ? 'ok' : 'error',
    sheet: SHEET_NAME,
    found: !!sheet,
    lastRow: sheet ? sheet.getLastRow() : null,
    version: VERSION
  });
}

// ---------------------------------------------------------------------------
// 1. Scan append (BookScan app, no token)
// ---------------------------------------------------------------------------

function appendScan_(data) {
  var isbn = String((data && data.isbn) || '').trim();

  // Per-scan id from the app, used to make retries idempotent. Optional:
  // anything malformed is ignored rather than rejected.
  var id = String((data && data.id) || '');
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id)) id = '';

  // The Web App URL ships in BookScan's public bundle, so accept nothing but a
  // well-formed ISBN-13. The app already canonicalizes every entry to that.
  if (!/^97[89]\d{10}$/.test(isbn)) {
    return json_({ status: 'error', message: '不是有效的 ISBN-13：' + isbn });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return json_({ status: 'error', message: '找不到分頁：' + SHEET_NAME });
  }

  // Two scans a second apart would otherwise both read the same getLastRow()
  // and the second write would land on top of the first.
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // A retry of a write that already happened — its reply was lost on the
    // way back to the phone. Report the original row instead of adding a
    // duplicate. Checked inside the lock so two retries can't both miss it.
    // The script cache keeps entries for at most 6 hours.
    var cache = CacheService.getScriptCache();
    var seenRow = id ? cache.get('scan:' + id) : null;
    if (seenRow) {
      return json_({ status: 'ok', row: Number(seenRow), isbn: isbn, duplicate: true });
    }

    var row = sheet.getLastRow() + 1;
    ISBN_COLUMNS.forEach(function (col) {
      // Plain text, matching the existing rows — as a number Sheets would
      // display 9786267891124 as 9.78627E+12.
      sheet.getRange(row, col).setNumberFormat('@').setValue(isbn);
    });
    SpreadsheetApp.flush();
    if (id) cache.put('scan:' + id, String(row), 21600);
    return json_({ status: 'ok', row: row, isbn: isbn });
  } finally {
    lock.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// 2. Management actions (gsheet.py, token required)
// ---------------------------------------------------------------------------

function handleAction_(data) {
  if (!tokenOk_(data.token)) {
    return { status: 'error', error: 'unauthorized' };
  }

  if (data.action === 'ping') {
    var tab = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    return { status: 'ok', version: VERSION, actions: ['fill', 'deleteRows'], lastRow: tab ? tab.getLastRow() : null };
  }
  if (data.action !== 'fill' && data.action !== 'deleteRows') {
    return { status: 'error', error: 'unknown_action' };
  }
  if (data.sheet !== SHEET_NAME) {
    return { status: 'error', error: 'sheet_not_allowed' };
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return { status: 'error', error: 'sheet_not_found' };
  }

  // One lock around the whole batch, shared with scan appends, so rows can't
  // be added, filled or deleted underneath a batch that is mid-way through.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { status: 'error', error: 'busy' };
  }
  try {
    return data.action === 'fill' ? fill_(sheet, data.items) : deleteRows_(sheet, data.rows);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Compares every character regardless of where the first mismatch is, so the
 * response time doesn't reveal how much of a guessed token was right.
 */
function tokenOk_(given) {
  var expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (!expected || typeof given !== 'string' || given.length !== expected.length) return false;
  var diff = 0;
  for (var i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * ISBNs pasted in by hand are often stored as numbers, or come back as
 * "9789865081645.0" or with a leading apostrophe. Without this, lookups by
 * ISBN silently miss those rows.
 */
function normIsbn_(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return v % 1 === 0 ? String(v) : '';
  var s = String(v).trim().replace(/^'+/, '');
  if (/^\d+\.0+$/.test(s)) s = s.split('.')[0];
  return s;
}

/** Normalized ISBN in column G → every data row holding it. */
function indexRows_(sheet) {
  var index = {};
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return index;
  var values = sheet.getRange(2, ISBN_COLUMN, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    var isbn = normIsbn_(values[i][0]);
    if (isbn) (index[isbn] = index[isbn] || []).push(i + 2);
  }
  return index;
}

function fill_(sheet, items) {
  if (!Array.isArray(items)) {
    return { status: 'error', error: 'items_required' };
  }
  if (items.length > MAX_FILL_ITEMS) {
    return { status: 'error', error: 'too_many_items', max: MAX_FILL_ITEMS };
  }
  var index = indexRows_(sheet);
  var results = items.map(function (item) { return fillOne_(sheet, index, item); });
  SpreadsheetApp.flush();
  return { status: 'ok', results: results };
}

/**
 * Finds the row by ISBN — never by row number, since people edit the sheet
 * while a run is in progress — and writes only cells that are empty right
 * now, so nothing typed in by hand is ever overwritten.
 */
function fillOne_(sheet, index, item) {
  var isbn = normIsbn_(item && item.isbn);
  var result = { isbn: isbn, row: null, written: [], skipped: [], rejected: [], error: null };
  if (!isbn) {
    result.error = 'no_isbn';
    return result;
  }
  var rows = index[isbn] || [];
  if (rows.length === 0) {
    result.error = 'not_found';
    return result;
  }
  if (rows.length > 1) {
    // Filling every copy would turn duplicates into convincing-looking data.
    result.error = 'ambiguous';
    result.rows = rows;
    return result;
  }
  result.row = rows[0];

  var fields = (item && item.fields) || {};
  Object.keys(fields).forEach(function (col) {
    var value = fields[col];
    if (!FILL_COLUMN.test(col) || (typeof value !== 'string' && typeof value !== 'number') || String(value) === '') {
      result.rejected.push(col);
      return;
    }
    var cell = sheet.getRange(col + result.row);
    if (cell.getValue() !== '') {
      result.skipped.push(col);
      return;
    }
    var text = String(value);
    // A leading "=" is stored as a formula even in a text-formatted cell.
    if (text.charAt(0) === '=') text = "'" + text;
    // Text format first, or ISBNs and prices turn into numbers (9.78627E+12).
    cell.setNumberFormat('@').setValue(text);
    result.written.push(col);
  });
  return result;
}

/**
 * Deletes duplicate rows the client has already chosen (it keeps the most
 * complete copy). Every row is re-checked here first: if either the row to
 * drop or the row to keep no longer holds that ISBN, row numbers have moved
 * since the client looked, so that request is skipped rather than guessed at.
 */
function deleteRows_(sheet, rows) {
  if (!Array.isArray(rows)) {
    return { status: 'error', error: 'rows_required' };
  }
  var lastRow = sheet.getLastRow();
  var isbnAt = function (r) {
    return r >= 2 && r <= lastRow ? normIsbn_(sheet.getRange(r, ISBN_COLUMN).getValue()) : '';
  };

  var keepRows = {};
  rows.forEach(function (req) {
    if (req) keepRows[Number(req.keep_row)] = true;
  });

  var toDelete = [];
  var skipped = [];
  rows.forEach(function (req) {
    var row = Number(req && req.row);
    var keep = Number(req && req.keep_row);
    var isbn = normIsbn_(req && req.isbn);
    if (!isWholeRow_(row) || !isWholeRow_(keep) || row === keep || !isbn) {
      skipped.push({ row: req ? req.row : null, reason: 'invalid' });
      return;
    }
    // Never delete a row another request is relying on as the copy to keep —
    // two requests pointing at each other would otherwise remove both.
    if (keepRows[row]) {
      skipped.push({ row: row, reason: 'is_keep_row' });
      return;
    }
    if (isbnAt(row) !== isbn || isbnAt(keep) !== isbn) {
      skipped.push({ row: row, reason: 'mismatch' });
      return;
    }
    if (toDelete.indexOf(row) === -1) toDelete.push(row);
  });

  // Bottom-up, or each deletion shifts the rows below it.
  toDelete.sort(function (a, b) { return b - a; });
  toDelete.forEach(function (r) { sheet.deleteRow(r); });
  return { status: 'ok', deleted: toDelete, skipped: skipped };
}

function isWholeRow_(n) {
  return typeof n === 'number' && n % 1 === 0 && n >= 2;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
