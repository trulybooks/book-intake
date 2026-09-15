/**
 * @OnlyCurrentDoc
 * Limits the authorization prompt to this one spreadsheet instead of all of
 * the owner's spreadsheets. The Web App runs as the owner and is open to
 * Anyone, so it should hold no more access than it needs.
 */

/**
 * BookScan → Google Sheet「+add」分頁
 *
 * BookScan 每新增一本書，就 POST {"isbn": "978…"} 到這個 Web App。
 * 這裡把 ISBN 寫進「+add」分頁的下一個空白列，A 欄（編號）和 G 欄（ISBN）
 * 都填，跟既有資料的格式一致。書名、作者、定價等欄位留空，交給後續的
 * 書籍更新流程補齊。
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
  var isbn;
  try {
    isbn = String(JSON.parse(e.postData.contents).isbn || '').trim();
  } catch (err) {
    return json_({ status: 'error', message: 'Body is not JSON' });
  }

  // The Web App URL ships in BookScan's public bundle, so accept nothing but a
  // well-formed ISBN-13. The app already canonicalizes every entry to that.
  if (!/^97[89]\d{10}$/.test(isbn)) {
    return json_({ status: 'error', message: 'Not an ISBN-13: ' + isbn });
  }

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) {
    return json_({ status: 'error', message: 'No tab named ' + SHEET_NAME });
  }

  // Two scans a second apart would otherwise both read the same getLastRow()
  // and the second write would land on top of the first.
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var row = sheet.getLastRow() + 1;
    ISBN_COLUMNS.forEach(function (col) {
      // Plain text, matching the existing rows — as a number Sheets would
      // display 9786267891124 as 9.78627E+12.
      sheet.getRange(row, col).setNumberFormat('@').setValue(isbn);
    });
    SpreadsheetApp.flush();
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
