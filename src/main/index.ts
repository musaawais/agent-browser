import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { SimpleStore } from './simple-store';
import { BrowserManager } from './browser-manager';
import { ProxyManager } from './proxy-manager';
import { AgentEngine } from './agent-engine';

// ── Stealth: remove Chromium automation flag before anything else ─────────────
// This is the most important step — it removes the flag Google checks first.
app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');
app.commandLine.appendSwitch('disable-infobars');
app.commandLine.appendSwitch('no-default-browser-check');

// ── Silence crash dialogs ─────────────────────────────────────────────────────
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason));

// ── Singleton store ───────────────────────────────────────────────────────────
const store = new SimpleStore();

// ── Module-level manager refs — IPC handlers registered ONCE read from here ──
export const refs = {
  mainWindow: null as BrowserWindow | null,
  browserManager: null as BrowserManager | null,
  proxyManager: null as ProxyManager | null,
  agentEngine: null as AgentEngine | null,
};

// ── Register ALL IPC handlers exactly once ────────────────────────────────────
function registerIpcHandlers() {
  // ── Browser ────────────────────────────────────────────────────────────────
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

  ipcMain.handle('browser:set-sidebar-width', (_, width: number) => {
    refs.browserManager?.setSidebarWidth(width);
    return { success: true };
  });

  // ── Proxy ─────────────────────────────────────────────────────────────────
  ipcMain.handle('proxy:set', async (_, config) => {
    if (refs.proxyManager) await refs.proxyManager.setProxy(config);
    return { success: true };
  });

  ipcMain.handle('proxy:clear', async () => {
    if (refs.proxyManager) await refs.proxyManager.clearProxy();
    return { success: true };
  });

  ipcMain.handle('proxy:get-state', () => refs.proxyManager?.getState() ?? null);

  // ── Agent ─────────────────────────────────────────────────────────────────
  ipcMain.handle('agent:create-task', (_, input) => {
    if (!refs.agentEngine) throw new Error('Agent engine not ready');
    return refs.agentEngine.createTask(input);
  });

  ipcMain.handle('agent:start-task', async (_, taskId: string) => {
    const bm = refs.browserManager;
    const win = refs.mainWindow;
    const ae = refs.agentEngine;
    if (!bm || !win || !ae) return { success: false, error: 'App not ready' };

    // Create a VISIBLE stealth tab for the agent to work in
    const tabId = uuidv4();
    bm.createAgentTab(tabId, 'about:blank');
    bm.activateTab(tabId);

    // Tell renderer to add this tab to its tab bar
    bm.sendTabCreated(tabId);

    const wc = bm.getWebContents(tabId);
    if (!wc) return { success: false, error: 'Could not get tab webContents' };

    // Apply proxy to agent tab session if configured
    const task = ae.getTask(taskId);
    if (task?.proxyHost && task?.proxyPort) {
      const proxyRules =
        task.proxyProtocol === 'socks5'
          ? `socks5://${task.proxyHost}:${task.proxyPort}`
          : `http://${task.proxyHost}:${task.proxyPort}`;
      try { await wc.session.setProxy({ proxyRules }); } catch { }
    }

    // Run agent in background — do not await so IPC returns immediately
    ae.startTask(taskId, wc).catch(console.error);

    return { success: true, tabId };
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

  // ── Store ──────────────────────────────────────────────────────────────────
  ipcMain.handle('store:get', (_, key: string) => store.get(key));

  ipcMain.handle('store:set', (_, key: string, value: unknown) => {
    store.set(key, value);
    return { success: true };
  });
}

// ── Window factory ────────────────────────────────────────────────────────────
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
  refs.proxyManager = new ProxyManager();
  refs.agentEngine = new AgentEngine(refs.proxyManager);
  refs.browserManager = new BrowserManager(win);

  // Forward agent status events to renderer
  refs.agentEngine.onStatusChange((task) => {
    try {
      if (refs.mainWindow && !refs.mainWindow.isDestroyed() && !refs.mainWindow.webContents.isDestroyed()) {
        refs.mainWindow.webContents.send('agent:task-updated', task);
      }
    } catch { }
  });

  win.loadURL(getRendererURL());

  win.on('resize', () => refs.browserManager?.repositionViews());

  win.on('closed', () => {
    if (refs.mainWindow === win) {
      refs.mainWindow = null;
      refs.browserManager = null;
    }
  });

  // Route popup windows (window.open) into new tabs
  app.on('web-contents-created', (_, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      try {
        if (refs.mainWindow && !refs.mainWindow.isDestroyed()) {
          refs.mainWindow.webContents.send('open-url-in-new-tab', url);
        }
      } catch { }
      return { action: 'deny' };
    });
  });
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Remove tracking/CSP headers so any site loads in the browser
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'X-Frame-Options': [],
        'Content-Security-Policy': [],
      },
    });
  });

  registerIpcHandlers(); // exactly once — handlers read from module refs
  await createMainWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow(); // refs updated inside; IPC handlers reuse them
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
