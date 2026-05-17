const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, powerMonitor, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const hosts = require('./hosts');
const db = require('./db');
const tracker = require('./tracker');

const isDev = process.env.NODE_ENV === 'development';

const electronLog = require('electron-log/main');
electronLog.initialize();
electronLog.transports.file.level = 'info';
electronLog.transports.file.maxSize = 5 * 1024 * 1024;
electronLog.transports.console.level = isDev ? 'info' : false;
Object.assign(console, electronLog.functions);
const log = (...args) => electronLog.info(...args);

process.on('uncaughtException', (err) => electronLog.error('uncaughtException', err));
process.on('unhandledRejection', (err) => electronLog.error('unhandledRejection', err));

const BLOCKLIST_PORT = 47823;
let blocklistServer = null;

let hostsSyncQueued = false;
let hostsSyncRunning = false;
async function queueHostsSync() {
  if (hostsSyncRunning) {
    hostsSyncQueued = true;
    return;
  }
  hostsSyncRunning = true;
  try {
    await hosts.sync(db.allBlockedDomains());
  } catch (e) {
    console.error('hosts sync failed', e.message);
  } finally {
    hostsSyncRunning = false;
    if (hostsSyncQueued) {
      hostsSyncQueued = false;
      queueHostsSync();
    }
  }
}

function startBlocklistServer() {
  blocklistServer = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }
    if (req.method === 'POST' && req.url === '/active') {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 8192) {
          req.destroy();
        }
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          if (data.clear === 'focused') {
            tracker.clearFocusedBrowserUrl();
          } else if (typeof data.url === 'string') {
            tracker.setActiveBrowserUrl(data.url, {
              focused: data.focused !== false,
              audible: !!data.audible
            });
          }
          res.writeHead(204, { 'Access-Control-Allow-Origin': '*' });
          res.end();
        } catch {
          res.writeHead(400, { 'Access-Control-Allow-Origin': '*' });
          res.end('bad json');
        }
      });
      return;
    }
    if (req.method !== 'GET') {
      res.writeHead(405); res.end(); return;
    }
    if (req.url.startsWith('/blocklist')) {
      const domains = db.allBlockedDomains();
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
      });
      res.end(JSON.stringify({ domains, ts: Date.now() }));
      return;
    }
    if (req.url === '/health') {
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*' });
      res.end('ok');
      return;
    }
    res.writeHead(404); res.end();
  });
  blocklistServer.on('error', (err) => {
    console.error('blocklist server error', err.message);
  });
  blocklistServer.listen(BLOCKLIST_PORT, '127.0.0.1', () => {
    log(`[blocklist] http://127.0.0.1:${BLOCKLIST_PORT}/blocklist`);
  });
}

let mainWindow = null;
let tray = null;
let trackerInterval = null;

const TICK_MS = 5000;
const TICK_SEC = TICK_MS / 1000;
const IDLE_THRESHOLD_SEC = 60;

const FALLBACK_ICON_B64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAd0lEQVR4AWMYWuD///8x/8mAEMP/zHL0X8oAaMD/qP9o4D8aQDcAGfyHGoIvAJABTOAj//9owH9k8Bm/AciG/CcUgP9o4D8aIDoA0Ay4iaY5BqaWqAAlMAAxsADM6kCkB1AjcBA8AHEC2QAU3+ImsBP8B+omtgEAxgVgKr0Y2WMAAAAASUVORK5CYII=';

function getTrayIcon() {
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png');
  if (fs.existsSync(iconPath)) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) return img;
  }
  return nativeImage.createFromBuffer(Buffer.from(FALLBACK_ICON_B64, 'base64'));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
    // Uncomment dòng dưới để debug production:
    // mainWindow.webContents.openDevTools();
  }

  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('renderer failed to load', code, desc);
  });

  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const image = getTrayIcon();
  tray = new Tray(image);
  tray.setToolTip('FocusBlock');

  const menu = Menu.buildFromTemplate([
    { label: 'Open FocusBlock', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus(); } } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else { mainWindow.show(); mainWindow.focus(); }
  });
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function tick() {
  try {
    checkDailyReset();
    const idle = powerMonitor.getSystemIdleTime();
    if (idle >= IDLE_THRESHOLD_SEC) {
      log(`[tick] idle ${idle}s — skip`);
      return;
    }

    const info = await tracker.getActive();
    if (!info) {
      log('[tick] no active info');
      return;
    }

    let domain = info.domain;
    const app_ = info.app;
    const today = todayStr();

    if (!domain) {
      const audibleUrl = tracker.getAudibleBrowserUrlIfFresh();
      if (audibleUrl) {
        const m = audibleUrl.match(/https?:\/\/([^\s/]+)/);
        if (m) domain = tracker.cleanHost(m[1]);
      }
    }

    log(`[tick] app=${app_} domain=${domain || '-'}`);

    if (domain) {
      if (db.isBlocked(domain)) return;
      db.addUsage(today, domain, TICK_SEC);
      enforceLimits(domain, today);
    } else if (app_) {
      db.addAppUsage(today, app_, TICK_SEC);
    }
  } catch (err) {
    console.error('tick error', err);
  }
}

function enforceLimits(domain, today) {
  const limit = db.getLimit(domain);
  if (!limit) return;
  const used = db.getUsageSeconds(today, domain);
  if (used >= limit * 60 && !db.isBlocked(domain)) {
    db.setBlocked(domain, 1, 'limit');
    queueHostsSync();
    new Notification({
      title: 'FocusBlock',
      body: `${domain} đã đạt giới hạn ${limit} phút hôm nay. Đã block.`
    }).show();
  }
}

function resetDailyLimits() {
  const removed = db.clearLimitBlocks();
  if (removed > 0) queueHostsSync();
  db.setLastResetDate(todayStr());
  electronLog.info(`[reset] cleared ${removed} limit blocks for ${todayStr()}`);
}

function checkDailyReset() {
  const today = todayStr();
  const last = db.getLastResetDate();
  if (last !== today) {
    electronLog.info(`[reset] stale last=${last} today=${today} — running reset`);
    resetDailyLimits();
  }
}

function scheduleMidnightReset() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const ms = next - now;
  setTimeout(() => {
    resetDailyLimits();
    scheduleMidnightReset();
  }, ms);
}

function registerIpc() {
  ipcMain.handle('blocklist:list', () => db.listBlocked());
  ipcMain.handle('blocklist:add', (_e, domain) => {
    db.setBlocked(domain, 1, 'manual');
    queueHostsSync();
    return db.listBlocked();
  });
  ipcMain.handle('blocklist:remove', (_e, domain) => {
    db.setBlocked(domain, 0, null);
    queueHostsSync();
    return db.listBlocked();
  });

  ipcMain.handle('limits:list', () => {
    const today = todayStr();
    return db.listLimits().map(l => ({
      ...l,
      used: Math.floor(db.getUsageSeconds(today, l.domain) / 60)
    }));
  });
  ipcMain.handle('limits:set', (_e, { domain, minutes }) => {
    db.setLimit(domain, minutes);
    const today = todayStr();
    const used = db.getUsageSeconds(today, domain);
    const limitSec = Number(minutes) * 60;
    if (used < limitSec) {
      if (db.clearLimitBlockFor(domain)) queueHostsSync();
    } else if (!db.isBlocked(domain)) {
      db.setBlocked(domain, 1, 'limit');
      queueHostsSync();
      new Notification({
        title: 'FocusBlock',
        body: `${domain} đã vượt giới hạn ${minutes} phút hôm nay. Đã block.`
      }).show();
    }
    return db.listLimits();
  });
  ipcMain.handle('limits:remove', (_e, domain) => {
    db.setLimit(domain, null);
    if (db.clearLimitBlockFor(domain)) queueHostsSync();
    return db.listLimits();
  });

  ipcMain.handle('stats:today', () => db.statsToday());
  ipcMain.handle('stats:app-today', () => db.statsAppToday());
  ipcMain.handle('stats:range', (_e, days) => db.statsRange(days || 7));
  ipcMain.handle('stats:top', (_e, days) => db.statsTop(days || 7));
  ipcMain.handle('stats:app-top', (_e, days) => db.statsAppTop(days || 7));
}

app.whenReady().then(async () => {
  try {
    db.init();
    checkDailyReset();
    registerIpc();
    createWindow();
    try { createTray(); } catch (e) { console.error('tray create failed', e); }

    queueHostsSync();
    startBlocklistServer();

    trackerInterval = setInterval(tick, TICK_MS);
    scheduleMidnightReset();

    app.setLoginItemSettings({ openAtLogin: true });
  } catch (err) {
    console.error('app init failed', err);
  }
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  if (trackerInterval) clearInterval(trackerInterval);
  if (blocklistServer) { try { blocklistServer.close(); } catch {} }
});
