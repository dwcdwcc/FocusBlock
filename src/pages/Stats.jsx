import React, { useState, useEffect, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, AreaChart, Area
} from 'recharts';
import {
  fmt, domainColor, DomainBadge, Icon, Card, PageHeader, Segmented, EmptyState
} from '../App.jsx';

const APP_TO_DOMAIN = {
  claude: 'claude.ai', discord: 'discord.com', slack: 'slack.com',
  spotify: 'spotify.com', notion: 'notion.so', figma: 'figma.com',
  whatsapp: 'whatsapp.com', telegram: 'telegram.org', zoom: 'zoom.us',
  cursor: 'cursor.com', code: 'github.com', chatgpt: 'chatgpt.com'
};
const normalizeApp = (n) => String(n || '').toLowerCase().replace(/\.exe$/, '').trim();

function mergeUsage(sites, apps) {
  const map = new Map();
  for (const s of sites) map.set(s.domain, { domain: s.domain, seconds: s.seconds });
  for (const a of apps) {
    const d = APP_TO_DOMAIN[normalizeApp(a.app)];
    if (!d) continue;
    if (map.has(d)) map.get(d).seconds += a.seconds;
    else map.set(d, { domain: d, seconds: a.seconds });
  }
  return [...map.values()].sort((x, y) => y.seconds - x.seconds);
}

const RANGES = [
  { id: 'day',   label: 'Day',   days: 1 },
  { id: 'week',  label: 'Week',  days: 7 },
  { id: 'month', label: 'Month', days: 30 }
];

function StatBlock({ label, value, sub, accent }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold">{label}</div>
      <div className={`mt-1.5 font-mono text-[20px] font-semibold tracking-tight leading-none ${accent || 'text-zinc-100'}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-500 mt-1.5">{sub}</div>}
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#141418]/95 backdrop-blur border border-white/10 rounded-lg px-2.5 py-1.5 shadow-xl shadow-black/50">
      <div className="text-[10px] text-zinc-500 font-mono">{label}</div>
      <div className="font-mono text-[12px] text-zinc-100 font-semibold">
        {payload[0].value} <span className="text-zinc-500 font-normal">min</span>
      </div>
    </div>
  );
}

const SOCIAL_DISTRACTION = new Set([
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'tiktok.com', 'reddit.com', 'snapchat.com', 'pinterest.com',
  'twitch.tv', '9gag.com', 'threads.net', 'tumblr.com'
]);

export default function Stats() {
  const [rangeId, setRangeId] = useState('day');
  const [range, setRange] = useState([]);
  const [top, setTop] = useState([]);
  const [appTop, setAppTop] = useState([]);
  const [blocklist, setBlocklist] = useState([]);
  const [spin, setSpin] = useState(false);
  const days = RANGES.find(r => r.id === rangeId).days;

  async function refresh() {
    setSpin(true);
    const [r, tp, atp, bl] = await Promise.all([
      window.api.stats.range(days),
      window.api.stats.top(days),
      window.api.stats.appTop(days),
      window.api.blocklist.list()
    ]);
    setRange(r); setTop(tp); setAppTop(atp); setBlocklist(bl);
    setTimeout(() => setSpin(false), 500);
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [days]);

  const merged = useMemo(() => mergeUsage(top, appTop), [top, appTop]);
  const total  = useMemo(() => merged.reduce((s, x) => s + x.seconds, 0), [merged]);
  const maxSec = merged[0]?.seconds || 1;

  const appList = useMemo(
    () => [...appTop].sort((x, y) => y.seconds - x.seconds),
    [appTop]
  );
  const totalApp  = useMemo(() => appList.reduce((s, x) => s + x.seconds, 0), [appList]);
  const maxAppSec = appList[0]?.seconds || 1;

  const { focusScore, distractionPct } = useMemo(() => {
    if (!total) return { focusScore: 100, distractionPct: 0 };
    const blockSet = new Set(blocklist.map(b => b.domain));
    let disSec = 0;
    for (const x of merged) {
      if (blockSet.has(x.domain) || SOCIAL_DISTRACTION.has(x.domain)) disSec += x.seconds;
    }
    const focSec = total - disSec;
    const weighted = disSec * 3 + focSec * 0.5;
    return {
      focusScore: Math.max(0, Math.min(100, Math.round(100 - weighted / 300))),
      distractionPct: Math.round((disSec / total) * 100)
    };
  }, [merged, total, blocklist]);
  const rangeData = useMemo(
    () => range.map(r => ({ date: r.date.slice(5), minutes: Math.round(r.seconds / 60) })),
    [range]
  );
  const avgMin  = rangeData.length ? Math.round(rangeData.reduce((s,x)=>s+x.minutes,0) / rangeData.length) : 0;
  const peakMin = rangeData.length ? Math.max(...rangeData.map(x => x.minutes)) : 0;
  const peakDay = rangeData.find(d => d.minutes === peakMin)?.date || '—';

  const rangeLabel = RANGES.find(r => r.id === rangeId).label.toLowerCase();
  const totalLabel = rangeId === 'day' ? 'Total today' : `Total · ${rangeLabel}`;

  return (
    <div className="pb-8">
      <PageHeader
        title="Insights"
        subtitle="Where your attention went."
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={refresh}
              className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.05] transition"
              title="Refresh"
            >
              <Icon name="refresh" className={`w-3.5 h-3.5 ${spin ? 'animate-spin' : ''}`} />
            </button>
            <Segmented value={rangeId} onChange={setRangeId} options={RANGES} />
          </div>
        }
      />

      <div className="px-7 pt-5 space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <StatBlock
            label={totalLabel}
            value={fmt(total)}
            sub={`Across ${merged.length} ${merged.length === 1 ? 'source' : 'sources'}`}
            accent="text-zinc-50"
          />
          {rangeId !== 'day' ? (
            <>
              <StatBlock label="Daily average" value={`${avgMin}m`} sub={`Over ${days} days`} />
              <StatBlock label="Peak day" value={`${peakMin}m`} sub={peakDay} />
            </>
          ) : (
            <>
              <StatBlock
                label="Top site"
                value={merged[0] ? merged[0].domain : '—'}
                sub={merged[0] ? fmt(merged[0].seconds) : 'No activity'}
                accent="font-mono text-[14px] text-zinc-100 font-semibold"
              />
              <StatBlock
                label="Focus score"
                value={`${focusScore}`}
                sub={distractionPct > 0 ? `${distractionPct}% distraction time` : 'No distractions tracked'}
                accent={focusScore >= 70 ? 'text-emerald-300' : focusScore >= 40 ? 'text-amber-300' : 'text-red-300'}
              />
            </>
          )}
        </div>

        {/* Trend chart */}
        {rangeId !== 'day' && (
          <Card>
            <div className="flex items-center justify-between px-4 pt-3.5 pb-1">
              <div>
                <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold">Daily trend</div>
                <div className="text-[11px] text-zinc-500 mt-0.5">Site time, minutes per day · last {days} days</div>
              </div>
              <div className="font-mono text-[10px] text-zinc-500">Avg <span className="text-zinc-300">{avgMin}m</span></div>
            </div>
            <div style={{ height: 150 }} className="px-2 pb-2">
              <ResponsiveContainer>
                <AreaChart data={rangeData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradTrend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis
                    dataKey="date" stroke="#52525b"
                    tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                    axisLine={false} tickLine={false}
                    interval={Math.max(0, Math.floor(rangeData.length / 8) - 1)}
                  />
                  <YAxis
                    stroke="#52525b"
                    tick={{ fontSize: 10, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}
                    axisLine={false} tickLine={false} width={32}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(167,139,250,0.3)', strokeWidth: 1 }} />
                  <Area
                    type="monotone" dataKey="minutes"
                    stroke="#a78bfa" strokeWidth={1.5} fill="url(#gradTrend)"
                    dot={false}
                    activeDot={{ r: 3, fill: '#c4b5fd', stroke: '#0a0a0c', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Top sources — custom bar list */}
        <Card>
          <div className="flex items-center justify-between px-4 pt-3.5 pb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold">Top sources</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Sites + tracked apps, this {rangeLabel}</div>
            </div>
            <div className="font-mono text-[10px] text-zinc-500">{merged.length} items</div>
          </div>
          <div className="px-2 pb-2">
            {merged.length === 0 && <EmptyState icon="stats" title="No activity yet" hint="Data will appear as you browse." />}
            <ul className="flex flex-col">
              {merged.map((t, idx) => {
                const pct = (t.seconds / maxSec) * 100;
                const share = total ? Math.round((t.seconds / total) * 100) : 0;
                return (
                  <li key={t.domain} className="group relative px-2 py-1.5 rounded-md hover:bg-white/[0.025] transition">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-[10px] text-zinc-600 w-4 text-right">{String(idx + 1).padStart(2, '0')}</div>
                      <DomainBadge domain={t.domain} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[12px] text-zinc-200 truncate">{t.domain}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[10px] text-zinc-500">{share}%</span>
                            <span className="font-mono text-[11.5px] text-zinc-300 tabular-nums w-12 text-right">{fmt(t.seconds)}</span>
                          </div>
                        </div>
                        <div className="relative h-1 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${domainColor(t.domain)} 0%, ${domainColor(t.domain)}99 100%)`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>

        {/* Top apps — raw desktop app usage */}
        <Card>
          <div className="flex items-center justify-between px-4 pt-3.5 pb-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-zinc-500 font-semibold">Top apps</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">Desktop apps by process, this {rangeLabel}</div>
            </div>
            <div className="font-mono text-[10px] text-zinc-500">{appList.length} items</div>
          </div>
          <div className="px-2 pb-2">
            {appList.length === 0 && <EmptyState icon="stats" title="No app activity yet" hint="Open a non-browser app to start tracking." />}
            <ul className="flex flex-col">
              {appList.map((t, idx) => {
                const pct = (t.seconds / maxAppSec) * 100;
                const share = totalApp ? Math.round((t.seconds / totalApp) * 100) : 0;
                return (
                  <li key={t.app} className="group relative px-2 py-1.5 rounded-md hover:bg-white/[0.025] transition">
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-[10px] text-zinc-600 w-4 text-right">{String(idx + 1).padStart(2, '0')}</div>
                      <DomainBadge domain={t.app} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[12px] text-zinc-200 truncate">{t.app}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono text-[10px] text-zinc-500">{share}%</span>
                            <span className="font-mono text-[11.5px] text-zinc-300 tabular-nums w-12 text-right">{fmt(t.seconds)}</span>
                          </div>
                        </div>
                        <div className="relative h-1 rounded-full bg-white/[0.04] overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${domainColor(t.app)} 0%, ${domainColor(t.app)}99 100%)`
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );
}
