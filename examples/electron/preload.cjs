const { contextBridge, ipcRenderer } = require('electron');
function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}
contextBridge.exposeInMainWorld('yuuki', {
  fixture: () => ipcRenderer.invoke('fixture'),
  checkUpdate: choice => ipcRenderer.invoke('update-check', choice),
  startStream: () => ipcRenderer.invoke('stream-start'),
  stopStream: () => ipcRenderer.invoke('stream-stop'),
  bootstrapAgent: () => ipcRenderer.invoke('agent-bootstrap'),
  agentCommand: command => ipcRenderer.invoke('agent-command', command),
  startSpeech: options => ipcRenderer.invoke('speech-start', options),
  stopSpeech: () => ipcRenderer.invoke('speech-stop'),
  cancelSpeech: () => ipcRenderer.invoke('speech-cancel'),
  onStream: callback => subscribe('stream-event', callback),
  onSpeech: callback => subscribe('speech-event', callback),
  onAgent: callback => subscribe('agent-event', callback)
});
