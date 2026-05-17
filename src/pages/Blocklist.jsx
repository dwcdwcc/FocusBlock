import React, { useState, useEffect, useRef } from 'react';
import {
  DomainBadge, Icon, Kbd, Card, PageHeader, EmptyState
} from '../App.jsx';

export default function Blocklist() {
  const [items, setItems] = useState([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [justAdded, setJustAdded] = useState(null);
  const inputRef = useRef(null);

  async function refresh() {
    const data = await window.api.blocklist.list();
    setItems(data);
  }

  useEffect(() => { refresh(); }, []);

  // Focus shortcut: press "/" anywhere to focus the input.
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

  const userBlocked  = items.filter(i => i.reason !== 'limit');
  const limitBlocked = items.filter(i => i.reason === 'limit');

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

        {/* List */}
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
