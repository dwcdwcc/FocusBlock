# FocusBlock

System-wide site blocker với time limits + usage insights (Windows). Khác BlockSite extension: chặn toàn máy, không chỉ Chrome.

## Tính năng phase 1

- **Blocklist** — chặn domain trên toàn máy qua `hosts` file.
- **Time limits** — đặt giới hạn phút/ngày cho site, hết quota → auto block đến nửa đêm.
- **Insights** — thống kê thời gian visit từng site (today, 7 days, top sites).

## Cách chạy

### 1. Cài dependencies

Mở PowerShell **as Administrator** (cần quyền admin vì sửa `hosts`):

```powershell
cd C:\Users\Admin\focusblock
npm install
```

`better-sqlite3` build native — nếu lỗi cần `windows-build-tools` hoặc Visual Studio Build Tools.

### 2. Dev mode

```powershell
npm run dev
```

Mở Vite dev server (5173) + Electron. Cửa sổ hiện, icon tray xuất hiện góc dưới phải.

### 3. Build installer

```powershell
npm run build
```

Output `release/`. Installer NSIS yêu cầu admin lúc cài.

## Kiến trúc

```
electron/
  main.js      → main process, tray, IPC, tick loop
  preload.js   → bridge tới renderer
  hosts.js     → đọc/ghi C:\Windows\System32\drivers\etc\hosts
  db.js        → SQLite (better-sqlite3) ở %APPDATA%/focusblock
  tracker.js   → active-win + domain extraction
src/
  App.jsx, main.jsx, index.css
  pages/Blocklist.jsx, Limits.jsx, Stats.jsx
```

## Cơ chế chặn

- Sửa `C:\Windows\System32\drivers\etc\hosts`, map `127.0.0.1 domain` + `127.0.0.1 www.domain`.
- Block của app bao quanh bởi marker `# === FocusBlock START ===` / `# === FocusBlock END ===` → không đụng entries khác.
- Sau mỗi lần sửa: chạy `ipconfig /flushdns`.

## Tracker

- Mỗi 5s gọi `active-win` lấy foreground window.
- Detect browser (Chrome/Edge/Firefox/Brave/...) → parse domain từ title (hoặc URL accessibility nếu có).
- Skip khi idle ≥ 60s (`powerMonitor.getSystemIdleTime`).
- Lưu SQLite `usage(date, domain, seconds)`.

## Hạn chế biết trước

- Tracker domain dựa vào window title — không chính xác 100% (browser ẩn title, incognito, ...). Sẽ cải thiện bằng UI Automation hoặc Browser Extension companion phase 2.
- Hosts file chỉ chặn domain-level, không chặn được URL path (vd: chặn `youtube.com/watch` nhưng cho `youtube.com/feed/subscriptions`).
- Cần quyền admin liên tục để sửa hosts.

## Roadmap

- Phase 2: schedule (chặn theo giờ), focus mode Pomodoro, password lock chống bypass.
- Phase 3: browser extension companion → URL-path level + chính xác hơn.
- Phase 4: cross-device sync.
