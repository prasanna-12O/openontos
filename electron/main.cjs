const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// --- SQLite-like JSON file storage (no native dependencies) ---
// Uses a JSON file in the user's app data directory for persistence.
// This avoids native module compilation issues while providing local file storage.

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'openontos-data.json');
}

function loadData() {
  const dbPath = getDbPath();
  try {
    if (fs.existsSync(dbPath)) {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Failed to load data:', err);
  }
  return null;
}

function saveData(data) {
  const dbPath = getDbPath();
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save data:', err);
    return false;
  }
}

// --- IPC Handlers ---
ipcMain.handle('db:load', () => loadData());
ipcMain.handle('db:save', (_event, data) => saveData(data));
ipcMain.handle('db:path', () => getDbPath());

// --- Window ---
function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'OpenOntos',
    backgroundColor: '#0f1419',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  // Check if we're in development or production
  const isDev = !app.isPackaged;
  
  if (isDev) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    // In production, the resources are packaged. Use process.resourcesPath for correct path resolution
    const htmlPath = path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html');
    console.log('Loading HTML from:', htmlPath);
    win.loadFile(htmlPath);
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
