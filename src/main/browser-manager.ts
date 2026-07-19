import { BrowserWindow, WebContentsView, Rectangle } from 'electron';

export interface TabInfo {
  id: string;
  view: WebContentsView;
  url: string;
  title: string;
  favicon: string;
  isLoading: boolean;
}

const CHROME_HEIGHT = 90; // height of address bar + tab bar

export class BrowserManager {
  private win: BrowserWindow;
  private tabs: Map<string, TabInfo> = new Map();
  private activeTabId: string | null = null;

  constructor(win: BrowserWindow) {
    this.win = win;
  }

  private getBrowserBounds(): Rectangle {
    const [width, height] = this.win.getContentSize();
    return {
      x: 0,
      y: CHROME_HEIGHT,
      width,
      height: height - CHROME_HEIGHT,
    };
  }

  createTab(id: string, url = 'about:blank'): TabInfo {
    const view = new WebContentsView({
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        allowRunningInsecureContent: false,
        javascript: true,
      },
    });

    view.webContents.loadURL(url);

    view.webContents.on('did-start-loading', () => {
      const tab = this.tabs.get(id);
      if (tab) {
        tab.isLoading = true;
        this.sendTabUpdate(id);
      }
    });

    view.webContents.on('did-stop-loading', () => {
      const tab = this.tabs.get(id);
      if (tab) {
        tab.isLoading = false;
        tab.url = view.webContents.getURL();
        this.sendTabUpdate(id);
      }
    });

    view.webContents.on('page-title-updated', (_, title) => {
      const tab = this.tabs.get(id);
      if (tab) {
        tab.title = title;
        this.sendTabUpdate(id);
      }
    });

    view.webContents.on('page-favicon-updated', (_, favicons) => {
      const tab = this.tabs.get(id);
      if (tab && favicons.length > 0) {
        tab.favicon = favicons[0];
        this.sendTabUpdate(id);
      }
    });

    view.webContents.on('did-navigate', (_, url) => {
      const tab = this.tabs.get(id);
      if (tab) {
        tab.url = url;
        this.sendTabUpdate(id);
      }
    });

    const tabInfo: TabInfo = {
      id,
      view,
      url,
      title: 'New Tab',
      favicon: '',
      isLoading: false,
    };

    this.tabs.set(id, tabInfo);
    return tabInfo;
  }

  activateTab(id: string) {
    // Hide current active tab
    if (this.activeTabId && this.activeTabId !== id) {
      const currentTab = this.tabs.get(this.activeTabId);
      if (currentTab) {
        this.win.contentView.removeChildView(currentTab.view);
      }
    }

    const tab = this.tabs.get(id);
    if (!tab) return;

    this.activeTabId = id;
    this.win.contentView.addChildView(tab.view);
    tab.view.setBounds(this.getBrowserBounds());
  }

  closeTab(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    if (this.activeTabId === id) {
      this.win.contentView.removeChildView(tab.view);
      this.activeTabId = null;
    }

    (tab.view.webContents as any).destroy();
    this.tabs.delete(id);
  }

  navigateTab(id: string, url: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;

    // Ensure URL has protocol
    let navigateUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('about:')) {
      // Check if it looks like a URL or a search query
      if (url.includes('.') && !url.includes(' ')) {
        navigateUrl = 'https://' + url;
      } else {
        navigateUrl = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
      }
    }

    tab.view.webContents.loadURL(navigateUrl);
  }

  goBack(id: string) {
    const tab = this.tabs.get(id);
    if (tab?.view.webContents.canGoBack()) {
      tab.view.webContents.goBack();
    }
  }

  goForward(id: string) {
    const tab = this.tabs.get(id);
    if (tab?.view.webContents.canGoForward()) {
      tab.view.webContents.goForward();
    }
  }

  reload(id: string) {
    const tab = this.tabs.get(id);
    tab?.view.webContents.reload();
  }

  stopLoading(id: string) {
    const tab = this.tabs.get(id);
    tab?.view.webContents.stop();
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
      if (tab) {
        tab.view.setBounds(this.getBrowserBounds());
      }
    }
  }

  getWebContents(id: string) {
    return this.tabs.get(id)?.view.webContents;
  }

   private sendTabUpdate(id: string) {
    const tab = this.tabs.get(id);
    if (!tab) return;
    if (this.win.isDestroyed() || this.win.webContents.isDestroyed()) return;
    if (tab.view.webContents.isDestroyed()) return;
    const { view: _view, ...info } = tab;
    this.win.webContents.send('tab-updated', info);
  }
}
