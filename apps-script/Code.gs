/**
 * @OnlyCurrentDoc
 * Limits the authorization prompt to this one spreadsheet instead of all of
 * the owner's spreadsheets. The Web App runs as the owner and is open to
 * Anyone, so it should hold no more access than it needs.
 */

/**
 * BookScan → Google Sheet「+add」分頁
 *
 * BookScan 每新增一本書，就 POST {"isbn": "978…", "id": "…"} 到這個 Web App。
 * 這裡把 ISBN 寫進「+add」分頁的下一個空白列，A 欄（編號）和 G 欄（ISBN）
 * 都填，跟既有資料的格式一致。書名、作者、定價等欄位留空，交給後續的
 * 書籍更新流程補齊。回覆 {"status":"ok","row":N}，App 據此顯示「已寫入第 N 列」。
 * 同一個 id 在 6 小時內重傳，只回報原本那一列，不會重複寫入。
 *
 * 部署（只需做一次）：
 *   1. 這份試算表必須是「Google 試算表」格式，不能是 .xlsx
 *   2. 擴充功能 → Apps Script → 把這整份貼上 → 儲存
 *   3. 部署 → 新增部署作業 → 類型：網頁應用程式
 *      執行身分：我　／　誰可以存取：所有人
 *   4. 複製產生的 …/exec 網址
 *
 * 之後若修改這份程式：部署 → 管理部署作業 → 編輯（鉛筆）→
 * 版本：新版本 → 部署。只按儲存的話，線上網址仍然跑舊程式。
 *
 * This file and src/sync.ts are two halves of one contract — change them together.
 */

var SHEET_NAME = '+add';
var ISBN_COLUMNS = [1, 7]; // A = 編號, G = ISBN

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ status: 'error', message: '資料格式錯誤（不是 JSON）' });
  }
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
    lastRow: sheet ? sheet.getLastRow() : null
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
