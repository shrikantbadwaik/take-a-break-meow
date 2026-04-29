const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("breakMeow", {
  startSession: (opts) => ipcRenderer.invoke("session:start", opts),
  stopSession: () => ipcRenderer.invoke("session:stop"),
  onTick: (fn) => {
    ipcRenderer.on("session:tick", (_e, payload) => fn(payload));
  },
  removeTickListener: () => {
    ipcRenderer.removeAllListeners("session:tick");
  },
});
