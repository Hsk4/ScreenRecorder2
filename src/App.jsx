import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (s) => {
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
};

const fmtSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDate = (ms) => {
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

// ─── Three.js Background ──────────────────────────────────────────────────────
function ThreeBackground({ isRecording }) {
  const mountRef = useRef(null);
  const stateRef = useRef({});

  useEffect(() => {
    const W = window.innerWidth, H = window.innerHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 100);
    camera.position.z = 6;

    // Rings
    const rings = [];
    const cols = [0xff2d55, 0x6c63ff, 0x00d4ff, 0xff9f0a];
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.TorusGeometry(1, 0.011, 16, 120);
      const mat = new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.2 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.scale.setScalar(2 + i * 0.85);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      mesh.userData = { sx: (Math.random() - 0.5) * 0.003, sy: (Math.random() - 0.5) * 0.003 };
      scene.add(mesh);
      rings.push(mesh);
    }

    // Particles
    const N = 700;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos.set([(Math.random() - 0.5) * 22, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 12], i * 3);
      const c = new THREE.Color().setHSL(0.65 + Math.random() * 0.25, 1, 0.7);
      col.set([c.r, c.g, c.b], i * 3);
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const particles = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.45 }));
    scene.add(particles);

    // Grid plane
    const gridHelper = new THREE.GridHelper(30, 30, 0x111128, 0x111128);
    gridHelper.position.y = -4;
    scene.add(gridHelper);

    // Wireframe orb
    const orb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.1, 2),
      new THREE.MeshBasicMaterial({ color: 0x6c63ff, wireframe: true, transparent: true, opacity: 0.06 })
    );
    scene.add(orb);

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));
    const pl = new THREE.PointLight(0x6c63ff, 3, 12);
    pl.position.set(2, 2, 3);
    scene.add(pl);

    stateRef.current = { renderer, scene, camera, rings, particles, orb, pl };

    let frame, t = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      t += 0.008;
      rings.forEach((r, i) => {
        r.rotation.x += r.userData.sx;
        r.rotation.y += r.userData.sy;
        r.material.opacity = 0.12 + 0.08 * Math.sin(t + i * 1.2);
      });
      particles.rotation.y += 0.0006;
      orb.rotation.y += 0.004;
      orb.rotation.x += 0.003;
      pl.position.set(Math.sin(t * 0.4) * 3.5, Math.cos(t * 0.25) * 3, 3);
      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  useEffect(() => {
    const { rings, pl } = stateRef.current;
    if (!rings) return;
    rings.forEach((r) => {
      const speed = isRecording ? 0.012 : 0.003;
      r.userData.sx = (Math.random() - 0.5) * speed;
      r.userData.sy = (Math.random() - 0.5) * speed;
    });
    if (pl) pl.color.set(isRecording ? 0xff2d55 : 0x6c63ff);
  }, [isRecording]);

  return <div ref={mountRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
function Waveform({ active }) {
  const [heights, setHeights] = useState(Array(24).fill(20));
  useEffect(() => {
    if (!active) { setHeights(Array(24).fill(20)); return; }
    const id = setInterval(() => setHeights(Array(24).fill(0).map(() => 15 + Math.random() * 85)), 120);
    return () => clearInterval(id);
  }, [active]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3, height: 34 }}>
      {heights.map((h, i) => (
        <div key={i} style={{
          width: 3, borderRadius: 3, flexShrink: 0,
          background: active ? `hsl(${345 + i * 2}, 100%, 60%)` : "#222",
          height: `${h}%`,
          transition: "height 0.12s ease",
        }} />
      ))}
    </div>
  );
}

// ─── Recording Card ───────────────────────────────────────────────────────────
function RecCard({ rec, onDelete, onOpen }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "rgba(108,99,255,0.1)" : "rgba(255,255,255,0.025)",
        border: `1px solid ${hov ? "rgba(108,99,255,0.35)" : "rgba(255,255,255,0.06)"}`,
        borderRadius: 14, padding: "13px 16px",
        display: "flex", alignItems: "center", gap: 12,
        transition: "all 0.2s", cursor: "pointer",
        transform: hov ? "translateX(3px)" : "none",
      }}
      onClick={() => onOpen(rec.path)}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 11, flexShrink: 0,
        background: "rgba(255,45,85,0.1)", border: "1px solid rgba(255,45,85,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
      }}>🎬</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: "#ddd", fontSize: 12.5, fontWeight: 600, fontFamily: "'DM Mono', monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {rec.name}
        </div>
        <div style={{ color: "#555", fontSize: 11, marginTop: 3 }}>
          {fmtDate(rec.date)} · {fmtSize(rec.size)}
        </div>
      </div>

      <button onClick={(e) => { e.stopPropagation(); onDelete(rec.path); }}
        style={{ background: "none", border: "none", color: hov ? "#ff2d55" : "#333", cursor: "pointer", fontSize: 15, padding: 4, transition: "color 0.2s", flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ─── FFmpeg Missing Dialog ────────────────────────────────────────────────────
function FFmpegDialog({ platform, onClose }) {
  const cmd = platform === "win32" ? "winget install ffmpeg"
    : platform === "darwin" ? "brew install ffmpeg"
    : "sudo apt install ffmpeg";
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        background: "#0f0f1a", border: "1px solid rgba(255,45,85,0.3)",
        borderRadius: 20, padding: 32, maxWidth: 420, width: "90%",
        boxShadow: "0 40px 100px rgba(0,0,0,0.6)",
      }}>
        <div style={{ fontSize: 36, marginBottom: 16 }}>⚠️</div>
        <div style={{ color: "#fff", fontSize: 18, fontWeight: 700, marginBottom: 8 }}>FFmpeg not found</div>
        <div style={{ color: "#666", fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
          ScreenRec uses FFmpeg to capture your screen. Install it with:
        </div>
        <div style={{
          background: "#080810", border: "1px solid #222", borderRadius: 10,
          padding: "12px 16px", fontFamily: "'DM Mono', monospace",
          color: "#00d4ff", fontSize: 13, marginBottom: 24,
        }}>{cmd}</div>
        <button onClick={onClose} style={{
          width: "100%", padding: "12px", borderRadius: 12,
          background: "rgba(108,99,255,0.2)", border: "1px solid rgba(108,99,255,0.4)",
          color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
          fontFamily: "'Space Grotesk', sans-serif",
        }}>Got it</button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [isRecording, setIsRecording]   = useState(false);
  const [isPaused, setIsPaused]         = useState(false);
  const [elapsed, setElapsed]           = useState(0);
  const [recordings, setRecordings]     = useState([]);
  const [saveDir, setSaveDir]           = useState("");
  const [quality, setQuality]           = useState("High");
  const [fps, setFps]                   = useState(30);
  const [audio, setAudio]               = useState(true);
  const [tab, setTab]                   = useState("record");
  const [countdown, setCountdown]       = useState(null);
  const [platform, setPlatform]         = useState("");
  const [ffmpegOk, setFfmpegOk]        = useState(true);
  const [showFFmpegWarn, setShowFFmpegWarn] = useState(false);
  const [pulse, setPulse]               = useState(false);
  const [status, setStatus]             = useState("idle"); // idle | recording | paused | saved
  const [lastSaved, setLastSaved]       = useState(null);

  const timerRef = useRef(null);
  const startRef = useRef(null);
  const pausedElapsedRef = useRef(0);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      if (!window.electron) return;
      const plat = await window.electron.platform();
      setPlatform(plat);
      const ok = await window.electron.checkFFmpeg();
      setFfmpegOk(ok);
      const dir = await window.electron.defaultDir();
      setSaveDir(dir);
      refreshRecordings(dir);
    };
    init();

    if (window.electron) {
      window.electron.onRecordStopped(({ outputPath }) => {
        setIsRecording(false);
        setIsPaused(false);
        setStatus("saved");
        setLastSaved(outputPath?.split(/[\\/]/).pop() || "Recording saved");
        setTimeout(() => setStatus("idle"), 4000);
        refreshRecordings();
      });
      window.electron.onRecordError((msg) => {
        setIsRecording(false);
        setStatus("idle");
        console.error("Record error:", msg);
      });
    }
  }, []);

  const refreshRecordings = useCallback(async (dir) => {
    if (!window.electron) return;
    const d = dir || saveDir;
    const list = await window.electron.listRecordings(d);
    setRecordings(list);
  }, [saveDir]);

  // ── Timer ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isRecording && !isPaused) {
      startRef.current = Date.now() - pausedElapsedRef.current * 1000;
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }, 500);
    } else {
      clearInterval(timerRef.current);
      if (isPaused) pausedElapsedRef.current = elapsed;
    }
    return () => clearInterval(timerRef.current);
  }, [isRecording, isPaused]);

  // ── Pulse ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isRecording || isPaused) { setPulse(false); return; }
    const id = setInterval(() => setPulse((p) => !p), 800);
    return () => clearInterval(id);
  }, [isRecording, isPaused]);

  // ── Recording controls ────────────────────────────────────────────────────
  const startCountdown = async () => {
    if (!ffmpegOk) { setShowFFmpegWarn(true); return; }
    setCountdown(3);
    let c = 3;
    const id = setInterval(() => {
      c--;
      if (c <= 0) { clearInterval(id); setCountdown(null); doStart(); }
      else setCountdown(c);
    }, 1000);
  };

  const doStart = async () => {
    if (!window.electron) {
      // Demo mode - no electron
      setIsRecording(true);
      setIsPaused(false);
      setElapsed(0);
      pausedElapsedRef.current = 0;
      setStatus("recording");
      return;
    }
    const res = await window.electron.startRecording({ fps, quality, audio, saveDir });
    if (res.ok) {
      setIsRecording(true); setIsPaused(false);
      setElapsed(0); pausedElapsedRef.current = 0;
      setStatus("recording");
    } else if (res.error === "ffmpeg_missing") {
      setShowFFmpegWarn(true);
    }
  };

  const stopRecording = async () => {
    if (window.electron) await window.electron.stopRecording();
    else {
      setIsRecording(false); setIsPaused(false);
      setStatus("saved"); setLastSaved("Recording_demo.mp4");
      setTimeout(() => setStatus("idle"), 3000);
      refreshRecordings();
    }
  };

  const togglePause = async () => {
    if (!isRecording) return;
    if (isPaused) {
      if (window.electron) await window.electron.resumeRecording();
      setIsPaused(false); setStatus("recording");
    } else {
      if (window.electron) await window.electron.pauseRecording();
      setIsPaused(true); setStatus("paused");
    }
  };

  const pickDir = async () => {
    if (!window.electron) return;
    const d = await window.electron.pickDir(saveDir);
    if (d) { setSaveDir(d); refreshRecordings(d); }
  };

  const deleteRec = async (path) => {
    if (window.electron) await window.electron.deleteRecording(path);
    refreshRecordings();
  };

  const openRec = (path) => window.electron?.openRecording(path);
  const openFolder = () => window.electron?.openFolder(saveDir);

  // ── Accent ────────────────────────────────────────────────────────────────
  const accent = isRecording ? (isPaused ? "#ff9f0a" : "#ff2d55") : "#6c63ff";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080810; user-select: none; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes countPop { 0%{transform:scale(0.4);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes savedPop { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: #1e1e2e; border-radius: 4px; }
        button { font-family: inherit; }
        select { font-family: inherit; }
        input  { font-family: inherit; }
      `}</style>

      <ThreeBackground isRecording={isRecording && !isPaused} />

      {/* FFmpeg dialog */}
      {showFFmpegWarn && <FFmpegDialog platform={platform} onClose={() => setShowFFmpegWarn(false)} />}

      {/* Countdown */}
      {countdown !== null && (
        <div style={{ position:"fixed", inset:0, zIndex:150, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.75)", backdropFilter:"blur(10px)" }}>
          <div key={countdown} style={{ fontSize:150, fontWeight:900, color:"#ff2d55", fontFamily:"'Space Grotesk',sans-serif", animation:"countPop 0.45s ease", textShadow:"0 0 100px rgba(255,45,85,0.6)" }}>
            {countdown}
          </div>
        </div>
      )}

      {/* App shell */}
      <div style={{ position:"relative", zIndex:10, height:"100vh", display:"flex", flexDirection:"column", fontFamily:"'Space Grotesk', sans-serif" }}>

        {/* ── Title bar (draggable) ── */}
        <div
          style={{ height:42, WebkitAppRegion:"drag", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", background:"rgba(8,8,16,0.8)", borderBottom:"1px solid rgba(255,255,255,0.04)", flexShrink:0 }}
        >
          {/* Traffic lights – only shown on non-mac (mac uses system) */}
          <div style={{ display:"flex", gap:7, WebkitAppRegion:"no-drag" }}>
            {[["#ff5f57", ()=>window.electron?.close()], ["#febc2e", ()=>window.electron?.minimize()], ["#28c840", ()=>window.electron?.maximize()]].map(([c, fn], i) => (
              <div key={i} onClick={fn} style={{ width:12, height:12, borderRadius:"50%", background:c, cursor:"pointer", opacity:0.9 }} />
            ))}
          </div>

          <div style={{ color:"#333", fontSize:11, fontFamily:"'DM Mono',monospace", letterSpacing:1 }}>
            SCREENREC {!ffmpegOk && "· ⚠ FFMPEG MISSING"}
          </div>

          {isRecording && (
            <div style={{ display:"flex", alignItems:"center", gap:6, WebkitAppRegion:"no-drag" }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:"#ff2d55", animation:"blink 1s ease infinite" }} />
              <span style={{ color:"#ff2d55", fontSize:11, fontFamily:"'DM Mono',monospace" }}>LIVE</span>
            </div>
          )}
          {!isRecording && <div style={{ width:60 }} />}
        </div>

        {/* ── Body ── */}
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* ── LEFT ── */}
          <div style={{ width:260, borderRight:"1px solid rgba(255,255,255,0.05)", background:"rgba(0,0,0,0.3)", backdropFilter:"blur(20px)", display:"flex", flexDirection:"column", padding:"24px 20px", gap:24, flexShrink:0 }}>

            {/* Logo */}
            <div style={{ display:"flex", alignItems:"center", gap:11 }}>
              <div style={{ width:36, height:36, borderRadius:11, background:`linear-gradient(135deg, ${accent}, ${isRecording?"#ff9f0a":"#00d4ff"})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:17, boxShadow:`0 4px 18px ${accent}44`, transition:"all 0.6s ease", flexShrink:0 }}>🎥</div>
              <div>
                <div style={{ color:"#fff", fontSize:15, fontWeight:700, letterSpacing:"-0.4px" }}>ScreenRec</div>
                <div style={{ color:"#333", fontSize:9, fontFamily:"'DM Mono',monospace", letterSpacing:1 }}>DESKTOP · v1.0</div>
              </div>
            </div>

            {/* ── BIG BUTTON ── */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
              <div style={{ position:"relative" }}>
                {/* Outer glow */}
                <div style={{ position:"absolute", inset:-16, borderRadius:"50%", background:`radial-gradient(circle, ${accent}28 0%, transparent 70%)`, transition:"all 0.6s", pointerEvents:"none" }} />
                {/* Ring */}
                <div style={{ position:"absolute", inset:-4, borderRadius:"50%", border:`1.5px solid ${accent}30`, transition:"all 0.6s", animation: isRecording && !isPaused ? "none" : "none" }} />
                <button
                  onClick={isRecording ? stopRecording : startCountdown}
                  disabled={countdown !== null}
                  style={{
                    position:"relative", width:96, height:96, borderRadius:"50%",
                    border:`1.5px solid ${accent}50`,
                    background:`radial-gradient(circle at 38% 35%, ${accent}28, ${accent}0c)`,
                    cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
                    transform:`scale(${pulse ? 1.05 : 1})`,
                    transition:"transform 0.35s ease, border-color 0.5s, background 0.5s",
                    boxShadow:`0 0 36px ${accent}30, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  }}
                >
                  <div style={{
                    width:54, height:54,
                    borderRadius: isRecording ? 14 : "50%",
                    background:`linear-gradient(135deg, ${accent}, ${isRecording?(isPaused?"#ff9f0a":"#ff6b85"):"#8b84ff"})`,
                    transition:"all 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:22,
                  }}>
                    {isRecording ? "⏹" : "⏺"}
                  </div>
                </button>
              </div>

              {/* Timer */}
              <div style={{ fontFamily:"'DM Mono',monospace", fontSize:30, fontWeight:500, color: isRecording ? accent : "#252535", letterSpacing:3, transition:"color 0.5s" }}>
                {fmt(elapsed)}
              </div>

              {/* Status pill */}
              <div style={{
                padding:"5px 15px", borderRadius:100,
                background: status==="saved" ? "rgba(40,200,64,0.12)" : isRecording ? `${accent}18` : "rgba(255,255,255,0.04)",
                border:`1px solid ${status==="saved" ? "#28c84040" : isRecording ? `${accent}40` : "rgba(255,255,255,0.07)"}`,
                color: status==="saved" ? "#28c840" : isRecording ? accent : "#333",
                fontSize:10, fontWeight:700, letterSpacing:1.8, fontFamily:"'DM Mono',monospace",
                transition:"all 0.35s",
                animation: status==="saved" ? "savedPop 0.4s ease" : "none",
              }}>
                {status==="saved" ? "✓ SAVED" : isRecording ? (isPaused ? "⏸ PAUSED" : "⏺ REC") : "● READY"}
              </div>

              {status==="saved" && lastSaved && (
                <div style={{ color:"#28c840", fontSize:10, textAlign:"center", fontFamily:"'DM Mono',monospace", maxWidth:200, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", animation:"fadeUp 0.3s ease" }}>
                  {lastSaved}
                </div>
              )}

              {/* Pause / Resume */}
              {isRecording && (
                <button onClick={togglePause} style={{
                  background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                  borderRadius:100, color:"#888", padding:"7px 18px", fontSize:12, cursor:"pointer", transition:"all 0.2s",
                }}>
                  {isPaused ? "▶ Resume" : "⏸ Pause"}
                </button>
              )}
            </div>

            {/* Waveform */}
            <div>
              <div style={{ color:"#292940", fontSize:9, letterSpacing:1.5, marginBottom:7, fontFamily:"'DM Mono',monospace" }}>
                AUDIO {audio ? "INPUT" : "MUTED"}
              </div>
              <Waveform active={isRecording && !isPaused && audio} />
            </div>

            {/* Settings */}
            <div style={{ marginTop:"auto" }}>
              <div style={{ color:"#1e1e3a", fontSize:9, letterSpacing:1.5, marginBottom:12, fontFamily:"'DM Mono',monospace" }}>SETTINGS</div>
              <div style={{ display:"flex", flexDirection:"column", gap:11 }}>

                {/* Audio */}
                <Row label="🎙 Audio">
                  <Toggle value={audio} onChange={setAudio} disabled={isRecording} accent="#6c63ff" />
                </Row>

                {/* Quality */}
                <Row label="✨ Quality">
                  <select value={quality} onChange={e=>setQuality(e.target.value)} disabled={isRecording}
                    style={{ background:"#0d0d18", border:"1px solid #1e1e30", color:"#777", padding:"4px 8px", borderRadius:8, fontSize:11, fontFamily:"'DM Mono',monospace", cursor:isRecording?"not-allowed":"pointer" }}>
                    {["High","Medium","Low"].map(q=><option key={q}>{q}</option>)}
                  </select>
                </Row>

                {/* FPS */}
                <Row label="🎞 FPS">
                  <div style={{ display:"flex", gap:4 }}>
                    {[15,30,60].map(f=>(
                      <button key={f} onClick={()=>!isRecording&&setFps(f)} disabled={isRecording}
                        style={{ padding:"3px 9px", borderRadius:7, background:fps===f?"rgba(108,99,255,0.18)":"transparent", border:`1px solid ${fps===f?"#6c63ff":"#1e1e30"}`, color:fps===f?"#6c63ff":"#444", fontSize:10, cursor:isRecording?"not-allowed":"pointer", fontFamily:"'DM Mono',monospace" }}>
                        {f}
                      </button>
                    ))}
                  </div>
                </Row>

                {/* Folder */}
                <button onClick={pickDir} disabled={isRecording}
                  style={{ display:"flex", alignItems:"center", gap:8, background:"none", border:"none", color:"#333", fontSize:12, cursor:isRecording?"not-allowed":"pointer", padding:"4px 0", textAlign:"left" }}>
                  <span style={{ fontSize:14 }}>📁</span>
                  <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:160 }}>{saveDir.split(/[\\/]/).pop() || "Save folder"}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ── RIGHT ── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", backdropFilter:"blur(5px)" }}>

            {/* Tabs */}
            <div style={{ display:"flex", gap:2, padding:"14px 22px 0", borderBottom:"1px solid rgba(255,255,255,0.04)", background:"rgba(0,0,0,0.15)", flexShrink:0 }}>
              {[["record","🎬 Record"],["library","📂 Library"]].map(([id,label])=>(
                <button key={id} onClick={()=>{setTab(id); if(id==="library") refreshRecordings();}}
                  style={{ padding:"9px 18px", borderRadius:"10px 10px 0 0", border:"none", background:tab===id?"rgba(108,99,255,0.12)":"transparent", borderBottom:`2px solid ${tab===id?"#6c63ff":"transparent"}`, color:tab===id?"#ddd":"#333", fontSize:13, fontWeight:600, cursor:"pointer", transition:"all 0.2s" }}>
                  {label} {id==="library" && recordings.length>0 && <span style={{ marginLeft:6, fontSize:10, background:"rgba(108,99,255,0.25)", color:"#6c63ff", padding:"1px 6px", borderRadius:100 }}>{recordings.length}</span>}
                </button>
              ))}
            </div>

            {/* Tab body */}
            <div style={{ flex:1, overflowY:"auto", padding:22 }}>

              {/* ── RECORD tab ── */}
              {tab==="record" && (
                <div style={{ animation:"fadeUp 0.3s ease" }}>
                  {/* Preview card */}
                  <div style={{
                    borderRadius:18, border:`1px solid ${isRecording?(isPaused?"rgba(255,159,10,0.25)":"rgba(255,45,85,0.25)"):"rgba(255,255,255,0.05)"}`,
                    background: isRecording ? `${accent}06` : "rgba(255,255,255,0.018)",
                    height:220, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:12,
                    position:"relative", overflow:"hidden", marginBottom:18, transition:"all 0.5s",
                  }}>
                    {/* Corner brackets */}
                    {isRecording && [["0","0","0deg"],["auto","0","-90deg"],["0","auto","90deg"],["auto","auto","180deg"]].map(([t,l,r],i)=>(
                      <div key={i} style={{ position:"absolute", top:t==="auto"?"auto":14, bottom:t==="auto"?14:"auto", left:l==="auto"?"auto":14, right:l==="auto"?14:"auto", width:22, height:22, borderTop:`2px solid ${accent}`, borderLeft:`2px solid ${accent}`, transform:`rotate(${r})`, opacity:0.7 }} />
                    ))}
                    {/* Scanning line */}
                    {isRecording && !isPaused && (
                      <div style={{ position:"absolute", left:0, right:0, height:1, background:`linear-gradient(90deg, transparent, ${accent}80, transparent)`, animation:"shimmer 2s linear infinite", backgroundSize:"200% 100%" }} />
                    )}

                    {isRecording ? (
                      <>
                        <div style={{ fontSize:42, animation: isPaused?"none":"blink 2.5s ease infinite" }}>📹</div>
                        <div style={{ color:accent, fontSize:14, fontWeight:600 }}>
                          {isPaused ? "Recording paused" : "Recording your screen..."}
                        </div>
                        <div style={{ color:"#444", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
                          {quality} · {fps}fps{audio?" · audio":""}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize:42, opacity:0.2 }}>🖥️</div>
                        <div style={{ color:"#333", fontSize:13 }}>Press record to start capturing</div>
                        <div style={{ color:"#222", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{fps}fps · {quality} quality{audio?" · audio":""}</div>
                      </>
                    )}
                  </div>

                  {/* Stats grid */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
                    {[
                      { label:"QUALITY", val:quality, icon:"✨" },
                      { label:"FRAME RATE", val:`${fps} fps`, icon:"🎞" },
                      { label:"AUDIO", val:audio?"On":"Off", icon:"🎙" },
                    ].map(({label,val,icon})=>(
                      <div key={label} style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:12, padding:"12px 14px" }}>
                        <div style={{ color:"#2a2a45", fontSize:9, letterSpacing:1.2, marginBottom:5, fontFamily:"'DM Mono',monospace" }}>{icon} {label}</div>
                        <div style={{ color:"#aaa", fontSize:15, fontWeight:600 }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Save path */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", borderRadius:12, padding:"11px 14px" }}>
                    <div>
                      <div style={{ color:"#2a2a45", fontSize:9, letterSpacing:1.2, fontFamily:"'DM Mono',monospace", marginBottom:4 }}>SAVE LOCATION</div>
                      <div style={{ color:"#555", fontSize:11, fontFamily:"'DM Mono',monospace" }}>{saveDir || "~/Videos/ScreenRec"}</div>
                    </div>
                    <button onClick={openFolder} style={{ background:"none", border:"1px solid #1e1e30", borderRadius:8, color:"#444", padding:"6px 12px", fontSize:11, cursor:"pointer" }}>
                      Open ↗
                    </button>
                  </div>
                </div>
              )}

              {/* ── LIBRARY tab ── */}
              {tab==="library" && (
                <div style={{ animation:"fadeUp 0.3s ease" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                    <div style={{ color:"#ccc", fontSize:15, fontWeight:700 }}>Recordings</div>
                    <button onClick={openFolder} style={{ background:"none", border:"1px solid #1e1e30", borderRadius:8, color:"#444", padding:"5px 12px", fontSize:11, cursor:"pointer" }}>
                      Open folder ↗
                    </button>
                  </div>

                  {recordings.length===0 ? (
                    <div style={{ textAlign:"center", padding:"60px 0", color:"#222" }}>
                      <div style={{ fontSize:44, marginBottom:12 }}>📭</div>
                      <div style={{ fontSize:13 }}>No recordings yet</div>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                      {recordings.map(r=>(
                        <RecCard key={r.path} rec={r} onDelete={deleteRec} onOpen={openRec} />
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Small reusable components ────────────────────────────────────────────────
function Row({ label, children }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
      <span style={{ color:"#444", fontSize:12 }}>{label}</span>
      {children}
    </div>
  );
}

function Toggle({ value, onChange, disabled, accent }) {
  return (
    <div onClick={()=>!disabled&&onChange(v=>!v)}
      style={{ width:38, height:21, borderRadius:100, background:value?accent:"#141420", border:"1px solid rgba(255,255,255,0.07)", cursor:disabled?"not-allowed":"pointer", position:"relative", transition:"background 0.3s", flexShrink:0 }}>
      <div style={{ position:"absolute", top:3, left:value?19:3, width:13, height:13, borderRadius:"50%", background:"#fff", transition:"left 0.3s", boxShadow:"0 1px 4px rgba(0,0,0,0.5)" }} />
    </div>
  );
}
