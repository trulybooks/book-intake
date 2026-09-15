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
}
