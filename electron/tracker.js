const { SYSTEM_APPS } = require('./system-apps');

let activeWin = null;

async function getActiveWin() {
  if (!activeWin) {
    activeWin = (await import('active-win')).default;
  }
  return activeWin;
}

const BROWSERS = new Set([
  'chrome.exe', 'msedge.exe', 'firefox.exe', 'brave.exe', 'opera.exe',
  'vivaldi.exe', 'arc.exe', 'zen.exe', 'librewolf.exe'
]);
const BROWSER_PATH_SUFFIXES = Array.from(BROWSERS);
const BROWSER_NAME_PATTERNS = [
  /^chrome(\.exe)?$/i,
  /^google chrome$/i,
  /^msedge(\.exe)?$/i,
  /^microsoft edge$/i,
  /^firefox(\.exe)?$/i,
  /^mozilla firefox$/i,
  /^brave(\.exe)?$/i,
  /^opera(\.exe)?$/i,
  /^vivaldi(\.exe)?$/i,
  /^arc(\.exe)?$/i,
  /^zen(\.exe)?$/i,
  /^librewolf(\.exe)?$/i
];

const MULTI_PART_TLDS = new Set([
  'co.uk', 'co.jp', 'co.kr', 'co.id', 'co.in', 'co.nz', 'co.za',
  'com.vn', 'com.au', 'com.br', 'com.cn', 'com.tw', 'com.sg',
  'com.hk', 'com.mx', 'com.ar', 'com.tr', 'com.my', 'com.ph',
  'ac.uk', 'gov.uk', 'org.uk', 'net.au', 'org.au'
]);

function registrableDomain(host) {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(last2) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  return last2;
}

function cleanHost(host) {
  const h = String(host || '').replace(/^www\./, '').split(':')[0].trim().toLowerCase();
  if (!h) return '';
  return registrableDomain(h);
}

const URL_RE = /https?:\/\/([^\s/]+)/;
const TLD_RE_FULL = /([a-z0-9-]+(?:\.[a-z0-9-]+)+\.(?:com|net|org|io|ai|tv|co|vn|dev|app|me|to|gg|edu|gov|info|xyz))/;
const TLD_RE_SHORT = /([a-z0-9-]+\.(?:com|net|org|io|ai|tv|co|vn|dev|app|me|to|gg|edu|gov|info|xyz))/;

const TITLE_KEYWORDS = [
  [/\byoutube\b/, 'youtube.com'],
  [/\bfacebook\b/, 'facebook.com'],
  [/\binstagram\b/, 'instagram.com'],
  [/\btwitter\b/, 'twitter.com'],
  [/\breddit\b/, 'reddit.com'],
  [/\btiktok\b/, 'tiktok.com'],
  [/\btwitch\b/, 'twitch.tv'],
  [/\bnetflix\b/, 'netflix.com'],
  [/\bspotify\b/, 'spotify.com'],
  [/\bdiscord\b/, 'discord.com'],
  [/\blinkedin\b/, 'linkedin.com'],
  [/\bgithub\b/, 'github.com'],
  [/\bchatgpt\b/, 'chatgpt.com'],
  [/\bgmail\b/, 'gmail.com'],
];

function extractDomainFromTitle(title) {
  if (!title) return null;
  const lower = title.toLowerCase();
  const urlMatch = lower.match(URL_RE);
  if (urlMatch) return cleanHost(urlMatch[1]);
  const tldMatch = lower.match(TLD_RE_FULL);
  if (tldMatch) return cleanHost(tldMatch[1]);
  const tldMatch2 = lower.match(TLD_RE_SHORT);
  if (tldMatch2) return cleanHost(tldMatch2[1]);
  for (const [re, dom] of TITLE_KEYWORDS) {
    if (re.test(lower)) return dom;
  }
  return null;
}

let lastBrowserUrl = null;
let lastAudibleUrl = null;
const BROWSER_URL_TTL_MS = 15000;

function setActiveBrowserUrl(url, opts) {
  if (!url || typeof url !== 'string') return;
  if (!/^https?:\/\//i.test(url)) return;
  const entry = { url, ts: Date.now() };
  const o = opts || {};
  if (o.focused !== false) {
    lastBrowserUrl = entry;
  }
  if (o.audible) {
    lastAudibleUrl = entry;
  }
}

function clearFocusedBrowserUrl() {
  lastBrowserUrl = null;
}

function getBrowserUrlIfFresh() {
  if (!lastBrowserUrl) return null;
  if (Date.now() - lastBrowserUrl.ts > BROWSER_URL_TTL_MS) return null;
  return lastBrowserUrl.url;
}

function getAudibleBrowserUrlIfFresh() {
  if (!lastAudibleUrl) return null;
  if (Date.now() - lastAudibleUrl.ts > BROWSER_URL_TTL_MS) return null;
  return lastAudibleUrl.url;
}

function isBrowserProc(procName, procPath) {
  if (BROWSERS.has(procName)) return true;
  for (const re of BROWSER_NAME_PATTERNS) {
    if (re.test(procName)) return true;
  }
  for (const b of BROWSER_PATH_SUFFIXES) {
    if (procPath.endsWith(b)) return true;
  }
  return false;
}

async function getActive() {
  try {
    const aw = await getActiveWin();
    const info = await aw();
    if (!info) return null;

    const procName = (info.owner && info.owner.name) ? info.owner.name.toLowerCase() : '';
    const procPath = (info.owner && info.owner.path) ? info.owner.path.toLowerCase() : '';
    if (SYSTEM_APPS.has(procName)) return null;
    const isBrowser = isBrowserProc(procName, procPath);

    if (isBrowser) {
      const extUrl = getBrowserUrlIfFresh();
      if (extUrl) {
        const m = extUrl.match(URL_RE);
        if (m) return { domain: cleanHost(m[1]), app: procName };
      }
      const d = extractDomainFromTitle(info.title);
      if (d) return { domain: d, app: procName };
      if (info.url) {
        const m = info.url.match(URL_RE);
        if (m) return { domain: cleanHost(m[1]), app: procName };
      }
      return { domain: null, app: procName };
    }

    if (info.url) {
      const m = info.url.match(URL_RE);
      if (m) return { domain: cleanHost(m[1]), app: procName };
    }

    return { domain: null, app: procName || 'unknown' };
  } catch {
    return null;
  }
}

module.exports = { getActive, setActiveBrowserUrl, getAudibleBrowserUrlIfFresh, clearFocusedBrowserUrl, cleanHost };
