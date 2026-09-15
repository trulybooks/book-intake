import { StorageService } from './storage.js';
import { ScannerService } from './scanner.js';
import { UIUtils } from './utils.js';
import { ExportService } from './export.js';
import { SyncService } from './sync.js';
import { parseIsbn, ISBN_REJECTION_MESSAGES } from './isbn.js';

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
		this.setupEventListeners();
		this.renderBooks();
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
			countElement.textContent = `${books.length} book${books.length !== 1 ? 's' : ''}`;
		}

		const booksContainer = document.getElementById('books-list');
		if (!booksContainer) return;

		if (books.length === 0) {
			booksContainer.innerHTML = `
                <div class="empty-state">
                    <h3>No Books Yet</h3>
                    <p>Scan or add books to get started!</p>
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
                </div>
                <div class="book-actions">
                    <button class="btn-delete-book" data-id="${book.id}" aria-label="Delete book">🗑️</button>
                </div>
            </div>
        `).join('');

		// Add delete handlers
		booksContainer.querySelectorAll('.btn-delete-book').forEach(btn => {
			btn.addEventListener('click', (e) => {
				e.stopPropagation();
				const bookId = btn.getAttribute('data-id');
				if (bookId) this.handleDeleteBook(bookId);
			});
		});
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

		this.setScannerStatus('Point camera at ISBN barcode...');

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
			SyncService.syncBook(newBook);
			this.renderBooks();

			UIUtils.showToast(`Scanned: ${isbn}`);
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
			SyncService.syncBook(newBook);
			this.renderBooks();

			UIUtils.hideModal('modal-add-book');
			// Show what was actually stored, not what was typed - hyphens are
			// stripped and ISBN-10 is converted, so the operator can confirm
			// the value that reached the Sheet.
			UIUtils.showToast(`Added ${isbn}`);
		} catch (error) {
			UIUtils.showToast('Failed to add book');
			console.error(error);
		}
	}

	/**
	 * Handle deleting a book
	 */
	private handleDeleteBook(bookId: string): void {
		// Deleting here only affects this device's list. The row already sent
		// to the Sheet stays there, and staff need to know that.
		if (!confirm('Remove this book from the list?\n(It is NOT removed from the Google Sheet.)')) return;

		try {
			StorageService.removeBook(bookId);
			this.renderBooks();

			UIUtils.showToast('Book removed');
		} catch (error) {
			UIUtils.showToast('Failed to remove book');
			console.error(error);
		}
	}

	/**
	 * Handle exporting the book list to CSV
	 */
	private handleExport(): void {
		const books = StorageService.loadBooks();

		if (books.length === 0) {
			UIUtils.showToast('No books to export');
			return;
		}

		try {
			const csvContent = ExportService.exportBooksToCSV(books);
			ExportService.downloadCSV(csvContent, ExportService.generateFilename());
			UIUtils.showToast(`Exported ${books.length} book${books.length !== 1 ? 's' : ''}`);
		} catch (error) {
			UIUtils.showToast('Failed to export books');
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
