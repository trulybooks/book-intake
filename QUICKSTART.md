# Quick Start Guide

## 🚀 Getting Started in 3 Steps

### 1️⃣ Install Dependencies
```bash
npm install
```

### 2️⃣ Build the Project
```bash
npm run build
```

### 3️⃣ Run the Application

**Option A: Using the built-in server**
```bash
npm run serve
```
Then open your browser to: `http://localhost:8080`

**Option B: Using VS Code Live Server**
- Install the "Live Server" extension in VS Code
- Right-click on `index.html`
- Select "Open with Live Server"

**Option C: Using Python's HTTP server**
```bash
python -m http.server 8080
```

**Option D: Using Node's http-server globally**
```bash
npx http-server . -p 8080
```

---

## 📱 First Time Usage

1. **Grant Camera Permissions**
   - When you first try to scan, your browser will ask for camera access
   - Click "Allow" to enable barcode scanning

2. **Add Your First Book**
   
   **Via Scanning (Recommended)**:
   - Tap "📷 掃描"
   - Point your camera at the ISBN barcode on the back of a book
   - The ISBN is recorded directly and sent to the shop's Google Sheet automatically — there's no book-details lookup, so title/author live in the Sheet

   **Via Manual Entry**:
   - Tap "✏️ 手動輸入"
   - Type the ISBN
   - Click "Add Book"

---

## 🔧 Development Mode

To work on the code with automatic recompilation:

```bash
# Terminal 1: Watch for TypeScript changes
npm run watch

# Terminal 2: Serve the application
npm run serve
```

Now any changes to `.ts` files will automatically recompile!

---

## 📚 What Can You Do?

### Books
- ✅ Scan ISBN barcodes to add books (ISBN recorded directly, no lookup)
- ✅ Manually add books by ISBN when scanning isn't available
- ✅ Delete books from the list (this device only — the Sheet keeps its row)
- ✅ Export the list to CSV
- ✅ All data stored locally (no account needed!)
- ✅ Every scanned/added ISBN is sent to the shop's Google Sheet automatically
- ✅ Each book shows whether it reached the Sheet (✅ row N / ⚠️ reason), with 重傳 for failures

---

## ⚠️ Important Notes

### Camera Access
- **HTTPS Required**: For camera access to work on non-localhost domains, you MUST use HTTPS
- **Permissions**: You must grant camera permissions when prompted
- **Mobile**: Works best with back camera on mobile devices

### Supported Barcodes
- ISBN-13 / EAN-13 starting 978 or 979
- ISBN-10 (manual entry; stored as ISBN-13)

### Browser Compatibility
- ✅ Chrome/Edge (recommended)
- ✅ Safari (iOS and macOS)
- ✅ Firefox
- ❌ Internet Explorer (not supported)

### Data Storage
- All data is stored in your browser's localStorage
- Data persists between sessions
- Clearing browser data deletes this device's list (the Google Sheet is unaffected)
- Tap 📥 下載 for a CSV backup; the Google Sheet is the off-device copy

---

## 🐛 Troubleshooting

### "Camera not working"
1. Check browser permissions (Settings → Privacy → Camera)
2. Make sure you're on HTTPS (or localhost)
3. Try a different browser
4. Check if camera works in other apps

### "Barcode won't scan"
1. Make sure the barcode is an ISBN/EAN-13 (not another type of barcode)
2. Try better lighting conditions and hold steady ~15-20cm away
3. Make sure the whole barcode fits inside the scan box
4. Use "✏️ 手動輸入" as a fallback

### "Page won't load"
1. Check that you ran `npm run build`
2. Make sure you're serving the files (not just opening index.html as a file)
3. Check browser console for errors (F12)

### "TypeScript errors"
1. Run `npm install` to ensure dependencies are installed
2. Check `tsconfig.json` settings
3. Make sure you're using a recent version of TypeScript

---

## 📖 Next Steps

After getting familiar with the app:

1. Check `TODO.md` for planned features
2. Read `README.md` for full documentation
3. Explore the source code in `src/`
4. Suggest improvements or report bugs

---

## 🎯 Tips for Best Experience

1. **Good Lighting**: Scan barcodes in well-lit areas
2. **Steady Hand**: Hold your phone steady while scanning
3. **Right Distance**: Keep camera 4-6 inches from barcode
4. **Horizontal**: Hold barcode horizontally for best results
5. **Clean Lens**: Make sure your camera lens is clean

---

## 💡 Pro Tips

- Use manual entry if a barcode will not scan
- Scanning and local storage work offline; Google Sheet sync needs an internet connection
- You can use this on multiple devices: each keeps its own list, and all of them send to the same Google Sheet

---

**Enjoy building your digital library! 📚**
