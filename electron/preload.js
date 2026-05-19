const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  blocklist: {
    list: () => ipcRenderer.invoke('blocklist:list'),
    add: (domain) => ipcRenderer.invoke('blocklist:add', domain),
    remove: (domain) => ipcRenderer.invoke('blocklist:remove', domain)
  },
  adult: {
    status: () => ipcRenderer.invoke('adult:status'),
    enable: () => ipcRenderer.invoke('adult:enable'),
    disable: () => ipcRenderer.invoke('adult:disable')
  },
  limits: {
    list: () => ipcRenderer.invoke('limits:list'),
    set: (domain, minutes) => ipcRenderer.invoke('limits:set', { domain, minutes }),
    remove: (domain) => ipcRenderer.invoke('limits:remove', domain)
  },
  stats: {
    today: () => ipcRenderer.invoke('stats:today'),
    appToday: () => ipcRenderer.invoke('stats:app-today'),
    range: (days) => ipcRenderer.invoke('stats:range', days),
    top: (days) => ipcRenderer.invoke('stats:top', days),
    appTop: (days) => ipcRenderer.invoke('stats:app-top', days),
    domainsTotal: (domains) => ipcRenderer.invoke('stats:domains-total', domains)
  }
});
