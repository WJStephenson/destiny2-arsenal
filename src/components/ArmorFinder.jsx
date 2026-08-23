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
  Crown,
  Award,
  Swords,
  Flame
} from 'lucide-react';
import { getTierInfo } from '../utils/destiny-helpers';
import { searchArmorClient } from '../utils/client-manifest';
import LongPressable from './LongPressable';

export default function ArmorFinder({ onSelectArmor, onOpenInfo }) {
  const [armorList, setArmorList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedTiers, setSelectedTiers] = useState([]); // All or Exotic/Legendary
  const [selectedSetCategory, setSelectedSetCategory] = useState('All');
  const [artificeOnly, setArtificeOnly] = useState(false);

  const setCategories = [
    'All',
    'Moments of Triumph & Events',
    'Raids & Dungeons',
    'Ritual & Pinnacle',
    'Episodes & Seasons',
    'Exotics'
  ];

  useEffect(() => {
    fetchArmor();
  }, [search, selectedClasses, selectedSlots, selectedTiers, selectedSetCategory, artificeOnly, page]);

  const fetchArmor = async () => {
    setLoading(true);
    try {
      const data = await searchArmorClient({
        search,
        classType: selectedClasses.length === 1 ? selectedClasses[0] : 'All',
        slot: selectedSlots.length === 1 ? selectedSlots[0] : 'All',
        tier: selectedTiers.length === 1 ? selectedTiers[0] : 'All',
        setCategory: selectedSetCategory,
        artificeOnly,
        page,
        limit: 48
      });

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
      <div className="bg-[#121722] border border-[#20293a] rounded-2xl p-5 shadow-xl space-y-4">
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search armor, sets, or exotic perks (e.g. Moments of Triumph, Exegesis, High-Altitude, Celestial Nighthawk)..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0b0e14] border border-[#20293a] rounded-xl text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 font-sans"
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

        {/* Set Categories Row */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading mr-1 flex-shrink-0">
            Set Category:
          </span>
          {setCategories.map(cat => (
            <button
              key={cat}
              onClick={() => { setSelectedSetCategory(cat); setPage(1); }}
              className={`px-3 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition-all border ${
                selectedSetCategory === cat
                  ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-sm'
                  : 'bg-[#0b0e14] text-slate-400 border-[#20293a] hover:text-slate-200'
              }`}
            >
              {cat === 'Moments of Triumph & Events' ? '🌟 Moments of Triumph / Events' :
               cat === 'Raids & Dungeons' ? '🏆 Raids & Dungeons' :
               cat === 'Ritual & Pinnacle' ? '⚔️ Ritual / Pinnacle' :
               cat === 'Episodes & Seasons' ? '🌌 Episodes & Seasons' :
               cat === 'Exotics' ? '🟡 Exotics' : 'All Sets'}
            </button>
          ))}

          <button
            onClick={() => { setArtificeOnly(!artificeOnly); setPage(1); }}
            className={`px-3 py-1 rounded-lg text-xs font-mono whitespace-nowrap transition-all border ml-auto ${
              artificeOnly
                ? 'bg-indigo-500 text-white font-bold border-indigo-400 shadow-sm'
                : 'bg-[#0b0e14] text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/10'
            }`}
          >
            💠 Artifice Only
          </button>
        </div>

        {/* Filter Pills (Class, Slot, Rarity) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-[#20293a]/60">
          
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
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all ${
                    selectedClasses.includes(cls)
                      ? `${getClassBadge(cls)} font-bold shadow-sm`
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
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
          {loading ? 'Searching Armour & Sets...' : `Found ${totalCount} Armour Pieces`}
        </h2>
        {selectedSetCategory !== 'All' && (
          <span className="text-xs font-mono text-amber-400">
            Filtered by {selectedSetCategory}
          </span>
        )}
      </div>

      {/* Armor Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-60 rounded-2xl bg-[#121722] border border-[#20293a] animate-pulse" />
          ))}
        </div>
      ) : armorList.length === 0 ? (
        <div className="p-12 text-center bg-[#121722] border border-[#20293a] rounded-2xl">
          <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-300 font-heading">No armour pieces matched your filters</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {armorList.map((a) => {
            const tierInfo = getTierInfo(a.tierTypeName);
            return (
              <div
                key={a.id}
                onClick={() => onSelectArmor(a)}
                className="group relative flex flex-col justify-between bg-[#121722] hover:bg-[#161d2b] border border-[#20293a] hover:border-amber-400 rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 shadow-lg hover:shadow-amber-500/10"
              >
                {/* Header */}
                <div className={`p-3.5 ${tierInfo.headerBg} border-b border-[#20293a]/60`}>
                  <div className="flex items-start gap-3">
                    <div className="relative w-14 h-14 rounded-xl bg-black/40 border border-white/10 overflow-hidden flex-shrink-0">
                      {a.icon ? (
                        <img src={a.icon} alt={a.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <Shield className="w-6 h-6 text-slate-600 m-auto" />
                      )}
                      {a.isArtifice && (
                        <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-indigo-500 rounded-bl text-[8px] flex items-center justify-center font-bold text-white" title="Artifice Armor">
                          A
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${tierInfo.bg} ${tierInfo.text}`}>
                          {a.tierTypeName}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${getClassBadge(a.classType)}`}>
                          {a.classType}
                        </span>
                        {a.isArtifice && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold">
                            Artifice
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-white text-sm tracking-wide truncate mt-1 group-hover:text-amber-300 transition-colors font-heading">
                        {a.name}
                      </h3>
                      <p className="text-xs text-slate-400 truncate">
                        {a.armorSlot || a.itemTypeDisplayName}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  
                  {/* Armor Set Badge & Intrinsic */}
                  {a.setName && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block truncate">
                        ✧ {a.setName}
                      </span>
                      {a.setIntrinsicPerk && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 bg-[#0b0e14] p-1.5 rounded-lg border border-slate-800 font-mono">
                          {a.setIntrinsicPerk}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Exotic Perk (if present) */}
                  {a.exoticPerk && (
                    <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-1">
                      <div className="flex items-center gap-1 text-xs font-bold text-amber-300 font-heading">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{a.exoticPerk.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                        {a.exoticPerk.description}
                      </p>
                    </div>
                  )}

                  {/* Source String */}
                  {a.sourceString && !a.exoticPerk && !a.setIntrinsicPerk && (
                    <p className="text-xs text-slate-400 line-clamp-2 italic">
                      "{a.sourceString}"
                    </p>
                  )}

                </div>

                {/* Card Footer */}
                <div className="px-3.5 py-2 bg-[#0d111a] border-t border-[#20293a] flex items-center justify-between text-xs">
                  <span className="text-slate-400 group-hover:text-amber-300 font-medium flex items-center gap-1 transition-colors">
                    Inspect Armour <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {a.setCategory}
                  </span>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
          >
            Previous
          </button>
          <span className="text-xs font-mono text-slate-400 px-2">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 disabled:opacity-40 hover:bg-slate-800 transition-colors"
          >
            Next
          </button>
        </div>
      )}

    </div>
  );
}
