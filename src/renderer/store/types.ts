export interface TabInfo {
  id: string;
  url: string;
  title: string;
  favicon: string;
  isLoading: boolean;
}

export interface ProxyConfig {
  country: string;
  countryCode: string;
  host: string;
  port: number;
  protocol: 'http' | 'socks5';
  username?: string;
  password?: string;
}

export interface ProxyState {
  enabled: boolean;
  current: ProxyConfig | null;
}

export interface AgentTaskInput {
  name: string;
  keyword: string;
  urls: string[];
  country: string;
  countryCode: string;
  /**
   * Proxy list — one entry per line.
   * Supported formats:
   *   host:port
   *   host:port:username:password
   *   http://username:password@host:port
   *   socks5://username:password@host:port
   *
   * The engine rotates through this list, one proxy per visit.
   * If a proxy fails, it falls back to direct (no proxy) for that visit.
   */
  proxyList: string[];
  visitCount: number;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  timeOnPageMin: number;
  timeOnPageMax: number;
  scrollSpeed: 'slow' | 'medium' | 'fast';
  clickInternalLinks: boolean;
  maxInternalLinks: number;
}

export interface AgentTask extends AgentTaskInput {
  id: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  progress: number;
  totalVisits: number;
  completedVisits: number;
  logs: string[];
  createdAt: number;
}

export type SidebarView = 'browser' | 'agent' | 'proxy' | 'settings';
