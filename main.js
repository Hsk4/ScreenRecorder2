const { app, BrowserWindow, ipcMain, dialog, shell, screen } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const os = require("os");

const isDev = process.argv.includes("--dev");

let mainWindow;
let ffmpegProcess = null;
let recordingStartTime = null;

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 920,
    height: 640,
    minWidth: 800,
    minHeight: 560,
    frame: false,          // Custom title bar
    transparent: false,
    backgroundColor: "#080810",
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 18, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, "assets", "icon.png"),
    show: false,
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "dist", "index.html"));
  }

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.on("closed", () => {
    if (ffmpegProcess) ffmpegProcess.kill("SIGINT");
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function getDefaultSaveDir() {
  const home = os.homedir();
  let dir;
  if (process.platform === "win32") dir = path.join(home, "Videos", "ScreenRec");
  else if (process.platform === "darwin") dir = path.join(home, "Movies", "ScreenRec");
  else dir = path.join(home, "Videos", "ScreenRec");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function checkFFmpeg() {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getScreenSize() {
  const primary = screen.getPrimaryDisplay();
  return primary.size; // { width, height }
}

function buildFFmpegArgs(opts, outputPath) {
  const { fps, quality, audio, display } = opts;
  const crf = quality === "High" ? "18" : quality === "Medium" ? "23" : "28";
  const size = getScreenSize();
  const args = [];

  if (process.platform === "linux") {
    const disp = process.env.DISPLAY || ":0";
    args.push("-f", "x11grab", "-r", `${fps}`, "-s", `${size.width}x${size.height}`, "-i", disp);
    if (audio) args.push("-f", "pulse", "-i", "default");
  } else if (process.platform === "darwin") {
    args.push("-f", "avfoundation", "-r", `${fps}`, "-i", audio ? "1:0" : "1:none");
  } else if (process.platform === "win32") {
    args.push("-f", "gdigrab", "-r", `${fps}`, "-i", "desktop");
    if (audio) args.push("-f", "dshow", "-i", "audio=virtual-audio-capturer");
  }

  args.push(
    "-c:v", "libx264",
    "-crf", crf,
    "-preset", "ultrafast",
    "-pix_fmt", "yuv420p"
  );
  if (audio) args.push("-c:a", "aac", "-b:a", "128k");
  args.push("-y", outputPath);
  return args;
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

// Window controls
ipcMain.on("win:minimize", () => mainWindow?.minimize());
ipcMain.on("win:maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on("win:close", () => mainWindow?.close());

// App info
ipcMain.handle("app:platform", () => process.platform);
ipcMain.handle("app:ffmpeg-check", () => checkFFmpeg());
ipcMain.handle("app:default-dir", () => getDefaultSaveDir());

// Pick save directory
ipcMain.handle("dialog:pick-dir", async (_, current) => {
  const res = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    defaultPath: current || getDefaultSaveDir(),
    title: "Choose Save Folder",
  });
  return res.canceled ? null : res.filePaths[0];
});

// List recordings
ipcMain.handle("recordings:list", (_, dir) => {
  try {
    const folder = dir || getDefaultSaveDir();
    if (!fs.existsSync(folder)) return [];
    return fs.readdirSync(folder)
      .filter((f) => f.endsWith(".mp4") || f.endsWith(".mkv"))
      .map((f) => {
        const full = path.join(folder, f);
        const stat = fs.statSync(full);
        return { name: f, path: full, size: stat.size, date: stat.mtimeMs };
      })
      .sort((a, b) => b.date - a.date);
  } catch { return []; }
});

// Delete recording
ipcMain.handle("recordings:delete", (_, filePath) => {
  try { fs.unlinkSync(filePath); return true; }
  catch { return false; }
});

// Open file in system player
ipcMain.handle("recordings:open", (_, filePath) => shell.openPath(filePath));

// Open folder
ipcMain.handle("recordings:open-folder", (_, dir) => shell.openPath(dir || getDefaultSaveDir()));

// ── Recording ─────────────────────────────────────────────────────────────────
ipcMain.handle("record:start", async (_, opts) => {
  if (ffmpegProcess) return { ok: false, error: "Already recording" };
  if (!checkFFmpeg()) return { ok: false, error: "ffmpeg_missing" };

  const saveDir = opts.saveDir || getDefaultSaveDir();
  if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_${String(now.getHours()).padStart(2,"0")}-${String(now.getMinutes()).padStart(2,"0")}-${String(now.getSeconds()).padStart(2,"0")}`;
  const outputPath = path.join(saveDir, `Recording_${stamp}.mp4`);

  const args = buildFFmpegArgs(opts, outputPath);

  try {
    ffmpegProcess = spawn("ffmpeg", args);
    recordingStartTime = Date.now();

    ffmpegProcess.stderr.on("data", (d) => {
      mainWindow?.webContents.send("record:log", d.toString());
    });

    ffmpegProcess.on("close", (code) => {
      ffmpegProcess = null;
      mainWindow?.webContents.send("record:stopped", { code, outputPath });
    });

    ffmpegProcess.on("error", (err) => {
      ffmpegProcess = null;
      mainWindow?.webContents.send("record:error", err.message);
    });

    return { ok: true, outputPath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle("record:stop", async () => {
  if (!ffmpegProcess) return { ok: false };
  return new Promise((resolve) => {
    ffmpegProcess.stdin.write("q");
    const timeout = setTimeout(() => {
      ffmpegProcess?.kill("SIGKILL");
      resolve({ ok: true });
    }, 6000);
    ffmpegProcess.once("close", () => {
      clearTimeout(timeout);
      resolve({ ok: true });
    });
  });
});

ipcMain.handle("record:pause", () => {
  // ffmpeg doesn't support pause natively on all platforms;
  // we send SIGSTOP on unix or just track state on windows
  if (!ffmpegProcess) return false;
  if (process.platform !== "win32") {
    ffmpegProcess.kill("SIGSTOP");
  }
  return true;
});

ipcMain.handle("record:resume", () => {
  if (!ffmpegProcess) return false;
  if (process.platform !== "win32") {
    ffmpegProcess.kill("SIGCONT");
  }
  return true;
});
