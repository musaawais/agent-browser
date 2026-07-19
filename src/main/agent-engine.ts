import { BrowserWindow, WebContentsView, session } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { ProxyManager } from './proxy-manager';

export interface AgentTask {
  id: string;
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
  status: 'idle' | 'running' | 'paused' | 'completed' | 'error';
  progress: number;
  totalVisits: number;
  completedVisits: number;
  logs: string[];
  createdAt: number;
}

export interface AgentTaskInput {
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

const DEVICE_PROFILES: Record<string, Electron.WebPreferences & { userAgent: string; viewport: { width: number; height: number } }> = {
  desktop: {
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  },
  mobile: {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 390, height: 844 },
  },
  tablet: {
    userAgent:
      'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    viewport: { width: 1024, height: 1366 },
  },
};

const SCROLL_SPEEDS: Record<string, { min: number; max: number; pause: number }> = {
  slow: { min: 200, max: 600, pause: 2000 },
  medium: { min: 600, max: 1200, pause: 1000 },
  fast: { min: 1200, max: 2000, pause: 500 },
};

export class AgentEngine {
  private tasks: Map<string, AgentTask> = new Map();
  private runningTasks: Map<string, boolean> = new Map();
  private proxyManager: ProxyManager;
  private statusCallback: ((task: AgentTask) => void) | null = null;

  constructor(proxyManager: ProxyManager) {
    this.proxyManager = proxyManager;
  }

  onStatusChange(cb: (task: AgentTask) => void) {
    this.statusCallback = cb;
  }

  createTask(input: AgentTaskInput): AgentTask {
    const task: AgentTask = {
      id: uuidv4(),
      ...input,
      status: 'idle',
      progress: 0,
      totalVisits: input.visitCount * input.urls.length,
      completedVisits: 0,
      logs: [],
      createdAt: Date.now(),
    };
    this.tasks.set(task.id, task);
    this.emitStatus(task);
    return task;
  }

  async startTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'running') return;

    task.status = 'running';
    task.logs = [];
    task.completedVisits = 0;
    task.progress = 0;
    this.runningTasks.set(taskId, true);
    this.emitStatus(task);

    try {
      await this.runTask(task);
    } catch (err) {
      task.status = 'error';
      task.logs.push(`Error: ${(err as Error).message}`);
      this.emitStatus(task);
    } finally {
      this.runningTasks.delete(taskId);
    }
  }

  stopTask(taskId: string): void {
    this.runningTasks.set(taskId, false);
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = 'idle';
      task.logs.push('Task stopped by user.');
      this.emitStatus(task);
    }
  }

  getAllTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }

  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }

  deleteTask(taskId: string): void {
    this.stopTask(taskId);
    this.tasks.delete(taskId);
  }

  private async runTask(task: AgentTask): Promise<void> {
    const device = DEVICE_PROFILES[task.deviceType] || DEVICE_PROFILES.desktop;

    for (let visit = 0; visit < task.visitCount; visit++) {
      for (const targetUrl of task.urls) {
        if (!this.runningTasks.get(task.id)) {
          task.status = 'idle';
          this.emitStatus(task);
          return;
        }

        task.logs.push(`Visit ${task.completedVisits + 1}/${task.totalVisits}: ${targetUrl}`);
        this.emitStatus(task);

        // Create invisible agent window
        const agentWindow = new BrowserWindow({
          show: false,
          width: device.viewport.width,
          height: device.viewport.height,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            javascript: true,
          },
        });

        try {
          // Set proxy if configured
          if (task.proxyHost && task.proxyPort) {
            const proxyRules =
              task.proxyProtocol === 'socks5'
                ? `socks5://${task.proxyHost}:${task.proxyPort}`
                : `http://${task.proxyHost}:${task.proxyPort}`;
            await agentWindow.webContents.session.setProxy({ proxyRules });
          }

          // Set user agent
          agentWindow.webContents.setUserAgent(device.userAgent);

          // Navigate to target
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Page load timeout')), 30000);

            agentWindow.webContents.once('did-finish-load', () => {
              clearTimeout(timeout);
              resolve();
            });

            agentWindow.webContents.once('did-fail-load', (_, code, desc) => {
              clearTimeout(timeout);
              reject(new Error(`Load failed: ${desc} (${code})`));
            });

            agentWindow.webContents.loadURL(targetUrl);
          });

          // Calculate time to spend on page
          const timeMin = task.timeOnPageMin * 1000;
          const timeMax = task.timeOnPageMax * 1000;
          const timeOnPage = timeMin + Math.random() * (timeMax - timeMin);

          task.logs.push(
            `  Browsing for ${Math.round(timeOnPage / 1000)}s on ${targetUrl}`
          );
          this.emitStatus(task);

          // Simulate scrolling behavior
          await this.simulateScrolling(agentWindow, task, timeOnPage);

          // Click internal links if enabled
          if (task.clickInternalLinks) {
            await this.simulateInternalNavigation(agentWindow, task, targetUrl);
          }

          task.completedVisits++;
          task.progress = Math.round((task.completedVisits / task.totalVisits) * 100);
          task.logs.push(`  Completed visit ${task.completedVisits}/${task.totalVisits}`);
          this.emitStatus(task);

          // Random pause between visits (2-8 seconds)
          await this.sleep(2000 + Math.random() * 6000);
        } catch (err) {
          task.logs.push(`  Warning: ${(err as Error).message}`);
          this.emitStatus(task);
        } finally {
          agentWindow.destroy();
        }
      }
    }

    task.status = 'completed';
    task.progress = 100;
    task.logs.push('All visits completed successfully.');
    this.emitStatus(task);
  }

  private async simulateScrolling(
    win: BrowserWindow,
    task: AgentTask,
    durationMs: number
  ): Promise<void> {
    const speed = SCROLL_SPEEDS[task.scrollSpeed] || SCROLL_SPEEDS.medium;
    const startTime = Date.now();

    while (Date.now() - startTime < durationMs) {
      if (!this.runningTasks.get(task.id)) break;

      // Calculate scroll distance
      const scrollAmount = speed.min + Math.random() * (speed.max - speed.min);
      const direction = Math.random() > 0.2 ? 1 : -1; // 80% down, 20% up

      await win.webContents.executeJavaScript(`
        (function() {
          var amount = ${scrollAmount * direction};
          var duration = ${speed.pause};
          var start = window.scrollY;
          var target = Math.max(0, Math.min(start + amount, document.body.scrollHeight - window.innerHeight));
          var startTime = performance.now();
          
          function step(now) {
            var elapsed = now - startTime;
            var progress = Math.min(elapsed / duration, 1);
            // Ease in-out
            var ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
            window.scrollTo(0, start + (target - start) * ease);
            if (progress < 1) requestAnimationFrame(step);
          }
          
          requestAnimationFrame(step);
        })();
      `).catch(() => {});

      await this.sleep(speed.pause + Math.random() * 1000);
    }
  }

  private async simulateInternalNavigation(
    win: BrowserWindow,
    task: AgentTask,
    baseUrl: string
  ): Promise<void> {
    try {
      const baseOrigin = new URL(baseUrl).origin;
      const maxLinks = task.maxInternalLinks || 3;

      // Find internal links on the page
      const links = await win.webContents.executeJavaScript(`
        (function() {
          var links = Array.from(document.querySelectorAll('a[href]'));
          var origin = '${baseOrigin}';
          var internal = links
            .map(a => a.href)
            .filter(href => {
              try {
                var url = new URL(href);
                return url.origin === origin && url.href !== window.location.href;
              } catch(e) { return false; }
            })
            .slice(0, ${maxLinks * 3});
          return internal;
        })();
      `) as string[];

      if (!links || links.length === 0) return;

      // Randomly select up to maxLinks links
      const shuffled = links.sort(() => Math.random() - 0.5).slice(0, maxLinks);

      for (const link of shuffled) {
        if (!this.runningTasks.get(task.id)) break;

        task.logs.push(`  Navigating to internal link: ${link}`);
        this.emitStatus(task);

        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 15000);
          win.webContents.once('did-finish-load', () => {
            clearTimeout(timeout);
            resolve();
          });
          win.webContents.loadURL(link);
        });

        // Spend time on internal page too
        const innerTime = 8000 + Math.random() * 12000;
        await this.simulateScrolling(win, task, innerTime);
        await this.sleep(1000 + Math.random() * 2000);
      }
    } catch {
      // Silently ignore navigation errors
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private emitStatus(task: AgentTask): void {
    this.statusCallback?.(task);
  }
}
