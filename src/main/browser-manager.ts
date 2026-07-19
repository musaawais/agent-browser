import { BrowserWindow, WebContentsView, Rectangle } from 'electron';

export interface TabInfo {
  id: string;
  view: WebContentsView;
  url: string;
  title: string;
  favicon: string;
  isLoading: boolean;
}

const CHROME_HEIGHT = 90;

export class BrowserManager {
  private win: BrowserWindow;
  private tabs: Map<string, TabInfo> = new Map();
  private activeTabId: string | null = null;
  private rendererReady = false;
  private pendingUpdates: Array<() => void> = [];

  constructor(win: BrowserWindow) {
    this.win = win;
    // Wait for renderer to be ready before sending any IPC messages
    win.webContents.once('did-finish-load', () => {
      this.rendererReady = true;
      // Flush any queued updates
      this.pendingUpdates.forEach((fn) => fn());
      this.pendingUpdates = [];
    });
  }

  private getBrowserBounds(): Rectangle {
    const [width, height] = this.win.getContentSize();
    return { x: 0, y: CHROME_HEIGHT, width, height: height - CHROME_HEIGHT };
  }

  createTab(id: string, url = 'about:blank'): TabInfo {
    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        javascript: true,
      },
    });

    view.webContents.loadURL(url);

    view.webContents.on('did-start-loading', () => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed()) {
        tab.isLoading = true;
        this.sendTabUpdate(id);
      }
    });

    view.webContents.on('did-stop-loading', () => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed()) {
        tab.isLoading = false;
        tab.url = view.webContents.getURL();
        this.sendTabUpdate(id);
      }
    });

    view.webContents.on('page-title-updated', (_, title) => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed()) {
        tab.title = title;
        this.sendTabUpdate(id);
      }
    });

    view.webContents.on('page-favicon-updated', (_, favicons) => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed() && favicons.length > 0) {
        tab.favicon = favicons[0];
        this.sendTabUpdate(id);
      }
    });

    view.webContents.on('did-navigate', (_, navUrl) => {
      const tab = this.tabs.get(id);
      if (tab && !view.webContents.isDestroyed()) {
        tab.url = navUrl;
        this.sendTabUpdate(id);
      }
    });

    const tabInfo: TabInfo = { id, view, url, title: 'New Tab', favicon: '', isLoading: true };
    this.tabs.set(id, tabInfo);
    return tabInfo;
  }

  activateTab(id: string) {
    if (this.activeTabId && this.activeTabId !== id) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        try { this.win.contentView.removeChildView(currentTab.view); } catch {}
      }
    }
    const tab = this.tabs.get(id);
    if (!tab) return;
    this.activeTabId = id;
    try {
      this.win.contentView.addChildView(tab.view);
      tab.view.setBounds(this.getBrowserBounds());
    } catch {}
  }

  closeTab(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    if (this.activeTabId === id) {
      try { this.win.contentView.removeChildView(tab.view); } catch {}
      this.activeTabId = null;
    }
    try { (tab.view.webContents as any).destroy(); } catch {}
    this.tabs.delete(id);
  }

  navigateTab(id: string, url: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    let navigateUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      if (url.includes('.') && !url.includes(' ')) {
        navigateUrl = 'https://' + url;
      } else {
        navigateUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }
    try { tab.view.webContents.loadURL(navigateUrl); } catch {}
  }

  goBack(id: string) {
    const tab = this.tabs.get(id);
    try {
      if (tab?.view.webContents.canGoBack()) tab.view.webContents.goBack();
    } catch {}
  }

  goForward(id: string) {
    const tab = this.tabs.get(id);
    try {
      if (tab?.view.webContents.canGoForward()) tab.view.webContents.goForward();
    } catch {}
  }

  reload(id: string) {
    const tab = this.tabs.get(id);
    try { tab?.view.webContents.reload(); } catch {}
  }

  stopLoading(id: string) {
    const tab = this.tabs.get(id);
    try { tab?.view.webContents.stop(); } catch {}
  }

  getTabInfo(id: string): Omit<TabInfo, 'view'> | null {
    const tab = this.tabs.get(id);
    if (!tab) return null;
    const { view: _view, ...info } = tab;
    return info;
  }

  repositionViews() {
    if (this.activeTabId) {
      const tab = this.tabs.get(this.activeTabId);
      try { if (tab) tab.view.setBounds(this.getBrowserBounds()); } catch {}
    }
  }

  getWebContents(id: string) {
    return this.tabs.get(id)?.view.webContents;
  }

  private sendTabUpdate(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    const doSend = () => {
      try {
        if (this.win.isDestroyed() || this.win.webContents.isDestroyed()) return;
        const { view: _view, ...info } = tab;
        this.win.webContents.send('tab-updated', info);
      } catch {}
    };

    if (this.rendererReady) {
      doSend();
    } else {
      this.pendingUpdates.push(doSend);
    }
  }
}
