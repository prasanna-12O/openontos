const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronDB', {
  load: () => ipcRenderer.invoke('db:load'),
  save: (data) => ipcRenderer.invoke('db:save', data),
  getDbPath: () => ipcRenderer.invoke('db:path'),
});
