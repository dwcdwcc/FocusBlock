const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const { isSystemApp } = require('./system-apps');

let state = null;
let filePath = null;
let tmpPath = null;
let saveTimer = null;

const RETENTION_DAYS = 90;

function defaultState() {
  return {
    blocklist: {},
    limits: {},
    usage: {},
    app_usage: {},
    lastResetDate: null
  };
}

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getLastResetDate() {
  return state.lastResetDate || null;
}

function setLastResetDate(date) {
  state.lastResetDate = date;
  saveSoon();
}

function init() {
  const dir = app.getPath('userData');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  filePath = path.join(dir, 'focusblock.json');
  tmpPath = filePath + '.tmp';
  if (fs.existsSync(filePath)) {
    try {
      state = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      state = defaultState();
    }
  } else {
    state = defaultState();
  }
  ensureShape();
  if (pruneOldDates(RETENTION_DAYS) > 0) saveSoon();
}

function ensureShape() {
  const def = defaultState();
  for (const k of Object.keys(def)) {
    if (!state[k]) state[k] = def[k];
  }
}

function pruneOldDates(days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = localDateStr(cutoff);
  let removed = 0;
  for (const bucket of [state.usage, state.app_usage]) {
    for (const date of Object.keys(bucket)) {
      if (date < cutoffStr) {
        delete bucket[date];
        removed++;
      }
    }
  }
  return removed;
}

function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(state), 'utf8');
      fs.renameSync(tmpPath, filePath);
    } catch (err) {
      console.error('db save failed', err);
    }
  }, 500);
}

function cleanDomain(d) {
  return String(d || '').trim().toLowerCase();
}

function listBlocked() {
  return Object.values(state.blocklist).filter(b => b.blocked === 1)
    .map(b => ({ domain: b.domain, blocked: b.blocked, reason: b.reason }))
    .sort((a, b) => a.domain.localeCompare(b.domain));
}

function allBlockedDomains() {
  return Object.values(state.blocklist).filter(b => b.blocked === 1).map(b => b.domain);
}

function isBlocked(domain) {
  const d = cleanDomain(domain);
  return state.blocklist[d] && state.blocklist[d].blocked === 1;
}

function setBlocked(domain, blocked, reason) {
  const d = cleanDomain(domain);
  if (!d) return;
  state.blocklist[d] = { domain: d, blocked: blocked ? 1 : 0, reason: reason || null, updated_at: new Date().toISOString() };
  saveSoon();
}

function clearLimitBlocks() {
  let n = 0;
  for (const d of Object.keys(state.blocklist)) {
    const b = state.blocklist[d];
    if (b.reason === 'limit' && b.blocked === 1) {
      b.blocked = 0;
      b.reason = null;
      n++;
    }
  }
  if (n > 0) saveSoon();
  return n;
}

function clearLimitBlockFor(domain) {
  const d = cleanDomain(domain);
  const b = state.blocklist[d];
  if (b && b.reason === 'limit' && b.blocked === 1) {
    b.blocked = 0;
    b.reason = null;
    saveSoon();
    return true;
  }
  return false;
}

function listLimits() {
  return Object.values(state.limits).sort((a, b) => a.domain.localeCompare(b.domain));
}

function getLimit(domain) {
  const d = cleanDomain(domain);
  return state.limits[d] ? state.limits[d].minutes : null;
}

function setLimit(domain, minutes) {
  const d = cleanDomain(domain);
  if (!d) return;
  if (minutes == null) {
    delete state.limits[d];
  } else {
    state.limits[d] = { domain: d, minutes: Number(minutes) };
  }
  saveSoon();
}

function addUsage(date, domain, seconds) {
  const d = cleanDomain(domain);
  if (!d) return;
  if (!state.usage[date]) state.usage[date] = {};
  state.usage[date][d] = (state.usage[date][d] || 0) + seconds;
  saveSoon();
}

function addAppUsage(date, appName, seconds) {
  const a = String(appName || '').trim().toLowerCase();
  if (!a) return;
  if (!state.app_usage[date]) state.app_usage[date] = {};
  state.app_usage[date][a] = (state.app_usage[date][a] || 0) + seconds;
  saveSoon();
}

function getUsageSeconds(date, domain) {
  const d = cleanDomain(domain);
  return (state.usage[date] && state.usage[date][d]) || 0;
}

function statsToday() {
  const today = localDateStr();
  const day = state.usage[today] || {};
  return Object.entries(day)
    .map(([domain, seconds]) => ({ domain, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

function statsAppToday() {
  const today = localDateStr();
  const day = state.app_usage[today] || {};
  return Object.entries(day)
    .filter(([app]) => !isSystemApp(app))
    .map(([app, seconds]) => ({ app, seconds }))
    .sort((a, b) => b.seconds - a.seconds);
}

function datesInRange(days) {
  const out = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(localDateStr(d));
  }
  return out;
}

function statsRange(days) {
  return datesInRange(days).map(date => {
    const day = state.usage[date] || {};
    let seconds = 0;
    for (const v of Object.values(day)) seconds += v;
    return { date, seconds };
  });
}

function statsTop(days) {
  const totals = {};
  for (const date of datesInRange(days)) {
    const day = state.usage[date];
    if (!day) continue;
    for (const [domain, seconds] of Object.entries(day)) {
      totals[domain] = (totals[domain] || 0) + seconds;
    }
  }
  return Object.entries(totals)
    .map(([domain, seconds]) => ({ domain, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 20);
}

function statsAppTop(days) {
  const totals = {};
  for (const date of datesInRange(days)) {
    const day = state.app_usage[date];
    if (!day) continue;
    for (const [app, seconds] of Object.entries(day)) {
      if (isSystemApp(app)) continue;
      totals[app] = (totals[app] || 0) + seconds;
    }
  }
  return Object.entries(totals)
    .map(([app, seconds]) => ({ app, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 20);
}

module.exports = {
  init,
  listBlocked,
  allBlockedDomains,
  isBlocked,
  setBlocked,
  clearLimitBlocks,
  clearLimitBlockFor,
  listLimits,
  getLimit,
  setLimit,
  addUsage,
  addAppUsage,
  getUsageSeconds,
  statsToday,
  statsAppToday,
  statsRange,
  statsTop,
  statsAppTop,
  getLastResetDate,
  setLastResetDate
};
