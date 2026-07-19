import { app, BrowserWindow, ipcMain, session, WebContentsView, BaseWindow } from 'electron';
import path from 'path';
import { SimpleStore } from './simple-store';
import { setupIpcHandlers } from './ipc-handlers';
import { BrowserManager } from './browser-manager';
import { ProxyManager } from './proxy-manager';
import { AgentEngine } from './agent-engine';
// Prevent crash dialogs — log errors silently instead
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const store = new SimpleStore();
let mainWindow: BrowserWindow | null = null;
let browserManager: BrowserManager | null = null;

function getRendererURL(): string {
  return `file://${path.join(__dirname, '../renderer/index.html')}`;
}

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0f0f13',
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false,
    },
  });

  mainWindow.loadURL(getRendererURL());

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  browserManager = new BrowserManager(mainWindow);
  const proxyManager = new ProxyManager();
  const agentEngine = new AgentEngine(proxyManager);

  setupIpcHandlers(ipcMain, mainWindow, browserManager, proxyManager, agentEngine, store);

  mainWindow.on('closed', () => {
    mainWindow = null;
    browserManager = null;
  });

  mainWindow.on('resize', () => {
    browserManager?.repositionViews();
  });

  return mainWindow;
}

app.whenReady().then(async () => {
  // Default security-friendly session settings
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'X-Frame-Options': [],
        'Content-Security-Policy': [],
      },
    });
  });

  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('web-contents-created', (_, contents) => {
  // Allow all navigation in webviews
  contents.on('will-navigate', (event, url) => {
    // Allow all
  });

  // Open new windows in a new tab instead of a system window
  contents.setWindowOpenHandler(({ url }) => {
    mainWindow?.webContents.send('open-url-in-new-tab', url);
    return { action: 'deny' };
  });
});
