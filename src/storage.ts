import { Book } from './types.js';

/**
 * Service for managing data persistence using localStorage.
 *
 * Books are kept as one flat list. Earlier versions grouped them into named
 * collections under `bookScan_collections`; that key is no longer read.
 */
export class StorageService {
	private static readonly BOOKS_KEY = 'bookScan_books';

	/**
	 * Load all books from localStorage, in the order they were added
	 */
	static loadBooks(): Book[] {
		try {
			const data = localStorage.getItem(this.BOOKS_KEY);
			return data ? JSON.parse(data) : [];
		} catch (error) {
			console.error('Error loading books:', error);
			return [];
		}
	}

	/**
	 * Save all books to localStorage
	 */
	private static saveBooks(books: Book[]): void {
		try {
			localStorage.setItem(this.BOOKS_KEY, JSON.stringify(books));
		} catch (error) {
			console.error('Error saving books:', error);
			throw new Error('Failed to save book. Storage may be full.');
		}
	}

	/**
	 * Add a book by its canonical ISBN
	 */
	static addBook(isbn: string): Book {
		const books = this.loadBooks();

		const newBook: Book = {
			id: this.generateId(),
			isbn,
			addedDate: new Date().toISOString()
		};

		books.push(newBook);
		this.saveBooks(books);

		return newBook;
	}

	/**
	 * Remove a book
	 */
	static removeBook(bookId: string): void {
		const books = this.loadBooks().filter(b => b.id !== bookId);
		this.saveBooks(books);
	}

	/**
	 * Merge fields into one book. A no-op if the book is gone, which happens
	 * when a sync finishes after staff already removed that book.
	 */
	static updateBook(bookId: string, updates: Partial<Omit<Book, 'id'>>): void {
		const books = this.loadBooks();
		const book = books.find(b => b.id === bookId);
		if (!book) return;

		Object.assign(book, updates);
		this.saveBooks(books);
	}

	/**
	 * Generate a unique ID
	 */
	private static generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
	}
}
