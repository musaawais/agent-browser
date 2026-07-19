// Re-export the api from window for typed usage
export const api = (window as any).api as {
  browser: {
    newTab: (url?: string) => Promise<any>;
    closeTab: (id: string) => Promise<any>;
    activateTab: (id: string) => Promise<any>;
    navigate: (id: string, url: string) => Promise<any>;
    goBack: (id: string) => Promise<any>;
    goForward: (id: string) => Promise<any>;
    reload: (id: string) => Promise<any>;
    stop: (id: string) => Promise<any>;
    onTabUpdated: (cb: (info: any) => void) => () => void;
    onOpenUrl: (cb: (url: string) => void) => () => void;
  };
  proxy: {
    set: (config: any) => Promise<any>;
    clear: () => Promise<any>;
    getState: () => Promise<any>;
  };
  agent: {
    createTask: (input: any) => Promise<any>;
    startTask: (id: string) => Promise<any>;
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
