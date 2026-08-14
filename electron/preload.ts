import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  exit: () => ipcRenderer.send('app-exit'),
});
