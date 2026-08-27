import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  ArrowRightLeft,
  RefreshCw,
  Flame,
  Zap,
  Moon,
  Snowflake,
  Wind,
  CircleDot,
  Box,
  Lock,
  Shield,
  Crosshair,
  Sparkles
} from 'lucide-react';
import { getDamageInfo, getTierInfo } from '../utils/destiny-helpers';
import { equipSlotKey, WEAPON_SLOT_KEYS, ARMOR_SLOT_KEYS } from '../utils/destiny-buckets';
import LongPressable from './LongPressable';
import SearchField from './SearchField';
import useBodyScrollLock from '../utils/useBodyScrollLock';

/** A character can hold nine items per slot, on top of the one it is wearing. */
const SLOT_CAPACITY = 9;

const DAMAGE_ICONS = {
  solar: Flame,
  arc: Zap,
  void: Moon,
  stasis: Snowflake,
  strand: Wind
};

const DAMAGE_ICON_COLOURS = {
  solar: 'text-amber-400',
  arc: 'text-sky-400',
  void: 'text-purple-400',
  stasis: 'text-blue-400',
  strand: 'text-emerald-400'
};

function DamageIcon({ type, className = 'w-3.5 h-3.5' }) {
  const key = type?.toLowerCase();
  const Icon = DAMAGE_ICONS[key] || CircleDot;
  return <Icon className={`${className} ${DAMAGE_ICON_COLOURS[key] || 'text-slate-300'}`} />;
}

/**
 * An item's icon, with its season watermark over the top.
 *
 * Never lazily: this grid lives inside a modal that mounts mid-animation, which
 * is exactly where lazy loading decides an image is off-screen and leaves the
 * tile blank. A broken or missing icon falls back to the item's initials rather
 * than to an empty square, so a tile always reads as something.
 */
function ItemIcon({ item }) {
  const [failed, setFailed] = useState(false);
  const initials = (item.name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();

  if (!item.icon || failed) {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-[#0b0e14] text-slate-400 font-heading font-bold text-sm">
        {initials}
      </div>
    );
  }

  return (
    <>
      <img
        src={item.icon}
        alt=""
        onError={() => setFailed(true)}
        className="absolute inset-0 w-full h-full object-cover"
      />
      {item.iconWatermark && (
        <img
          src={item.iconWatermark}
          alt=""
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
      )}
    </>
  );
}

/**
 * Pick a piece of gear to bring to the character on screen.
 *
 * Everything the player owns for this slot and cannot already reach -- the
 * vault, and the other Guardians' inventories -- in one grid. A tile brings
 * the item over; holding one inspects the roll.
 */
export default function SlotPickerModal({
  slotGroup,
  activeChar,
  characters = [],
  vaultItems = [],
  onClose,
  onTransfer,
  actionLoading,
  onInspect
}) {
  // The page behind stays put while this is open.
  useBodyScrollLock();

  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState('all'); // 'all' | 'Exotic' | 'Legendary' | 'Rare'
  const [damageFilter, setDamageFilter] = useState('all'); // 'all' | 'Solar' | 'Arc' | ...
  const [artificeOnly, setArtificeOnly] = useState(false);
  const [masterworkOnly, setMasterworkOnly] = useState(false);
  const [sortBy, setSortBy] = useState('power_desc');
  const [note, setNote] = useState(null);

  const isWeaponSlot = WEAPON_SLOT_KEYS.includes(slotGroup.key);
  const isArmorSlot = ARMOR_SLOT_KEYS.includes(slotGroup.key);

  const currentBagCount = slotGroup.bag?.length || 0;
  const availableSpace = Math.max(0, SLOT_CAPACITY - currentBagCount);
  const isFull = availableSpace === 0;

  // Close on Escape, and stop the page behind from scrolling under the modal.
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    if (!note) return undefined;
    const timer = setTimeout(() => setNote(null), 4000);
    return () => clearTimeout(timer);
  }, [note]);

  /**
   * Everywhere this Guardian's next piece could come from: the vault, and the
   * other Guardians. An item another Guardian is wearing is listed too -- the
   * player still needs to know it is out there -- but it cannot move until it
   * is taken off, so it is marked and left untappable.
   */
  const candidates = useMemo(() => {
    const entries = [];

    vaultItems.forEach(item => {
      entries.push({ item, sourceLabel: 'Vault', fromVault: true, equippedElsewhere: false });
    });

    characters.forEach(character => {
      if (!character || character.characterId === activeChar?.characterId) return;
      (character.bag || []).forEach(item => {
        entries.push({ item, sourceLabel: character.classType, fromVault: false, equippedElsewhere: false });
      });
      (character.equipped || []).forEach(item => {
        entries.push({ item, sourceLabel: character.classType, fromVault: false, equippedElsewhere: true });
      });
    });

    return entries;
  }, [vaultItems, characters, activeChar?.characterId]);

  /**
   * What the picker's search can offer -- drawn from the candidates it holds,
   * so every suggestion leads somewhere.
   */
  const searchGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];

    const matches = (value) => value && String(value).toLowerCase().includes(query);
    const named = [];
    const types = new Set();
    const elements = new Set();
    const perks = new Set();

    const seenNames = new Set();

    candidates.forEach(({ item }) => {
      if (equipSlotKey(item) !== slotGroup.key) return;
      // One row per name: a vault holds four of the same gun, and four
      // identical rows are no more use than one.
      if (matches(item.name) && named.length < 5 && !seenNames.has(item.name)) {
        seenNames.add(item.name);
        named.push(item);
      }
      if (matches(item.weaponType || item.armorSlot)) types.add(item.weaponType || item.armorSlot);
      if (matches(item.damageType)) elements.add(item.damageType);
      (item.perks || []).forEach(perk => {
        const name = typeof perk === 'string' ? perk : perk?.name;
        if (matches(name) && perks.size < 6) perks.add(name);
      });
    });

    return [
      {
        key: 'items',
        label: 'Matching gear',
        icon: isWeaponSlot ? Crosshair : Shield,
        tone: 'text-slate-400',
        layout: 'rows',
        items: named.map(item => ({
          value: item.itemInstanceId,
          label: item.name,
          detail: [item.damageType, item.itemTypeDisplayName].filter(Boolean).join(' • '),
          icon: item.icon,
          onSelect: () => setSearch(item.name)
        }))
      },
      {
        key: 'elements',
        label: 'Elements',
        icon: Sparkles,
        tone: 'text-orange-400',
        items: [...elements].map(el => ({
          value: el, label: el, tone: getDamageInfo(el).text, onSelect: () => setDamageFilter(el)
        }))
      },
      {
        key: 'types',
        label: 'Types',
        icon: isWeaponSlot ? Crosshair : Shield,
        tone: 'text-purple-400',
        items: [...types].slice(0, 5).map(type => ({
          value: type, label: type, onSelect: () => setSearch(type)
        }))
      },
      {
        key: 'perks',
        label: 'Perks',
        icon: Sparkles,
        tone: 'text-amber-400',
        items: [...perks].map(perk => ({
          value: perk, label: perk, onSelect: () => setSearch(perk)
        }))
      }
    ];
  }, [search, candidates, slotGroup.key, isWeaponSlot]);

  const matchingItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return candidates
      .filter(({ item }) => {
        // The slot comes from the item's own definition: anything stored in the
        // vault reports the vault as its bucket, never the slot it equips into.
        if (equipSlotKey(item) !== slotGroup.key) return false;

        // The slot decides the tile; the weapon/armour flags only veto a
        // contradiction, exactly as the Guardian screen's slot cards do.
        if (isWeaponSlot && item.isArmor) return false;
        if (isArmorSlot && item.isWeapon) return false;

        // Armour this Guardian cannot wear. A null class is not class-locked.
        if (isArmorSlot && activeChar?.classType && item.classType
          && item.classType !== 'Any' && item.classType !== activeChar.classType) {
          return false;
        }

        if (tierFilter !== 'all' && item.tierTypeName !== tierFilter) return false;

        if (isWeaponSlot && damageFilter !== 'all'
          && item.damageType?.toLowerCase() !== damageFilter.toLowerCase()) {
          return false;
        }

        if (isArmorSlot && artificeOnly && !item.isArtifice) return false;
        if (masterworkOnly && !item.isMasterwork) return false;

        if (query) {
          const haystack = [
            item.name,
            item.weaponType,
            item.armorSlot,
            item.itemTypeDisplayName,
            item.damageType,
            item.sourceString,
            ...(item.perks || []).map(perk => (typeof perk === 'string' ? perk : perk?.name))
          ];
          if (!haystack.some(field => field && String(field).toLowerCase().includes(query))) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        // Anything that cannot move waits at the end, whatever the sort.
        if (a.equippedElsewhere !== b.equippedElsewhere) return a.equippedElsewhere ? 1 : -1;
        if (sortBy === 'power_asc') return (a.item.power || 0) - (b.item.power || 0);
        if (sortBy === 'name_asc') return (a.item.name || '').localeCompare(b.item.name || '');
        if (sortBy === 'stat_desc') return (b.item.armorStats?.total || 0) - (a.item.armorStats?.total || 0);
        return (b.item.power || 0) - (a.item.power || 0);
      });
  }, [
    candidates,
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

  /**
   * Two groups, the other Guardians before the vault: a piece already on a
   * Guardian is one move away and the likelier pick, and a vault of hundreds
   * would otherwise bury it.
   */
  const sections = useMemo(() => ([
    { key: 'guardians', label: 'On other Guardians', entries: matchingItems.filter(e => !e.fromVault) },
    { key: 'vault', label: 'In the Vault', entries: matchingItems.filter(e => e.fromVault) }
  ].filter(section => section.entries.length > 0)), [matchingItems]);

  const hasActiveFilters = !!search || tierFilter !== 'all' || damageFilter !== 'all'
    || artificeOnly || masterworkOnly;

  const handleTileTap = (entry) => {
    const { item, equippedElsewhere, sourceLabel } = entry;
    if (equippedElsewhere) {
      setNote(`${item.name} is equipped on your ${sourceLabel}. Equip something else there first.`);
      return;
    }
    if (isFull) {
      setNote(`${activeChar?.classType}'s ${slotGroup.title.toLowerCase()} inventory is full (${SLOT_CAPACITY}/${SLOT_CAPACITY}).`);
      return;
    }
    if (actionLoading) return;
    onTransfer?.(item);
  };

  const pill = (active) => `px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
    active
      ? 'bg-amber-500 text-black font-bold border-amber-400'
      : 'bg-[#0b0e14] text-slate-400 border-[#20293a] hover:text-slate-200'
  }`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden overscroll-none animate-fadeIn"
      data-no-swipe
      onClick={onClose}
    >
      {/* The overlay never scrolls; the panel is bounded and scrolls inside, so
          no part of it can end up out of reach on a short screen. */}
      <div
        className="sheet-panel relative w-full max-w-5xl h-[calc(100dvh-var(--sat)-0.5rem)] sm:h-[40rem] bg-[#121722] border-t sm:border border-[#28354d] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden w-12 h-1.5 bg-slate-600/70 rounded-full mx-auto my-2.5 flex-shrink-0" />

        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 bg-[#0b0e14] border-b border-[#20293a] flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 flex-shrink-0">
              {isWeaponSlot ? <Crosshair className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-white font-heading truncate">
                  Add {slotGroup.title}
                </h3>
                <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono font-bold whitespace-nowrap">
                  {matchingItems.length} available
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 font-mono">
                To <strong className="text-slate-200">{activeChar?.classType}</strong>
                <span className="mx-1.5">•</span>
                <span className={isFull ? 'text-rose-400' : 'text-emerald-400'}>{currentBagCount}/{SLOT_CAPACITY}</span>
                <span className="text-slate-500"> held</span>
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

        {/* Search, sort and filters */}
        <div className="p-3 sm:p-4 bg-[#10141d] border-b border-[#20293a] space-y-2.5 flex-shrink-0">
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <SearchField
              className="flex-1"
              value={search}
              onChange={setSearch}
              placeholder="Search by name, perk, type or element..."
              groups={searchGroups}
            />

            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
              <span>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[#0b0e14] border border-[#20293a] rounded-lg px-2 py-1.5 text-slate-200 text-xs focus:outline-none"
              >
                <option value="power_desc">Power (High → Low)</option>
                <option value="power_asc">Power (Low → High)</option>
                <option value="name_asc">Name (A → Z)</option>
                {isArmorSlot && <option value="stat_desc">Stat Total (High → Low)</option>}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="text-[10px] text-slate-500 font-mono mr-0.5">Rarity:</span>
              {['all', 'Exotic', 'Legendary', 'Rare'].map(tier => (
                <button key={tier} onClick={() => setTierFilter(tier)} className={pill(tierFilter === tier)}>
                  {tier === 'all' ? 'All' : tier}
                </button>
              ))}
            </div>

            {isWeaponSlot && (
              <div className="flex items-center gap-1 border-l border-[#20293a] pl-2 flex-shrink-0">
                <span className="text-[10px] text-slate-500 font-mono mr-0.5">Element:</span>
                {['all', 'Solar', 'Arc', 'Void', 'Stasis', 'Strand', 'Kinetic'].map(element => (
                  <button
                    key={element}
                    onClick={() => setDamageFilter(element)}
                    className={`${pill(damageFilter === element)} inline-flex items-center gap-1`}
                  >
                    {element !== 'all' && <DamageIcon type={element} className="w-3 h-3" />}
                    <span>{element === 'all' ? 'All' : element}</span>
                  </button>
                ))}
              </div>
            )}

            {isArmorSlot && (
              <div className="flex items-center gap-1.5 border-l border-[#20293a] pl-2 flex-shrink-0">
                <button onClick={() => setArtificeOnly(!artificeOnly)} className={pill(artificeOnly)}>
                  Artifice
                </button>
                <button onClick={() => setMasterworkOnly(!masterworkOnly)} className={pill(masterworkOnly)}>
                  Masterwork
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Grid */}
        <div className="sheet-scroll flex-1 p-3 sm:p-5">
          {isFull && (
            <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
              Your {slotGroup.title.toLowerCase()} inventory on {activeChar?.classType} is full
              ({SLOT_CAPACITY}/{SLOT_CAPACITY}). Vault or equip something to make room.
            </div>
          )}

          {matchingItems.length === 0 ? (
            <div className="p-10 text-center bg-[#0b0e14]/60 border border-[#20293a] rounded-2xl max-w-md mx-auto space-y-2">
              <Box className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-base font-bold text-slate-300 font-heading">Nothing to bring over</h4>
              <p className="text-xs text-slate-500">
                {hasActiveFilters
                  ? 'Try clearing the filters or the search.'
                  : `Every ${slotGroup.title.toLowerCase()} you own is already on this Guardian.`}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {sections.map(section => (
                <div key={section.key} className="space-y-2">
                  {/* Only worth a heading once there is a second group to tell
                      it apart from. */}
                  {sections.length > 1 && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                        {section.label}
                      </span>
                      <span className="flex-1 h-px bg-[#20293a]" />
                    </div>
                  )}

                  <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-1.5 sm:gap-3">
                    {section.entries.map(({ item, sourceLabel, fromVault, equippedElsewhere }) => {
                      const tierInfo = getTierInfo(item.tierTypeName);
                      const isTransferring = actionLoading === item.itemInstanceId;
                      const dimmed = equippedElsewhere || isFull || (!!actionLoading && !isTransferring);

                      return (
                        <div key={item.itemInstanceId || `${item.itemHash}-${sourceLabel}`} className="flex flex-col min-w-0 group">
                          <LongPressable
                            as="div"
                            onClick={() => handleTileTap({ item, sourceLabel, equippedElsewhere })}
                            onLongPress={() => onInspect?.(item)}
                            title={`${item.name}${item.power ? ` • ✧ ${item.power}` : ''} — tap to bring over, hold to inspect`}
                            className={`relative w-full aspect-square rounded-2xl overflow-hidden border-2 shadow-md transition-transform duration-150 ${
                              item.isMasterwork
                                ? 'border-yellow-400 ring-2 ring-yellow-400/40'
                                : (tierInfo.border || 'border-slate-700')
                            } ${
                              dimmed
                                ? 'opacity-45'
                                : 'hover:border-amber-400 hover:scale-[1.04] active:scale-95'
                            }`}
                          >
                            <ItemIcon item={item} />

                            {/* Element, top left */}
                            {item.damageType && (
                              <div className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/85 border border-white/10 z-10">
                                <DamageIcon type={item.damageType} className="w-3 h-3" />
                              </div>
                            )}

                            {/* Artifice, top right */}
                            {item.isArtifice && (
                              <div className="absolute top-1.5 right-1.5 px-1 py-0.5 rounded bg-indigo-600 text-[8px] font-bold text-white font-mono leading-none z-10">
                                A
                              </div>
                            )}

                            {/* Locked, bottom left. Where it lives is written under
                                the tile, which has room for the word at any size. */}
                            {equippedElsewhere && (
                              <span className="absolute bottom-1.5 left-1.5 p-1 rounded-md bg-black/90 border border-white/15 z-10">
                                <Lock className="w-2.5 h-2.5 text-slate-300" />
                              </span>
                            )}

                            {/* Power, bottom right */}
                            {item.power && (
                              <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/90 text-amber-300 border border-amber-500/20 text-[9px] font-mono font-bold leading-none z-10">
                                {item.power}
                              </span>
                            )}

                            {isTransferring && (
                              <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center gap-1 z-20">
                                <RefreshCw className="w-5 h-5 text-amber-400 animate-spin" />
                                <span className="text-[8px] font-mono text-amber-300 font-bold">MOVING</span>
                              </div>
                            )}

                            {!dimmed && !isTransferring && (
                              <div className="absolute inset-0 bg-amber-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-10">
                                <ArrowRightLeft className="w-5 h-5 text-white drop-shadow-md" />
                              </div>
                            )}
                          </LongPressable>

                          <div className="w-full mt-1 px-0.5 min-w-0 text-center">
                            <span
                              className="block text-[10px] sm:text-[11px] font-bold text-slate-200 truncate group-hover:text-amber-300 font-heading"
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            <span className={`block text-[9px] font-mono truncate ${
                              fromVault ? 'text-slate-400' : 'text-indigo-300'
                            }`}>
                              {sourceLabel}
                              {isArmorSlot && item.armorStats?.total ? ` · ${item.armorStats.total}` : ''}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sheet-safe-bottom px-4 py-3 bg-[#0b0e14] border-t border-[#20293a] flex items-center justify-between gap-3 flex-shrink-0">
          <span className="text-[11px] font-mono truncate text-amber-300">
            {note}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors flex-shrink-0"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
