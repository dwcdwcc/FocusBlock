import React, { useState, useEffect } from 'react';
import {
  DomainBadge, Icon, Kbd, Card, PageHeader, EmptyState
} from '../App.jsx';

export default function Limits() {
  const [items, setItems] = useState([]);
  const [domain, setDomain] = useState('');
  const [minutes, setMinutes] = useState(30);
  const [error, setError] = useState('');

  async function refresh() {
    const data = await window.api.limits.list();
    setItems(data);
  }

  useEffect(() => { refresh(); }, []);

  async function onAdd(e) {
    e.preventDefault();
    const d = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const m = parseInt(minutes, 10);
    if (!d) { setError('Domain required.'); return; }
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(d)) { setError('Use a domain like example.com.'); return; }
    if (!m || m <= 0) { setError('Minutes must be > 0.'); return; }
    setError('');
    await window.api.limits.set(d, m);
    setDomain('');
    setMinutes(30);
    refresh();
  }

  async function onRemove(d) {
    await window.api.limits.remove(d);
    refresh();
  }

  const presets = [15, 30, 60, 120];

  return (
    <div className="pb-8">
      <PageHeader
        title="Time Limits"
        subtitle="Daily caps per domain. Auto-blocks until midnight when exceeded."
        right={
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <Icon name="limit" className="w-3.5 h-3.5" />
            <span className="font-mono">{items.length} active</span>
          </div>
        }
      />

      <div className="px-7 pt-5 space-y-5">
        {/* Add form */}
        <form onSubmit={onAdd}>
          <div className={`bg-white/[0.03] border rounded-xl p-2 transition
            ${error ? 'border-red-500/40' : 'border-white/[0.06] focus-within:border-violet-400/40 focus-within:bg-white/[0.04]'}`}>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 flex-1 px-2">
                <Icon name="search" className="w-3.5 h-3.5 text-zinc-500" />
                <input
                  value={domain}
                  onChange={(e) => { setDomain(e.target.value); if (error) setError(''); }}
                  placeholder="Domain — e.g. youtube.com"
                  className="flex-1 bg-transparent outline-none text-[13px] text-zinc-100 placeholder:text-zinc-600 font-mono py-1"
                />
              </div>
              <div className="w-px h-5 bg-white/[0.06]"></div>
              <div className="flex items-center gap-1 pr-1">
                <input
                  type="number"
                  min="1"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="w-14 bg-transparent outline-none text-[13px] text-zinc-100 font-mono text-right tabular-nums"
                />
                <span className="text-[11px] text-zinc-500 select-none">min / day</span>
              </div>
              <button
                type="submit"
                className="flex items-center gap-1.5 bg-violet-500/90 hover:bg-violet-400 text-white text-[11.5px] font-medium px-2.5 py-1.5 rounded-md transition shadow-sm shadow-violet-900/40"
              >
                <Icon name="plus" className="w-3 h-3" />
                Set
                <Kbd>↵</Kbd>
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-1.5 px-2">
              <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold">Quick</span>
              {presets.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setMinutes(p)}
                  className={`font-mono text-[10.5px] px-1.5 py-0.5 rounded transition
                    ${parseInt(minutes, 10) === p
                      ? 'bg-violet-400/15 text-violet-200 border border-violet-400/20'
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-white/[0.03]'}`}
                >{p}m</button>
              ))}
            </div>
          </div>
          {error && <div className="text-[11px] text-red-400 mt-1.5 px-1">{error}</div>}
        </form>

        {/* List */}
        <Card>
          <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5">
            <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold">Daily limits</div>
            <div className="font-mono text-[10px] text-zinc-500">resets 00:00</div>
          </div>
          {items.length === 0 ? (
            <EmptyState icon="limit" title="No limits set" hint="Add one above to gently block when you've had enough." />
          ) : (
            <ul className="pb-1.5">
              {items.map((i) => {
                // `used` is optional — if the backend hasn't reported it, default to 0.
                const used = typeof i.used === 'number' ? i.used : 0;
                const pct = Math.min(100, (used / i.minutes) * 100);
                const remaining = Math.max(0, i.minutes - used);
                const state = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
                const barClr = state === 'over' ? 'from-red-400 to-red-500'
                            : state === 'warn' ? 'from-amber-400 to-amber-500'
                            :                    'from-violet-400 to-violet-500';
                const lblClr = state === 'over' ? 'text-red-300'
                            : state === 'warn' ? 'text-amber-300'
                            :                    'text-zinc-300';
                return (
                  <li key={i.domain} className="group relative px-4 py-2.5 hover:bg-white/[0.025] transition">
                    <div className="flex items-center gap-3">
                      <DomainBadge domain={i.domain} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-[13px] text-zinc-100 truncate">{i.domain}</span>
                            {state === 'over' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-300 bg-red-400/[0.08] border border-red-400/20 rounded-md px-1.5 py-0.5">
                                <Icon name="lock" className="w-2.5 h-2.5" />
                                blocked
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`font-mono text-[11px] tabular-nums ${lblClr}`}>{used}m</span>
                            <span className="text-zinc-700 font-mono text-[11px]">/</span>
                            <span className="font-mono text-[11px] text-zinc-500 tabular-nums">{i.minutes}m</span>
                          </div>
                        </div>
                        <div className="relative h-1.5 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className={`absolute inset-y-0 left-0 rounded-full bg-gradient-to-r transition-all ${barClr}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-zinc-600">
                            {state === 'over' ? 'Auto-blocked until midnight' : `${remaining}m remaining today`}
                          </span>
                          <button
                            onClick={() => onRemove(i.domain)}
                            className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-zinc-500 hover:text-red-300 transition"
                          >
                            <Icon name="trash" className="w-2.5 h-2.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
