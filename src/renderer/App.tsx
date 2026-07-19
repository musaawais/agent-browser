import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { TabInfo, AgentTask, SidebarView } from './store/types';
import { TabBar } from './components/Browser/TabBar';
import { NavigationBar } from './components/Browser/NavigationBar';
import { Sidebar } from './components/Sidebar';
import { AgentPanel } from './components/Agent/AgentPanel';
import { ProxyPanel } from './components/Proxy/ProxyPanel';
import { SettingsPanel } from './components/SettingsPanel';

declare global {
  interface Window {
    api: typeof import('./api').api;
  }
}

const api = window.api;

const SIDEBAR_WIDTH = 320;

export default function App() {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [sidebarView, setSidebarView] = useState<SidebarView>('browser');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);

  // Keep a ref to activeTabId so callbacks always see the latest value
  const activeTabIdRef = useRef<string | null>(null);
  activeTabIdRef.current = activeTabId;

  // ── Initial setup ────────────────────────────────────────────────────────
  useEffect(() => {
    openNewTab();
    loadAgentTasks();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notify main process whenever sidebar width changes ───────────────────
  // This makes the native browser view shrink so it doesn't cover the sidebar.
  useEffect(() => {
    const width = sidebarOpen ? SIDEBAR_WIDTH : 0;
    api.browser.setSidebarWidth(width).catch(() => {});
  }, [sidebarOpen]);

  // ── Listen for tab updates from main ────────────────────────────────────
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Listen for agent task updates from main ──────────────────────────────
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

  // ── Helpers ──────────────────────────────────────────────────────────────
  const loadAgentTasks = async () => {
    try {
      const tasks = await api.agent.getAllTasks();
      if (tasks) setAgentTasks(tasks);
    } catch { /* ignore */ }
  };

  const openNewTab = useCallback(async (url?: string) => {
    try {
      const tab = await api.browser.newTab(url);
      if (!tab) return;
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    } catch (err) {
      console.error('openNewTab error', err);
    }
  }, []);

  const closeTab = useCallback(
    async (id: string) => {
      try {
        await api.browser.closeTab(id);
      } catch { /* ignore */ }

      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (id === activeTabIdRef.current) {
          if (next.length > 0) {
            const lastTab = next[next.length - 1];
            setActiveTabId(lastTab.id);
            api.browser.activateTab(lastTab.id).catch(() => {});
          } else {
            openNewTab();
          }
        }
        return next;
      });
    },
    [openNewTab]
  );

  const activateTab = useCallback(async (id: string) => {
    setActiveTabId(id);
    try { await api.browser.activateTab(id); } catch { /* ignore */ }
  }, []);

  const navigate = useCallback(async (url: string) => {
    const id = activeTabIdRef.current;
    if (!id) return;
    try { await api.browser.navigate(id, url); } catch { /* ignore */ }
  }, []);

  const goBack = useCallback(async () => {
    const id = activeTabIdRef.current;
    if (id) try { await api.browser.goBack(id); } catch { /* ignore */ }
  }, []);

  const goForward = useCallback(async () => {
    const id = activeTabIdRef.current;
    if (id) try { await api.browser.goForward(id); } catch { /* ignore */ }
  }, []);

  const reload = useCallback(async () => {
    const id = activeTabIdRef.current;
    if (id) try { await api.browser.reload(id); } catch { /* ignore */ }
  }, []);

  const handleToggleSidebar = useCallback((view: SidebarView) => {
    setSidebarView((prev) => {
      if (prev === view && sidebarOpen) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
      return view;
    });
  }, [sidebarOpen]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0f0f13]">
      {/* ── Chrome: tab bar + navigation bar (90px total) ───────────────── */}
      <div
        className="drag-region flex flex-col shrink-0 border-b border-white/[0.06]"
        style={{ height: 90 }}
      >
        {/* Tab row */}
        <div className="flex items-center pl-[80px] pr-2 pt-2" style={{ height: 42 }}>
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onActivate={activateTab}
            onClose={closeTab}
            onNewTab={() => openNewTab()}
          />
        </div>

        {/* Navigation row */}
        <div className="flex items-center px-3 pb-2 gap-2" style={{ height: 48 }}>
          <NavigationBar
            activeTab={activeTab}
            onNavigate={navigate}
            onBack={goBack}
            onForward={goForward}
            onReload={reload}
            sidebarOpen={sidebarOpen}
            sidebarView={sidebarView}
            onToggleSidebar={handleToggleSidebar}
          />
        </div>
      </div>

      {/* ── Content area: browser pane (native) + sidebar (HTML) ─────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Browser placeholder — Electron's WebContentsView renders here.
            The view is resized via browser:set-sidebar-width so it never
            overlaps the sidebar panel. */}
        <div className="flex-1" />

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
