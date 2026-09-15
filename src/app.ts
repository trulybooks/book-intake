import { StorageService } from './storage.js';
import { ScannerService } from './scanner.js';
import { UIUtils } from './utils.js';
import { ExportService } from './export.js';
import { SyncService } from './sync.js';
import { parseIsbn, ISBN_REJECTION_MESSAGES } from './isbn.js';
import { Book } from './types.js';

/**
 * Main application class
 */
class BookScanApp {
	private scannerService: ScannerService;

	constructor() {
		this.scannerService = new ScannerService();
		this.init();
	}

	/**
	 * Initialize the application
	 */
	private init(): void {
		this.recoverInterruptedSyncs();
		this.setupEventListeners();
		this.renderBooks();
	}

	/**
	 * A send can't survive a page reload, so a book still marked pending was
	 * cut off mid-flight and its row may or may not exist. Mark it failed so
	 * it shows a 重傳 button instead of spinning forever.
	 */
	private recoverInterruptedSyncs(): void {
		StorageService.loadBooks()
			.filter(book => book.syncStatus === 'pending')
			.forEach(book => StorageService.updateBook(book.id, {
				syncStatus: 'failed',
				syncError: '傳送中斷，不確定是否已寫入'
			}));
	}

	/**
	 * Setup all event listeners
	 */
	private setupEventListeners(): void {
		document.getElementById('btn-scan-book')?.addEventListener('click', () => {
			this.startScanning();
		});

		document.getElementById('btn-add-manual')?.addEventListener('click', () => {
			UIUtils.showModal('modal-add-book');
		});

		document.getElementById('btn-export')?.addEventListener('click', () => {
			this.handleExport();
		});

		// Scanner view
		document.getElementById('btn-close-scanner')?.addEventListener('click', () => {
			this.stopScanning();
		});

		// Manual book entry modal
		document.getElementById('btn-save-book')?.addEventListener('click', () => {
			this.handleAddManualBook();
		});

		document.getElementById('btn-cancel-book')?.addEventListener('click', () => {
			UIUtils.hideModal('modal-add-book');
		});

		// Typing ISBNs is a repetitive, two-handed job during a stock take:
		// Enter must submit so the operator never has to reach for the button.
		document.getElementById('input-isbn')?.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') this.handleAddManualBook();
		});
	}

	/**
	 * Render the book list and count
	 */
	private renderBooks(): void {
		const books = StorageService.loadBooks();

		const countElement = document.getElementById('book-count');
		if (countElement) {
			countElement.textContent = `共 ${books.length} 本`;
		}

		const booksContainer = document.getElementById('books-list');
		if (!booksContainer) return;

		if (books.length === 0) {
			booksContainer.innerHTML = `
                <div class="empty-state">
                    <h3>還沒有書</h3>
                    <p>按「📷 掃描」或「✏️ 手動輸入」開始加入書籍</p>
                </div>
            `;
			return;
		}

		// Newest first: during a stock take the book you just scanned is the
		// one you want to see confirmed at the top.
		booksContainer.innerHTML = books.slice().reverse().map(book => `
            <div class="book-card" data-id="${book.id}">
                <div class="book-info">
                    <h3>${UIUtils.escapeHtml(book.isbn)}</h3>
                    <p>${UIUtils.escapeHtml(UIUtils.formatDate(book.addedDate))}</p>
                    ${this.syncStatusHtml(book)}
                </div>
                <div class="book-actions">
                    ${this.canRetrySync(book)
				? `<button class="btn-retry" data-id="${book.id}">重傳</button>`
				: ''}
                    <button class="btn-delete-book" data-id="${book.id}" aria-label="刪除">🗑️</button>
                </div>
            </div>
        `).join('');

		// Add retry handlers
		booksContainer.querySelectorAll('.btn-retry').forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const bookId = btn.getAttribute('data-id');
				if (bookId) this.handleRetrySync(bookId);
			});
		});

		// Add delete handlers
		booksContainer.querySelectorAll('.btn-delete-book').forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const bookId = btn.getAttribute('data-id');
				if (bookId) this.handleDeleteBook(bookId);
			});
		});
	}

	/**
	 * The last sync outcome for one book, as a status line on its card
	 */
	private syncStatusHtml(book: Book): string {
		const at = book.syncAt ? ` · ${UIUtils.escapeHtml(this.formatTime(book.syncAt))}` : '';

		switch (book.syncStatus) {
			case 'synced':
				return `<p class="sync-status sync-ok">✅ 已寫入 Sheet 第 ${Number(book.syncedRow)} 列${at}</p>`;
			case 'pending':
				return '<p class="sync-status sync-pending">⏳ 傳送中…</p>';
			case 'failed':
				return `<p class="sync-status sync-failed">⚠️ 未傳到 Sheet：${UIUtils.escapeHtml(book.syncError || '原因不明')}${at}</p>`;
			default:
				// Added before sync results were recorded: it was probably
				// sent, but nothing confirmed it.
				return '<p class="sync-status sync-unknown">❔ 沒有同步紀錄，Sheet 已有這本就不用重傳</p>';
		}
	}

	/** Anything except a confirmed or in-flight sync can be sent again. */
	private canRetrySync(book: Book): boolean {
		return book.syncStatus !== 'synced' && book.syncStatus !== 'pending';
	}

	/** Short local date and time, e.g. "9/15 14:32". */
	private formatTime(iso: string): string {
		return new Date(iso).toLocaleString('zh-TW', {
			month: 'numeric',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false
		});
	}

	/**
	 * Send one book to the Sheet and record the outcome on the book, so its
	 * card keeps showing whether the last attempt reached the Sheet.
	 */
	private async syncAndRecord(book: Book): Promise<void> {
		StorageService.updateBook(book.id, { syncStatus: 'pending', syncAt: new Date().toISOString() });
		this.renderBooks();

		const result = await SyncService.syncBook(book);
		const syncAt = new Date().toISOString();

		if (result.ok) {
			StorageService.updateBook(book.id, { syncStatus: 'synced', syncedRow: result.row, syncError: undefined, syncAt });
			UIUtils.showToast(`✅ 已寫入 Sheet 第 ${result.row} 列`, 2000);
		} else {
			StorageService.updateBook(book.id, { syncStatus: 'failed', syncError: result.error, syncAt });
			UIUtils.showToast(`⚠️ 未傳到 Sheet：${result.error}`, 4000);
		}
		this.renderBooks();
	}

	/**
	 * Handle the 重傳 button on a book card
	 */
	private handleRetrySync(bookId: string): void {
		const book = StorageService.loadBooks().find(b => b.id === bookId);
		if (!book || !this.canRetrySync(book)) return;

		this.syncAndRecord(book).catch(error => console.error(error));
	}

	/** Update the line of text under the camera preview. */
	private setScannerStatus(message: string): void {
		const statusElement = document.getElementById('scanner-status');
		if (statusElement) {
			statusElement.textContent = message;
		}
	}

	/**
	 * Start the barcode scanner
	 */
	private async startScanning(): Promise<void> {
		UIUtils.switchView('scanner-view');

		this.setScannerStatus('請把相機對準書背的 ISBN 條碼');

		try {
			await this.scannerService.startScanner(
				'reader',
				(isbn) => this.handleScannedISBN(isbn),
				undefined,
				(message) => this.setScannerStatus(message)
			);
		} catch (error) {
			UIUtils.showToast((error as Error).message);
			this.stopScanning();
		}
	}

	/**
	 * Stop the scanner
	 */
	private async stopScanning(): Promise<void> {
		await this.scannerService.stopScanner();
		UIUtils.switchView('books-view');
	}

	/**
	 * Handle scanned ISBN: record it locally and sync it to the Google
	 * Sheet. No book-details lookup — the ISBN itself is the payload.
	 */
	private async handleScannedISBN(isbn: string): Promise<void> {
		// Stop scanner immediately
		await this.scannerService.stopScanner();
		UIUtils.switchView('books-view');

		try {
			const newBook = StorageService.addBook(isbn);
			UIUtils.showToast(`已掃描：${isbn}`);
			this.syncAndRecord(newBook).catch(error => console.error(error));
		} catch (error) {
			UIUtils.showToast((error as Error).message, 5000);
			console.error(error);
		}
	}

	/**
	 * Handle manual book entry
	 */
	private handleAddManualBook(): void {
		const isbnInput = document.getElementById('input-isbn') as HTMLInputElement;
		const parsed = parseIsbn(isbnInput?.value ?? '');

		// Reject here rather than at the Sheet: a typo'd ISBN that syncs looks
		// like a real row and only surfaces days later when nothing matches it.
		if (!parsed.ok) {
			UIUtils.showToast(ISBN_REJECTION_MESSAGES[parsed.reason], 4000);
			isbnInput?.focus();
			return;
		}

		const isbn = parsed.isbn;

		try {
			const newBook = StorageService.addBook(isbn);
			UIUtils.hideModal('modal-add-book');
			// Show what was actually stored, not what was typed - hyphens are
			// stripped and ISBN-10 is converted, so the operator can confirm
			// the value that reached the Sheet.
			UIUtils.showToast(`已加入：${isbn}`);
			this.syncAndRecord(newBook).catch(error => console.error(error));
		} catch (error) {
			UIUtils.showToast('加入失敗');
			console.error(error);
		}
	}

	/**
	 * Handle deleting a book
	 */
	private handleDeleteBook(bookId: string): void {
		// Deleting here only affects this device's list. The row already sent
		// to the Sheet stays there, and staff need to know that.
		if (!confirm('要從清單移除這本書嗎？\n（Google Sheet 裡的資料不會被刪除）')) return;

		try {
			StorageService.removeBook(bookId);
			this.renderBooks();

			UIUtils.showToast('已移除');
		} catch (error) {
			UIUtils.showToast('移除失敗');
			console.error(error);
		}
	}

	/**
	 * Handle exporting the book list to CSV
	 */
	private handleExport(): void {
		const books = StorageService.loadBooks();

		if (books.length === 0) {
			UIUtils.showToast('清單是空的，沒有資料可以下載');
			return;
		}

		try {
			const csvContent = ExportService.exportBooksToCSV(books);
			ExportService.downloadCSV(csvContent, ExportService.generateFilename());
			UIUtils.showToast(`已下載 ${books.length} 本書的清單`);
		} catch (error) {
			UIUtils.showToast('下載失敗');
			console.error(error);
		}
	}
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', () => new BookScanApp());
} else {
	new BookScanApp();
}
