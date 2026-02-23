# 🎥 ScreenRec — Electron Desktop App

A minimal, 3D-designed screen recorder built with Electron + React + Three.js.  
Records your screen using FFmpeg and saves MP4s locally.

---

## Requirements

- **Node.js** v18+ → https://nodejs.org
- **FFmpeg** (for actual recording)
  - Windows: `winget install ffmpeg`
  - macOS:   `brew install ffmpeg`
  - Linux:   `sudo apt install ffmpeg`

---

## 🚀 Quick Start (Run in Dev Mode)

```bash
# 1. Install dependencies
npm install

# 2. Run the app
npm run dev
```

This starts Vite (React) on port 3000 and launches Electron pointing at it.

---

## 📦 Build a distributable (.exe / .dmg / .AppImage)

```bash
# Install deps first
npm install

# Windows → produces an NSIS installer in dist-electron/
npm run build:win

# macOS → produces a .dmg in dist-electron/
npm run build:mac

# Linux → produces an .AppImage in dist-electron/
npm run build:linux
```

The output will be in the `dist-electron/` folder.  
On Windows you'll get a standard installer that anyone can run — **no Node, no Flutter, no anything** needed.

---

## How it Works

| Layer     | Tech                          |
|-----------|-------------------------------|
| Shell     | Electron (Chromium + Node.js) |
| UI        | React + Three.js (3D bg)      |
| Recording | FFmpeg (spawned as subprocess)|
| IPC       | Electron contextBridge        |

### Platform capture methods
| OS      | FFmpeg input     |
|---------|------------------|
| Windows | `gdigrab`        |
| macOS   | `avfoundation`   |
| Linux   | `x11grab`        |

---

## Features
- 🔴 Animated record button with pulse & countdown
- ⏸ Pause / Resume recording
- 🎙 Audio toggle
- ✨ Quality (High/Medium/Low) + FPS (15/30/60)
- 📂 Custom save folder
- 🗂 Library tab — browse, open, delete recordings
- 🌌 Three.js 3D animated background
- 🖥 Custom frameless title bar with traffic lights
- ⚠️ FFmpeg detection with install instructions

---

## Notes

### Windows audio
For system audio capture on Windows, install **VB-Audio Virtual Cable** (free):  
https://vb-audio.com/Cable/  
Then select `CABLE Output` as your recording device, or just toggle audio off.

### macOS permissions
On first run, macOS will ask for **Screen Recording** permission.  
Go to: System Settings → Privacy & Security → Screen Recording → enable ScreenRec.

### Linux
Make sure `$DISPLAY` is set and you're running in an X11 session (not Wayland).  
For Wayland, install `wf-recorder` separately and adjust `main.js`.
