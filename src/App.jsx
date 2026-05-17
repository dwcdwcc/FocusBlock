import React, { useState, useEffect } from 'react';
import Blocklist from './pages/Blocklist.jsx';
import Limits from './pages/Limits.jsx';
import Stats from './pages/Stats.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI primitives — also imported by Stats / Blocklist / Limits.
// Keeping them here means the four-file boundary the brief asked for.
// ─────────────────────────────────────────────────────────────────────────────

export function fmt(sec) {
  const total = Math.floor(sec);
  if (total <= 0) return '0m';
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return '<1m';
}

export function domainColor(d) {
  let h = 0;
  for (let i = 0; i < (d || '').length; i++) h = (h * 31 + d.charCodeAt(i)) >>> 0;
  return `oklch(0.62 0.13 ${h % 360})`;
}

export function DomainBadge({ domain, size = 'md' }) {
  const sz = size === 'sm' ? 'w-5 h-5 text-[9px]'
           : size === 'lg' ? 'w-8 h-8 text-[13px]'
           :                 'w-6 h-6 text-[10.5px]';
  const letter = (domain || '?')[0].toUpperCase();
  return (
    <div
      className={`${sz} rounded-md flex items-center justify-center font-semibold text-white/95 shrink-0 shadow-inner shadow-black/30 ring-1 ring-inset ring-white/10`}
      style={{ background: domainColor(domain) }}
    >{letter}</div>
  );
}

export function Icon({ name, className = 'w-4 h-4' }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'stats':   return (<svg viewBox="0 0 16 16" className={className} {...s}><path d="M2 13h12" /><path d="M4 13V8.5" /><path d="M8 13V4" /><path d="M12 13v-6.5" /></svg>);
    case 'block':   return (<svg viewBox="0 0 16 16" className={className} {...s}><circle cx="8" cy="8" r="5.5" /><path d="M4.2 4.2l7.6 7.6" /></svg>);
    case 'limit':   return (<svg viewBox="0 0 16 16" className={className} {...s}><circle cx="8" cy="8.5" r="5" /><path d="M8 5.5v3l1.9 1.2" /><path d="M6 2h4" /></svg>);
    case 'refresh': return (<svg viewBox="0 0 16 16" className={className} {...s}><path d="M13.2 7a5 5 0 1 0-1.3 4.5" /><path d="M13.5 3v4h-4" /></svg>);
    case 'plus':    return (<svg viewBox="0 0 16 16" className={className} {...s}><path d="M8 3v10M3 8h10" /></svg>);
    case 'search':  return (<svg viewBox="0 0 16 16" className={className} {...s}><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L13.5 13.5" /></svg>);
    case 'trash':   return (<svg viewBox="0 0 16 16" className={className} {...s}><path d="M3 4.5h10" /><path d="M6 4.5V3h4v1.5" /><path d="M4.5 4.5l.7 8.2a1 1 0 0 0 1 .8h3.6a1 1 0 0 0 1-.8l.7-8.2" /></svg>);
    case 'check':   return (<svg viewBox="0 0 16 16" className={className} {...s}><path d="M3.5 8.5l3 3 6-6.5" /></svg>);
    case 'lock':    return (<svg viewBox="0 0 16 16" className={className} {...s}><rect x="3.5" y="7" width="9" height="6" rx="1.2" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></svg>);
    default: return null;
  }
}

export function Kbd({ children }) {
  return (
    <span className="font-mono text-[10px] text-zinc-500 bg-white/[0.04] border border-white/[0.07] rounded px-1 py-px leading-none">
      {children}
    </span>
  );
}

export function Card({ children, className = '' }) {
  return <div className={`bg-white/[0.02] border border-white/[0.05] rounded-xl ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, right }) {
  return (
    <div className="px-7 pt-6 pb-4 flex items-end justify-between gap-4 border-b border-white/[0.04]">
      <div>
        <h1 className="text-[18px] font-semibold tracking-tight leading-none">{title}</h1>
        {subtitle && <p className="text-[12px] text-zinc-500 mt-1.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Segmented({ value, onChange, options }) {
  return (
    <div className="flex items-center gap-0.5 bg-white/[0.03] border border-white/[0.06] rounded-lg p-0.5">
      {options.map(o => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-2.5 py-1 text-[11.5px] font-medium rounded-md transition
              ${active ? 'bg-white/[0.08] text-zinc-100 shadow-sm shadow-black/40' : 'text-zinc-400 hover:text-zinc-200'}`}
          >{o.label}</button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon, title, hint }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.05] flex items-center justify-center text-zinc-500 mb-3">
        <Icon name={icon} className="w-4 h-4" />
      </div>
      <div className="text-[13px] text-zinc-300 font-medium">{title}</div>
      {hint && <div className="text-[11.5px] text-zinc-500 mt-1">{hint}</div>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// App shell
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'stats',     label: 'Insights',    icon: 'stats',  hint: '1' },
  { id: 'blocklist', label: 'Blocklist',   icon: 'block',  hint: '2' },
  { id: 'limits',    label: 'Time Limits', icon: 'limit',  hint: '3' }
];

export default function App() {
  const [tab, setTab] = useState('stats');

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === '1') setTab('stats');
      if (e.key === '2') setTab('blocklist');
      if (e.key === '3') setTab('limits');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="h-screen flex bg-[#0a0a0c] text-zinc-100 text-[13px] antialiased font-[Inter,system-ui,sans-serif]">
      {/* Sidebar */}
      <aside className="w-[200px] shrink-0 bg-[#06060a] border-r border-white/[0.04] flex flex-col">
        <div className="px-4 pt-5 pb-6 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-400 to-violet-600 flex items-center justify-center relative shadow-lg shadow-violet-900/40 ring-1 ring-violet-300/20">
            <div className="absolute inset-1 rounded-md bg-[#06060a] flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-violet-300 shadow-[0_0_6px_rgba(196,181,253,0.8)]"></div>
            </div>
          </div>
          <div>
            <div className="text-[13px] font-semibold tracking-tight leading-none">FocusBlock</div>
            <div className="text-[10px] text-zinc-500 mt-0.5 leading-none">Stay on track.</div>
          </div>
        </div>

        <nav className="px-2 flex flex-col gap-0.5">
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`group relative flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left transition
                  ${active
                    ? 'bg-white/[0.05] text-zinc-100'
                    : 'text-zinc-400 hover:bg-white/[0.025] hover:text-zinc-200'}`}
              >
                {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(167,139,250,0.7)]"></span>}
                <Icon name={t.icon} className={`w-[15px] h-[15px] ${active ? 'text-violet-300' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
                <span className="text-[12.5px] font-medium flex-1">{t.label}</span>
                <Kbd>{t.hint}</Kbd>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto px-4 pb-4">
          <div className="px-2.5 py-2 rounded-md bg-white/[0.02] border border-white/[0.04]">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-emerald-400/50 animate-ping"></span>
                <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              </span>
              <span className="text-[10.5px] text-zinc-400 font-medium">Tracking active</span>
            </div>
            <div className="text-[9.5px] text-zinc-600 font-mono">v0.1.0 · local-only</div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {tab === 'stats'     && <Stats />}
        {tab === 'blocklist' && <Blocklist />}
        {tab === 'limits'    && <Limits />}
      </main>
    </div>
  );
}
