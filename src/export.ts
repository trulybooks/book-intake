import { Book } from './types.js';

/**
 * Service for exporting the book list to CSV format
 */
export class ExportService {
	/**
	 * Export books to CSV
	 */
	static exportBooksToCSV(books: Book[]): string {
		const rows: string[][] = [['ISBN', 'Added Date']];

		books.forEach(book => {
			rows.push([book.isbn, this.formatDate(book.addedDate)]);
		});

		return this.convertToCSV(rows);
	}

	/**
	 * Convert 2D array to CSV string with proper escaping
	 */
	private static convertToCSV(rows: string[][]): string {
		return rows.map(row => {
			return row.map(cell => this.escapeCSVCell(cell)).join(',');
		}).join('\n');
	}

	/**
	 * Escape a CSV cell value (handle quotes and commas)
	 */
	private static escapeCSVCell(value: string): string {
		// If value contains comma, quote, or newline, wrap in quotes and escape internal quotes
		if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
			// Escape quotes by doubling them
			return `"${value.replace(/"/g, '""')}"`;
		}
		return value;
	}

	/**
	 * Download CSV string as file
	 */
	static downloadCSV(csvContent: string, filename: string): void {
		// Add BOM for proper UTF-8 encoding in Excel
		const BOM = '\uFEFF';
		const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');

		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', filename);
		link.style.visibility = 'hidden';

		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);

		// Clean up the URL object
		URL.revokeObjectURL(url);
	}

	/**
	 * Format ISO date string to readable format
	 */
	private static formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('en-US', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
	}

	/**
	 * Generate filename for the export
	 */
	static generateFilename(): string {
		const timestamp = new Date().toISOString().split('T')[0];
		return `books_${timestamp}.csv`;
	}
}
