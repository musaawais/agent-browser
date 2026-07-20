export const api = (window as any).api as {
  browser: {
    newTab: (url?: string) => Promise<{ id: string; url: string; title: string; favicon: string; isLoading: boolean } | null>;
    closeTab: (id: string) => Promise<{ success: boolean }>;
    activateTab: (id: string) => Promise<{ success: boolean }>;
    navigate: (id: string, url: string) => Promise<{ success: boolean }>;
    goBack: (id: string) => Promise<{ success: boolean }>;
    goForward: (id: string) => Promise<{ success: boolean }>;
    reload: (id: string) => Promise<{ success: boolean }>;
    stop: (id: string) => Promise<{ success: boolean }>;
    setSidebarWidth: (width: number) => Promise<{ success: boolean }>;
    onTabUpdated: (cb: (info: any) => void) => () => void;
    onTabCreated: (cb: (info: any) => void) => () => void;
    onOpenUrl: (cb: (url: string) => void) => () => void;
  };
  proxy: {
    set: (config: any) => Promise<any>;
    clear: () => Promise<any>;
    getState: () => Promise<any>;
  };
  agent: {
    createTask: (input: {
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
    }) => Promise<any>;
    startTask: (id: string) => Promise<{ success: boolean; error?: string }>;
    stopTask: (id: string) => Promise<any>;
    deleteTask: (id: string) => Promise<any>;
    getAllTasks: () => Promise<any[]>;
    onTaskUpdated: (cb: (task: any) => void) => () => void;
  };
  store: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any) => Promise<any>;
  };
  platform: string;
};
