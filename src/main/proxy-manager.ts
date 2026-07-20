import { session } from 'electron';

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

export class ProxyManager {
  private state: ProxyState = { enabled: false, current: null };

  async setProxy(config: ProxyConfig): Promise<void> {
    const proxyRules =
      config.protocol === 'socks5'
        ? `socks5://${config.host}:${config.port}`
        : `http://${config.host}:${config.port}`;

    await session.defaultSession.setProxy({ proxyRules });
    this.state = { enabled: true, current: config };
  }

  /**
   * Clear the app-level proxy and go back to following the OS network stack.
   * Using mode:'system' (not 'direct') means the system VPN / system proxy
   * settings remain in effect — 'direct' would bypass them completely.
   */
  async clearProxy(): Promise<void> {
    await session.defaultSession.setProxy({ mode: 'system' } as any);
    this.state = { enabled: false, current: null };
  }

  getState(): ProxyState {
    return { ...this.state };
  }
}
