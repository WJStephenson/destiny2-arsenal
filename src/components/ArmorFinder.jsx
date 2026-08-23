import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Search, 
  Sparkles, 
  X, 
  SlidersHorizontal, 
  ChevronRight,
  Filter,
  Layers,
  Crown
} from 'lucide-react';
import { getTierInfo } from '../utils/destiny-helpers';

export default function ArmorFinder({ onSelectArmor }) {
  const [armorList, setArmorList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedTiers, setSelectedTiers] = useState(['Exotic']); // Default to Exotic for quick discovery
  const [hasExoticPerk, setHasExoticPerk] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchArmor();
    }, 150);
    return () => clearTimeout(timer);
  }, [search, selectedClasses, selectedSlots, selectedTiers, hasExoticPerk, page]);

  const fetchArmor = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedClasses.length > 0) params.append('classType', selectedClasses.join(','));
      if (selectedSlots.length > 0) params.append('armorSlot', selectedSlots.join(','));
      if (selectedTiers.length > 0) params.append('tier', selectedTiers.join(','));
      if (hasExoticPerk) params.append('hasExoticPerk', 'true');
      params.append('page', page);
      params.append('limit', '48');

      const res = await fetch(`/api/armor?${params.toString()}`);
      const data = await res.json();

      setArmorList(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Error fetching armor:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleArrayFilter = (setter, currentList, value) => {
    setPage(1);
    if (currentList.includes(value)) {
      setter(currentList.filter(item => item !== value));
    } else {
      setter([...currentList, value]);
    }
  };

  const getClassBadge = (cls) => {
    switch (cls) {
      case 'Titan': return 'bg-red-500/20 text-red-300 border-red-500/40';
      case 'Hunter': return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      case 'Warlock': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Search & Filter Bar */}
      <div className="bg-[#121722] border border-[#20293a] rounded-xl p-5 shadow-xl space-y-4">
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search armor or exotic perks (e.g. Celestial Nighthawk, Biotic Enhancements)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0b0e14] border border-[#20293a] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/40"
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-[#20293a]/60">
          
          {/* Class Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading">
              Class:
            </span>
            <div className="flex items-center gap-1.5">
              {['Hunter', 'Titan', 'Warlock'].map((cls) => (
                <button
                  key={cls}
                  onClick={() => toggleArrayFilter(setSelectedClasses, selectedClasses, cls)}
                  className={`px-3 py-1 rounded-md text-xs font-medium border transition-all ${
                    selectedClasses.includes(cls)
                      ? `${getClassBadge(cls)} font-bold`
                      : 'bg-[#0b0e14] text-slate-400 border-[#20293a] hover:text-slate-200'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

          {/* Slot Filter */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading">
              Slot:
            </span>
            <div className="flex items-center gap-1.5">
              {['Helmet', 'Gauntlets', 'Chest Armor', 'Leg Armor', 'Class Item'].map((slot) => (
                <button
                  key={slot}
                  onClick={() => toggleArrayFilter(setSelectedSlots, selectedSlots, slot)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                    selectedSlots.includes(slot)
                      ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                      : 'bg-[#0b0e14] text-slate-400 border-[#20293a] hover:text-slate-200'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>

          {/* Rarity */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading">
              Rarity:
            </span>
            <div className="flex items-center gap-1.5">
              {['Exotic', 'Legendary'].map((t) => (
                <button
                  key={t}
                  onClick={() => toggleArrayFilter(setSelectedTiers, selectedTiers, t)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                    selectedTiers.includes(t)
                      ? t === 'Exotic' ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' : 'bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold'
                      : 'bg-[#0b0e14] text-slate-400 border-[#20293a] hover:text-slate-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-white font-heading">
          {loading ? 'Searching Armor...' : `Found ${totalCount} Armor Pieces`}
        </h2>
      </div>

      {/* Armor Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-60 rounded-xl bg-[#121722] border border-[#20293a] animate-pulse" />
          ))}
        </div>
      ) : armorList.length === 0 ? (
        <div className="p-12 text-center bg-[#121722] border border-[#20293a] rounded-xl">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-300 font-heading">No armor pieces matched your filters</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {armorList.map((a) => {
            const tierInfo = getTierInfo(a.tierTypeName);
            return (
              <div
                key={a.id}
                onClick={() => onSelectArmor(a)}
                className="group relative flex flex-col justify-between bg-[#121722] hover:bg-[#161d2b] border border-[#20293a] hover:border-purple-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
              >
                {/* Header */}
                <div className={`p-3.5 ${tierInfo.headerBg} border-b border-[#20293a]/60`}>
                  <div className="flex items-start gap-3">
                    <div className="relative w-14 h-14 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex-shrink-0">
                      {a.icon ? (
                        <img src={a.icon} alt={a.name} className="w-full h-full object-cover" />
                      ) : (
                        <Shield className="w-6 h-6 text-slate-600 m-auto" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${tierInfo.bg} ${tierInfo.text}`}>
                          {a.tierTypeName}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${getClassBadge(a.classType)}`}>
                          {a.classType}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {a.armorSlot}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white tracking-wide truncate group-hover:text-purple-300 transition-colors mt-0.5 font-heading">
                        {a.name}
                      </h3>
                    </div>
                  </div>
                </div>

                {/* Exotic Perk / Description Body */}
                <div className="p-3.5 space-y-2.5 flex-1">
                  {a.exoticPerk ? (
                    <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300 font-heading">
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        <span>{a.exoticPerk.name}</span>
                      </div>
                      <p className="text-slate-300 text-[11px] leading-relaxed line-clamp-3">
                        {a.exoticPerk.description}
                      </p>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 italic">
                      Legendary armor piece. Compatible with all class armor mods.
                    </div>
                  )}

                  {/* Base Stats Distribution */}
                  {a.stats && (
                    <div className="grid grid-cols-3 gap-1 pt-2 border-t border-[#20293a]/60 text-[10px] font-mono">
                      {['Mobility', 'Resilience', 'Recovery', 'Discipline', 'Intellect', 'Strength'].map((stat) => (
                        <div key={stat} className="bg-[#0b0e14]/50 px-1.5 py-0.5 rounded flex justify-between">
                          <span className="text-slate-500">{stat.slice(0, 3)}:</span>
                          <span className="text-slate-200 font-bold">{a.stats[stat] || 0}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-3 py-2 bg-[#0d111a] border-t border-[#20293a] flex items-center justify-between text-xs text-slate-400">
                  <span className="group-hover:text-purple-300 font-medium flex items-center gap-1">
                    Inspect Armor <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                  {a.stats?.Total > 0 && (
                    <span className="font-mono text-purple-300 font-bold">
                      Total: {a.stats.Total}
                    </span>
                  )}
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
  );
}
