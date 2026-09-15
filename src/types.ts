/** Outcome of the last attempt to write a book to the Google Sheet. */
export type SyncStatus = 'pending' | 'synced' | 'failed';

/**
 * A single scanned or typed book. The ISBN is the whole record — title,
 * author and the rest live in the Google Sheet it syncs to, which is the
 * system of record (see CLAUDE.md).
 */
export interface Book {
	id: string;
	/** Canonical ISBN-13, as returned by `parseIsbn()` in isbn.ts. */
	isbn: string;
	addedDate: string;
	/** Absent on books added before sync results were recorded. */
	syncStatus?: SyncStatus;
	/** Sheet row Code.gs reported writing, when synced. */
	syncedRow?: number;
	/** Why the last attempt failed, when failed. */
	syncError?: string;
	/** When the last attempt started (pending) or finished. */
	syncAt?: string;
}
