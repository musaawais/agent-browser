import React, { useState, useEffect, useCallback } from 'react';
import type { TabInfo, AgentTask, SidebarView } from './store/types';
import { TabBar } from './components/Browser/TabBar';
import { NavigationBar } from './components/Browser/NavigationBar';
import { Sidebar } from './components/Sidebar';
import { AgentPanel } from './components/Agent/AgentPanel';
import { ProxyPanel } from './components/Proxy/ProxyPanel';
import { SettingsPanel } from './components/SettingsPanel';
import { v4 as uuidv4 } from 'uuid';

declare global {
  interface Window {
    api: typeof import('./api').api;
  }
}

const api = window.api;

export default function App() {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>('browser');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);

  // Open initial tab
  useEffect(() => {
    openNewTab();
    loadAgentTasks();
  }, []);

  // Listen for tab updates from main process
  useEffect(() => {
    const cleanup = api.browser.onTabUpdated((info: TabInfo) => {
      setTabs((prev) =>
        prev.map((t) => (t.id === info.id ? { ...t, ...info } : t))
      );
    });

    const cleanupUrl = api.browser.onOpenUrl((url: string) => {
      openNewTab(url);
    });

    return () => {
      cleanup();
      cleanupUrl();
    };
  }, []);

  // Listen for agent task updates
  useEffect(() => {
    const cleanup = api.agent.onTaskUpdated((task: AgentTask) => {
      setAgentTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === task.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = task;
          return next;
        }
        return [...prev, task];
      });
    });
    return cleanup;
  }, []);

  const loadAgentTasks = async () => {
    const tasks = await api.agent.getAllTasks();
    setAgentTasks(tasks);
  };

  const openNewTab = useCallback(async (url?: string) => {
    const tab = await api.browser.newTab(url);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  }, []);

  const closeTab = useCallback(
    async (id: string) => {
      await api.browser.closeTab(id);
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (id === activeTabId && next.length > 0) {
          const lastTab = next[next.length - 1];
          setActiveTabId(lastTab.id);
          api.browser.activateTab(lastTab.id);
        } else if (next.length === 0) {
          openNewTab();
        }
        return next;
      });
    },
    [activeTabId, openNewTab]
  );

  const activateTab = useCallback(async (id: string) => {
    setActiveTabId(id);
    await api.browser.activateTab(id);
  }, []);

  const navigate = useCallback(
    async (url: string) => {
      if (!activeTabId) return;
      await api.browser.navigate(activeTabId, url);
    },
    [activeTabId]
  );

  const goBack = useCallback(async () => {
    if (activeTabId) await api.browser.goBack(activeTabId);
  }, [activeTabId]);

  const goForward = useCallback(async () => {
    if (activeTabId) await api.browser.goForward(activeTabId);
  }, [activeTabId]);

  const reload = useCallback(async () => {
    if (activeTabId) await api.browser.reload(activeTabId);
  }, [activeTabId]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  const SIDEBAR_WIDTH = sidebarOpen ? 320 : 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0f0f13]">
      {/* Chrome (tabs + navigation) */}
      <div
        className="drag-region flex flex-col shrink-0 border-b border-white/[0.06]"
        style={{ height: 90 }}
      >
        {/* Tab bar row */}
        <div className="flex items-center pl-[80px] pr-2 pt-2" style={{ height: 42 }}>
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onActivate={activateTab}
            onClose={closeTab}
            onNewTab={() => openNewTab()}
          />
        </div>

        {/* Navigation bar row */}
        <div className="flex items-center px-3 pb-2 gap-2" style={{ height: 48 }}>
          <NavigationBar
            activeTab={activeTab}
            onNavigate={navigate}
            onBack={goBack}
            onForward={goForward}
            onReload={reload}
            sidebarOpen={sidebarOpen}
            sidebarView={sidebarView}
            onToggleSidebar={(view: SidebarView) => {
              if (sidebarView === view && sidebarOpen) {
                setSidebarOpen(false);
              } else {
                setSidebarView(view);
                setSidebarOpen(true);
              }
            }}
          />
        </div>
      </div>

      {/* Content area: browser pane + optional sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Browser view area (Electron injects WebContentsView here) */}
        <div className="flex-1 bg-white" />

        {/* Right sidebar */}
        {sidebarOpen && (
          <div
            className="sidebar flex flex-col shrink-0 overflow-hidden"
            style={{ width: SIDEBAR_WIDTH }}
          >
            <Sidebar
              view={sidebarView}
              agentTasks={agentTasks}
              onTasksChange={setAgentTasks}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
