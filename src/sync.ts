import { Book } from './types.js';

/**
 * Google Apps Script Web App that appends each ISBN to the `+add` tab of the
 * shop's Google Sheet. The script itself is `apps-script/Code.gs` in this
 * repo — the two halves of one contract, so change them together.
 *
 * Hardcoded rather than user-configured: this build serves one shop and one
 * Sheet, so there is nothing for staff to fill in. The URL ships in the public
 * bundle and anyone who reads it can POST to it, which is why Code.gs only
 * accepts a valid 978/979 ISBN-13 and nothing else.
 *
 * Empty string means sync is off.
 */
const SYNC_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzOgPWLAS-G47kW7ug48qwpnHcQLIzzCFIVPzve3O8FqKDC5EGaabopUGx4gBc9ju01Zg/exec';

/**
 * How long to wait for Code.gs to answer before calling the attempt failed.
 * Apps Script cold starts take a few seconds; well past that, the shop-floor
 * connection has most likely dropped.
 */
const SYNC_TIMEOUT_MS = 20000;

/** What Code.gs reported for one book, or why no report came back. */
export type SyncResult =
	| { ok: true; row: number }
	| { ok: false; error: string };

/**
 * Service for syncing books to the shop's Google Sheet via Apps Script.
 */
export class SyncService {
	/**
	 * POST one book to Code.gs and return what it wrote.
	 *
	 * This is an ordinary, readable CORS request. A POST with a `text/plain`
	 * body is a "simple" request, so the browser skips the preflight Apps
	 * Script can't answer, follows Apps Script's 302 to
	 * script.googleusercontent.com, and that response carries
	 * `Access-Control-Allow-Origin: *` (verified from the live site on
	 * 2026-09-15). So `ok: true` means Code.gs confirmed the row, not merely
	 * that the request left the phone. Don't change the Content-Type to
	 * application/json: that forces a preflight and every sync fails.
	 *
	 * The book id goes along so Code.gs can recognise a retry of a write that
	 * succeeded but whose reply was lost, and answer with the original row
	 * instead of adding a duplicate.
	 */
	static async syncBook(book: Book): Promise<SyncResult> {
		if (!SYNC_WEB_APP_URL) {
			return { ok: false, error: '尚未設定同步網址' };
		}

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

		try {
			const response = await fetch(SYNC_WEB_APP_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'text/plain;charset=utf-8' },
				body: JSON.stringify({ isbn: book.isbn, id: book.id }),
				signal: controller.signal
			});

			if (!response.ok) {
				return { ok: false, error: `Sheet 回應 HTTP ${response.status}` };
			}

			let data: { status?: string; row?: unknown; message?: string };
			try {
				data = await response.json();
			} catch {
				// Not JSON: typically Google's "authorization needed" page,
				// meaning the owner has to authorize the script again.
				return { ok: false, error: 'Sheet 回應異常（Apps Script 可能要重新授權）' };
			}

			if (data.status === 'ok' && typeof data.row === 'number') {
				return { ok: true, row: data.row };
			}
			return { ok: false, error: data.message || 'Sheet 沒有寫入' };
		} catch (error) {
			console.error('Sync failed:', error);
			return {
				ok: false,
				error: controller.signal.aborted ? '逾時，沒收到 Sheet 回覆' : '連線失敗（網路或 Sheet 權限）'
			};
		} finally {
			clearTimeout(timer);
		}
	}
}
