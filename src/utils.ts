/**
 * Simple UI utility functions
 */
export class UIUtils {
	private static toastTimer: ReturnType<typeof setTimeout> | null = null;

	/**
	 * Show a toast notification
	 */
	static showToast(message: string, duration: number = 3000): void {
		const toast = document.getElementById('toast');
		if (!toast) return;

		toast.textContent = message;
		toast.classList.add('active');

		// A newer toast replaces the one on screen. Without clearing the old
		// timer it would fire part-way and hide the new toast early — which
		// happens on every scan, where the sync result follows right behind
		// the 已掃描 toast.
		if (this.toastTimer !== null) clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => {
			toast.classList.remove('active');
			this.toastTimer = null;
		}, duration);
	}

	/**
	 * Show loading overlay
	 */
	static showLoading(message: string = '載入中…'): void {
		const overlay = document.getElementById('loading-overlay');
		if (!overlay) return;

		const text = overlay.querySelector('p');
		if (text) text.textContent = message;

		overlay.classList.add('active');
	}

	/**
	 * Hide loading overlay
	 */
	static hideLoading(): void {
		const overlay = document.getElementById('loading-overlay');
		if (!overlay) return;

		overlay.classList.remove('active');
	}

	/**
	 * Show a modal
	 */
	static showModal(modalId: string): void {
		const modal = document.getElementById(modalId);
		if (!modal) return;

		modal.classList.add('active');
	}

	/**
	 * Hide a modal
	 */
	static hideModal(modalId: string): void {
		const modal = document.getElementById(modalId);
		if (!modal) return;

		modal.classList.remove('active');

		// Clear inputs in the modal
		modal.querySelectorAll('input').forEach(input => {
			input.value = '';
		});
	}

	/**
	 * Switch between views
	 */
	static switchView(viewId: string): void {
		// Hide all views
		document.querySelectorAll('.view').forEach(view => {
			view.classList.remove('active');
		});

		// Show target view
		const targetView = document.getElementById(viewId);
		if (targetView) {
			targetView.classList.add('active');
		}
	}

	/**
	 * Format date for display
	 */
	static formatDate(dateString: string): string {
		const date = new Date(dateString);
		return date.toLocaleDateString('zh-TW', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	/**
	 * Escape HTML to prevent XSS
	 */
	static escapeHtml(text: string): string {
		const div = document.createElement('div');
		div.textContent = text;
		return div.innerHTML;
	}
}
