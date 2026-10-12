import { contextBridge, ipcRenderer } from 'electron';
import type { AppApi, ProgressEvent } from '../shared/types';
const api: AppApi = {
  getSystem: () => ipcRenderer.invoke('pandora:system'),
  getMetrics: () => ipcRenderer.invoke('pandora:metrics'),
  getTweaks: () => ipcRenderer.invoke('pandora:tweaks'),
  applyTweaks: ids => ipcRenderer.invoke('pandora:apply', ids),
  revertTweaks: ids => ipcRenderer.invoke('pandora:revert', ids),
  getHistory: () => ipcRenderer.invoke('pandora:history'),
  scanCleanup: kind => ipcRenderer.invoke('pandora:scan-cleanup', kind),
  clean: (id, categories, confirmation) => ipcRenderer.invoke('pandora:clean', id, categories, confirmation),
  getProcesses: () => ipcRenderer.invoke('pandora:processes'),
  getStartup: () => ipcRenderer.invoke('pandora:startup'),
  getGames: () => ipcRenderer.invoke('pandora:games'),
  getSettings: () => ipcRenderer.invoke('pandora:settings'),
  saveSettings: settings => ipcRenderer.invoke('pandora:save-settings', settings),
  exportReport: kind => ipcRenderer.invoke('pandora:export', kind),
  onProgress: callback => {
    const handler = (_event: Electron.IpcRendererEvent, payload: ProgressEvent) => callback(payload);
    ipcRenderer.on('pandora:progress', handler);
    return () => { ipcRenderer.removeListener('pandora:progress', handler); };
  },
  windowAction: action => ipcRenderer.send('pandora:window', action)
};
contextBridge.exposeInMainWorld('pandora', api);
