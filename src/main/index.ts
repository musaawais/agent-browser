import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SimpleStore } from './simple-store';
import { BrowserManager } from './browser-manager';
import { ProxyManager } from './proxy-manager';
import { AgentEngine } from './agent-engine';

// ── Silence crash dialogs ───────────────────────────────────────────────────
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));

// ── Persistent store (singleton, survives window lifecycle) ─────────────────
const store = new SimpleStore();

// ── Manager refs – mutated on every createMainWindow call ────────────────────
// IPC handlers are registered ONCE and always read from these refs.
// This prevents the "ipcMain.handle already registered" crash on macOS reopen.
export const refs = {
  mainWindow: null as BrowserWindow | null,
  browserManager: null as BrowserManager | null,
  proxyManager: null as ProxyManager | null,
  agentEngine: null as AgentEngine | null,
};

// ── IPC: all channels registered ONCE ───────────────────────────────────────
function registerIpcHandlers() {
  // Browser ──────────────────────────────────────────────────────────────────
  ipcMain.handle('browser:new-tab', (_, url?: string) => {
    const bm = refs.browserManager;
    if (!bm) return null;
    const id = uuidv4();
    const tab = bm.createTab(id, url || 'https://www.google.com');
    bm.activateTab(id);
    return { id, url: tab.url, title: tab.title, favicon: tab.favicon, isLoading: true };
  });

  ipcMain.handle('browser:close-tab', (_, id: string) => {
    refs.browserManager?.closeTab(id);
    return { success: true };
  });

  ipcMain.handle('browser:activate-tab', (_, id: string) => {
    refs.browserManager?.activateTab(id);
    return { success: true };
  });

  ipcMain.handle('browser:navigate', (_, id: string, url: string) => {
    refs.browserManager?.navigateTab(id, url);
    return { success: true };
  });

  ipcMain.handle('browser:go-back', (_, id: string) => {
    refs.browserManager?.goBack(id);
    return { success: true };
  });

  ipcMain.handle('browser:go-forward', (_, id: string) => {
    refs.browserManager?.goForward(id);
    return { success: true };
  });

  ipcMain.handle('browser:reload', (_, id: string) => {
    refs.browserManager?.reload(id);
    return { success: true };
  });

  ipcMain.handle('browser:stop', (_, id: string) => {
    refs.browserManager?.stopLoading(id);
    return { success: true };
  });

  // Tell the main process how wide the sidebar is so the browser view
  // can shrink its right edge and not cover the sidebar panel.
  ipcMain.handle('browser:set-sidebar-width', (_, width: number) => {
    refs.browserManager?.setSidebarWidth(width);
    return { success: true };
  });

  // Proxy ────────────────────────────────────────────────────────────────────
  ipcMain.handle('proxy:set', async (_, config) => {
    if (refs.proxyManager) await refs.proxyManager.setProxy(config);
    return { success: true };
  });

  ipcMain.handle('proxy:clear', async () => {
    if (refs.proxyManager) await refs.proxyManager.clearProxy();
    return { success: true };
  });

  ipcMain.handle('proxy:get-state', () => refs.proxyManager?.getState() ?? null);

  // Agent ────────────────────────────────────────────────────────────────────
  ipcMain.handle('agent:create-task', (_, input) => {
    if (!refs.agentEngine) throw new Error('Agent engine not ready');
    return refs.agentEngine.createTask(input);
  });

  ipcMain.handle('agent:start-task', async (_, id: string) => {
    refs.agentEngine?.startTask(id).catch(console.error);
    return { success: true };
  });

  ipcMain.handle('agent:stop-task', (_, id: string) => {
    refs.agentEngine?.stopTask(id);
    return { success: true };
  });

  ipcMain.handle('agent:delete-task', (_, id: string) => {
    refs.agentEngine?.deleteTask(id);
    return { success: true };
  });

  ipcMain.handle('agent:get-all-tasks', () => refs.agentEngine?.getAllTasks() ?? []);

  // Store ────────────────────────────────────────────────────────────────────
  ipcMain.handle('store:get', (_, key: string) => store.get(key));

  ipcMain.handle('store:set', (_, key: string, value: unknown) => {
    store.set(key, value);
    return { success: true };
  });
}

// ── Window factory ───────────────────────────────────────────────────────────
function getRendererURL() {
  return `file://${path.join(__dirname, '../renderer/index.html')}`;
}

async function createMainWindow() {
  const win = new BrowserWindow({
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
      sandbox: false,
    },
  });

  refs.mainWindow = win;

  // Create fresh managers for this window
  refs.proxyManager = new ProxyManager();
  refs.agentEngine = new AgentEngine(refs.proxyManager);
  refs.browserManager = new BrowserManager(win);

  // Agent status → renderer (always uses the current win ref)
  refs.agentEngine.onStatusChange((task) => {
    try {
      if (refs.mainWindow && !refs.mainWindow.isDestroyed() && !refs.mainWindow.webContents.isDestroyed()) {
        refs.mainWindow.webContents.send('agent:task-updated', task);
      }
    } catch { /* ignore */ }
  });

  win.loadURL(getRendererURL());

  win.on('resize', () => refs.browserManager?.repositionViews());

  win.on('closed', () => {
    if (refs.mainWindow === win) {
      refs.mainWindow = null;
      refs.browserManager = null;
      // Keep proxyManager and agentEngine alive briefly so in-flight tasks can log
    }
  });

  // Intercept new-window calls and open them as a new tab instead
  app.on('web-contents-created', (_, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      try {
        if (refs.mainWindow && !refs.mainWindow.isDestroyed()) {
          refs.mainWindow.webContents.send('open-url-in-new-tab', url);
        }
      } catch { /* ignore */ }
      return { action: 'deny' };
    });
  });
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Strip headers that prevent sites from loading inside the app
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'X-Frame-Options': [],
        'Content-Security-Policy': [],
      },
    });
  });

  // Register ALL IPC handlers exactly once
  registerIpcHandlers();

  await createMainWindow();

  // macOS: recreate window when dock icon is clicked and no windows are open
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      // Managers are replaced inside createMainWindow; IPC handlers reuse module refs
      await createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
