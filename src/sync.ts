import { Book } from './types.js';
import { UIUtils } from './utils.js';

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
 * Service for syncing books to the shop's Google Sheet via Apps Script.
 */
export class SyncService {
	/**
	 * Fire-and-forget POST of one book's ISBN. Apps Script Web Apps don't
	 * return browser-readable CORS responses, so `no-cors` + `text/plain` is
	 * used to avoid a failing preflight request. This means only network-level
	 * failures are distinguishable here — a resolved request confirms the
	 * browser sent it and got *some* response, not that Apps Script's doPost
	 * actually wrote the row.
	 */
	static syncBook(book: Book): void {
		if (!SYNC_WEB_APP_URL) {
			console.warn('Sync is off: SYNC_WEB_APP_URL is empty in src/sync.ts');
			return;
		}

		fetch(SYNC_WEB_APP_URL, {
			method: 'POST',
			mode: 'no-cors',
			headers: { 'Content-Type': 'text/plain' },
			body: JSON.stringify({ isbn: book.isbn })
		})
			.then(() => UIUtils.showToast('🔄 Synced to Google Sheet', 2000))
			.catch((error) => {
				console.error('Sync request failed to send:', error);
				UIUtils.showToast('⚠️ Sync request failed to send (check network)', 3000);
			});
	}
}
