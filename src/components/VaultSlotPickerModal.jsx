import React, { useState, useMemo } from 'react';
import { 
  X, 
  Search, 
  SlidersHorizontal, 
  ArrowRightLeft, 
  RefreshCw, 
  Flame, 
  Zap, 
  Moon, 
  Snowflake, 
  Wind, 
  CircleDot, 
  Sparkles, 
  Box, 
  Check, 
  Shield, 
  Crosshair 
} from 'lucide-react';
import { getDamageInfo, getTierInfo } from '../utils/destiny-helpers';
import { equipSlotKey, WEAPON_SLOT_KEYS, ARMOR_SLOT_KEYS } from '../utils/destiny-buckets';
import LongPressable from './LongPressable';

export default function VaultSlotPickerModal({
  slotGroup,
  activeChar,
  vaultItems = [],
  onClose,
  onTransfer,
  actionLoading,
  onSelectWeapon,
  onSelectArmor,
  onOpenInfo
}) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all'); // 'all' | 'Exotic' | 'Legendary' | 'Rare'
  const [damageFilter, setDamageFilter] = useState('all'); // 'all' | 'Solar' | 'Arc' | 'Void' | 'Stasis' | 'Strand' | 'Kinetic'
  const [artificeOnly, setArtificeOnly] = useState(false);
  const [masterworkOnly, setMasterworkOnly] = useState(false);
  const [sortBy, setSortBy] = useState('power_desc'); // 'power_desc' | 'power_asc' | 'name_asc' | 'stat_desc'

  const isWeaponSlot = WEAPON_SLOT_KEYS.includes(slotGroup.key);
  const isArmorSlot = ARMOR_SLOT_KEYS.includes(slotGroup.key);

  // Current count in the character's inventory for this specific slot
  const currentBagCount = slotGroup.bag?.length || 0;
  const availableSpace = Math.max(0, 9 - currentBagCount);
  const isFull = availableSpace === 0;

  // Filter vault items strictly for this equipment slot and character class
  const relevantVaultItems = useMemo(() => {
    return vaultItems.filter(item => {
      // Must match slot
      const itemSlotKey = equipSlotKey(item);
      if (itemSlotKey !== slotGroup.key) return false;

      // For armor, must match active character's class (Titan, Hunter, Warlock or Any)
      if (isArmorSlot && activeChar?.classType) {
        if (item.classType && item.classType !== 'Any' && item.classType !== activeChar.classType) {
          return false;
        }
      }

      // Rarity / Tier filter
      if (tierFilter !== 'all' && item.tierTypeName !== tierFilter) {
        return false;
      }

      // Damage filter (weapons)
      if (isWeaponSlot && damageFilter !== 'all') {
        if (item.damageType?.toLowerCase() !== damageFilter.toLowerCase()) {
          return false;
        }
      }

      // Artifice only (armor)
      if (isArmorSlot && artificeOnly && !item.isArtifice) {
        return false;
      }

      // Masterwork only
      if (masterworkOnly && !item.isMasterwork) {
        return false;
      }

      // Text search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchesName = item.name?.toLowerCase().includes(q);
        const matchesType = (item.weaponType || item.armorSlot || item.itemTypeDisplayName)?.toLowerCase().includes(q);
        const matchesDamage = item.damageType?.toLowerCase().includes(q);
        const matchesPerks = item.perks && item.perks.some(p => (p.name || p).toLowerCase().includes(q));
        const matchesSource = item.sourceString?.toLowerCase().includes(q);
        if (!matchesName && !matchesType && !matchesDamage && !matchesPerks && !matchesSource) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'power_desc') {
        return (b.power || 0) - (a.power || 0);
      }
      if (sortBy === 'power_asc') {
        return (a.power || 0) - (b.power || 0);
      }
      if (sortBy === 'name_asc') {
        return (a.name || '').localeCompare(b.name || '');
      }
      if (sortBy === 'stat_desc') {
        return (b.armorStats?.total || 0) - (a.armorStats?.total || 0);
      }
      return 0;
    });
  }, [
    vaultItems, 
    slotGroup.key, 
    isWeaponSlot, 
    isArmorSlot, 
    activeChar?.classType, 
    tierFilter, 
    damageFilter, 
    artificeOnly, 
    masterworkOnly, 
    search, 
    sortBy
  ]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-4xl bg-[#121722] border-t sm:border border-[#28354d] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Pull Handle */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-600/70 rounded-full mx-auto my-2.5 flex-shrink-0" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#0b0e14] border-b border-[#20293a] flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0 shadow-sm">
              {isWeaponSlot ? <Crosshair className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-white font-heading truncate">
                  Add {slotGroup.title}
                </h3>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold whitespace-nowrap">
                  {relevantVaultItems.length} in Vault
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate mt-0.5 flex items-center gap-1.5 font-mono">
                <span>To: <strong className="text-slate-200">{activeChar?.classType}</strong></span>
                <span>•</span>
                <span>Inventory: <strong className={isFull ? 'text-rose-400' : 'text-emerald-400'}>{currentBagCount}/9</strong></span>
                <span>({availableSpace} space{availableSpace === 1 ? '' : 's'} left)</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors flex-shrink-0"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters & Search Bar */}
        <div className="p-3 sm:p-4 bg-[#10141d] border-b border-[#20293a] space-y-2.5 flex-shrink-0">
          
          {/* Search & Sort Row */}
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={`Search by name, perk, type...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 sm:py-2 bg-[#0b0e14] border border-[#20293a] rounded-xl text-xs sm:text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/60"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono self-end sm:self-auto">
              <span className="whitespace-nowrap text-[11px]">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#0b0e14] border border-[#20293a] rounded-lg px-2 py-1.5 text-slate-200 focus:outline-none text-xs"
              >
                <option value="power_desc">Power (High → Low)</option>
                <option value="power_asc">Power (Low → High)</option>
                <option value="name_asc">Name (A → Z)</option>
                {isArmorSlot && <option value="stat_desc">Stat Total (High → Low)</option>}
              </select>
            </div>
          </div>

          {/* Quick Filter Pills Row (Horizontally Scrollable) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            
            {/* Rarity */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-500 font-mono mr-0.5">Rarity:</span>
              {['all', 'Exotic', 'Legendary', 'Rare'].map(t => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`px-2 py-1 rounded-lg font-medium transition-all ${
                    tierFilter === t
                      ? 'bg-amber-500 text-black font-bold shadow-sm'
                      : 'bg-[#0b0e14] text-slate-400 hover:text-slate-200 border border-[#20293a]'
                  }`}
                >
                  {t === 'all' ? 'All' : t}
                </button>
              ))}
            </div>

            {/* Weapon Element Filters */}
            {isWeaponSlot && (
              <div className="flex items-center gap-1 border-l border-[#20293a] pl-2 flex-shrink-0">
                <span className="text-[10px] text-slate-500 font-mono mr-0.5">Element:</span>
                {['all', 'Solar', 'Arc', 'Void', 'Stasis', 'Strand', 'Kinetic'].map(elem => {
                  const active = damageFilter === elem;
                  return (
                    <button
                      key={elem}
                      onClick={() => setDamageFilter(elem)}
                      className={`flex items-center gap-1 px-2 py-1 rounded-lg font-medium transition-all ${
                        active
                          ? 'bg-amber-500 text-black font-bold shadow-sm'
                          : 'bg-[#0b0e14] text-slate-400 hover:text-slate-200 border border-[#20293a]'
                      }`}
                    >
                      {elem !== 'all' && getDamageIcon(elem)}
                      <span>{elem === 'all' ? 'All' : elem}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Armor Specific Toggles */}
            {isArmorSlot && (
              <div className="flex items-center gap-1.5 border-l border-[#20293a] pl-2 flex-shrink-0">
                <button
                  onClick={() => setArtificeOnly(!artificeOnly)}
                  className={`px-2.5 py-1 rounded-lg font-medium border transition-all ${
                    artificeOnly
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50 font-bold'
                      : 'bg-[#0b0e14] text-slate-400 border-[#20293a] hover:text-slate-200'
                  }`}
                >
                  Artifice Only
                </button>

                <button
                  onClick={() => setMasterworkOnly(!masterworkOnly)}
                  className={`px-2.5 py-1 rounded-lg font-medium border transition-all ${
                    masterworkOnly
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                      : 'bg-[#0b0e14] text-slate-400 border-[#20293a] hover:text-slate-200'
                  }`}
                >
                  Masterwork Only
                </button>
              </div>
            )}

          </div>

        </div>

        {/* Modal Body: Grid of Destiny Gear Tiles */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 min-h-[300px]">
          
          {isFull && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium flex items-center justify-between">
              <span>⚠️ Your {slotGroup.title} inventory on {activeChar?.classType} is full (9/9 items). Vault or equip an item to free space.</span>
            </div>
          )}

          {relevantVaultItems.length === 0 ? (
            <div className="p-12 text-center bg-[#0b0e14]/60 border border-[#20293a] rounded-2xl max-w-md mx-auto space-y-2">
              <Box className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-slate-300 font-heading">
                No matching items in Vault
              </h4>
              <p className="text-xs text-slate-500">
                {search || tierFilter !== 'all' || damageFilter !== 'all' || artificeOnly
                  ? 'Try clearing active filters or search terms.'
                  : `You don't have any spare ${slotGroup.title.toLowerCase()} stored in your Vault.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 sm:gap-3.5">
              {relevantVaultItems.map((item) => {
                const tierInfo = getTierInfo(item.tierTypeName);
                const damageInfo = getDamageInfo(item.damageType);
                const isTransferring = actionLoading === item.itemInstanceId;
                const blocked = isFull || (!!actionLoading && !isTransferring);

                return (
                  <div
                    key={item.itemInstanceId || item.itemHash}
                    className="flex flex-col items-center w-full min-w-0 group"
                  >
                    {/* Square Item Tile */}
                    <LongPressable
                      as="div"
                      onClick={() => {
                        if (!blocked && !isTransferring) {
                          onTransfer(item);
                        }
                      }}
                      onLongPress={() => {
                        if (item.isWeapon) onSelectWeapon?.(item.baseItem || item);
                        else if (item.isArmor) onSelectArmor?.(item.baseItem || item);
                        else onOpenInfo?.(item);
                      }}
                      className={`relative w-full aspect-square rounded-2xl bg-[#0b0e14] border-2 ${
                        item.isMasterwork 
                          ? 'border-yellow-400 ring-2 ring-yellow-400/40 shadow-lg shadow-yellow-500/10' 
                          : (tierInfo.border || 'border-slate-700')
                      } p-1 transition-all duration-150 flex items-center justify-center overflow-hidden shadow-md ${
                        blocked
                          ? 'opacity-40 cursor-not-allowed'
                          : 'cursor-pointer hover:border-amber-400 hover:scale-105 active:scale-95 group-hover:shadow-amber-500/20'
                      }`}
                      title={`${item.name} (${item.power ? `✧ ${item.power}` : ''}) • Click to Pull • Hold for Details`}
                    >
                      {/* Item Icon Image */}
                      {item.icon ? (
                        <img 
                          src={item.icon} 
                          alt={item.name} 
                          className="absolute inset-1 w-[calc(100%-8px)] h-[calc(100%-8px)] object-cover rounded-xl"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">D2</span>
                      )}

                      {/* Watermark */}
                      {item.iconWatermark && (
                        <img 
                          src={item.iconWatermark} 
                          alt="" 
                          className="absolute inset-1 w-[calc(100%-8px)] h-[calc(100%-8px)] object-cover rounded-xl pointer-events-none opacity-80" 
                        />
                      )}

                      {/* Element / Damage Icon Badge (Top Left) */}
                      {item.damageType && (
                        <div className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/85 backdrop-blur-sm border border-white/10 shadow flex items-center justify-center z-10">
                          {getDamageIcon(item.damageType)}
                        </div>
                      )}

                      {/* Artifice Badge (Top Right) */}
                      {item.isArtifice && (
                        <div className="absolute top-1.5 right-1.5 px-1 py-0.5 rounded bg-indigo-600 text-[8px] font-bold text-white shadow font-mono z-10 leading-none">
                          A
                        </div>
                      )}

                      {/* Power Level Badge (Bottom Right) */}
                      {item.power && (
                        <span className="absolute bottom-1.5 right-1.5 text-[9px] font-mono bg-black/90 text-amber-300 px-1.5 py-0.5 rounded-md font-bold leading-none shadow border border-amber-500/20 z-10">
                          {item.power}
                        </span>
                      )}

                      {/* Loading Spinner during Transfer */}
                      {isTransferring && (
                        <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-1 z-20">
                          <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                          <span className="text-[8px] font-mono text-amber-300 font-bold">PULLING</span>
                        </div>
                      )}

                      {/* Pull Hover Overlay (desktop) */}
                      {!blocked && !isTransferring && (
                        <div className="absolute inset-0 bg-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                          <ArrowRightLeft className="w-5 h-5 text-white drop-shadow-md" />
                        </div>
                      )}
                    </LongPressable>

                    {/* Item Label & Info Below Tile */}
                    <div className="w-full mt-1 text-center px-0.5 min-w-0">
                      <span 
                        onClick={() => {
                          if (item.isWeapon) onSelectWeapon?.(item.baseItem || item);
                          else if (item.isArmor) onSelectArmor?.(item.baseItem || item);
                        }}
                        className="block text-[11px] font-bold text-slate-200 truncate group-hover:text-amber-300 cursor-pointer transition-colors font-heading"
                        title={item.name}
                      >
                        {item.name}
                      </span>
                      <span className="block text-[9px] text-slate-400 font-mono truncate">
                        {isArmorSlot && item.armorStats?.total ? (
                          <span>Stat: {item.armorStats.total}</span>
                        ) : (
                          <span>{item.weaponType || item.itemTypeDisplayName}</span>
                        )}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-[#0b0e14] border-t border-[#20293a] flex items-center justify-between gap-3 flex-shrink-0 text-xs">
          <span className="text-slate-400 font-mono text-[11px] truncate">
            Tap tile to pull • Hold to inspect
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors flex-shrink-0"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
