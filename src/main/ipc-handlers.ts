import { IpcMain, BrowserWindow } from 'electron';
import { BrowserManager } from './browser-manager';
import { ProxyManager, ProxyConfig } from './proxy-manager';
import { AgentEngine, AgentTaskInput } from './agent-engine';
import { SimpleStore } from './simple-store';
import { v4 as uuidv4 } from 'uuid';

export function setupIpcHandlers(
  ipcMain: IpcMain,
  mainWindow: BrowserWindow,
  browserManager: BrowserManager,
  proxyManager: ProxyManager,
  agentEngine: AgentEngine,
  store: SimpleStore
) {
  // ─── Browser Tab Handlers ────────────────────────────────────────────────
  ipcMain.handle('browser:new-tab', (_, url?: string) => {
    const id = uuidv4();
    const tab = browserManager.createTab(id, url || 'https://www.google.com');
    browserManager.activateTab(id);
    return { id, url: tab.url, title: tab.title, favicon: tab.favicon, isLoading: false };
  });

  ipcMain.handle('browser:close-tab', (_, id: string) => {
    browserManager.closeTab(id);
    return { success: true };
  });

  ipcMain.handle('browser:activate-tab', (_, id: string) => {
    browserManager.activateTab(id);
    return { success: true };
  });

  ipcMain.handle('browser:navigate', (_, id: string, url: string) => {
    browserManager.navigateTab(id, url);
    return { success: true };
  });

  ipcMain.handle('browser:go-back', (_, id: string) => {
    browserManager.goBack(id);
    return { success: true };
  });

  ipcMain.handle('browser:go-forward', (_, id: string) => {
    browserManager.goForward(id);
    return { success: true };
  });

  ipcMain.handle('browser:reload', (_, id: string) => {
    browserManager.reload(id);
    return { success: true };
  });

  ipcMain.handle('browser:stop', (_, id: string) => {
    browserManager.stopLoading(id);
    return { success: true };
  });

  // ─── Proxy Handlers ──────────────────────────────────────────────────────
  ipcMain.handle('proxy:set', async (_, config: ProxyConfig) => {
    await proxyManager.setProxy(config);
    return { success: true };
  });

  ipcMain.handle('proxy:clear', async () => {
    await proxyManager.clearProxy();
    return { success: true };
  });

  ipcMain.handle('proxy:get-state', () => {
    return proxyManager.getState();
  });

  // ─── Agent Handlers ──────────────────────────────────────────────────────
  agentEngine.onStatusChange((task) => {
    mainWindow.webContents.send('agent:task-updated', task);
  });

  ipcMain.handle('agent:create-task', (_, input: AgentTaskInput) => {
    return agentEngine.createTask(input);
  });

  ipcMain.handle('agent:start-task', async (_, id: string) => {
    // Run async but don't await so it runs in background
    agentEngine.startTask(id).catch(console.error);
    return { success: true };
  });

  ipcMain.handle('agent:stop-task', (_, id: string) => {
    agentEngine.stopTask(id);
    return { success: true };
  });

  ipcMain.handle('agent:delete-task', (_, id: string) => {
    agentEngine.deleteTask(id);
    return { success: true };
  });

  ipcMain.handle('agent:get-all-tasks', () => {
    return agentEngine.getAllTasks();
  });

  // ─── Store Handlers ──────────────────────────────────────────────────────
  ipcMain.handle('store:get', (_, key: string) => {
    return store.get(key);
  });

  ipcMain.handle('store:set', (_, key: string, value: unknown) => {
    store.set(key, value);
    return { success: true };
  });
}
