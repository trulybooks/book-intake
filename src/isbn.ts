/**
 * ISBN normalization and validation.
 *
 * Single source of truth for both entry paths (camera scan and manual typing),
 * so the same book always produces the same string. That matters because the
 * synced Google Sheet is the system of record: if a scan wrote
 * `9789573317249` and manual entry wrote `957-33-1724-3` for the same book,
 * the Sheet would carry two unmatchable keys for one title.
 *
 * Canonical form is ISBN-13, digits only. ISBN-10 input is converted (see
 * `isbn10To13`) rather than rejected — old stock still carries ISBN-10 on the
 * copyright page.
 */

/** Why a candidate string is not a usable ISBN. */
export type IsbnRejection =
	| 'empty'
	| 'bad-characters'
	| 'bad-length'
	| 'bad-checksum'
	| 'not-bookland';

export type IsbnResult =
	| { ok: true; isbn: string }
	| { ok: false; reason: IsbnRejection };

/** Human-readable explanation for each rejection, for toasts and scanner status. */
export const ISBN_REJECTION_MESSAGES: Record<IsbnRejection, string> = {
	'empty': 'ISBN is required',
	'bad-characters': 'ISBN may only contain digits (and a trailing X)',
	'bad-length': 'ISBN must be 10 or 13 digits',
	'bad-checksum': 'ISBN check digit is wrong - re-check the number',
	'not-bookland': 'Not a book barcode (must start 978 or 979)'
};

/**
 * Strip the separators people actually type or that appear in print: ASCII
 * hyphen, the Unicode dash range (U+2010-U+2015, which is what you get when a
 * number is copied out of a PDF or a word processor), whitespace, and the
 * non-breaking space. Anything else is left in place so it gets reported as
 * `bad-characters` rather than silently discarded.
 */
export function normalizeIsbn(raw: string): string {
	return raw.replace(/[\s\u00a0\u2010-\u2015-]/g, '').toUpperCase();
}

/** ISBN-10 check: sum of digit x (10..1) must be divisible by 11, X = 10. */
function isValidIsbn10(isbn: string): boolean {
	let sum = 0;
	for (let i = 0; i < 10; i++) {
		const char = isbn[i];
		const value = char === 'X' ? 10 : char.charCodeAt(0) - 48;
		sum += value * (10 - i);
	}
	return sum % 11 === 0;
}

/** EAN-13 check digit: alternating weights 1 and 3 over the first 12 digits. */
function isbn13CheckDigit(first12: string): string {
	let sum = 0;
	for (let i = 0; i < 12; i++) {
		sum += (first12.charCodeAt(i) - 48) * (i % 2 === 0 ? 1 : 3);
	}
	return String((10 - (sum % 10)) % 10);
}

/** Convert a valid ISBN-10 to its ISBN-13 equivalent (Bookland prefix 978). */
export function isbn10To13(isbn10: string): string {
	const body = '978' + isbn10.slice(0, 9);
	return body + isbn13CheckDigit(body);
}

/**
 * Parse arbitrary user or scanner input into a canonical ISBN-13.
 *
 * To keep ISBNs exactly as entered instead of converting ISBN-10 to ISBN-13,
 * return `{ ok: true, isbn: cleaned }` from the ISBN-10 branch below.
 */
export function parseIsbn(raw: string): IsbnResult {
	const cleaned = normalizeIsbn(raw);

	if (!cleaned) return { ok: false, reason: 'empty' };

	// X is only legal as the ISBN-10 check character, never mid-number.
	if (!/^\d*X?$/.test(cleaned)) return { ok: false, reason: 'bad-characters' };

	if (cleaned.length === 10) {
		if (!isValidIsbn10(cleaned)) return { ok: false, reason: 'bad-checksum' };
		return { ok: true, isbn: isbn10To13(cleaned) };
	}

	if (cleaned.length === 13) {
		if (cleaned.includes('X')) return { ok: false, reason: 'bad-characters' };
		// 978/979 is the Bookland range. A 13-digit barcode outside it is a
		// regular retail product (or a Taiwanese 471... article code), not a book.
		if (!/^97[89]/.test(cleaned)) return { ok: false, reason: 'not-bookland' };
		if (!isbn13ChecksumOk(cleaned)) return { ok: false, reason: 'bad-checksum' };
		return { ok: true, isbn: cleaned };
	}

	return { ok: false, reason: 'bad-length' };
}

function isbn13ChecksumOk(isbn: string): boolean {
	return isbn13CheckDigit(isbn.slice(0, 12)) === isbn[12];
}
