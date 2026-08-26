import React, { useState, useMemo, useEffect } from 'react';
import { Zap, Check, RotateCcw, AlertCircle, Lock, Unlock, Ban, X } from 'lucide-react';
import { getTierInfo } from '../utils/destiny-helpers';
import { useDeepArmorSearch } from '../utils/useDeepArmorSearch';
import {
  STAT_KEYS,
  STAT_META,
  STAT_MAX,
  STAT_TIER_SIZE,
  OVERCHARGE_THRESHOLD,
  MINOR_MOD_VALUE,
  MASTERWORK_BONUS_PER_PIECE,
  ARMOR_SLOTS,
  normaliseStats,
  buildComboIndex,
  setKey,
  chooseSlotCaps,
  COMBO_BUDGET,
  pieceKey,
  computeStatRanges,
  rankBuilds,
  clampStat
} from '../utils/armor-stats';
import { SLOT_LABELS, armorSlotKey } from '../utils/destiny-buckets';

export default function ArmourOptimizer({
  activeChar,
  vault = [],
  onEquipItem,
  onSelectArmor
}) {
  const [targetStats, setTargetStats] = useState({
    weapons: 30,
    health: 100,
    classAbility: 80,
    grenade: 100,
    superAbility: 50,
    melee: 30
  });

  const [assumeMasterwork, setAssumeMasterwork] = useState(true);
  const [assumeArtifice, setAssumeArtifice] = useState(false);
  const [selectedExoticHash, setSelectedExoticHash] = useState('any');
  // Armour set bonuses are earned by wearing 2 or 4 pieces of the same set.
  // Five slots means two 2-piece bonuses fit together; a 4-piece does not
  // leave room for a second set.
  const [selectedSetKey, setSelectedSetKey] = useState('any');
  const [requiredSetCount, setRequiredSetCount] = useState(2);
  const [secondSetKey, setSecondSetKey] = useState('any');
  // Instance keys the player pinned into every build, or vetoed entirely.
  const [lockedPieces, setLockedPieces] = useState([]);
  const [excludedPieces, setExcludedPieces] = useState([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildingStatus, setBuildingStatus] = useState(null);

  const presets = [
    { name: 'Grenade Spam', stats: { weapons: 20, health: 100, classAbility: 60, grenade: 150, superAbility: 40, melee: 20 } },
    { name: 'Tank', stats: { weapons: 20, health: 200, classAbility: 100, grenade: 40, superAbility: 40, melee: 20 } },
    { name: 'Super Focus', stats: { weapons: 30, health: 100, classAbility: 60, grenade: 40, superAbility: 150, melee: 30 } },
    { name: 'Weapon Damage', stats: { weapons: 150, health: 100, classAbility: 50, grenade: 40, superAbility: 40, melee: 20 } },
    { name: 'Melee Brawler', stats: { weapons: 30, health: 120, classAbility: 60, grenade: 30, superAbility: 40, melee: 150 } },
    { name: 'Balanced', stats: { weapons: 70, health: 100, classAbility: 70, grenade: 70, superAbility: 70, melee: 70 } }
  ];

  /** Every armour piece this Guardian could actually wear, from all three locations. */
  const armorPools = useMemo(() => {
    const pools = Object.fromEntries(ARMOR_SLOTS.map(s => [s, []]));
    if (!activeChar) return pools;

    const push = (item, location) => {
      if (!item.isArmor) return;
      const slot = armorSlotKey(item);
      if (!slot) return;
      pools[slot].push({ ...item, location, slotType: slot, stats: normaliseStats(item.armorStats || item.statsList) });
    };

    (activeChar.equipped || []).forEach(it => push(it, 'equipped'));
    (activeChar.bag || []).forEach(it => push(it, 'bag'));
    (vault || []).forEach(it => {
      // Vault holds every class's armour; only this Guardian's is usable.
      if (it.classType && it.classType !== activeChar.classType) return;
      push(it, 'vault');
    });

    return pools;
  }, [activeChar, vault]);

  /**
   * Source filters match on the fields the live profile pipeline actually
   * populates (source category, source string and item name) rather than on
   * set metadata that only exists for the bundled manifest entries.
   * Exotics are always kept -- they are never part of a set.
   */
  /**
   * Every set the player could actually wear a bonus from, with the pieces
   * that back it. A set only appears once it could reach its smaller bonus.
   */
  const availableSets = useMemo(() => {
    const sets = new Map();
    ARMOR_SLOTS.forEach(slot => armorPools[slot].forEach(piece => {
      const key = setKey(piece);
      if (!key) return;
      if (!sets.has(key)) {
        sets.set(key, { key, name: piece.setName || 'Unnamed set', bonuses: piece.setBonuses || [], slots: new Set(), pieces: 0 });
      }
      const entry = sets.get(key);
      entry.pieces++;
      entry.slots.add(slot);
      if (!entry.bonuses.length && piece.setBonuses?.length) entry.bonuses = piece.setBonuses;
    }));

    return Array.from(sets.values())
      // A bonus needs distinct slots, not just copies of one piece.
      .filter(entry => entry.slots.size >= 2)
      .sort((a, b) => b.slots.size - a.slots.size || a.name.localeCompare(b.name));
  }, [armorPools]);

  const activeSet = availableSets.find(entry => entry.key === selectedSetKey) || null;

  // A second bonus only fits behind a 2-piece first one, and never the same set.
  const secondSetAllowed = !!activeSet && requiredSetCount === 2;
  const secondSetChoices = secondSetAllowed
    ? availableSets.filter(entry => entry.key !== activeSet.key)
    : [];
  const secondSet = secondSetAllowed
    ? secondSetChoices.find(entry => entry.key === secondSetKey) || null
    : null;

  const requiredSets = useMemo(() => {
    const list = [];
    if (activeSet) list.push({ key: activeSet.key, count: requiredSetCount });
    if (secondSet) list.push({ key: secondSet.key, count: 2 });
    return list;
  }, [activeSet, requiredSetCount, secondSet]);

  // Drop a stale second pick rather than silently ignoring it.
  useEffect(() => {
    if (secondSetKey !== 'any' && !secondSetAllowed) setSecondSetKey('any');
  }, [secondSetAllowed, secondSetKey]);

  // The pool itself is never narrowed for a set: a set bonus is a constraint on
  // the finished build, and the other slots stay free to roll whatever suits.
  const filteredPools = armorPools;

  const totalPieces = useMemo(
    () => ARMOR_SLOTS.reduce((acc, s) => acc + filteredPools[s].length, 0),
    [filteredPools]
  );

  const availableExotics = useMemo(() => {
    const map = new Map();
    ARMOR_SLOTS.forEach(slot => filteredPools[slot].forEach(it => {
      if (it.tierTypeName === 'Exotic') {
        const h = String(it.itemHash ?? it.id);
        if (!map.has(h)) map.set(h, it);
      }
    }));
    return Array.from(map.values());
  }, [filteredPools]);

  /**
   * The combination index only depends on what armour exists and which exotic
   * is pinned, so it survives every target tweak. That is what keeps the
   * ranges below responsive while sliders move.
   */
  const indexOptions = useMemo(
    () => ({
      exoticHash: selectedExoticHash,
      lockedPieces,
      excludedPieces,
      requiredSets
    }),
    [selectedExoticHash, lockedPieces, excludedPieces, requiredSets]
  );

  const comboIndex = useMemo(
    () => buildComboIndex(filteredPools, {
      ...indexOptions,
      slotCaps: chooseSlotCaps(filteredPools, COMBO_BUDGET.INSTANT),
      maxCombos: COMBO_BUDGET.INSTANT
    }),
    [filteredPools, indexOptions]
  );

  const modOptions = useMemo(
    () => ({ assumeMasterwork, assumeArtifice }),
    [assumeMasterwork, assumeArtifice]
  );

  /**
   * For each stat: the lowest and highest value still reachable while the
   * other five targets hold. Recomputed on every edit.
   */
  const instant = useMemo(
    () => computeStatRanges(comboIndex, targetStats, modOptions),
    [comboIndex, targetStats, modOptions]
  );

  const instantBuilds = useMemo(
    () => rankBuilds(comboIndex, targetStats, modOptions, 10),
    [comboIndex, targetStats, modOptions]
  );

  /**
   * A far larger search runs in a worker against the same pools. Until it
   * answers -- and whenever the player moves a target faster than it can keep
   * up -- the instant answer above is what is on screen.
   */
  const deep = useDeepArmorSearch({
    pools: filteredPools,
    indexOptions,
    targets: targetStats,
    modOptions
  });

  const { ranges, anyFeasible } = deep.result || instant;
  const builds = deep.result ? deep.result.builds : instantBuilds;
  const searchDepth = deep.result ? 'deep' : 'instant';

  const rangeByKey = useMemo(
    () => Object.fromEntries(ranges.map(r => [r.key, r])),
    [ranges]
  );

  const togglePiece = (setter, other, key) => {
    // A piece cannot be locked and excluded at once, so setting one clears the
    // other.
    other(list => list.filter(k => k !== key));
    setter(list => (list.includes(key) ? list.filter(k => k !== key) : [...list, key]));
  };

  const toggleLock = (piece) => togglePiece(setLockedPieces, setExcludedPieces, pieceKey(piece));
  const toggleExclude = (piece) => togglePiece(setExcludedPieces, setLockedPieces, pieceKey(piece));

  // Pinned and vetoed pieces have to be visible somewhere: an excluded piece
  // simply stops appearing, and without a list there would be no way to undo it.
  const piecesByKey = useMemo(() => {
    const map = new Map();
    ARMOR_SLOTS.forEach(slot => armorPools[slot].forEach(p => map.set(pieceKey(p), p)));
    return map;
  }, [armorPools]);

  const pinnedSummary = [
    ...lockedPieces.map(k => ({ key: k, kind: 'lock', piece: piecesByKey.get(k) })),
    ...excludedPieces.map(k => ({ key: k, kind: 'exclude', piece: piecesByKey.get(k) }))
  ];

  // Report on whichever search the numbers on screen actually came from.
  const activeCoverage = (deep.result && deep.coverage) ? deep.coverage : comboIndex;
  const searchedPieces = (activeCoverage.coverage || []).reduce((acc, c) => acc + c.considered, 0);
  const availablePieces = (activeCoverage.coverage || []).reduce((acc, c) => acc + c.available, 0);
  const searchTruncated = !!activeCoverage.truncated;

  const unreachable = ranges.filter(r => !r.targetReachable && r.target > 0);

  const setStat = (key, value) => {
    setTargetStats(prev => ({ ...prev, [key]: clampStat(value) }));
  };

  const handleStatChange = (key, delta) => {
    setTargetStats(prev => ({ ...prev, [key]: clampStat((prev[key] || 0) + delta) }));
  };

  /** Snap a stat to the best value its current range allows. */
  const maximiseStat = (key) => {
    const range = rangeByKey[key];
    if (range) setStat(key, range.max);
  };

  const resetTargets = () => {
    setLockedPieces([]);
    setExcludedPieces([]);
    setTargetStats({ weapons: 0, health: 0, classAbility: 0, grenade: 0, superAbility: 0, melee: 0 });
  };

  const handleEquipBuild = async (build) => {
    if (!build || isBuilding) return;
    setIsBuilding(true);

    try {
      for (const piece of build.pieces) {
        if (!piece.itemInstanceId) continue;
        if (piece.location === 'equipped') continue;

        // Equipping owns the vault pull as well: a piece can only reach a slot
        // through the character's inventory, and doing that here too would race
        // the equip's own view of where the piece is.
        setBuildingStatus(piece.location === 'vault'
          ? `Pulling ${piece.name} from the vault...`
          : `Equipping ${piece.name}...`);

        const equipped = await onEquipItem?.(piece.itemInstanceId);
        if (equipped === false) throw new Error(`Could not equip ${piece.name}`);
      }
      setBuildingStatus('Build equipped.');
    } catch (err) {
      setBuildingStatus(err.message || 'Could not finish equipping this build');
    } finally {
      setIsBuilding(false);
      setTimeout(() => setBuildingStatus(null), 4000);
    }
  };

  if (!activeChar) {
    return (
      <div className="p-8 rounded-2xl bg-[#121722] border border-[#1e2638] text-center">
        <p className="text-sm text-slate-400">Sign in and pick a Guardian to use the optimizer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn">

      {/* Header & assumptions */}
      <div className="bg-[#121722] border border-[#1e2638] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white font-heading tracking-wide">
              Armour Stat Optimizer
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {totalPieces} pieces available for {activeChar.classType}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-[#0b0e14] px-2.5 py-1 rounded-lg border border-[#1e2638] cursor-pointer hover:border-slate-600">
              <input
                type="checkbox"
                checked={assumeMasterwork}
                onChange={(e) => setAssumeMasterwork(e.target.checked)}
                className="accent-amber-500 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span>Assume masterworked (+{MASTERWORK_BONUS_PER_PIECE}/stat per piece)</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-[#0b0e14] px-2.5 py-1 rounded-lg border border-[#1e2638] cursor-pointer hover:border-slate-600">
              <input
                type="checkbox"
                checked={assumeArtifice}
                onChange={(e) => setAssumeArtifice(e.target.checked)}
                className="accent-amber-500 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span>Assume artifice</span>
            </label>

            <button
              onClick={resetTargets}
              className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-[#0b0e14] px-2.5 py-1 rounded-lg border border-[#1e2638] hover:border-slate-600"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 font-mono leading-relaxed border-t border-[#1e2638] pt-2">
          Ranges below show what each stat can still reach with your armour once the other five targets are met.
          Mods are assumed, not chosen: five general slots (+10 major / +{MINOR_MOD_VALUE} minor, one per piece) plus +3 per artifice slot.
          Fragments and armour set perks stack on top of these numbers.
          {' '}
          {searchTruncated ? (
            <>
              Searching {searchedPieces} of your {availablePieces} pieces
              {searchDepth === 'instant' && deep.available ? ' while a deeper pass runs' : ''}.
              Every stat's highest and lowest roll is always included, so the range ends are
              exact; an awkward mid-range combination can be missed.
            </>
          ) : (
            <>Searching all {availablePieces} of your pieces.</>
          )}
        </p>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-[#1e2638]">
          <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap mr-1">Presets:</span>
          {presets.map((pr, idx) => (
            <button
              key={idx}
              onClick={() => setTargetStats(pr.stats)}
              className="px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-slate-800 border border-[#1e2638] hover:border-amber-500/40 text-slate-300 hover:text-white text-xs font-mono whitespace-nowrap transition-colors"
            >
              {pr.name}
            </button>
          ))}
        </div>
      </div>

      {/* Live stat targeting with achievable ranges */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {STAT_META.map(meta => {
          const range = rangeByKey[meta.key] || { min: 0, max: 0, target: 0, targetReachable: false };
          const target = targetStats[meta.key] || 0;
          const reachable = range.targetReachable;
          const span = Math.max(1, range.max - range.min);

          return (
            <div
              key={meta.key}
              className={`p-3 rounded-xl bg-[#121722] border space-y-2 ${
                reachable ? 'border-[#1e2638]' : 'border-red-500/40'
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-bold text-slate-200 font-heading tracking-wide">{meta.label}</span>
                  <span className="text-[10px] font-mono text-slate-500">{meta.short}</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className={`text-lg font-bold font-heading tabular-nums ${
                    !reachable ? 'text-red-400' : target >= OVERCHARGE_THRESHOLD ? 'text-amber-400' : 'text-white'
                  }`}>
                    {target}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">T{Math.floor(target / STAT_TIER_SIZE)}</span>
                </div>
              </div>

              {/* Achievable band: the shaded region is what this stat can still reach. */}
              <div className="relative h-6">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-[#0b0e14] border border-[#1e2638]" />
                <div
                  className={`absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full ${reachable ? 'bg-amber-500/40' : 'bg-red-500/30'}`}
                  style={{
                    left: `${(range.min / STAT_MAX) * 100}%`,
                    width: `${Math.max(0, (range.max - range.min) / STAT_MAX) * 100}%`
                  }}
                />
                {/* Overcharge threshold marker */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-3 w-px bg-slate-600"
                  style={{ left: `${(OVERCHARGE_THRESHOLD / STAT_MAX) * 100}%` }}
                  title={`Overcharge threshold (${OVERCHARGE_THRESHOLD})`}
                />
                <input
                  type="range"
                  min={0}
                  max={STAT_MAX}
                  step={MINOR_MOD_VALUE}
                  value={target}
                  onChange={(e) => setStat(meta.key, Number(e.target.value))}
                  aria-label={`${meta.label} target`}
                  className="absolute inset-0 w-full h-full appearance-none bg-transparent cursor-pointer accent-amber-500"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleStatChange(meta.key, -STAT_TIER_SIZE)}
                    disabled={target <= 0}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs disabled:opacity-30"
                    aria-label={`Lower ${meta.label}`}
                  >
                    −
                  </button>
                  <button
                    onClick={() => handleStatChange(meta.key, STAT_TIER_SIZE)}
                    disabled={target >= STAT_MAX}
                    className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs disabled:opacity-30"
                    aria-label={`Raise ${meta.label}`}
                  >
                    +
                  </button>
                  <button
                    onClick={() => maximiseStat(meta.key)}
                    disabled={!anyFeasible || target === range.max}
                    className="px-1.5 h-6 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-slate-300 disabled:opacity-30"
                    title="Set to the highest value still possible"
                  >
                    Max
                  </button>
                </div>

                <div className="text-[10px] font-mono text-right">
                  {anyFeasible ? (
                    <span className="text-slate-400">
                      possible <span className="text-slate-200 font-bold tabular-nums">{range.min}</span>
                      <span className="text-slate-600"> – </span>
                      <span className="text-slate-200 font-bold tabular-nums">{range.max}</span>
                    </span>
                  ) : (
                    <span className="text-red-400">no set fits these targets</span>
                  )}
                </div>
              </div>

              {!reachable && anyFeasible && (
                <p className="text-[10px] font-mono text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  {target > range.max
                    ? `Out of reach — cap is ${range.max} with the other targets set.`
                    : `Your armour floor here is ${range.min}.`}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Pool constraints */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#121722] border border-[#1e2638] rounded-2xl p-3">
        <div className="space-y-1">
          <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
            {selectedExoticHash === 'any' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            Exotic
          </label>
          <select
            value={selectedExoticHash}
            onChange={(e) => setSelectedExoticHash(e.target.value)}
            className="w-full bg-[#0b0e14] border border-[#1e2638] rounded-xl p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
          >
            <option value="any">Any exotic</option>
            <option value="none">No exotic (legendaries only)</option>
            {availableExotics.map(ex => (
              <option key={String(ex.itemHash ?? ex.id)} value={String(ex.itemHash ?? ex.id)}>
                {ex.name} — {SLOT_LABELS[ex.slotType] || ex.slotType}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-mono text-slate-400 block">Set bonus</label>
          <div className="flex items-center gap-1.5">
            <select
              value={selectedSetKey}
              onChange={(e) => setSelectedSetKey(e.target.value)}
              className="flex-1 min-w-0 bg-[#0b0e14] border border-[#1e2638] rounded-xl p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
            >
              <option value="any">No set bonus</option>
              {availableSets.map(entry => (
                <option key={entry.key} value={entry.key}>
                  {entry.name} ({entry.slots.size} slots)
                </option>
              ))}
            </select>

            {/* 4-piece is only offered once four different slots can supply it. */}
            <div className="flex items-center bg-[#0b0e14] border border-[#1e2638] rounded-xl p-0.5 flex-shrink-0">
              {[2, 4].map(count => {
                const possible = !activeSet || activeSet.slots.size >= count;
                return (
                  <button
                    key={count}
                    onClick={() => setRequiredSetCount(count)}
                    disabled={!activeSet || !possible}
                    title={possible ? `Require ${count} pieces` : `You only have ${activeSet.slots.size} slots of this set`}
                    className={`px-2 py-1 rounded-lg text-xs font-mono transition-colors ${
                      activeSet && requiredSetCount === count
                        ? 'bg-amber-500 text-black font-bold'
                        : 'text-slate-400 hover:text-slate-200 disabled:opacity-30'
                    }`}
                  >
                    {count}pc
                  </button>
                );
              })}
            </div>
          </div>

          {/* A 2-piece leaves three slots free, so a second 2-piece bonus fits
              alongside it. A 4-piece does not. */}
          {secondSetAllowed && (
            <select
              value={secondSetKey}
              onChange={(e) => setSecondSetKey(e.target.value)}
              className="w-full bg-[#0b0e14] border border-[#1e2638] rounded-xl p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
            >
              <option value="any">+ add a second 2pc bonus</option>
              {secondSetChoices.map(entry => (
                <option key={entry.key} value={entry.key}>
                  {entry.name} ({entry.slots.size} slots)
                </option>
              ))}
            </select>
          )}

          {[
            activeSet ? { set: activeSet, count: requiredSetCount } : null,
            secondSet ? { set: secondSet, count: 2 } : null
          ].filter(Boolean).map(({ set, count }) => (
            <ul key={set.key} className="space-y-0.5 pt-0.5">
              <li className="text-[10px] font-mono text-slate-400 font-bold">{set.name}</li>
              {set.bonuses.length === 0 ? (
                <li className="text-[10px] font-mono text-slate-500">
                  Wearing {count} pieces. Bonus details need a manifest sync.
                </li>
              ) : set.bonuses.map(bonus => (
                <li
                  key={bonus.count}
                  className={`text-[10px] font-mono leading-snug pl-2 ${
                    count >= bonus.count ? 'text-amber-300' : 'text-slate-500'
                  }`}
                >
                  <span className="font-bold">{bonus.count}pc</span> {bonus.name}
                  {bonus.description ? ` — ${bonus.description}` : ''}
                </li>
              ))}
            </ul>
          ))}

          {requiredSets.length > 0 && (
            <p className="text-[10px] font-mono text-slate-500">
              {requiredSets.reduce((acc, r) => acc + r.count, 0)} of 5 slots committed
              {requiredSets.reduce((acc, r) => acc + r.count, 0) < ARMOR_SLOTS.length
                ? `, ${ARMOR_SLOTS.length - requiredSets.reduce((acc, r) => acc + r.count, 0)} free for stats`
                : ''}
            </p>
          )}

          {availableSets.length === 0 && (
            <p className="text-[10px] font-mono text-slate-500">
              No set bonuses found in your armour.
            </p>
          )}
        </div>
      </div>

      {unreachable.length > 0 && anyFeasible && (
        <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/30 text-xs font-mono text-red-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            {unreachable.map(r => STAT_META.find(m => m.key === r.key)?.label).join(', ')}
            {unreachable.length === 1 ? ' is' : ' are'} out of reach together. Builds below are the closest your armour gets.
          </span>
        </div>
      )}

      {buildingStatus && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium flex items-center gap-2">
          <Zap className={`w-4 h-4 text-amber-400 ${isBuilding ? 'animate-pulse' : ''}`} />
          <span>{buildingStatus}</span>
        </div>
      )}

      {pinnedSummary.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-[#121722] border border-[#1e2638] rounded-2xl p-3">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Pinned:</span>
          {pinnedSummary.map(({ key, kind, piece }) => (
            <span
              key={`${kind}:${key}`}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${
                kind === 'lock'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                  : 'bg-rose-500/15 border-rose-500/40 text-rose-200'
              }`}
            >
              {kind === 'lock' ? <Lock className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
              <span className="truncate max-w-[160px]">{piece?.name || 'Unknown piece'}</span>
              <button
                onClick={() => (kind === 'lock'
                  ? setLockedPieces(list => list.filter(k => k !== key))
                  : setExcludedPieces(list => list.filter(k => k !== key)))}
                className="hover:text-white"
                aria-label={`Remove ${piece?.name || 'piece'}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
          <button
            onClick={() => { setLockedPieces([]); setExcludedPieces([]); }}
            className="text-xs text-slate-500 hover:text-slate-300 underline font-mono ml-1"
          >
            Clear
          </button>
        </div>
      )}

      {/* Results */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-heading px-1">
          Builds ({builds.length})
        </h3>

        {builds.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#121722] border border-[#1e2638] text-center space-y-1.5">
            <AlertCircle className="w-6 h-6 text-slate-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-300 font-heading">Not enough armour</h4>
            <p className="text-xs text-slate-500">
              The optimizer needs at least one piece in every slot.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {builds.map((build, bIdx) => (
              <div
                key={bIdx}
                className={`bg-[#121722] border rounded-2xl p-3.5 space-y-3 ${
                  build.meetsTargets ? 'border-amber-500/40' : 'border-[#1e2638]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#1e2638] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-black font-heading font-bold text-xs tracking-wider tabular-nums">
                      {build.totalStatPoints}
                    </span>
                    {build.meetsTargets ? (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Targets met
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-mono">
                        {build.shortfall} short
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-wrap text-[10px] font-mono">
                    {STAT_META.map(meta => {
                      const value = build.stats[meta.key];
                      const hitTarget = value >= (targetStats[meta.key] || 0);
                      return (
                        <span
                          key={meta.key}
                          title={`${meta.label} ${value} (target ${targetStats[meta.key] || 0})`}
                          className={`px-1.5 py-0.5 rounded border tabular-nums ${
                            value >= OVERCHARGE_THRESHOLD
                              ? 'text-amber-400 font-bold border-amber-500/30 bg-amber-500/5'
                              : hitTarget
                                ? 'text-slate-300 border-slate-800 bg-[#0b0e14]'
                                : 'text-red-400 border-red-500/30 bg-red-500/5'
                          }`}
                        >
                          {meta.short} {value}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {build.pieces.map((piece, pIdx) => {
                    const tier = getTierInfo(piece.tierTypeName);
                    const isLocked = lockedPieces.includes(pieceKey(piece));
                    return (
                      <div
                        key={pIdx}
                        className={`p-1.5 rounded-xl bg-[#0b0e14] border transition-all space-y-1 group ${
                          isLocked ? 'border-amber-400' : tier.border
                        }`}
                        title={`${piece.name} (${piece.location})`}
                      >
                        <div
                          onClick={() => onSelectArmor?.(piece)}
                          className="relative w-full aspect-square rounded-lg bg-black/60 border border-white/10 overflow-hidden cursor-pointer"
                        >
                          {piece.icon && (
                            <img src={piece.icon} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          )}
                          {piece.isArtifice && (
                            <div className="absolute top-0 right-0 w-3 h-3 bg-indigo-500 rounded-bl text-[7px] flex items-center justify-center font-bold text-white" title="Artifice">
                              A
                            </div>
                          )}
                          {piece.location === 'vault' && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[7px] text-slate-300 text-center font-mono">
                              VAULT
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-white truncate font-heading text-center">
                          {piece.name}
                        </div>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => toggleLock(piece)}
                            title={isLocked ? 'Unpin this piece' : 'Keep this piece in every build'}
                            aria-pressed={isLocked}
                            className={`px-1 py-0.5 rounded ${
                              isLocked ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            <Lock className="w-2.5 h-2.5" />
                          </button>
                          <button
                            onClick={() => toggleExclude(piece)}
                            title="Never use this piece"
                            className="px-1 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-rose-400"
                          >
                            <Ban className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                  <div className="flex items-center gap-1 flex-wrap">
                    {build.mods.length === 0 ? (
                      <span className="text-[10px] font-mono text-slate-500">No mods needed</span>
                    ) : build.mods.map((mod, mIdx) => (
                      <span
                        key={mIdx}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          mod.kind === 'artifice'
                            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300'
                            : 'bg-[#0b0e14] border-slate-800 text-slate-300'
                        }`}
                      >
                        {mod.label}
                      </span>
                    ))}
                  </div>

                  <button
                    disabled={isBuilding}
                    onClick={() => handleEquipBuild(build)}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold font-heading text-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Equip build</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
