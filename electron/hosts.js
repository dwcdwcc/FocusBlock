const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');

const HOSTS_PATH = process.platform === 'win32'
  ? path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts')
  : '/etc/hosts';

const MARK_START = '# === FocusBlock START ===';
const MARK_END = '# === FocusBlock END ===';
const REDIRECT = '127.0.0.1';
const MAX_HOSTS_ENTRIES = 500;

function buildBlock(domains) {
  const lines = [MARK_START];
  let list = domains;
  if (list.length > MAX_HOSTS_ENTRIES) {
    console.warn(`[hosts] ${list.length} domains exceeds safety cap ${MAX_HOSTS_ENTRIES} — truncating to avoid DNS resolver slowdown`);
    list = list.slice(0, MAX_HOSTS_ENTRIES);
  }
  for (const d of list) {
    const clean = d.trim().toLowerCase();
    if (!clean) continue;
    lines.push(`${REDIRECT} ${clean}`);
    if (!clean.startsWith('www.')) {
      lines.push(`${REDIRECT} www.${clean}`);
    }
  }
  lines.push(MARK_END);
  return lines.join('\r\n');
}

function stripExisting(content) {
  const startIdx = content.indexOf(MARK_START);
  const endIdx = content.indexOf(MARK_END);
  if (startIdx === -1 || endIdx === -1) return content.trimEnd();
  const before = content.slice(0, startIdx).trimEnd();
  const after = content.slice(endIdx + MARK_END.length);
  return (before + after).trimEnd();
}

async function readHosts() {
  try {
    return await fs.readFile(HOSTS_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return '';
    throw err;
  }
}

async function writeHosts(content) {
  await fs.writeFile(HOSTS_PATH, content, { encoding: 'utf8' });
}

function flushDns() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve();
    exec('ipconfig /flushdns', () => resolve());
  });
}

async function sync(domains) {
  const current = await readHosts();
  const stripped = stripExisting(current);
  const block = buildBlock(domains);
  const next = stripped.length
    ? `${stripped}\r\n\r\n${block}\r\n`
    : `${block}\r\n`;
  if (next === current) return false;
  await writeHosts(next);
  await flushDns();
  return true;
}

module.exports = { sync, HOSTS_PATH };
