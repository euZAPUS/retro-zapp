/* © 2026 euZAPUS · Todos los derechos reservados. Ver LICENSE. */
/* Puente seguro entre la web del arcade y el proceso principal (solo expone lo necesario para actualizar). */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zapDesktop', {
  isDesktop: true,
  platform: process.platform,
  getState: () => ipcRenderer.invoke('zap:update:get'),
  runUpdate: () => ipcRenderer.invoke('zap:update:run'),
  secret: {
    get: () => ipcRenderer.invoke('zap:secret:get'),
    set: v => ipcRenderer.invoke('zap:secret:set', v),
    del: () => ipcRenderer.invoke('zap:secret:del')
  },
  onState: cb => {
    const h = (_e, s) => cb(s);
    ipcRenderer.on('zap:update:state', h);
    return () => ipcRenderer.removeListener('zap:update:state', h);
  }
});
