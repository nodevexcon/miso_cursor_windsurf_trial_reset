import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type { ProgressPayload, IApplication } from '../src/electron.d';

contextBridge.exposeInMainWorld('electron', {
  executeReset: (options: string[], application: IApplication): Promise<void> =>
    ipcRenderer.invoke('reset:execute', options, application),

  analyzeActions: (options: string[], application: IApplication): Promise<any[]> =>
    ipcRenderer.invoke('analysis:execute', options, application),

  getExeMetadata: (filePath: string): Promise<any> =>
    ipcRenderer.invoke('app-cleaner:get-exe-metadata', filePath),
  
  findLeftovers: (metadata: any): Promise<any[]> =>
    ipcRenderer.invoke('app-cleaner:find-leftovers', metadata),

  deleteItems: (items: any[]): Promise<void> =>
    ipcRenderer.invoke('app-cleaner:delete-items', items),

  onResetProgress: (callback: (data: ProgressPayload) => void) => {
    const listener = (_: IpcRendererEvent, data: ProgressPayload) => callback(data);
    ipcRenderer.on('reset-progress', listener);
    
    // Return a cleanup function to remove the listener
    return () => {
      ipcRenderer.removeListener('reset-progress', listener);
    };
  },

  onAppCleanerProgress: (callback: (data: { type: 'log', message: string }) => void) => {
    const listener = (_: IpcRendererEvent, data: { type: 'log', message: string }) => callback(data);
    ipcRenderer.on('app-cleaner-progress', listener);
    
    return () => {
      ipcRenderer.removeListener('app-cleaner-progress', listener);
    };
  },
}); 