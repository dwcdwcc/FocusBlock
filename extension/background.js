const BLOCKLIST_URL = 'http://127.0.0.1:47823/blocklist';
const ACTIVE_URL = 'http://127.0.0.1:47823/active';
const POLL_SECONDS = 5;
const RULE_ID_BASE = 1000;
const MAX_RULES = 4000;
const FAIL_OPEN_THRESHOLD = 3;

let currentDomains = [];
let lastReportedUrl = null;
let lastReportTs = 0;
let consecutiveFailures = 0;
let failOpenActive = false;
const REPORT_MIN_INTERVAL_MS = 1000;

async function postActive(url, opts) {
  try {
    await fetch(ACTIVE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, ts: Date.now(), focused: !!(opts && opts.focused), audible: !!(opts && opts.audible) })
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

function hashDomainToId(domain, idx) {
  let h = 0;
  for (let i = 0; i < domain.length; i++) {
    h = ((h << 5) - h + domain.charCodeAt(i)) | 0;
  }
  return RULE_ID_BASE + idx + (Math.abs(h) % 100000);
}

function buildRule(domain, idx) {
  const blockedUrl = chrome.runtime.getURL('blocked.html') + '?d=' + encodeURIComponent(domain);
  return {
    id: hashDomainToId(domain, idx),
    priority: 1,
    action: {
      type: 'redirect',
      redirect: { url: blockedUrl }
    },
    condition: {
      requestDomains: [domain],
      resourceTypes: ['main_frame']
    }
  };
}

function arrEq(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

async function applyDomains(domains) {
  const clean = Array.from(new Set(
    (domains || [])
      .map(d => String(d || '').trim().toLowerCase())
      .filter(d => d && !d.startsWith('www.'))
  )).sort().slice(0, MAX_RULES);

  if (arrEq(clean, currentDomains)) return;

  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map(r => r.id);

  const addRules = clean.map((d, i) => buildRule(d, i));

  const seen = new Set();
  const dedup = [];
  for (const r of addRules) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    dedup.push(r);
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: dedup
    });
    const prev = new Set(currentDomains);
    const newlyAdded = clean.filter(d => !prev.has(d));
    currentDomains = clean;
    console.log('[FocusBlock] applied', clean.length, 'rules');
    if (newlyAdded.length) await redirectOpenTabs(newlyAdded);
  } catch (err) {
    console.error('[FocusBlock] updateDynamicRules failed', err);
  }
}

async function redirectOpenTabs(domains) {
  for (const d of domains) {
    try {
      const tabs = await chrome.tabs.query({ url: [`*://${d}/*`, `*://*.${d}/*`] });
      const target = chrome.runtime.getURL('blocked.html') + '?d=' + encodeURIComponent(d);
      for (const t of tabs) {
        chrome.tabs.update(t.id, { url: target }).catch(e =>
          console.warn('[FocusBlock] tab update failed', t.id, e.message)
        );
      }
      if (tabs.length) console.log('[FocusBlock] redirected', tabs.length, 'tab(s) for', d);
    } catch (err) {
      console.warn('[FocusBlock] tabs.query failed for', d, err.message);
    }
  }
}

async function clearAllRules() {
  try {
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    if (!existing.length) return;
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existing.map(r => r.id),
      addRules: []
    });
    currentDomains = [];
    console.log('[FocusBlock] fail-open: cleared', existing.length, 'rules (app unreachable)');
  } catch (err) {
    console.error('[FocusBlock] clearAllRules failed', err);
  }
}

async function poll() {
  try {
    const res = await fetch(BLOCKLIST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error('http ' + res.status);
    const data = await res.json();
    consecutiveFailures = 0;
    if (failOpenActive) {
      failOpenActive = false;
      console.log('[FocusBlock] app reachable again — resuming normal blocking');
    }
    await applyDomains(data.domains);
  } catch (err) {
    consecutiveFailures++;
    console.warn('[FocusBlock] poll failed', err.message, `(${consecutiveFailures}/${FAIL_OPEN_THRESHOLD})`);
    if (consecutiveFailures >= FAIL_OPEN_THRESHOLD && !failOpenActive) {
      failOpenActive = true;
      await clearAllRules();
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('focusblock-poll', { periodInMinutes: POLL_SECONDS / 60 });
  poll();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('focusblock-poll', { periodInMinutes: POLL_SECONDS / 60 });
  poll();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'focusblock-poll') {
    poll();
    reportActiveTab();
    reportAudibleTabs();
  }
});

poll();
