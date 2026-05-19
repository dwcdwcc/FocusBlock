import React, { useState, useEffect, useRef } from 'react';
import {
  DomainBadge, Icon, Kbd, Card, PageHeader, EmptyState
} from '../App.jsx';

const SUGGESTED_SITES = [
  { domain: 'youtube.com',    label: 'YouTube',      category: 'Video'     },
  { domain: 'facebook.com',   label: 'Facebook',     category: 'Social'    },
  { domain: 'messenger.com',  label: 'Messenger',    category: 'Chat'      },
  { domain: 'tiktok.com',     label: 'TikTok',       category: 'Social'    },
  { domain: 'telegram.org',   label: 'Telegram',     category: 'Chat'      },
  { domain: 'instagram.com',  label: 'Instagram',    category: 'Social'    },
  { domain: 'twitter.com',    label: 'Twitter / X',  category: 'Social'    },
  { domain: 'reddit.com',     label: 'Reddit',       category: 'Forum'     },
  { domain: 'vnexpress.net',  label: 'VnExpress',    category: 'Tin tức'   },
  { domain: 'hyperliquid.xyz',label: 'Hyperliquid',  category: 'Crypto'    },
  { domain: 'tradingview.com',label: 'TradingView',  category: 'Trading'   },
  { domain: 'binance.com',    label: 'Binance',      category: 'Crypto'    },
  { domain: 'shopee.vn',      label: 'Shopee',       category: 'Shopping'  },
  { domain: 'discord.com',    label: 'Discord',      category: 'Chat'      },
  { domain: 'netflix.com',    label: 'Netflix',      category: 'Streaming' },
];

function fmtSeconds(s) {
  if (!s || s < 5) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  if (m > 0) return `${m}m`;
  return '<1m';
}

export default function Blocklist() {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState(null);
  const inputRef = useRef(null);

  const [adultStatus, setAdultStatus] = useState({ enabled: false, domainCount: 0, fetchedAt: null });
  const [adultLoading, setAdultLoading] = useState(false);
  const [adultError, setAdultError] = useState('');

  const [siteStats, setSiteStats] = useState({});

  async function refresh() {
    const data = await window.api.blocklist.list();
    setItems(data);
  }

  async function refreshAdultStatus() {
    const s = await window.api.adult.status();
    setAdultStatus(s);
  }

  async function refreshSiteStats() {
    const domains = SUGGESTED_SITES.map(s => s.domain);
    const totals = await window.api.stats.domainsTotal(domains);
    setSiteStats(totals || {});
  }

  useEffect(() => {
    refresh();
    refreshAdultStatus();
    refreshSiteStats();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function validate(v) {
    if (!v) return 'Domain required.';
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(v)) return 'Use a domain like example.com.';
    return '';
  }

  async function onAdd(e) {
    e.preventDefault();
    const v = input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const err = validate(v);
    if (err) { setError(err); return; }
    if (items.find(i => i.domain === v)) { setError('Already in blocklist.'); return; }
    setError('');
    await window.api.blocklist.add(v);
    setInput('');
    setJustAdded(v);
    setTimeout(() => setJustAdded(null), 1200);
    refresh();
  }

  async function onRemove(domain) {
    await window.api.blocklist.remove(domain);
    refresh();
  }

  async function onQuickAdd(domain) {
    await window.api.blocklist.add(domain);
    setJustAdded(domain);
    setTimeout(() => setJustAdded(null), 1200);
    refresh();
  }

  async function toggleAdult() {
    if (adultLoading) return;
    setAdultLoading(true);
    setAdultError('');
    try {
      let result;
      if (adultStatus.enabled) {
        result = await window.api.adult.disable();
      } else {
        result = await window.api.adult.enable();
      }
      if (result && !result.ok && result.error) {
        setAdultError(result.error);
      }
      await refreshAdultStatus();
    } catch (e) {
      setAdultError(e.message || 'Failed');
    } finally {
      setAdultLoading(false);
    }
  }

  const userBlocked  = items.filter(i => i.reason !== 'limit');
  const limitBlocked = items.filter(i => i.reason === 'limit');
  const blockedSet   = new Set(items.map(i => i.domain));

  return (
    <div className="pb-8">
      <PageHeader
        title="Blocklist"
        subtitle="System-wide. Applies to every browser and tracked app."
        right={
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <Icon name="lock" className="w-3.5 h-3.5" />
            <span className="font-mono">{items.length} blocked</span>
          </div>
        }
      />

      <div className="px-7 pt-5 space-y-5">
        {/* Add form */}
        <form onSubmit={onAdd} className="relative">
          <div className={`flex items-center gap-2 bg-white/[0.03] border rounded-xl px-3 py-2 transition
            ${error ? 'border-red-500/40' : 'border-white/[0.06] focus-within:border-violet-400/40 focus-within:bg-white/[0.04]'}`}>
            <Icon name="search" className="w-3.5 h-3.5 text-zinc-500" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => { setInput(e.target.value); if (error) setError(''); }}
              placeholder="Block a domain — e.g. facebook.com"
              className="flex-1 bg-transparent outline-none text-[13px] text-zinc-100 placeholder:text-zinc-600 font-mono"
            />
            {!input && <Kbd>/</Kbd>}
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex items-center gap-1.5 bg-violet-500/90 hover:bg-violet-400 disabled:bg-white/[0.05] disabled:text-zinc-600 text-white text-[11.5px] font-medium px-2.5 py-1 rounded-md transition shadow-sm shadow-violet-900/40"
            >
              <Icon name="plus" className="w-3 h-3" />
              Block
              <Kbd>↵</Kbd>
            </button>
          </div>
          {error && <div className="absolute -bottom-5 left-3 text-[11px] text-red-400">{error}</div>}
        </form>

        {/* Adult Content Toggle */}
        <Card>
          <div className="px-4 py-3.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/[0.12] border border-red-500/20 flex items-center justify-center text-[15px] select-none">
                🔞
              </div>
              <div>
                <div className="text-[13px] font-semibold text-zinc-100">Block Adult Content (18+)</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">
                  {adultStatus.enabled
                    ? `${adultStatus.domainCount.toLocaleString()} domains blocked via StevenBlack`
                    : 'Blocks 40,000+ adult domains system-wide via StevenBlack'}
                </div>
                {adultError && (
                  <div className="text-[11px] text-red-400 mt-1">{adultError}</div>
                )}
              </div>
            </div>
            <button
              onClick={toggleAdult}
              disabled={adultLoading}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none
                ${adultStatus.enabled ? 'bg-red-500/80' : 'bg-white/[0.08]'}
                ${adultLoading ? 'opacity-50 cursor-wait' : 'cursor-pointer hover:opacity-90'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200
                ${adultStatus.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {adultStatus.enabled && adultStatus.fetchedAt && (
            <div className="px-4 pb-3 text-[10px] text-zinc-600 flex items-center gap-1.5">
              <Icon name="check" className="w-3 h-3 text-emerald-500/60" />
              List updated {new Date(adultStatus.fetchedAt).toLocaleDateString()}
            </div>
          )}
          {adultLoading && !adultStatus.enabled && (
            <div className="px-4 pb-3 text-[10px] text-zinc-500 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full border border-zinc-500 border-t-transparent animate-spin" />
              Downloading list from StevenBlack...
            </div>
          )}
        </Card>

        {/* Quick Add — Suggested Sites */}
        <Card>
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
            <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold">Quick Add</div>
            <div className="text-[10px] text-zinc-600">Based on your usage</div>
          </div>
          <ul className="pb-1.5">
            {SUGGESTED_SITES.map((site) => {
              const isBlocked = blockedSet.has(site.domain);
              const usage = fmtSeconds(siteStats[site.domain]);
              const isNew = justAdded === site.domain;
              return (
                <li
                  key={site.domain}
                  className={`flex items-center gap-3 px-4 py-2 transition
                    ${isNew ? 'bg-violet-500/[0.08]' : 'hover:bg-white/[0.025]'}`}
                >
                  <DomainBadge domain={site.domain} />
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span className={`text-[13px] truncate ${isBlocked ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>
                      {site.label}
                    </span>
                    <span className="text-[10px] text-zinc-600 bg-white/[0.04] border border-white/[0.05] rounded px-1.5 py-0.5 flex-shrink-0">
                      {site.category}
                    </span>
                    {usage && (
                      <span className="text-[10px] font-mono text-amber-400/70 flex-shrink-0">
                        {usage}
                      </span>
                    )}
                  </div>
                  {isBlocked ? (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-400/70 bg-emerald-500/[0.08] border border-emerald-500/20 rounded-md px-2 py-1 flex-shrink-0">
                      <Icon name="check" className="w-3 h-3" />
                      Blocked
                    </span>
                  ) : (
                    <button
                      onClick={() => onQuickAdd(site.domain)}
                      className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-violet-300 hover:bg-violet-500/[0.08] border border-transparent hover:border-violet-500/20 px-2 py-1 rounded-md transition flex-shrink-0"
                    >
                      <Icon name="plus" className="w-3 h-3" />
                      Add
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Blocked Domains List */}
        <Card>
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
            <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold">Blocked domains</div>
            {limitBlocked.length > 0 && (
              <div className="flex items-center gap-1.5 text-[10px] text-amber-300/90">
                <span className="w-1 h-1 rounded-full bg-amber-300/80"></span>
                {limitBlocked.length} via limit
              </div>
            )}
          </div>
          {items.length === 0 ? (
            <EmptyState icon="block" title="Nothing blocked yet" hint="Add a domain above to get started." />
          ) : (
            <ul className="pb-1.5">
              {[...userBlocked, ...limitBlocked].map((i) => {
                const isLimit = i.reason === 'limit';
                const isNew = justAdded === i.domain;
                return (
                  <li
                    key={i.domain}
                    className={`group relative flex items-center gap-3 px-4 py-2 transition
                      ${isNew ? 'bg-violet-500/[0.08]' : 'hover:bg-white/[0.025]'}`}
                  >
                    <DomainBadge domain={i.domain} />
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className="font-mono text-[13px] text-zinc-100 truncate">{i.domain}</span>
                      {isLimit && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300/90 bg-amber-400/[0.08] border border-amber-400/20 rounded-md px-1.5 py-0.5">
                          <Icon name="limit" className="w-2.5 h-2.5" />
                          limit hit
                        </span>
                      )}
                      {isNew && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-300 bg-emerald-400/[0.08] border border-emerald-400/20 rounded-md px-1.5 py-0.5">
                          <Icon name="check" className="w-2.5 h-2.5" />
                          added
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onRemove(i.domain)}
                      className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-zinc-500 hover:text-red-300 hover:bg-red-500/[0.08] px-2 py-1 rounded-md transition"
                    >
                      <Icon name="trash" className="w-3 h-3" />
                      Remove
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="text-[10.5px] text-zinc-600 px-1 flex items-center gap-1.5">
          <Icon name="lock" className="w-3 h-3" />
          Edits the system hosts file. Affects every app on this machine.
        </div>
      </div>
    </div>
  );
}
