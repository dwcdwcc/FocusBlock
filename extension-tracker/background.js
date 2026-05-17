const ACTIVE_URL = 'http://127.0.0.1:47823/active';
const POLL_SECONDS = 5;
const REPORT_MIN_INTERVAL_MS = 1000;

let lastReportedUrl = null;
let lastReportTs = 0;

async function postActive(url, opts) {
  try {
    await fetch(ACTIVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        ts: Date.now(),
        focused: !!(opts && opts.focused),
        audible: !!(opts && opts.audible)
      })
    }).catch(() => {});
  } catch {}
}

async function reportActiveTab() {
  try {
    let win;
    try {
      win = await chrome.windows.getLastFocused({ populate: false });
    } catch {
      return;
    }
    if (!win || win.focused !== true) return;
    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    if (!tab || !tab.url) return;
    if (!/^https?:\/\//i.test(tab.url)) return;
    const now = Date.now();
    if (tab.url === lastReportedUrl && now - lastReportTs < REPORT_MIN_INTERVAL_MS) return;
    lastReportedUrl = tab.url;
    lastReportTs = now;
    await postActive(tab.url, { focused: true, audible: !!tab.audible });
  } catch {}
}

async function reportAudibleTabs() {
  try {
    const tabs = await chrome.tabs.query({ audible: true });
    for (const tab of tabs) {
      if (!tab || !tab.url) continue;
      if (!/^https?:\/\//i.test(tab.url)) continue;
      await postActive(tab.url, { focused: false, audible: true });
    }
  } catch {}
}

chrome.tabs.onActivated.addListener(() => { reportActiveTab(); });
chrome.tabs.onUpdated.addListener((_id, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    if (tab && tab.active) reportActiveTab();
  }
  if (changeInfo.audible === true && tab && tab.url && /^https?:\/\//i.test(tab.url)) {
    postActive(tab.url, { focused: false, audible: true });
  }
});
chrome.windows.onFocusChanged.addListener(async (winId) => {
  try {
    const win = await chrome.windows.getLastFocused({ populate: false });
    if (!win || win.focused !== true) {
      await fetch(ACTIVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clear: 'focused', ts: Date.now() })
      }).catch(() => {});
      return;
    }
  } catch {}
  if (winId !== chrome.windows.WINDOW_ID_NONE) reportActiveTab();
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('focusblock-tracker', { periodInMinutes: POLL_SECONDS / 60 });
  reportActiveTab();
  reportAudibleTabs();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('focusblock-tracker', { periodInMinutes: POLL_SECONDS / 60 });
  reportActiveTab();
  reportAudibleTabs();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focusblock-tracker') {
    reportActiveTab();
    reportAudibleTabs();
  }
});

reportActiveTab();
reportAudibleTabs();
