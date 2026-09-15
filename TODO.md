# BookScan - Remaining Implementation Tasks

## ✅ Completed

- [x] Project structure and configuration
- [x] TypeScript setup and configuration
- [x] HTML5 responsive layout with mobile-first design
- [x] CSS styling with touch-friendly UI elements
- [x] LocalStorage service for data persistence
- [x] ISBN capture flow (scan records ISBN directly; book-details lookup removed by design)
- [x] Barcode scanner integration (zxing-wasm; replaced Html5Qrcode, whose JS decoder couldn't reliably read EAN-13 on iOS)
- [x] ~~Collection management~~ — removed 2026-09-14; books are one flat list
- [x] Book management (add via scan, add manually, delete)
- [x] Modal dialogs for user input
- [x] Toast notifications for feedback
- [x] Loading states and error handling
- [x] CSV export
- [x] Google Sheet sync via Apps Script Web App (hardcoded endpoint → `+add` tab, fire-and-forget; see `apps-script/Code.gs`)

## 🔨 Core Functionality - Ready for Testing

### Testing Checklist

1. **Book List**
   - [ ] Books appear newest first
   - [ ] Book count is correct

2. **Book Scanning**
   - [ ] Camera permissions handling
   - [ ] Scan ISBN barcode successfully
   - [ ] Scanned book appears at the top of the list
   - [ ] Scanned ISBN appears in the `+add` tab, columns A and G, as text

3. **Manual Book Entry**
   - [ ] Hyphenated ISBN (`978-986-...`) is accepted and stored without hyphens
   - [ ] ISBN-10 (including one ending in `X`) is stored as its ISBN-13 equivalent
   - [ ] A wrong check digit is rejected with a message, not saved or synced
   - [ ] Enter in the ISBN field submits the form

4. **Book Display & Management**
   - [ ] Delete books from the list (the Sheet row stays)
   - [ ] Empty state shows when no books

5. **Data Persistence**
   - [ ] Data persists after page reload

6. **Mobile Experience**
   - [ ] Touch targets are easy to tap
   - [ ] Layouts work on small screens
   - [ ] Camera interface works on mobile
   - [ ] Modals work correctly on mobile

## 🎯 Potential Enhancements (Future)

### High Priority

- [ ] **Import Functionality** (export to CSV is done, see Completed)
  - Export the list to JSON
  - Import from JSON file


- [ ] **Search & Filter**
  - Search the list by ISBN
  - Filter books by year, author, etc.

- [ ] **Sorting Options**
  - Sort by title (A-Z, Z-A)
  - Sort by author
  - Sort by date added
  - Sort by publication year

### Medium Priority

- [ ] **Image Upload**
  - Allow users to upload custom book covers
  - Scan barcodes from image files (not just camera)
  - Image compression for storage efficiency

- [ ] **Reading Progress**
  - Mark books as "read", "reading", "to-read"
  - Add reading progress percentage
  - Add reading start/finish dates
  - Reading statistics

- [ ] **Notes & Tags**
  - Add personal notes to books
  - Custom tags/categories
  - Rating system (1-5 stars)

- [ ] **Bulk Operations**
  - Select multiple books for deletion
  - Bulk tag/category assignment

- [ ] **Improved Error Handling**
  - Better offline detection
  - Retry mechanism for API failures
  - More detailed error messages

### Low Priority

- [ ] **UI/UX Enhancements**
  - Dark mode support
  - Theme customization
  - Animation improvements
  - Haptic feedback on mobile

- [ ] **PWA Features**
  - Service worker for offline support
  - Install as app on mobile
  - Push notifications (optional reminders)
  - Background sync

- [ ] **Data Management**
  - Share the book list
  - Duplicate detection (same ISBN)
  - Data usage statistics

- [ ] **Google Sheet Sync polish** (v1 done, see Completed — these are optional follow-ups)
  - Retry-on-failure / offline queue for sync requests
  - A way to confirm the Apps Script write actually succeeded (blocked by the no-cors/opaque-response limitation — would need a different transport, e.g. a tiny proxy)

- [ ] **Accessibility**
  - ARIA labels for all interactive elements
  - Keyboard navigation improvements
  - Screen reader optimization
  - High contrast mode

### Nice to Have

- [ ] **Advanced Features**
  - Book recommendations
  - Series tracking
  - Wishlist functionality
  - Loan tracking (books lent to friends)
  - Price tracking from online stores

- [ ] **Social Features**
  - Share book lists
  - Book club lists
  - Reading challenges

- [ ] **Analytics**
  - Reading statistics dashboard
  - Genre distribution charts
  - Reading pace tracking
  - Year-over-year comparisons

## 🐛 Known Issues / To Fix

- [ ] Long book titles may need better truncation
- [ ] Scanner may need better lighting instructions for users
- [ ] Consider adding camera flip button for front/back camera selection
- [ ] Test localStorage limits with a large list (500+ books)
- [ ] Add confirmation for destructive actions (currently using browser confirm)
- [x] Improve ISBN validation — `src/isbn.ts` verifies ISBN-10/EAN-13 check digits and the 978/979 Bookland prefix, and canonicalizes everything to ISBN-13

## 📱 Mobile-Specific Testing Needed

- [ ] Test on iOS Safari (iPhone)
- [ ] Test on Android Chrome
- [ ] Test on Android Firefox
- [ ] Test on tablet devices
- [ ] Test landscape orientation
- [ ] Test on older devices (performance)
- [ ] Test with slow network connections
- [ ] Test with no network connection

## 🔒 Security Considerations

- [ ] Input sanitization (XSS prevention) - Currently using escapeHtml
- [ ] Storage encryption (optional, for sensitive notes)

## 📚 Documentation Needs

- [ ] JSDoc comments for all public methods
- [ ] API documentation
- [ ] User guide with screenshots
- [ ] Video tutorial for first-time users
- [ ] FAQ section

## 🧪 Testing

- [ ] Unit tests for StorageService
- [ ] Integration tests for scanner
- [ ] E2E tests for core workflows
- [ ] Cross-browser testing
- [ ] Performance testing with large datasets

## 🚀 Deployment

- [ ] Setup CI/CD pipeline
- [ ] Minify and bundle JavaScript
- [ ] Optimize images and assets
- [ ] Setup CDN for static assets
- [ ] Configure HTTPS
- [ ] Add analytics (optional)
- [ ] Setup error tracking (Sentry, etc.)

---

## Next Steps

1. **Build and test the current implementation**
   ```bash
   npm install
   npm run build
   npm run serve
   ```

2. **Test core functionality** using the testing checklist above

3. **Fix any bugs** discovered during testing

4. **Prioritize enhancements** based on user needs

5. **Implement high-priority features** one at a time

---

**Last Updated**: 2026-09-14 — removed collections (one flat book list); sync hardcoded to the shop Sheet's `+add` tab via `apps-script/Code.gs`
