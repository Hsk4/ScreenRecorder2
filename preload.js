const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electron", {
  // Window controls
  minimize: () => ipcRenderer.send("win:minimize"),
  maximize: () => ipcRenderer.send("win:maximize"),
  close:    () => ipcRenderer.send("win:close"),

  // App info
  platform:     () => ipcRenderer.invoke("app:platform"),
  checkFFmpeg:  () => ipcRenderer.invoke("app:ffmpeg-check"),
  defaultDir:   () => ipcRenderer.invoke("app:default-dir"),

  // Dialogs
  pickDir: (current) => ipcRenderer.invoke("dialog:pick-dir", current),

  // Recordings
  listRecordings:   (dir)  => ipcRenderer.invoke("recordings:list", dir),
  deleteRecording:  (path) => ipcRenderer.invoke("recordings:delete", path),
  openRecording:    (path) => ipcRenderer.invoke("recordings:open", path),
  openFolder:       (dir)  => ipcRenderer.invoke("recordings:open-folder", dir),

  // Recording control
  startRecording: (opts) => ipcRenderer.invoke("record:start", opts),
  stopRecording:  ()     => ipcRenderer.invoke("record:stop"),
  pauseRecording: ()     => ipcRenderer.invoke("record:pause"),
  resumeRecording:()     => ipcRenderer.invoke("record:resume"),

  // Events from main
  onRecordStopped: (cb) => ipcRenderer.on("record:stopped", (_, data) => cb(data)),
  onRecordError:   (cb) => ipcRenderer.on("record:error",   (_, msg)  => cb(msg)),
  onRecordLog:     (cb) => ipcRenderer.on("record:log",     (_, log)  => cb(log)),
});
