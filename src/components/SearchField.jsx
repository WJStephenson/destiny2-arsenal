import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

/**
 * The one search box the app uses.
 *
 * Every screen searches the same way: type, and what you typed is offered back
 * as things you can pick -- a name to jump to, or a property to filter on. The
 * screens differ only in what they can offer, so that is the one thing they
 * pass in.
 *
 * `groups` is a list of { key, label, icon, items }, where each item is
 * { value, label, detail, tone, onSelect }. A group with no items is skipped,
 * so a caller can hand over every group it knows about and let the query decide
 * which ones appear.
 */
export default function SearchField({
  value,
  onChange,
  onClear,
  placeholder = 'Search...',
  groups = [],
  accent = 'amber',
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const visibleGroups = groups.filter(group => group.items?.length > 0);
  const showDropdown = isOpen && value.trim().length > 0 && visibleGroups.length > 0;

  const focusRing = accent === 'sky'
    ? 'focus:border-sky-500/60 focus:ring-sky-500/40'
    : 'focus:border-amber-500/60 focus:ring-amber-500/40';

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />

      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
        className={`w-full pl-10 pr-10 py-2.5 bg-[#0b0e14] border border-[#20293a] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 ${focusRing}`}
      />

      {value && (
        <button
          onClick={() => { (onClear || onChange)(''); setIsOpen(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
          aria-label="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {showDropdown && (
        <div className="absolute left-0 right-0 top-full mt-1.5 max-h-80 overflow-y-auto overscroll-contain bg-[#161c2b] border border-[#28354d] rounded-xl shadow-2xl z-50 p-2 space-y-3">
          {visibleGroups.map((group, groupIndex) => {
            const Icon = group.icon;
            return (
              <div
                key={group.key}
                className={groupIndex > 0 ? 'space-y-1 pt-1 border-t border-[#28354d]' : 'space-y-1'}
              >
                <div className={`text-[10px] font-bold font-heading uppercase tracking-wider px-2 flex items-center gap-1 ${group.tone || 'text-slate-400'}`}>
                  {Icon && <Icon className="w-3 h-3" />} {group.label}
                </div>

                {/* A group of named things reads as rows; a group of
                    properties reads as chips, the same shape they take once
                    they are applied. */}
                {group.layout === 'rows' ? (
                  <div className="space-y-0.5">
                    {group.items.map(item => (
                      <div
                        key={item.value}
                        onClick={() => { item.onSelect(); setIsOpen(false); }}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 cursor-pointer text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.icon && (
                            <div className="w-7 h-7 rounded bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                              <img src={item.icon} alt="" className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-slate-200 font-medium truncate">{item.label}</div>
                            {item.detail && (
                              <div className="text-[10px] text-slate-500 font-mono truncate">{item.detail}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1 px-1">
                    {group.items.map(item => (
                      <button
                        key={item.value}
                        onClick={() => { item.onSelect(); setIsOpen(false); }}
                        className={`px-2 py-1 rounded bg-[#0b0e14] hover:bg-slate-800 border border-[#20293a] text-xs font-mono transition-colors ${item.tone || 'text-slate-300'}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * What the search is currently narrowed to, and the way back out of it.
 *
 * A filter picked from the dropdown would otherwise apply invisibly: the
 * results change and nothing on screen says why.
 */
export function FilterChips({ filters = [], onClear, label = 'Filters' }) {
  if (!filters.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#20293a]/60">
      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading">
        {label}:
      </span>

      {filters.map(({ key, label: kind, value, remove, tone }) => (
        <span
          key={key}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${tone || 'bg-slate-700/30 border-slate-600/50 text-slate-200'}`}
        >
          {kind && <span className="opacity-60 font-mono text-[10px] uppercase">{kind}</span>}
          <span>{value}</span>
          <button onClick={remove} className="hover:text-white ml-0.5" aria-label={`Remove ${value} filter`}>
            <X className="w-3.5 h-3.5" />
          </button>
        </span>
      ))}

      {onClear && (
        <button
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-slate-300 underline font-mono ml-1"
        >
          Clear
        </button>
      )}
    </div>
  );
}

/** The colours a filter chip comes in, so every screen tints them alike. */
export const CHIP_TONES = Object.freeze({
  type: 'bg-purple-500/15 border-purple-500/40 text-purple-200',
  frame: 'bg-amber-500/15 border-amber-500/40 text-amber-200',
  source: 'bg-sky-500/15 border-sky-500/40 text-sky-200',
  element: 'bg-orange-500/15 border-orange-500/40 text-orange-200',
  tier: 'bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200',
  slot: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200',
  guardian: 'bg-rose-500/15 border-rose-500/40 text-rose-200',
  set: 'bg-teal-500/15 border-teal-500/40 text-teal-200',
  category: 'bg-sky-500/15 border-sky-500/40 text-sky-200'
});
