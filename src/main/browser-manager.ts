import { BrowserWindow, WebContentsView, Rectangle } from 'electron';
import path from 'path';

export interface TabInfo {
  id: string;
  view: WebContentsView;
  url: string;
  title: string;
  favicon: string;
  isLoading: boolean;
}

export const CHROME_HEIGHT = 90; // exported so agent-engine can use the same constant

export class BrowserManager {
  private win: BrowserWindow;
  private tabs: Map<string, TabInfo> = new Map();
  private activeTabId: string | null = null;
  private rendererReady = false;
  private pendingUpdates: Array<() => void> = [];
  private sidebarWidth = 0;

  constructor(win: BrowserWindow) {
    this.win = win;
    win.webContents.once('did-finish-load', () => {
      this.rendererReady = true;
      this.pendingUpdates.forEach((fn) => fn());
      this.pendingUpdates = [];
    });
  }

  getSidebarWidth(): number { return this.sidebarWidth; }

  setSidebarWidth(width: number) {
    this.sidebarWidth = width;
    this.repositionViews();
  }

  getBrowserBounds(): Rectangle {
    const [width, height] = this.win.getContentSize();
    return {
      x: 0,
      y: CHROME_HEIGHT,
      width: Math.max(200, width - this.sidebarWidth),
      height: Math.max(200, height - CHROME_HEIGHT),
    };
  }

  // ── Tab factories ──────────────────────────────────────────────────────────

  createTab(id: string, url = 'about:blank'): TabInfo {
    return this._createView(id, url, false);
  }

  /**
   * Create a stealth tab for user-browsing (injects agent-preload.js to hide
   * navigator.webdriver). The agent engine manages its OWN views separately.
   */
  createAgentTab(id: string, url = 'about:blank'): TabInfo {
    return this._createView(id, url, true);
  }

  private _createView(id: string, url: string, stealth: boolean): TabInfo {
    const preloadPath = stealth
      ? path.join(__dirname, 'agent-preload.js')
      : undefined;

    const view = new WebContentsView({
      webPreferences: {
        ...(preloadPath ? { preload: preloadPath } : {}),
        sandbox: !stealth,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        javascript: true,
      },
    });
    view.setBackgroundColor('#ffffff');
    view.webContents.loadURL(url).catch(() => {});

    view.webContents.on('did-start-loading', () => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed()) { tab.isLoading = true; this.sendTabUpdate(id); }
    });
    view.webContents.on('did-stop-loading', () => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed()) {
        tab.isLoading = false; tab.url = view.webContents.getURL(); this.sendTabUpdate(id);
      }
    });
    view.webContents.on('page-title-updated', (_, title) => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed()) { tab.title = title; this.sendTabUpdate(id); }
    });
    view.webContents.on('page-favicon-updated', (_, favicons) => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed() && favicons.length > 0) { tab.favicon = favicons[0]; this.sendTabUpdate(id); }
    });
    view.webContents.on('did-navigate', (_, navUrl) => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed()) { tab.url = navUrl; this.sendTabUpdate(id); }
    });
    view.webContents.on('did-navigate-in-page', (_, navUrl) => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed()) { tab.url = navUrl; this.sendTabUpdate(id); }
    });

    const tabInfo: TabInfo = { id, view, url, title: 'New Tab', favicon: '', isLoading: true };
    this.tabs.set(id, tabInfo);
    return tabInfo;
  }

  // ── Tab operations ─────────────────────────────────────────────────────────

  activateTab(id: string) {
    if (this.activeTabId && this.activeTabId !== id) {
      const cur = this.tabs.get(this.activeTabId);
      if (cur) try { this.win.contentView.removeChildView(cur.view); } catch { }
    }
    const tab = this.tabs.get(id);
    if (!tab) return;
    this.activeTabId = id;
    try {
      this.win.contentView.addChildView(tab.view);
      tab.view.setBounds(this.getBrowserBounds());
    } catch { }
  }

  closeTab(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    if (this.activeTabId === id) {
      try { this.win.contentView.removeChildView(tab.view); } catch { }
      this.activeTabId = null;
    }
    try { (tab.view.webContents as any).destroy(); } catch { }
    this.tabs.delete(id);
  }

  navigateTab(id: string, url: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    let nav = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      nav = url.includes('.') && !url.includes(' ')
        ? 'https://' + url
        : `https://www.google.com/search?q=${encodeURIComponent(url)}`;
    }
    try { tab.view.webContents.loadURL(nav); } catch { }
  }

  goBack(id: string)    { const t = this.tabs.get(id); try { if (t?.view.webContents.canGoBack())    t.view.webContents.goBack();    } catch { } }
  goForward(id: string) { const t = this.tabs.get(id); try { if (t?.view.webContents.canGoForward()) t.view.webContents.goForward(); } catch { } }
  reload(id: string)    { const t = this.tabs.get(id); try { t?.view.webContents.reload();  } catch { } }
  stopLoading(id: string) { const t = this.tabs.get(id); try { t?.view.webContents.stop(); } catch { } }

  repositionViews() {
    if (!this.activeTabId) return;
    const tab = this.tabs.get(this.activeTabId);
    try { if (tab && !this.win.isDestroyed()) tab.view.setBounds(this.getBrowserBounds()); } catch { }
  }

  getWebContents(id: string) { return this.tabs.get(id)?.view.webContents; }

  /** Tell the renderer a new tab was created (e.g. by the agent). */
  sendTabCreated(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    const doSend = () => {
      try {
        if (this.win.isDestroyed() || this.win.webContents.isDestroyed()) return;
        const { view: _v, ...info } = tab;
        this.win.webContents.send('tab-created', info);
      } catch { }
    };
    if (this.rendererReady) doSend(); else this.pendingUpdates.push(doSend);
  }

  private sendTabUpdate(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    const doSend = () => {
      try {
        if (this.win.isDestroyed() || this.win.webContents.isDestroyed()) return;
        const { view: _v, ...info } = tab;
        this.win.webContents.send('tab-updated', info);
      } catch { }
    };
    if (this.rendererReady) doSend(); else this.pendingUpdates.push(doSend);
  }
}
