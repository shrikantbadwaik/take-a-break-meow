const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  screen,
} = require("electron");
const path = require("path");

const APP_TITLE = "Take a Break Meow";

let settingsWindow = null;
let overlayWindow = null;
let tray = null;
let tickInterval = null;

/** @type {{ usageMs: number, breakMs: number, usageEndAt: number, breakEndAt: number, phase: 'idle'|'usage'|'break' }} */
let session = {
  usageMs: 60 * 60 * 1000,
  breakMs: 5 * 60 * 1000,
  usageEndAt: 0,
  breakEndAt: 0,
  phase: "idle",
};

function createTrayIcon() {
  const size = process.platform === "darwin" ? 18 : 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><text y="18" font-size="16">🐱</text></svg>`;
  return nativeImage.createFromDataURL(
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg)
  );
}

function formatRemaining(ms) {
  if (ms <= 0) return "00:00";
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function broadcastTick() {
  const now = Date.now();
  let payload;

  if (session.phase === "usage" && session.usageEndAt > now) {
    payload = {
      phase: "usage",
      remainingMs: session.usageEndAt - now,
      usageMs: session.usageMs,
      breakMs: session.breakMs,
    };
  } else if (session.phase === "break" && session.breakEndAt > now) {
    payload = {
      phase: "break",
      remainingMs: session.breakEndAt - now,
      usageMs: session.usageMs,
      breakMs: session.breakMs,
    };
  } else if (
    session.phase === "usage" &&
    session.usageEndAt &&
    now >= session.usageEndAt
  ) {
    beginBreak();
    return;
  } else if (
    session.phase === "break" &&
    session.breakEndAt &&
    now >= session.breakEndAt
  ) {
    finishBreakAndRestartUsage();
    return;
  } else {
    payload = {
      phase: session.phase,
      remainingMs: 0,
      usageMs: session.usageMs,
      breakMs: session.breakMs,
    };
  }

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("session:tick", payload);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send("session:tick", payload);
  }

  updateTray(payload);
}

function updateTray(payload) {
  if (!tray) return;
  if (session.phase === "idle" || !payload) {
    tray.setToolTip(`${APP_TITLE} — idle`);
    return;
  }
  if (payload.phase === "usage") {
    tray.setToolTip(
      `${APP_TITLE} — ${formatRemaining(payload.remainingMs)} until break`
    );
  } else if (payload.phase === "break") {
    tray.setToolTip(
      `${APP_TITLE} — break ${formatRemaining(payload.remainingMs)}`
    );
  }
}

function beginBreak() {
  session.phase = "break";
  session.breakEndAt = Date.now() + session.breakMs;
  showOverlay();
}

function finishBreakAndRestartUsage() {
  closeOverlay();
  session.phase = "usage";
  session.usageEndAt = Date.now() + session.usageMs;
  session.breakEndAt = 0;
}

function closeOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.close();
    overlayWindow = null;
  }
}

function startTickLoop() {
  if (tickInterval) clearInterval(tickInterval);
  tickInterval = setInterval(broadcastTick, 250);
  broadcastTick();
}

function stopTickLoop() {
  if (tickInterval) {
    clearInterval(tickInterval);
    tickInterval = null;
  }
}

function showSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 400,
    height: 540,
    resizable: false,
    maximizable: false,
    title: APP_TITLE,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#faf6ef",
  });
  settingsWindow.loadFile(path.join(__dirname, "settings.html"));
  settingsWindow.on("closed", () => {
    settingsWindow = null;
  });
}

function showOverlay() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
    overlayWindow.focus();
    return;
  }
  const display = screen.getPrimaryDisplay();
  // Cover the display without native fullscreen (bad with transparent on macOS).
  const { x, y, width, height } = display.bounds;

  /** @type {import('electron').BrowserWindowConstructorOptions} */
  const opts = {
    x,
    y,
    width,
    height,
    frame: false,
    fullscreen: false,
    fullscreenable: false,
    simpleFullscreen: false,
    transparent: true,
    hasShadow: false,
    resizable: false,
    skipTaskbar: true,
    show: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  // macOS: avoid a separate Mission Control "Space" tile — use a panel-style window.
  // (Do not set `parent` to the hidden settings window; a hidden parent can suppress
  // the child overlay on macOS.)
  if (process.platform === "darwin") {
    opts.type = "panel";
  }

  overlayWindow = new BrowserWindow(opts);

  overlayWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true,
    ...(process.platform === "darwin" ? { skipTransformProcessType: true } : {}),
  });

  // macOS: very high levels + non-panel windows often appear as their own Space tile.
  // Stay above normal windows without pushing into the fullscreen Space behavior.
  if (process.platform === "darwin") {
    overlayWindow.setAlwaysOnTop(true, "floating", 90);
  } else {
    overlayWindow.setAlwaysOnTop(true, "screen-saver");
  }

  overlayWindow.loadFile(path.join(__dirname, "overlay.html"));
  overlayWindow.once("ready-to-show", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      if (process.platform === "darwin") {
        overlayWindow.setFullScreen(false);
        overlayWindow.setSimpleFullScreen(false);
      }
      overlayWindow.show();
      overlayWindow.focus();
    }
  });
  overlayWindow.webContents.once("did-finish-load", () => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      broadcastTick();
    }
  });
  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });
}

function stopSessionInternal() {
  session.phase = "idle";
  session.usageEndAt = 0;
  session.breakEndAt = 0;
  stopTickLoop();
  closeOverlay();
  if (tray) tray.setToolTip(APP_TITLE);
  broadcastTick();
}

function buildTray() {
  tray = new Tray(createTrayIcon());
  tray.setToolTip(APP_TITLE);
  const menu = Menu.buildFromTemplate([
    {
      label: "Open…",
      click: () => showSettingsWindow(),
    },
    {
      label: "Stop session",
      click: () => stopSessionInternal(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => showSettingsWindow());
}

app.whenReady().then(() => {
  buildTray();
  showSettingsWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) showSettingsWindow();
  });
});

app.on("window-all-closed", () => {});

ipcMain.handle("session:start", (_event, opts) => {
  const usageMinutes = Math.max(
    1,
    Math.min(24 * 60, Number(opts?.usageMinutes) || 60)
  );
  const breakMinutes = Math.max(
    1,
    Math.min(120, Number(opts?.breakMinutes) || 5)
  );
  session.usageMs = usageMinutes * 60 * 1000;
  session.breakMs = breakMinutes * 60 * 1000;
  session.phase = "usage";
  session.usageEndAt = Date.now() + session.usageMs;
  session.breakEndAt = 0;
  startTickLoop();
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.hide();
  }
  return {
    ok: true,
    usageMinutes,
    breakMinutes,
    usageEndAt: session.usageEndAt,
  };
});

ipcMain.handle("session:stop", () => {
  stopSessionInternal();
  return { ok: true };
});
