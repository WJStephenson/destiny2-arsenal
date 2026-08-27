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
  Flame,
  MapPin
} from 'lucide-react';
import { getTierInfo, getSourceCategoryBadge } from '../utils/destiny-helpers';
import { getArmorSuggestionsClient, searchArmorClient, getArmorSourceCategories } from '../utils/client-manifest';
import LongPressable from './LongPressable';
import SearchField, { FilterChips, CHIP_TONES } from './SearchField';

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
  const [selectedSetName, setSelectedSetName] = useState('All');
  const [suggestions, setSuggestions] = useState({ armor: [], sets: [], sources: [], slots: [], classes: [], tiers: [] });

  // Categories come from the manifest rather than a hardcoded list: the old
  // list named sets that no source category ever matched, so every option
  // returned an empty grid.
  const [setCategories, setSetCategories] = useState(['All']);

  useEffect(() => {
    getArmorSourceCategories()
      .then(cats => setSetCategories(['All', ...cats]))
      .catch(() => setSetCategories(['All']));
  }, []);

  useEffect(() => {
    fetchArmor();
  }, [search, selectedClasses, selectedSlots, selectedTiers, selectedSetCategory, selectedSetName, artificeOnly, page]);

  const fetchArmor = async () => {
    setLoading(true);
    try {
      const data = await searchArmorClient({
        search,
        classType: selectedClasses.length === 1 ? selectedClasses[0] : 'All',
        slot: selectedSlots.length === 1 ? selectedSlots[0] : 'All',
        tier: selectedTiers.length === 1 ? selectedTiers[0] : 'All',
        sourceCategory: selectedSetCategory,
        setName: selectedSetName,
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

  useEffect(() => {
    setSuggestions(search.trim()
      ? getArmorSuggestionsClient(search.trim())
      : { armor: [], sets: [], sources: [], slots: [], classes: [], tiers: [] });
  }, [search]);

  /** Add a filter and empty the box, the way the weapons screen does. */
  const pickFilter = (apply) => {
    apply();
    setSearch('');
    setPage(1);
  };

  const addUnique = (setter, list, value) => {
    if (!list.includes(value)) setter([...list, value]);
  };

  const removeFrom = (setter, list, value) => {
    setter(list.filter(item => item !== value));
    setPage(1);
  };

  /** What the search bar can offer for whatever has been typed. */
  const searchGroups = [
    {
      key: 'armor',
      label: 'Armour',
      icon: Shield,
      tone: 'text-slate-400',
      layout: 'rows',
      items: (suggestions.armor || []).map(a => ({
        value: a.hash || a.id,
        label: a.name,
        detail: [a.classType, a.armorSlot].filter(Boolean).join(' • '),
        icon: a.icon,
        onSelect: () => { setSearch(a.name); setPage(1); }
      }))
    },
    {
      key: 'sets',
      label: 'Armour Sets',
      icon: Layers,
      tone: 'text-teal-400',
      items: (suggestions.sets || []).map(name => ({
        value: name, label: name, onSelect: () => pickFilter(() => setSelectedSetName(name))
      }))
    },
    {
      key: 'classes',
      label: 'Guardians',
      icon: Shield,
      tone: 'text-rose-400',
      items: (suggestions.classes || []).map(cls => ({
        value: cls,
        label: cls,
        onSelect: () => pickFilter(() => addUnique(setSelectedClasses, selectedClasses, cls))
      }))
    },
    {
      key: 'slots',
      label: 'Slots',
      icon: Layers,
      tone: 'text-emerald-400',
      items: (suggestions.slots || []).map(slot => ({
        value: slot,
        label: slot,
        onSelect: () => pickFilter(() => addUnique(setSelectedSlots, selectedSlots, slot))
      }))
    },
    {
      key: 'tiers',
      label: 'Rarity',
      icon: Crown,
      tone: 'text-fuchsia-400',
      items: (suggestions.tiers || []).map(tier => ({
        value: tier,
        label: tier,
        onSelect: () => pickFilter(() => addUnique(setSelectedTiers, selectedTiers, tier))
      }))
    },
    {
      key: 'sources',
      label: 'Sources & Activities',
      icon: MapPin,
      tone: 'text-sky-400',
      items: (suggestions.sources || []).map(src => ({
        value: src, label: src, onSelect: () => pickFilter(() => setSelectedSetCategory(src))
      }))
    }
  ];

  /** Everything the grid is currently narrowed by. */
  const activeFilters = [
    ...selectedClasses.map(v => ({
      key: `cls:${v}`, label: 'Guardian', value: v, tone: CHIP_TONES.guardian,
      remove: () => removeFrom(setSelectedClasses, selectedClasses, v)
    })),
    ...selectedSlots.map(v => ({
      key: `slot:${v}`, label: 'Slot', value: v, tone: CHIP_TONES.slot,
      remove: () => removeFrom(setSelectedSlots, selectedSlots, v)
    })),
    ...selectedTiers.map(v => ({
      key: `tier:${v}`, label: 'Rarity', value: v, tone: CHIP_TONES.tier,
      remove: () => removeFrom(setSelectedTiers, selectedTiers, v)
    })),
    ...(selectedSetName !== 'All' ? [{
      key: `set:${selectedSetName}`, label: 'Set', value: selectedSetName, tone: CHIP_TONES.set,
      remove: () => { setSelectedSetName('All'); setPage(1); }
    }] : []),
    ...(selectedSetCategory !== 'All' ? [{
      key: `src:${selectedSetCategory}`, label: 'Source', value: selectedSetCategory, tone: CHIP_TONES.source,
      remove: () => { setSelectedSetCategory('All'); setPage(1); }
    }] : []),
    ...(artificeOnly ? [{
      key: 'artifice', label: 'Only', value: 'Artifice', tone: CHIP_TONES.type,
      remove: () => { setArtificeOnly(false); setPage(1); }
    }] : [])
  ];

  const clearFilters = () => {
    setSelectedClasses([]);
    setSelectedSlots([]);
    setSelectedTiers([]);
    setSelectedSetName('All');
    setSelectedSetCategory('All');
    setArtificeOnly(false);
    setPage(1);
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
        <SearchField
          value={search}
          onChange={(next) => { setSearch(next); setPage(1); }}
          placeholder="Search armour by name, set, slot or source..."
          groups={searchGroups}
        />

        <FilterChips filters={activeFilters} onClear={clearFilters} />

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
              {cat === 'All' ? 'All Sets' : `${getSourceCategoryBadge(cat).icon} ${cat}`}
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
