/**
 * Barcode normalization and validation.
 *
 * Single source of truth for both entry paths (camera scan and manual typing),
 * so the same item always produces the same string. That matters because the
 * synced Google Sheet is the system of record: if a scan wrote
 * `9789573317249` and manual entry wrote `957-33-1724-3` for the same book,
 * the Sheet would carry two unmatchable keys for one title.
 *
 * The shop stocks non-book items too, so any well-formed retail barcode is
 * accepted — EAN-13 (including the 978/979 Bookland range used by ISBNs),
 * UPC-A and EAN-8 — and stored exactly as printed. ISBN-10 is the one
 * exception: it is converted to its ISBN-13 equivalent (see `isbn10To13`),
 * because the same book's barcode always carries the 13-digit form.
 */

/** Why a candidate string is not a usable barcode. */
export type IsbnRejection =
	| 'empty'
	| 'bad-characters'
	| 'bad-length'
	| 'bad-checksum';

export type IsbnResult =
	| { ok: true; isbn: string }
	| { ok: false; reason: IsbnRejection };

/** Human-readable explanation for each rejection, for toasts and scanner status. */
export const ISBN_REJECTION_MESSAGES: Record<IsbnRejection, string> = {
	'empty': '請輸入條碼',
	'bad-characters': '條碼只能有數字（ISBN-10 最後一碼可以是 X）',
	'bad-length': '條碼必須是 8、12 或 13 碼（ISBN-10 為 10 碼）',
	'bad-checksum': '檢查碼不對，請再核對一次號碼'
};

/**
 * Strip the separators people actually type or that appear in print: ASCII
 * hyphen, the Unicode dash range (U+2010-U+2015, which is what you get when a
 * number is copied out of a PDF or a word processor), whitespace, and the
 * non-breaking space. Anything else is left in place so it gets reported as
 * `bad-characters` rather than silently discarded.
 */
export function normalizeIsbn(raw: string): string {
	return raw.replace(/[\s ‐-―-]/g, '').toUpperCase();
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

/**
 * Check digit of an EAN-13, UPC-A or EAN-8 code. All three weight the digits
 * 3 and 1 alternately, counting leftwards from the digit next to the check
 * digit — which is why the weights start differently for even and odd lengths.
 */
function eanChecksumOk(code: string): boolean {
	const body = code.slice(0, -1);
	let sum = 0;
	for (let i = 0; i < body.length; i++) {
		sum += (body.charCodeAt(i) - 48) * ((body.length - 1 - i) % 2 === 0 ? 3 : 1);
	}
	return (10 - (sum % 10)) % 10 === code.charCodeAt(code.length - 1) - 48;
}

/** Convert a valid ISBN-10 to its ISBN-13 equivalent (Bookland prefix 978). */
export function isbn10To13(isbn10: string): string {
	const body = '978' + isbn10.slice(0, 9);
	return body + isbn13CheckDigit(body);
}

/**
 * Parse arbitrary user or scanner input into the value to store.
 *
 * ISBN-10 becomes its ISBN-13 equivalent; every other accepted code is kept
 * exactly as printed. To store ISBN-10 as typed instead, return
 * `{ ok: true, isbn: cleaned }` from the ISBN-10 branch below.
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

	// EAN-13 (books and everything else), UPC-A and EAN-8. The shop stocks
	// non-book items, so the 978/979 Bookland range is not required.
	if (cleaned.length === 13 || cleaned.length === 12 || cleaned.length === 8) {
		if (cleaned.includes('X')) return { ok: false, reason: 'bad-characters' };
		if (!eanChecksumOk(cleaned)) return { ok: false, reason: 'bad-checksum' };
		return { ok: true, isbn: cleaned };
	}

	return { ok: false, reason: 'bad-length' };
}
