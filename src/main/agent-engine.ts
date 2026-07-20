/**
 * Agent Engine — controls a VISIBLE browser tab, just like AI browser agents.
 *
 * Flow for each visit:
 *  1. Navigate the visible tab to Google.com
 *  2. Type the keyword into the search box and submit
 *  3. Wait for Google results to load
 *  4. Navigate to the target URL
 *  5. Scroll the page naturally for the configured duration
 *  6. Optionally visit internal links
 *  7. Log every step to the activity log (shown in sidebar)
 */

import { WebContents } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { ProxyManager } from './proxy-manager';

// ── Types ────────────────────────────────────────────────────────────────────

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

const USER_AGENTS: Record<string, string> = {
  desktop:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  mobile:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  tablet:
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
};

// ── Engine ───────────────────────────────────────────────────────────────────

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

  /**
   * Start a task controlling the provided visible WebContents.
   * Called from the main process after a dedicated tab is created.
   */
  async startTask(taskId: string, webContents: WebContents): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task || task.status === 'running') return;

    task.status = 'running';
    task.logs = [];
    task.completedVisits = 0;
    task.progress = 0;
    this.runningTasks.set(taskId, true);
    this.emitStatus(task);

    // Apply user agent based on device type
    try {
      webContents.setUserAgent(USER_AGENTS[task.deviceType] || USER_AGENTS.desktop);
    } catch { /* ignore */ }

    try {
      await this.runVisibleTask(task, webContents);
    } catch (err) {
      task.status = 'error';
      task.logs.push(`❌ Error: ${(err as Error).message}`);
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
      task.logs.push('⏹ Stopped by user.');
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

  // ── Core visible-tab automation ──────────────────────────────────────────

  private async runVisibleTask(task: AgentTask, wc: WebContents): Promise<void> {
    for (let visitNum = 0; visitNum < task.visitCount; visitNum++) {
      for (const targetUrl of task.urls) {
        if (!this.isRunning(task)) return;

        const visitIndex = visitNum * task.urls.length + task.urls.indexOf(targetUrl) + 1;
        const visitLabel = `Visit ${task.completedVisits + 1}/${task.totalVisits}`;

        // ── Step 1: Go to Google ────────────────────────────────────────────
        if (task.keyword) {
          task.logs.push(`${visitLabel}: 🔍 Opening Google...`);
          this.emitStatus(task);

          await this.navigateTo(wc, 'https://www.google.com');
          if (!this.isRunning(task)) return;

          await this.sleep(800 + Math.random() * 600);

          // ── Step 2: Type keyword into search box ──────────────────────────
          task.logs.push(`${visitLabel}: ⌨️  Typing "${task.keyword}"...`);
          this.emitStatus(task);

          await this.typeAndSearch(wc, task.keyword);
          if (!this.isRunning(task)) return;

          // Wait for results page
          await this.sleep(2000 + Math.random() * 1000);
          await this.waitForIdle(wc, 8000);
          if (!this.isRunning(task)) return;

          task.logs.push(`${visitLabel}: ✅ Google results loaded`);
          this.emitStatus(task);
          await this.sleep(1000 + Math.random() * 800);
        }

        // ── Step 3: Navigate to the target site ───────────────────────────
        task.logs.push(`${visitLabel}: 🌐 Navigating to ${targetUrl}`);
        this.emitStatus(task);

        await this.navigateTo(wc, targetUrl);
        if (!this.isRunning(task)) return;

        task.logs.push(`${visitLabel}: ✅ Page loaded`);
        this.emitStatus(task);

        // ── Step 4: Scroll the page ───────────────────────────────────────
        const timeMs =
          (task.timeOnPageMin +
            Math.random() * (task.timeOnPageMax - task.timeOnPageMin)) *
          1000;
        task.logs.push(
          `${visitLabel}: 📜 Scrolling page for ${Math.round(timeMs / 1000)}s...`
        );
        this.emitStatus(task);

        await this.scrollPage(wc, task, timeMs);
        if (!this.isRunning(task)) return;

        // ── Step 5: Visit internal links ──────────────────────────────────
        if (task.clickInternalLinks) {
          await this.visitInternalLinks(wc, task, targetUrl);
          if (!this.isRunning(task)) return;
        }

        // ── Done with this visit ──────────────────────────────────────────
        task.completedVisits++;
        task.progress = Math.round(
          (task.completedVisits / task.totalVisits) * 100
        );
        task.logs.push(`${visitLabel}: 🎯 Complete (${task.progress}%)`);
        this.emitStatus(task);

        // Pause between visits
        if (
          visitNum < task.visitCount - 1 ||
          task.urls.indexOf(targetUrl) < task.urls.length - 1
        ) {
          await this.sleep(2000 + Math.random() * 3000);
        }
      }
    }

    task.status = 'completed';
    task.progress = 100;
    task.logs.push('🎉 All visits completed successfully!');
    this.emitStatus(task);
  }

  // ── Navigation helpers ────────────────────────────────────────────────────

  /**
   * Load a URL and wait for it to finish (with 30s timeout).
   * Resolves even on error so the task can continue.
   */
  private navigateTo(wc: WebContents, url: string): Promise<void> {
    return new Promise((resolve) => {
      if (wc.isDestroyed()) { resolve(); return; }

      const done = (reason?: string) => {
        clearTimeout(timer);
        wc.removeListener('did-finish-load', onFinish);
        wc.removeListener('did-fail-load', onFail);
        resolve();
      };

      const timer = setTimeout(() => done('timeout'), 30_000);
      const onFinish = () => done('finish');
      const onFail = (_e: any, code: number, desc: string) => {
        // Only bail on real errors, not aborted navigations (-3)
        if (code !== -3) done(`fail:${desc}`);
      };

      wc.once('did-finish-load', onFinish);
      wc.once('did-fail-load', onFail);
      wc.loadURL(url).catch(() => done('load-error'));
    });
  }

  /**
   * Wait until the page stops loading (network idle), with a max timeout.
   */
  private waitForIdle(wc: WebContents, maxMs = 10_000): Promise<void> {
    return new Promise((resolve) => {
      if (wc.isDestroyed() || !wc.isLoading()) { resolve(); return; }
      const timer = setTimeout(resolve, maxMs);
      wc.once('did-stop-loading', () => { clearTimeout(timer); resolve(); });
    });
  }

  /**
   * Inject JavaScript that fills the Google search textarea and submits the form.
   * Simulates character-by-character typing for natural appearance.
   */
  private async typeAndSearch(wc: WebContents, keyword: string): Promise<void> {
    if (wc.isDestroyed()) return;

    try {
      const keywordJson = JSON.stringify(keyword);
      const charDelay = 60; // ms between characters

      await wc.executeJavaScript(`
        (function() {
          // Try textarea first (new Google), then input (old / search results)
          var el = document.querySelector('textarea[name="q"]')
                || document.querySelector('input[name="q"]')
                || document.querySelector('input[type="search"]')
                || document.querySelector('[role="combobox"]');

          if (!el) return 'no-input';

          el.focus();
          el.value = '';

          var chars = ${keywordJson}.split('');
          var delay = 0;

          chars.forEach(function(ch) {
            setTimeout(function() {
              el.value += ch;
              el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch }));
              el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: ch }));
              el.dispatchEvent(new KeyboardEvent('keyup',  { bubbles: true, key: ch }));
            }, delay);
            delay += ${charDelay};
          });

          // Press Enter after all characters are typed
          setTimeout(function() {
            el.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', keyCode: 13 }));
            var form = el.closest('form');
            if (form) {
              form.submit();
            } else {
              el.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: 'Enter', keyCode: 13 }));
            }
          }, delay + 100);

          return 'typed';
        })();
      `);

      // Wait for typing + Enter to land
      await this.sleep(keyword.length * charDelay + 400);
    } catch { /* page may have navigated, that's fine */ }
  }

  /**
   * Smoothly scroll the page up and down for `durationMs` milliseconds.
   */
  private async scrollPage(
    wc: WebContents,
    task: AgentTask,
    durationMs: number
  ): Promise<void> {
    const speeds = {
      slow:   { step: 120, pause: 900 },
      medium: { step: 280, pause: 550 },
      fast:   { step: 480, pause: 300 },
    };
    const { step, pause } = speeds[task.scrollSpeed] || speeds.medium;
    const end = Date.now() + durationMs;

    while (Date.now() < end && this.isRunning(task)) {
      if (wc.isDestroyed()) break;

      const direction = Math.random() > 0.25 ? 1 : -1; // 75% down, 25% up
      const amount = step + Math.random() * step;

      try {
        await wc.executeJavaScript(`
          (function() {
            var target = window.scrollY + (${amount} * ${direction});
            target = Math.max(0, Math.min(target, document.body.scrollHeight - window.innerHeight));
            window.scrollTo({ top: target, behavior: 'smooth' });
          })();
        `);
      } catch { break; }

      await this.sleep(pause + Math.random() * 300);
    }
  }

  /**
   * Find internal links on the current page and navigate to them one by one.
   */
  private async visitInternalLinks(
    wc: WebContents,
    task: AgentTask,
    baseUrl: string
  ): Promise<void> {
    try {
      const origin = new URL(baseUrl).origin;
      const max = task.maxInternalLinks || 3;

      const links = await wc.executeJavaScript(`
        (function() {
          return Array.from(document.querySelectorAll('a[href]'))
            .map(function(a) { return a.href; })
            .filter(function(href) {
              try {
                var u = new URL(href);
                return u.origin === ${JSON.stringify(origin)} && u.href !== window.location.href;
              } catch(e) { return false; }
            })
            .slice(0, ${max * 3});
        })();
      `) as string[];

      if (!links || links.length === 0) return;

      const chosen = links.sort(() => Math.random() - 0.5).slice(0, max);

      for (const link of chosen) {
        if (!this.isRunning(task)) break;
        if (wc.isDestroyed()) break;

        task.logs.push(`  🔗 Internal: ${link}`);
        this.emitStatus(task);

        await this.navigateTo(wc, link);
        await this.scrollPage(wc, task, 6000 + Math.random() * 8000);
        await this.sleep(1000 + Math.random() * 1500);
      }
    } catch { /* ignore */ }
  }

  // ── Utilities ─────────────────────────────────────────────────────────────

  private isRunning(task: AgentTask): boolean {
    return !!this.runningTasks.get(task.id);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private emitStatus(task: AgentTask): void {
    this.statusCallback?.(task);
  }
}
