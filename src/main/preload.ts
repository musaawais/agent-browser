import { contextBridge, ipcRenderer } from 'electron';

const api = {
  // Browser tab management
  browser: {
    newTab: (url?: string) => ipcRenderer.invoke('browser:new-tab', url),
    closeTab: (id: string) => ipcRenderer.invoke('browser:close-tab', id),
    activateTab: (id: string) => ipcRenderer.invoke('browser:activate-tab', id),
    navigate: (id: string, url: string) => ipcRenderer.invoke('browser:navigate', id, url),
    goBack: (id: string) => ipcRenderer.invoke('browser:go-back', id),
    goForward: (id: string) => ipcRenderer.invoke('browser:go-forward', id),
    reload: (id: string) => ipcRenderer.invoke('browser:reload', id),
    stop: (id: string) => ipcRenderer.invoke('browser:stop', id),
    onTabUpdated: (cb: (info: TabInfo) => void) => {
      ipcRenderer.on('tab-updated', (_, info) => cb(info));
      return () => ipcRenderer.removeAllListeners('tab-updated');
    },
    onOpenUrl: (cb: (url: string) => void) => {
      ipcRenderer.on('open-url-in-new-tab', (_, url) => cb(url));
      return () => ipcRenderer.removeAllListeners('open-url-in-new-tab');
    },
  },

  // Proxy / VPN management
  proxy: {
    set: (config: ProxyConfig) => ipcRenderer.invoke('proxy:set', config),
    clear: () => ipcRenderer.invoke('proxy:clear'),
    getState: () => ipcRenderer.invoke('proxy:get-state'),
  },

  // Agent task management
  agent: {
    createTask: (input: AgentTaskInput) => ipcRenderer.invoke('agent:create-task', input),
    startTask: (id: string) => ipcRenderer.invoke('agent:start-task', id),
    stopTask: (id: string) => ipcRenderer.invoke('agent:stop-task', id),
    deleteTask: (id: string) => ipcRenderer.invoke('agent:delete-task', id),
    getAllTasks: () => ipcRenderer.invoke('agent:get-all-tasks'),
    onTaskUpdated: (cb: (task: AgentTask) => void) => {
      ipcRenderer.on('agent:task-updated', (_, task) => cb(task));
      return () => ipcRenderer.removeAllListeners('agent:task-updated');
    },
  },

  // Settings / Store
  store: {
    get: (key: string) => ipcRenderer.invoke('store:get', key),
    set: (key: string, value: unknown) => ipcRenderer.invoke('store:set', key, value),
  },

  // App info
  platform: process.platform,
};

contextBridge.exposeInMainWorld('api', api);

// Types used in preload (also exported for renderer to import)
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

interface AgentTaskInput {
  name: string;
  keyword: string;
  urls: string[];
  country: string;
  countryCode: string;
  proxyHost: string;
  proxyPort: number;
  proxyProtocol: 'http' | 'socks5';
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
