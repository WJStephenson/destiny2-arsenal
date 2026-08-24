import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Sparkles, 
  X, 
  Check, 
  ChevronRight, 
  Copy, 
  Bookmark, 
  Scale, 
  ExternalLink,
  Flame,
  Zap,
  Moon,
  Snowflake,
  Wind,
  CircleDot,
  Wand2,
  Hammer,
  MapPin,
  Trophy,
  Tag,
  Crosshair,
  Compass,
  Info
} from 'lucide-react';
import { getDamageInfo, getTierInfo, getSourceCategoryBadge, generateDimQuery, withoutDuplicateEnhancedPerks, rollColumns, getAmmoInfo, getSlotInfo } from '../utils/destiny-helpers';
import { searchWeaponsClient, getSuggestionsClient, searchPerksClient } from '../utils/client-manifest';
import LongPressable from './LongPressable';
import PerkIcon from './PerkIcon';

export default function WeaponFinder({ 
  onSelectWeapon, 
  onAddToCompare, 
  compareList, 
  onSaveWishlist,
  filtersMetadata,
  onOpenInfo 
}) {
  const [weapons, setWeapons] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [search, setSearch] = useState('');
  const [selectedWeaponTypes, setSelectedWeaponTypes] = useState([]);
  const [selectedDamageTypes, setSelectedDamageTypes] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [selectedTiers, setSelectedTiers] = useState([]);
  const [selectedSources, setSelectedSources] = useState([]);
  const [selectedArchetypes, setSelectedArchetypes] = useState([]);
  const [craftableOnly, setCraftableOnly] = useState(false);

  // Perk Filters
  const [selectedPerks, setSelectedPerks] = useState([]);
  const [perkMatchMode, setPerkMatchMode] = useState('and');
  const [perkSearchInput, setPerkSearchInput] = useState('');
  const [isPerkDropdownOpen, setIsPerkDropdownOpen] = useState(false);

  // Name / Archetype / Keyword Autofill Suggestions State
  const [suggestions, setSuggestions] = useState({ weapons: [], archetypes: [], sources: [], weaponTypes: [] });
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const searchContainerRef = useRef(null);
  const perkContainerRef = useRef(null);

  // Column specific filters
  const [column3Perk, setColumn3Perk] = useState('');
  const [column4Perk, setColumn4Perk] = useState('');
  const [originTrait, setOriginTrait] = useState('');

  // Sorting
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');

  // Copy notification state
  const [copiedId, setCopiedId] = useState(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setIsSearchDropdownOpen(false);
      }
      if (perkContainerRef.current && !perkContainerRef.current.contains(e.target)) {
        setIsPerkDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions when search input changes
  useEffect(() => {
    if (!search || search.trim().length === 0) {
      setSuggestions({ weapons: [], archetypes: [], sources: [], weaponTypes: [] });
      return;
    }

    const data = getSuggestionsClient(search.trim());
    setSuggestions(data);
  }, [search]);

  // Fetch weapons when filters change
  useEffect(() => {
    fetchWeapons();
  }, [
    search, 
    selectedWeaponTypes, 
    selectedDamageTypes, 
    selectedSlots, 
    selectedTiers, 
    selectedSources,
    selectedArchetypes,
    craftableOnly,
    selectedPerks,
    perkMatchMode,
    column3Perk,
    column4Perk,
    originTrait,
    sortBy,
    sortDir,
    page
  ]);

  const fetchWeapons = async () => {
    setLoading(true);
    try {
      const data = await searchWeaponsClient({
        search,
        weaponType: selectedWeaponTypes,
        damageType: selectedDamageTypes,
        slot: selectedSlots,
        tier: selectedTiers,
        sourceCategory: selectedSources,
        archetype: selectedArchetypes,
        craftable: craftableOnly,
        perks: selectedPerks,
        perkMatchMode,
        column3Perk,
        column4Perk,
        originTrait,
        sortBy,
        sortDir,
        page,
        limit: 48
      });

      setWeapons(data.items || []);
      setTotalCount(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Error fetching weapons:', err);
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

  const addPerk = (perkName) => {
    if (!selectedPerks.includes(perkName)) {
      setSelectedPerks([...selectedPerks, perkName]);
      setPage(1);
    }
    setPerkSearchInput('');
    setIsPerkDropdownOpen(false);
  };

  const removePerk = (perkName) => {
    setSelectedPerks(selectedPerks.filter(p => p !== perkName));
    setPage(1);
  };

  /**
   * Suggestions add a filter rather than overwriting the search box, so an
   * archetype, a weapon type and a source can stack. Picking a named weapon is
   * still a plain text search -- there is nothing to stack it with.
   */
  const selectSuggestion = (type, value) => {
    const addUnique = (setter, list, item) => {
      if (!list.includes(item)) setter([...list, item]);
    };

    if (type === 'weapon') {
      setSearch(value.name);
    } else {
      if (type === 'archetype') addUnique(setSelectedArchetypes, selectedArchetypes, value);
      else if (type === 'source') addUnique(setSelectedSources, selectedSources, value);
      else if (type === 'weaponType') addUnique(setSelectedWeaponTypes, selectedWeaponTypes, value);
      setSearch('');
    }
    setIsSearchDropdownOpen(false);
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearch('');
    setSelectedWeaponTypes([]);
    setSelectedDamageTypes([]);
    setSelectedSlots([]);
    setSelectedTiers([]);
    setSelectedSources([]);
    setSelectedArchetypes([]);
    setCraftableOnly(false);
    setSelectedPerks([]);
    setColumn3Perk('');
    setColumn4Perk('');
    setOriginTrait('');
    setPage(1);
  };

  const copyDim = (weapon, e) => {
    e.stopPropagation();
    const query = generateDimQuery(weapon, selectedPerks);
    navigator.clipboard.writeText(query);
    setCopiedId(weapon.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const popularPerks = filtersMetadata?.popularPerks || [
    'Incandescent', 'Voltshot', 'Kinetic Tremors', 'Bait and Switch',
    'Destabilizing Rounds', 'Precision Instrument', 'Reconstruction', 'Rewind Rounds',
    'Heal Clip', 'Firefly', 'Explosive Payload', 'Demolitionist',
    'Frenzy', 'Target Lock', 'Hatchling', 'Headstone'
  ];

  /**
   * Perk suggestions come from the perk catalogue, not from the weapon filter
   * metadata. perkColumns only exists in the server-generated filters.json --
   * the client-side fallback has no such key, so reading it there returned
   * nothing for every query with no visible error. The column lists stay as a
   * fallback for the case where the catalogue has not loaded.
   */
  const perkMatches = useMemo(() => {
    const q = perkSearchInput.trim().toLowerCase();
    if (!q) return [];

    const fromCatalogue = searchPerksClient(q)
      .filter(perk => !selectedPerks.includes(perk.name))
      .slice(0, 15)
      .map(perk => ({ name: perk.name, description: perk.description, category: perk.category }));

    if (fromCatalogue.length > 0) return fromCatalogue;

    const seen = new Set();
    const fallback = [];
    for (const name of Object.values(filtersMetadata?.perkColumns || {}).flat()) {
      if (seen.has(name) || selectedPerks.includes(name)) continue;
      seen.add(name);
      if (name.toLowerCase().includes(q)) fallback.push({ name });
      if (fallback.length >= 15) break;
    }
    return fallback;
  }, [perkSearchInput, selectedPerks, filtersMetadata]);

  const removeFrom = (setter, list, value) => {
    setter(list.filter(item => item !== value));
    setPage(1);
  };

  // One flat list so the chip strip does not need three near-identical blocks.
  const activeSearchFilters = [
    ...selectedWeaponTypes.map(v => ({
      key: `type:${v}`, label: 'Type', value: v, tone: 'bg-purple-500/15 border-purple-500/40 text-purple-200',
      remove: () => removeFrom(setSelectedWeaponTypes, selectedWeaponTypes, v)
    })),
    ...selectedArchetypes.map(v => ({
      key: `arch:${v}`, label: 'Frame', value: v, tone: 'bg-amber-500/15 border-amber-500/40 text-amber-200',
      remove: () => removeFrom(setSelectedArchetypes, selectedArchetypes, v)
    })),
    ...selectedSources.map(v => ({
      key: `src:${v}`, label: 'Source', value: v, tone: 'bg-sky-500/15 border-sky-500/40 text-sky-200',
      remove: () => removeFrom(setSelectedSources, selectedSources, v)
    }))
  ];

  const clearSearchFilters = () => {
    setSelectedWeaponTypes([]);
    setSelectedArchetypes([]);
    setSelectedSources([]);
    setPage(1);
  };

  const getDamageIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'solar': return <Flame className="w-3.5 h-3.5 text-amber-400" />;
      case 'arc': return <Zap className="w-3.5 h-3.5 text-sky-400" />;
      case 'void': return <Moon className="w-3.5 h-3.5 text-purple-400" />;
      case 'stasis': return <Snowflake className="w-3.5 h-3.5 text-blue-400" />;
      case 'strand': return <Wind className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <CircleDot className="w-3.5 h-3.5 text-slate-300" />;
    }
  };

  const hasActiveFilters = search || 
    selectedWeaponTypes.length > 0 || 
    selectedDamageTypes.length > 0 || 
    selectedSlots.length > 0 || 
    selectedTiers.length > 0 || 
    selectedSources.length > 0 ||
    selectedArchetypes.length > 0 ||
    craftableOnly || 
    selectedPerks.length > 0 ||
    column3Perk ||
    column4Perk ||
    originTrait;

  const hasSuggestions = suggestions.weapons?.length > 0 || 
    suggestions.archetypes?.length > 0 || 
    suggestions.sources?.length > 0 || 
    suggestions.weaponTypes?.length > 0;

  return (
    <div className="space-y-6">
      
      {/* Top Query & Search Box */}
      <div className="bg-[#121722] border border-[#20293a] rounded-xl p-5 shadow-xl">
        <div className="flex flex-col gap-4">
          
          {/* Main Search & Perk Builder Row */}
          <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
            
            {/* Autofill Search Bar (Name, Archetype, Source) */}
            <div className="relative flex-1" ref={searchContainerRef}>
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search name, type, archetype or source — pick to add a filter"
                value={search}
                onChange={(e) => { 
                  setSearch(e.target.value); 
                  setIsSearchDropdownOpen(true);
                  setPage(1); 
                }}
                onFocus={() => setIsSearchDropdownOpen(true)}
                className="w-full pl-10 pr-10 py-2.5 bg-[#0b0e14] border border-[#20293a] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
              />
              {search && (
                <button 
                  onClick={() => { setSearch(''); setIsSearchDropdownOpen(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Autofill Dropdown Menu */}
              {isSearchDropdownOpen && search.trim().length > 0 && hasSuggestions && (
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-80 overflow-y-auto bg-[#161c2b] border border-[#28354d] rounded-xl shadow-2xl z-50 p-2 space-y-3">
                  
                  {/* Matching Weapons */}
                  {suggestions.weapons?.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-[10px] font-bold text-slate-400 font-heading uppercase tracking-wider px-2 flex items-center gap-1">
                        <Crosshair className="w-3 h-3 text-amber-400" /> Weapons
                      </div>
                      <div className="space-y-0.5">
                        {suggestions.weapons.map((w) => {
                          const tierInfo = getTierInfo(w.tierTypeName);
                          const damageInfo = getDamageInfo(w.damageType);
                          return (
                            <div
                              key={w.id}
                              onClick={() => selectSuggestion('weapon', w)}
                              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 cursor-pointer text-xs group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                                  {w.icon && <img src={w.icon} alt="" className="w-full h-full object-cover" />}
                                </div>
                                <div className="min-w-0">
                                  <span className="font-bold text-slate-200 group-hover:text-amber-300 transition-colors truncate block">
                                    {w.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    <span className={damageInfo.text}>{w.damageType}</span> • {w.weaponType}
                                  </span>
                                </div>
                              </div>
                              {w.sourceString && (
                                <span className="text-[10px] text-slate-500 font-mono truncate max-w-[140px] text-right">
                                  {w.sourceString}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Matching Archetypes */}
                  {suggestions.archetypes?.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-[#28354d]">
                      <div className="text-[10px] font-bold text-amber-400 font-heading uppercase tracking-wider px-2 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-amber-400" /> Archetypes & Frames
                      </div>
                      <div className="flex flex-wrap gap-1 px-1">
                        {suggestions.archetypes.map((arch) => (
                          <button
                            key={arch}
                            onClick={() => selectSuggestion('archetype', arch)}
                            className="px-2 py-1 rounded bg-[#0b0e14] hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-[#20293a] text-xs font-mono transition-colors"
                          >
                            {arch}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Sources / Activities */}
                  {suggestions.sources?.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-[#28354d]">
                      <div className="text-[10px] font-bold text-sky-400 font-heading uppercase tracking-wider px-2 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-sky-400" /> Sources & Activities
                      </div>
                      <div className="flex flex-wrap gap-1 px-1">
                        {suggestions.sources.map((src) => (
                          <button
                            key={src}
                            onClick={() => selectSuggestion('source', src)}
                            className="px-2 py-1 rounded bg-[#0b0e14] hover:bg-sky-500/20 text-slate-300 hover:text-sky-300 border border-[#20293a] text-xs font-mono transition-colors"
                          >
                            {src}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Matching Weapon Types */}
                  {suggestions.weaponTypes?.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-[#28354d]">
                      <div className="text-[10px] font-bold text-purple-400 font-heading uppercase tracking-wider px-2 flex items-center gap-1">
                        <Crosshair className="w-3 h-3 text-purple-400" /> Weapon Types
                      </div>
                      <div className="flex flex-wrap gap-1 px-1">
                        {suggestions.weaponTypes.map((wt) => (
                          <button
                            key={wt}
                            onClick={() => selectSuggestion('weaponType', wt)}
                            className="px-2 py-1 rounded bg-[#0b0e14] hover:bg-purple-500/20 text-slate-300 hover:text-purple-300 border border-[#20293a] text-xs font-mono transition-colors"
                          >
                            {wt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>

            {/* Interactive Perk Dropdown */}
            <div className="relative flex-1" ref={perkContainerRef}>
              <div className="flex items-center">
                <Sparkles className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400" />
                <input
                  type="text"
                  placeholder="Search perks — pick to add a filter"
                  value={perkSearchInput}
                  onChange={(e) => {
                    setPerkSearchInput(e.target.value);
                    setIsPerkDropdownOpen(true);
                  }}
                  onFocus={() => setIsPerkDropdownOpen(true)}
                  className="w-full pl-10 pr-20 py-2.5 bg-[#0b0e14] border border-[#20293a] rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/40"
                />
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center bg-slate-800 rounded border border-slate-700 p-0.5 text-xs font-mono">
                  <button
                    onClick={() => setPerkMatchMode('and')}
                    className={`px-1.5 py-0.5 rounded ${perkMatchMode === 'and' ? 'bg-amber-500 text-black font-bold' : 'text-slate-400'}`}
                    title="Must have ALL selected perks"
                  >
                    AND
                  </button>
                  <button
                    onClick={() => setPerkMatchMode('or')}
                    className={`px-1.5 py-0.5 rounded ${perkMatchMode === 'or' ? 'bg-amber-500 text-black font-bold' : 'text-slate-400'}`}
                    title="Can have ANY of the selected perks"
                  >
                    OR
                  </button>
                </div>
              </div>

              {isPerkDropdownOpen && perkSearchInput.trim() && (
                <div className="absolute left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto bg-[#161c2b] border border-[#28354d] rounded-lg shadow-2xl z-50 p-1">
                  {perkMatches.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-slate-500">
                      No perks match "{perkSearchInput.trim()}"
                    </div>
                  ) : perkMatches.map((perk) => (
                    <div
                      key={perk.name}
                      onClick={() => addPerk(perk.name)}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-amber-500/10 hover:text-amber-300 cursor-pointer text-sm text-slate-200"
                    >
                      <span className="flex items-start gap-2 min-w-0">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <span className="min-w-0">
                          <span className="block truncate">{perk.name}</span>
                          {perk.description && (
                            <span className="block text-xs text-slate-500 truncate">{perk.description}</span>
                          )}
                        </span>
                      </span>
                      <span className="text-xs text-slate-500 font-mono flex-shrink-0">+ Add</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Active Selected Perks Chips */}
          {selectedPerks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#20293a]/60">
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider font-heading">
                Active Perk Filters ({perkMatchMode.toUpperCase()}):
              </span>
              {selectedPerks.map((perk) => (
                <span
                  key={perk}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium shadow-sm"
                >
                  <LongPressable
                    onLongPress={() => onOpenInfo?.({ name: perk, type: 'perk' })}
                    className="flex items-center gap-1.5"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>{perk}</span>
                  </LongPressable>
                  <button
                    onClick={() => removePerk(perk)}
                    className="hover:text-white ml-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              <button
                onClick={() => setSelectedPerks([])}
                className="text-xs text-slate-500 hover:text-slate-300 underline font-mono ml-2"
              >
                Clear Perks
              </button>
            </div>
          )}

          {/* Filters added from the search bar. Without these the selections
              made in the dropdown would apply invisibly. */}
          {activeSearchFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#20293a]/60">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading">
                Filters:
              </span>
              {activeSearchFilters.map(({ key, label, value, remove, tone }) => (
                <span
                  key={key}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${tone}`}
                >
                  <span className="opacity-60 font-mono text-[10px] uppercase">{label}</span>
                  <span>{value}</span>
                  <button onClick={remove} className="hover:text-white ml-0.5" aria-label={`Remove ${value} filter`}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearSearchFilters}
                className="text-xs text-slate-500 hover:text-slate-300 underline font-mono ml-1"
              >
                Clear
              </button>
            </div>
          )}

          {/* Quick Popular Meta Perks Pills (Tap to inspect & filter) */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-xs text-slate-500 whitespace-nowrap mr-1 font-mono flex items-center gap-1">
              <span>Popular:</span>
            </span>
            {popularPerks.map((p) => {
              const isSelected = selectedPerks.includes(p);
              return (
                <div
                  key={p}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/20 font-bold'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border-slate-700/60'
                  }`}
                >
                  <LongPressable
                    onClick={() => onOpenInfo?.({ name: p, type: 'perk' })}
                    onLongPress={() => onOpenInfo?.({ name: p, type: 'perk' })}
                    className="cursor-pointer"
                  >
                    <span>{p}</span>
                  </LongPressable>
                  {isSelected && (
                    <button
                      onClick={() => removePerk(p)}
                      className="hover:text-rose-400 p-0.5 rounded"
                      title="Remove filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>

      {/* Toggles that are quicker to tap than to type. Weapon types,
          archetypes and sources live in the search bar instead. */}
      <div className="space-y-3 bg-[#121722]/60 border border-[#20293a]/60 rounded-xl p-4">
        
        {/* Rarity / Tier (Exotic, Legendary, Rare) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading whitespace-nowrap min-w-[70px]">
            Rarity:
          </span>
          <div className="flex items-center gap-1.5">
            {[
              { name: 'Exotic', bg: 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-500/10' },
              { name: 'Legendary', bg: 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-purple-500/10' },
              { name: 'Rare', bg: 'bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-blue-500/10' }
            ].map((tier) => {
              const active = selectedTiers.includes(tier.name);
              return (
                <button
                  key={tier.name}
                  onClick={() => toggleArrayFilter(setSelectedTiers, selectedTiers, tier.name)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    active
                      ? `${tier.bg} border font-bold shadow-sm`
                      : 'bg-[#0b0e14] text-slate-400 hover:text-slate-200 border border-[#20293a]'
                  }`}
                >
                  {tier.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Damage Types & Slots Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-[#20293a]/40">
          
          {/* Elements (With Long Press Subclass info!) */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-heading whitespace-nowrap min-w-[70px]">
              Element:
            </span>
            <div className="flex items-center gap-1.5">
              {['Solar', 'Arc', 'Void', 'Stasis', 'Strand', 'Kinetic'].map((elem) => {
                const active = selectedDamageTypes.includes(elem);
                const info = getDamageInfo(elem);
                return (
                  <LongPressable
                    key={elem}
                    onClick={() => toggleArrayFilter(setSelectedDamageTypes, selectedDamageTypes, elem)}
                    onLongPress={() => onOpenInfo?.({ name: elem, type: 'element' })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                      active
                        ? `${info.bg} ${info.text} border ${info.border} font-bold`
                        : 'bg-[#0b0e14] text-slate-400 hover:text-slate-200 border border-[#20293a]'
                    }`}
                  >
                    {getDamageIcon(elem)}
                    <span>{elem}</span>
                  </LongPressable>
                );
              })}
            </div>
          </div>

          {/* Slot, Ammo & Craftable */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-1 font-mono">Slot:</span>
              {['Kinetic', 'Energy', 'Power'].map((s) => (
                <button
                  key={s}
                  onClick={() => toggleArrayFilter(setSelectedSlots, selectedSlots, s)}
                  className={`px-2 py-0.5 rounded text-xs ${
                    selectedSlots.includes(s)
                      ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      : 'bg-[#0b0e14] text-slate-400 border border-[#20293a]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              onClick={() => { setCraftableOnly(!craftableOnly); setPage(1); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                craftableOnly
                  ? 'bg-red-500/20 text-red-300 border-red-500/50 shadow-sm shadow-red-500/20 font-bold'
                  : 'bg-[#0b0e14] text-slate-400 border-[#20293a] hover:text-slate-200'
              }`}
            >
              <Hammer className="w-3.5 h-3.5 text-red-400" />
              <span>Craftable Only</span>
            </button>

            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 underline font-mono"
              >
                <X className="w-3 h-3" /> Reset All
              </button>
            )}
          </div>

        </div>

      </div>

      {/* --- RESULTS HEADER & SORTING --- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-white font-heading">
            {totalCount.toLocaleString()} Weapons
          </h2>
          {selectedSources.length > 0 && (
            <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
              {selectedSources.join(', ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-mono">Sort By:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#121722] border border-[#20293a] rounded px-2.5 py-1 text-slate-200 focus:outline-none"
          >
            <option value="name">Name</option>
            <option value="tier">Rarity / Tier</option>
            <option value="range">Range</option>
            <option value="stability">Stability</option>
            <option value="handling">Handling</option>
            <option value="reload">Reload Speed</option>
            <option value="impact">Impact</option>
            <option value="rpm">Rounds Per Minute</option>
          </select>
          <button
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            className="p-1 px-2 rounded bg-[#121722] border border-[#20293a] text-slate-300 hover:text-white font-mono"
          >
            {sortDir.toUpperCase()}
          </button>
        </div>
      </div>

      {/* --- WEAPONS GRID --- */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-[#121722] border border-[#20293a] animate-pulse" />
          ))}
        </div>
      ) : weapons.length === 0 ? (
        <div className="p-12 text-center bg-[#121722] border border-[#20293a] rounded-xl">
          <Crosshair className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-300 font-heading">No weapons matched your filters</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
            Try broadening your perk or source search or switching perk match mode from AND to OR.
          </p>
          <button
            onClick={clearAllFilters}
            className="mt-4 px-4 py-2 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-lg text-sm hover:bg-amber-500/30"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {weapons.map((w) => {
            const tierInfo = getTierInfo(w.tierTypeName);
            const damageInfo = getDamageInfo(w.damageType);
            const sourceBadge = getSourceCategoryBadge(w.sourceCategory);
            const ammoInfo = getAmmoInfo(w.ammoType);
            const slotInfo = getSlotInfo(w.slot);
            const isCompared = compareList.some(item => item.id === w.id);

            const matchingPerks = selectedPerks.length > 0 
              ? w.allPerkNames.filter(pn => selectedPerks.some(sp => sp.toLowerCase() === pn.toLowerCase()))
              : [];

            return (
              <div
                key={w.id}
                onClick={() => onSelectWeapon(w)}
                className={`group relative flex flex-col justify-between bg-[#121722] hover:bg-[#161d2b] border ${
                  matchingPerks.length > 0 ? 'border-amber-500/50 shadow-lg shadow-amber-500/5' : 'border-[#20293a]'
                } hover:border-slate-500 rounded-xl overflow-hidden cursor-pointer transition-all duration-200`}
              >
                {/* Card Header */}
                <div className={`relative p-3.5 ${tierInfo.headerBg} border-b border-[#20293a]/60`}>
                  <div className="flex items-start gap-3">
                    
                    {/* Icon */}
                    <div className="relative w-14 h-14 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex-shrink-0">
                      {w.icon ? (
                        <img src={w.icon} alt={w.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Crosshair className="w-6 h-6" />
                        </div>
                      )}
                      {w.iconWatermark && (
                        <img src={w.iconWatermark} alt="" className="absolute inset-0 w-full h-full pointer-events-none opacity-80" />
                      )}
                      {w.isCraftable && (
                        <div className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-bl" title="Craftable weapon" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold uppercase ${tierInfo.bg} ${tierInfo.text}`}>
                          {w.tierTypeName}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${damageInfo.bg} ${damageInfo.text}`}>
                          {w.damageType}
                        </span>
                        {/* Slot and ammo are separate facts from damage type --
                            a Void sniper is an Energy-slot Special weapon. */}
                        {slotInfo && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${slotInfo.bg} ${slotInfo.text} ${slotInfo.border}`}>
                            {slotInfo.name}
                          </span>
                        )}
                        {ammoInfo && (
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${ammoInfo.bg} ${ammoInfo.text} ${ammoInfo.border}`}>
                            {ammoInfo.name}
                          </span>
                        )}
                        {w.isCraftable && (
                          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                            Craft
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white tracking-wide truncate group-hover:text-amber-400 transition-colors mt-0.5">
                        {w.name}
                      </h3>

                      <p className="text-xs text-slate-400 truncate">
                        {w.itemTypeDisplayName || w.weaponType}
                      </p>
                    </div>

                  </div>
                </div>

                {/* Sockets / Perks & Source Body */}
                <div className="p-3 space-y-2.5 flex-1">
                  
                  {/* Acquisition Source Pill (Long Pressable) */}
                  {w.sourceString && (
                    <LongPressable
                      onLongPress={(e) => {
                        e.stopPropagation();
                        onOpenInfo?.({
                          name: w.sourceString,
                          category: 'Acquisition Source',
                          description: `Drop location: ${w.sourceString}`,
                          type: 'source'
                        });
                      }}
                      className={`text-[11px] flex items-center gap-1.5 px-2 py-1 rounded border truncate w-full ${sourceBadge.bg} ${sourceBadge.text} ${sourceBadge.border}`}
                      title={`${w.sourceString} (Hold for info)`}
                    >
                      <span className="flex-shrink-0">{sourceBadge.icon}</span>
                      <span className="truncate font-medium">{w.sourceString}</span>
                    </LongPressable>
                  )}

                  {/* Intrinsic frame (Long Pressable) */}
                  {w.intrinsic && (
                    <LongPressable
                      onLongPress={(e) => {
                        e.stopPropagation();
                        onOpenInfo?.({
                          name: w.intrinsic.name,
                          category: 'Intrinsic Frame',
                          description: w.intrinsic.description,
                          icon: w.intrinsic.icon,
                          type: 'intrinsic'
                        });
                      }}
                      className="text-xs flex items-center gap-1.5 text-slate-400 bg-[#0b0e14]/60 px-2 py-1 rounded border border-[#20293a]/40 w-full"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                      <span className="font-medium text-slate-300 truncate">{w.intrinsic.name}</span>
                    </LongPressable>
                  )}

                  {/* A card only shows the perks that answer the current perk
                      filter -- the reason this weapon is in the list. The full
                      roll belongs to the inspect view, where there is room for
                      it. With no perk filter set there is nothing to justify,
                      so the block does not render at all.

                      Matches are looked for in every socket, not just the two
                      trait columns, because a barrel or magazine can be what
                      was filtered on. Columns are kept so a match still shows
                      which socket it sits in. */}
                  {matchingPerks.length > 0 && (
                    <div className="flex gap-1.5 items-start">
                      {rollColumns(w.socketColumns)
                        .map(col => ({
                          type: col.type,
                          perks: withoutDuplicateEnhancedPerks(col.perks || []).filter(p =>
                            selectedPerks.some(sp => sp.toLowerCase() === p.name.toLowerCase())
                          )
                        }))
                        .filter(col => col.perks.length > 0)
                        .map((col, idx) => (
                          <div key={idx} className="flex flex-col items-center gap-1">
                            {col.perks.map((p) => {
                              const info = {
                                name: p.name,
                                category: p.category || 'Perk',
                                description: p.description,
                                icon: p.icon,
                                stats: p.stats,
                                isEnhanced: p.isEnhanced,
                                type: 'perk'
                              };
                              return (
                                <LongPressable
                                  key={p.hash}
                                  onClick={(e) => { e.stopPropagation(); onOpenInfo?.(info); }}
                                  onLongPress={(e) => { e.stopPropagation(); removePerk(p.name); }}
                                  title={`${p.name}${p.isEnhanced ? ' (Enhanced)' : ''} — ${col.type} — hold to drop this filter`}
                                  className="relative justify-center w-7 h-7 rounded-full border border-amber-400 ring-1 ring-amber-400 bg-amber-500/20 transition-all hover:scale-110 active:scale-95"
                                >
                                  <PerkIcon perk={p} className="w-5 h-5" />
                                </LongPressable>
                              );
                            })}
                          </div>
                        ))}
                    </div>
                  )}

                </div>

                {/* Card Footer Actions */}
                <div className="px-3 py-2 bg-[#0d111a] border-t border-[#20293a] flex items-center justify-between text-xs">
                  <span className="text-slate-400 hover:text-amber-300 font-medium flex items-center gap-1">
                    Inspect <ChevronRight className="w-3.5 h-3.5" />
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCompare(w);
                      }}
                      className={`p-1.5 rounded transition-colors ${
                        isCompared 
                          ? 'bg-emerald-500 text-black font-bold' 
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                      title={isCompared ? 'Remove from compare' : 'Add to compare'}
                    >
                      <Scale className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSaveWishlist({
                          id: `wish_${w.id}_${Date.now()}`,
                          weaponId: w.id,
                          name: w.name,
                          icon: w.icon,
                          weaponType: w.weaponType,
                          damageType: w.damageType,
                          tierTypeName: w.tierTypeName,
                          selectedPerks: matchingPerks.length > 0 ? matchingPerks : selectedPerks,
                          notes: `Source: ${w.sourceString || 'Destiny 2'}`,
                          savedAt: new Date().toISOString()
                        });
                      }}
                      className="p-1.5 rounded text-slate-400 hover:text-pink-400 hover:bg-slate-800 transition-colors"
                      title="Save to Wishlist"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* --- PAGINATION --- */}
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
