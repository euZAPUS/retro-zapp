/* ZAP Arcade · proceso principal de Electron: ventana, menú y actualizaciones automáticas desde GitHub Releases. */
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

app.setAppUserModelId('com.euzapus.zaparcade');
if (!app.requestSingleInstanceLock()) { app.quit(); }

let win = null;
const boundsFile = () => path.join(app.getPath('userData'), 'window.json');
function loadBounds() { try { return JSON.parse(fs.readFileSync(boundsFile(), 'utf8')); } catch (e) { return {}; } }
function saveBounds() {
  if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
  try { fs.writeFileSync(boundsFile(), JSON.stringify({ ...win.getBounds(), max: win.isMaximized() })); } catch (e) { /* nada */ }
}

/* ---------- actualizaciones ---------- */
let state = { status: app.isPackaged ? 'idle' : 'dev', version: app.getVersion(), available: null, progress: 0, error: null };
let userInitiated = false;
function setState(patch) {
  state = { ...state, ...patch };
  if (win && !win.isDestroyed()) win.webContents.send('zap:update:state', state);
}
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
autoUpdater.on('checking-for-update', () => setState({ status: 'checking', error: null }));
autoUpdater.on('update-not-available', () => setState({ status: 'uptodate', available: null }));
autoUpdater.on('update-available', info => {
  setState({ status: 'available', available: info.version, progress: 0 });
  if (userInitiated) autoUpdater.downloadUpdate().catch(onError);
});
autoUpdater.on('download-progress', p => setState({ status: 'downloading', progress: Math.round(p.percent) }));
autoUpdater.on('update-downloaded', () => {
  setState({ status: 'installing', progress: 100 });
  /* reinicia sola y abre la versión nueva */
  setTimeout(() => autoUpdater.quitAndInstall(true, true), 900);
});
autoUpdater.on('error', e => onError(e));
function onError(e) { setState({ status: 'error', error: String((e && e.message) || e).split('\n')[0].slice(0, 200) }); }

async function runUpdate() {
  if (!app.isPackaged) { setState({ status: 'dev' }); return state; }
  userInitiated = true;
  try {
    if (state.status === 'available') await autoUpdater.downloadUpdate();
    else if (state.status !== 'checking' && state.status !== 'downloading' && state.status !== 'installing') await autoUpdater.checkForUpdates();
  } catch (e) { onError(e); }
  return state;
}
ipcMain.handle('zap:update:get', () => state);
ipcMain.handle('zap:update:run', () => runUpdate());

/* ---------- ventana ---------- */
function createWindow() {
  const b = loadBounds();
  win = new BrowserWindow({
    width: b.width || 1280, height: b.height || 860, x: b.x, y: b.y, minWidth: 380, minHeight: 560,
    backgroundColor: '#0b0d18', show: false, autoHideMenuBar: true, title: 'ZAP Arcade',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  if (b.max) win.maximize();
  win.once('ready-to-show', () => win.show());
  win.on('close', saveBounds);
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) { e.preventDefault(); if (/^https:\/\//.test(url)) shell.openExternal(url); } });
  win.webContents.on('did-finish-load', () => win.webContents.send('zap:update:state', state));
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
}

function buildMenu() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'ZAP Arcade', submenu: [
      { label: 'Recargar', accelerator: 'CmdOrCtrl+R', click: () => win && win.webContents.reload() },
      { label: 'Pantalla completa', accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) },
      { label: 'Herramientas de desarrollo', accelerator: 'CmdOrCtrl+Shift+I', click: () => win && win.webContents.toggleDevTools() },
      { type: 'separator' },
      { label: 'Salir', accelerator: 'CmdOrCtrl+Q', role: 'quit' }
    ] }
  ]));
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(() => {
  buildMenu(); createWindow();
  /* comprobación silenciosa al abrir: solo avisa, no descarga */
  if (app.isPackaged) setTimeout(() => autoUpdater.checkForUpdates().catch(onError), 4000);
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
