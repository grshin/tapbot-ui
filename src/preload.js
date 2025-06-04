const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
        send: (channel, ...args) => {
            ipcRenderer.send(channel, ...args);
        },
        once: (channel, listener) => {
            ipcRenderer.once(channel, listener);
        },
        on: (channel, listener) => {
            ipcRenderer.on(channel, listener);
        },
        removeListener: (channel, listener) => {
            ipcRenderer.removeListener(channel, listener);
        },
        removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    },
});
