import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // ── Browser tab management ──────────────────────────────────────────────
  browser: {
    newTab: (url?: string) => ipcRenderer.invoke('browser:new-tab', url),
    closeTab: (id: string) => ipcRenderer.invoke('browser:close-tab', id),
    activateTab: (id: string) => ipcRenderer.invoke('browser:activate-tab', id),
    navigate: (id: string, url: string) => ipcRenderer.invoke('browser:navigate', id, url),
    goBack: (id: string) => ipcRenderer.invoke('browser:go-back', id),
    goForward: (id: string) => ipcRenderer.invoke('browser:go-forward', id),
    reload: (id: string) => ipcRenderer.invoke('browser:reload', id),
    stop: (id: string) => ipcRenderer.invoke('browser:stop', id),
    setSidebarWidth: (width: number) => ipcRenderer.invoke('browser:set-sidebar-width', width),

    onTabUpdated: (cb: (info: TabInfo) => void) => {
      const fn = (_: Electron.IpcRendererEvent, info: TabInfo) => cb(info);
      ipcRenderer.on('tab-updated', fn);
      return () => ipcRenderer.removeListener('tab-updated', fn);
    },

    onTabCreated: (cb: (info: TabInfo) => void) => {
      const fn = (_: Electron.IpcRendererEvent, info: TabInfo) => cb(info);
      ipcRenderer.on('tab-created', fn);
      return () => ipcRenderer.removeListener('tab-created', fn);
    },

    onOpenUrl: (cb: (url: string) => void) => {
      const fn = (_: Electron.IpcRendererEvent, url: string) => cb(url);
      ipcRenderer.on('open-url-in-new-tab', fn);
      return () => ipcRenderer.removeListener('open-url-in-new-tab', fn);
    },
  },

  // ── Proxy / VPN management ──────────────────────────────────────────────
  proxy: {
    set: (config: ProxyConfig) => ipcRenderer.invoke('proxy:set', config),
    clear: () => ipcRenderer.invoke('proxy:clear'),
    getState: () => ipcRenderer.invoke('proxy:get-state'),
  },

  // ── Agent task management ───────────────────────────────────────────────
  agent: {
    createTask: (input: AgentTaskInput) => ipcRenderer.invoke('agent:create-task', input),
    startTask: (id: string) => ipcRenderer.invoke('agent:start-task', id),
    stopTask: (id: string) => ipcRenderer.invoke('agent:stop-task', id),
    deleteTask: (id: string) => ipcRenderer.invoke('agent:delete-task', id),
    getAllTasks: () => ipcRenderer.invoke('agent:get-all-tasks'),
    onTaskUpdated: (cb: (task: AgentTask) => void) => {
      const fn = (_: Electron.IpcRendererEvent, task: AgentTask) => cb(task);
      ipcRenderer.on('agent:task-updated', fn);
      return () => ipcRenderer.removeListener('agent:task-updated', fn);
    },
  },

  // ── Settings / Store ────────────────────────────────────────────────────
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  },

  platform: process.platform,
};

contextBridge.exposeInMainWorld('api', api);

// ── Local type definitions ───────────────────────────────────────────────────
interface TabInfo {
  id: string;
  url: string;
  title: string;
  favicon: string;
  isLoading: boolean;
}

interface ProxyConfig {
  country: string;
  countryCode: string;
  host: string;
  port: number;
  protocol: 'http' | 'socks5';
  username?: string;
  password?: string;
}

/**
 * proxyList: one entry per line.
 * Supported formats:
 *   host:port
 *   host:port:username:password
 *   http://username:password@host:port
 *   socks5://username:password@host:port
 *
 * The agent rotates through this list, one proxy per visit (one IP per session).
 * Each visit also gets a fresh isolated session so GA4 sees a new user.
 */
interface AgentTaskInput {
  name: string;
  keyword: string;
  urls: string[];
  country: string;
  countryCode: string;
  proxyList: string[];
  visitCount: number;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  timeOnPageMin: number;
  timeOnPageMax: number;
  scrollSpeed: 'slow' | 'medium' | 'fast';
  clickInternalLinks: boolean;
  maxInternalLinks: number;
}

interface AgentTask extends AgentTaskInput {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  progress: number;
  totalVisits: number;
  completedVisits: number;
  logs: string[];
  createdAt: number;
}
