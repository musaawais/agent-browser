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

  async clearProxy(): Promise<void> {
    await session.defaultSession.setProxy({ proxyRules: 'direct://' });
    this.state = { enabled: false, current: null };
  }

  getState(): ProxyState {
    return { ...this.state };
  }

  async setProxyForWebContents(
    webContents: Electron.WebContents,
    config: ProxyConfig
  ): Promise<void> {
    const sess = webContents.session;
    const proxyRules =
      config.protocol === 'socks5'
        ? `socks5://${config.host}:${config.port}`
        : `http://${config.host}:${config.port}`;
    await sess.setProxy({ proxyRules });
  }
}
