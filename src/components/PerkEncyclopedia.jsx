import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Search, 
  X, 
  Crosshair, 
  ChevronRight, 
  ExternalLink,
  Filter
} from 'lucide-react';
import { getDamageInfo, getTierInfo } from '../utils/destiny-helpers';
import { getPerkSuggestionsClient, searchPerksClient } from '../utils/client-manifest';
import SearchField, { FilterChips, CHIP_TONES } from './SearchField';

export default function PerkEncyclopedia({ onSelectWeapon }) {
  const [perks, setPerks] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Trait');
  const [suggestions, setSuggestions] = useState({ perks: [], categories: [] });
  const [selectedPerkDetail, setSelectedPerkDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    fetchPerks();
  }, [search, category, page]);

  useEffect(() => {
    setSuggestions(search.trim() ? getPerkSuggestionsClient(search.trim()) : { perks: [], categories: [] });
  }, [search]);

  /** What the search bar can offer for whatever has been typed. */
  const searchGroups = [
    {
      key: 'perks',
      label: 'Perks & Traits',
      icon: Sparkles,
      tone: 'text-amber-400',
      layout: 'rows',
      items: (suggestions.perks || []).map(p => ({
        value: p.hash || p.name,
        label: p.name,
        detail: p.category || p.itemTypeDisplayName,
        icon: p.icon,
        onSelect: () => { setSearch(p.name); setPage(1); }
      }))
    },
    {
      key: 'categories',
      label: 'Categories',
      icon: Filter,
      tone: 'text-sky-400',
      items: (suggestions.categories || []).map(cat => ({
        value: cat,
        label: cat,
        onSelect: () => { setCategory(cat); setSearch(''); setPage(1); }
      }))
    }
  ];

  /** The one filter this screen has, shown the way every other screen shows one. */
  const activeFilters = category !== 'All'
    ? [{
      key: `cat:${category}`,
      label: 'Category',
      value: category,
      tone: CHIP_TONES.category,
      remove: () => { setCategory('All'); setPage(1); }
    }]
    : [];

  const fetchPerks = async () => {
    setLoading(true);
    try {
      const allMatching = searchPerksClient(search, category);
      const total = allMatching.length;
      const limit = 40;
      const totalPages = Math.ceil(total / limit) || 1;
      const paginated = allMatching.slice((page - 1) * limit, page * limit);

      setPerks(paginated);
      setTotalCount(total);
      setTotalPages(totalPages);
    } catch (err) {
      console.error('Error fetching perks:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPerkDetail = async (hash) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/perks/${hash}`);
      const data = await res.json();
      setSelectedPerkDetail(data);
    } catch (err) {
      console.error('Error fetching perk detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const categories = [
    'All', 
    'Trait', 
    'Origin Trait', 
    'Intrinsic', 
    'Barrel', 
    'Magazine', 
    'Mod'
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Search & Category Filter */}
      <div className="bg-[#121722] border border-[#20293a] rounded-xl p-5 shadow-xl space-y-4">
        
        {/* Search */}
        <SearchField
          value={search}
          onChange={(next) => { setSearch(next); setPage(1); }}
          placeholder="Search perks and traits..."
          groups={searchGroups}
          accent="sky"
        />

        <FilterChips filters={activeFilters} onClear={() => { setCategory('All'); setPage(1); }} />

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading whitespace-nowrap">
            Category:
          </span>
          <div className="flex items-center gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); setPage(1); }}
                className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                  category === cat
                    ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-bold'
                    : 'bg-[#0b0e14] text-slate-400 border-[#20293a] hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* Main Layout: Perk Grid + Selected Perk Side Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Perk Cards Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-white font-heading">
              {loading ? 'Searching Perk Database...' : `Found ${totalCount.toLocaleString()} Perks`}
            </h2>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="h-32 rounded-xl bg-[#121722] border border-[#20293a] animate-pulse" />
              ))}
            </div>
          ) : perks.length === 0 ? (
            <div className="p-12 text-center bg-[#121722] border border-[#20293a] rounded-xl">
              <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-lg font-bold text-slate-300 font-heading">No perks found</h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {perks.map((p) => {
                const isSelected = selectedPerkDetail?.hash === p.hash;
                return (
                  <div
                    key={p.hash}
                    onClick={() => loadPerkDetail(p.hash)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#182236] border-sky-400 ring-1 ring-sky-400/50 shadow-lg shadow-sky-500/10'
                        : 'bg-[#121722] hover:bg-[#161d2b] border-[#20293a] hover:border-slate-600'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-black/50 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {p.icon ? (
                            <img src={p.icon} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Sparkles className="w-5 h-5 text-sky-400" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300">
                              {p.category}
                            </span>
                            {p.isEnhanced && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300">
                                Enhanced
                              </span>
                            )}
                          </div>
                          <h3 className="text-sm font-bold text-white tracking-wide truncate mt-0.5 font-heading">
                            {p.name}
                          </h3>
                        </div>
                      </div>

                      <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                        {p.description || 'No description available.'}
                      </p>
                    </div>

                    <div className="pt-2 mt-2 border-t border-[#20293a]/60 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>{p.weaponCount} compatible weapon{p.weaponCount === 1 ? '' : 's'}</span>
                      <span className="text-sky-400 flex items-center gap-0.5">
                        View Weapons <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 rounded-lg bg-[#121722] border border-[#20293a] text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none font-mono"
              >
                Prev
              </button>
              <span className="text-xs text-slate-400 font-mono px-3">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 rounded-lg bg-[#121722] border border-[#20293a] text-sm text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none font-mono"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Selected Perk Detail Side Panel */}
        <div className="space-y-4">
          <div className="sticky top-24 bg-[#121722] border border-[#20293a] rounded-xl p-5 shadow-xl space-y-4 max-h-[85vh] flex flex-col">
            {selectedPerkDetail ? (
              <>
                {/* Header */}
                <div className="space-y-2 border-b border-[#20293a] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/20 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      {selectedPerkDetail.icon ? (
                        <img src={selectedPerkDetail.icon} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Sparkles className="w-6 h-6 text-sky-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-bold">
                          {selectedPerkDetail.category}
                        </span>
                        {selectedPerkDetail.isEnhanced && (
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">
                            Enhanced
                          </span>
                        )}
                      </div>
                      <h3 className="text-xl font-bold text-white font-heading mt-0.5">
                        {selectedPerkDetail.name}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed bg-[#0b0e14] p-3 rounded-lg border border-[#20293a]">
                    {selectedPerkDetail.description || 'No description available.'}
                  </p>

                  {/* Stat bonuses */}
                  {selectedPerkDetail.stats?.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      {selectedPerkDetail.stats.map((s, idx) => (
                        <span key={idx} className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          {s.value > 0 ? `+${s.value}` : s.value} {s.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Weapons Rolling this Perk */}
                <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-heading">
                    Compatible Weapons ({selectedPerkDetail.compatibleWeapons?.length || 0})
                  </h4>

                  {selectedPerkDetail.compatibleWeapons?.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No weapons recorded rolling this perk.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {selectedPerkDetail.compatibleWeapons.map((w) => {
                        const tierInfo = getTierInfo(w.tierTypeName);
                        const damageInfo = getDamageInfo(w.damageType);
                        return (
                          <div
                            key={w.id}
                            onClick={() => onSelectWeapon(w)}
                            className="flex items-center justify-between p-2 rounded-lg bg-[#0b0e14] hover:bg-[#161d2b] border border-[#20293a] hover:border-sky-500/50 cursor-pointer transition-colors text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-8 h-8 rounded bg-black border border-white/10 overflow-hidden flex-shrink-0">
                                {w.icon && <img src={w.icon} alt="" className="w-full h-full object-cover" />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-200 truncate">{w.name}</div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                  <span className={damageInfo.text}>{w.damageType}</span>
                                  <span>•</span>
                                  <span>{w.weaponType}</span>
                                </div>
                              </div>
                            </div>

                            <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <Sparkles className="w-8 h-8 mx-auto text-slate-600" />
                <p className="text-xs">Click any perk from the list on the left to view its description, stats, and all weapons rolling it.</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
