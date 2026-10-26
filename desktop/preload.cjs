const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "affiliateDesktop",
  Object.freeze({
    devices: () => ipcRenderer.invoke("devices:list"),
    open: (serial) => ipcRenderer.invoke("devices:open", serial),
  }),
);
