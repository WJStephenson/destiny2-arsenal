import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  Sparkles, 
  Zap, 
  Sliders, 
  Check, 
  Layers, 
  Cpu, 
  RotateCcw,
  Box,
  ChevronRight,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { getTierInfo } from '../utils/destiny-helpers';
import LongPressable from './LongPressable';

export default function ArmourOptimizer({
  activeChar,
  vault = [],
  onEquipItem,
  onTransferItem,
  onOpenInfo,
  onSelectArmor
}) {
  // Target Stat Points (0 to 200 Scale)
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
  const [selectedSetFilter, setSelectedSetFilter] = useState('any');
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildingStatus, setBuildingStatus] = useState(null);

  // 6 Frontiers Stats
  const statMeta = [
    { key: 'weapons', label: 'Weapons', short: 'WEAP' },
    { key: 'health', label: 'Health', short: 'HLTH' },
    { key: 'classAbility', label: 'Class', short: 'CLAS' },
    { key: 'grenade', label: 'Grenade', short: 'GREN' },
    { key: 'superAbility', label: 'Super', short: 'SUPR' },
    { key: 'melee', label: 'Melee', short: 'MELE' }
  ];

  // Presets
  const presets = [
    {
      name: 'Double Grenade & Health',
      stats: { weapons: 30, health: 100, classAbility: 60, grenade: 120, superAbility: 80, melee: 20 }
    },
    {
      name: 'Double Melee & Brawler',
      stats: { weapons: 20, health: 100, classAbility: 80, grenade: 30, superAbility: 40, melee: 120 }
    },
    {
      name: 'Super & Weapons Gunner',
      stats: { weapons: 100, health: 80, classAbility: 40, grenade: 80, superAbility: 110, melee: 30 }
    },
    {
      name: 'Max Health Tank',
      stats: { weapons: 60, health: 120, classAbility: 100, grenade: 50, superAbility: 40, melee: 20 }
    }
  ];

  const getArmorSlotName = (item) => {
    if (item.bucketHash === 3448274439 || item.armorSlot?.toLowerCase().includes('helmet') || item.slot?.toLowerCase().includes('helmet')) return 'helmet';
    if (item.bucketHash === 3551901077 || item.armorSlot?.toLowerCase().includes('gauntlet') || item.slot?.toLowerCase().includes('gauntlet') || item.itemTypeDisplayName?.toLowerCase().includes('gauntlet') || item.itemTypeDisplayName?.toLowerCase().includes('arms')) return 'gauntlets';
    if (item.bucketHash === 1423949262 || item.armorSlot?.toLowerCase().includes('chest') || item.slot?.toLowerCase().includes('chest') || item.itemTypeDisplayName?.toLowerCase().includes('chest')) return 'chest';
    if (item.bucketHash === 20886954 || item.armorSlot?.toLowerCase().includes('leg') || item.slot?.toLowerCase().includes('leg') || item.itemTypeDisplayName?.toLowerCase().includes('leg')) return 'legs';
    if (item.bucketHash === 1585787867 || item.armorSlot?.toLowerCase().includes('class') || item.slot?.toLowerCase().includes('class') || item.itemTypeDisplayName?.toLowerCase().includes('class') || item.itemTypeDisplayName?.toLowerCase().includes('mark') || item.itemTypeDisplayName?.toLowerCase().includes('cloak') || item.itemTypeDisplayName?.toLowerCase().includes('bond')) return 'classItem';
    return null;
  };

  const getItemStats = (item) => {
    if (item.armorStats && typeof item.armorStats === 'object') {
      return {
        weapons: item.armorStats.weapons ?? item.armorStats.mobility ?? 0,
        health: item.armorStats.health ?? item.armorStats.resilience ?? 0,
        classAbility: item.armorStats.classAbility ?? item.armorStats.recovery ?? 0,
        grenade: item.armorStats.grenade ?? item.armorStats.discipline ?? 0,
        superAbility: item.armorStats.superAbility ?? item.armorStats.intellect ?? 0,
        melee: item.armorStats.melee ?? item.armorStats.strength ?? 0,
        total: item.armorStats.total || 0
      };
    }
    let weap = 0, hlth = 0, clas = 0, gren = 0, supr = 0, mele = 0;
    if (item.statsList) {
      item.statsList.forEach(s => {
        const n = s.name?.toLowerCase() || '';
        if (n.includes('weapon') || n.includes('mobility')) weap = s.value;
        else if (n.includes('health') || n.includes('resilience')) hlth = s.value;
        else if (n.includes('class') || n.includes('recovery')) clas = s.value;
        else if (n.includes('grenade') || n.includes('discipline')) gren = s.value;
        else if (n.includes('super') || n.includes('intellect')) supr = s.value;
        else if (n.includes('melee') || n.includes('strength')) mele = s.value;
      });
    }
    return {
      weapons: weap,
      health: hlth,
      classAbility: clas,
      grenade: gren,
      superAbility: supr,
      melee: mele,
      total: weap + hlth + clas + gren + supr + mele
    };
  };

  const allOwnedArmor = useMemo(() => {
    if (!activeChar) return [];
    const charClass = activeChar.classType;
    const items = [];

    (activeChar.equipped || []).forEach(it => {
      if (it.isArmor) {
        const slot = getArmorSlotName(it);
        if (slot) items.push({ ...it, location: 'equipped', slotType: slot, stats: getItemStats(it) });
      }
    });

    (activeChar.bag || []).forEach(it => {
      if (it.isArmor) {
        const slot = getArmorSlotName(it);
        if (slot) items.push({ ...it, location: 'bag', slotType: slot, stats: getItemStats(it) });
      }
    });

    (vault || []).forEach(it => {
      if (it.isArmor) {
        const itemClass = it.classType || (it.itemTypeDisplayName?.includes('Titan') ? 'Titan' : it.itemTypeDisplayName?.includes('Hunter') ? 'Hunter' : it.itemTypeDisplayName?.includes('Warlock') ? 'Warlock' : null);
        if (!itemClass || itemClass === charClass) {
          const slot = getArmorSlotName(it);
          if (slot) items.push({ ...it, location: 'vault', slotType: slot, stats: getItemStats(it) });
        }
      }
    });

    return items;
  }, [activeChar, vault]);

  const availableExotics = useMemo(() => {
    const map = new Map();
    allOwnedArmor.forEach(it => {
      if (it.tierTypeName === 'Exotic') {
        const h = it.itemHash || it.id;
        if (!map.has(h)) map.set(h, it);
      }
    });
    return Array.from(map.values());
  }, [allOwnedArmor]);

  // Optimization calculation
  const calculatedBuilds = useMemo(() => {
    if (allOwnedArmor.length === 0) return [];

    let filteredPool = allOwnedArmor;
    if (selectedSetFilter === 'artifice') {
      filteredPool = allOwnedArmor.filter(it => it.isArtifice || it.tierTypeName === 'Exotic');
    } else if (selectedSetFilter === 'iron_banner') {
      filteredPool = allOwnedArmor.filter(it => it.setName?.includes('Iron') || it.name?.includes('Iron') || it.tierTypeName === 'Exotic');
    } else if (selectedSetFilter === 'raid') {
      filteredPool = allOwnedArmor.filter(it => it.setCategory === 'Raids & Dungeons' || it.tierTypeName === 'Exotic');
    } else if (selectedSetFilter === 'moments_of_triumph') {
      filteredPool = allOwnedArmor.filter(it => it.setName?.includes('Triumph') || it.tierTypeName === 'Exotic');
    }

    const helmets = filteredPool.filter(it => it.slotType === 'helmet');
    const arms = filteredPool.filter(it => it.slotType === 'gauntlets');
    const chests = filteredPool.filter(it => it.slotType === 'chest');
    const legs = filteredPool.filter(it => it.slotType === 'legs');
    const classItems = filteredPool.filter(it => it.slotType === 'classItem');

    const dummyClass = classItems.length > 0 ? classItems : [{
      name: `${activeChar?.classType || ''} Class Item`,
      tierTypeName: 'Legendary',
      slotType: 'classItem',
      stats: { weapons: 0, health: 0, classAbility: 0, grenade: 0, superAbility: 0, melee: 0, total: 0 }
    }];

    const results = [];
    const topH = helmets.slice(0, 12);
    const topA = arms.slice(0, 12);
    const topC = chests.slice(0, 12);
    const topL = legs.slice(0, 12);
    const topCI = dummyClass.slice(0, 3);

    const targetW = targetStats.weapons || 0;
    const targetH = targetStats.health || 0;
    const targetC = targetStats.classAbility || 0;
    const targetG = targetStats.grenade || 0;
    const targetS = targetStats.superAbility || 0;
    const targetM = targetStats.melee || 0;

    const mwBonus = assumeMasterwork ? 10 : 0;

    for (const h of topH) {
      for (const a of topA) {
        for (const c of topC) {
          for (const l of topL) {
            for (const ci of topCI) {
              const pieces = [h, a, c, l, ci];
              const exoticsCount = pieces.filter(it => it.tierTypeName === 'Exotic').length;
              if (exoticsCount > 1) continue;

              if (selectedExoticHash === 'none' && exoticsCount > 0) continue;
              if (selectedExoticHash !== 'any' && selectedExoticHash !== 'none') {
                const hasSelectedExotic = pieces.some(it => String(it.itemHash || it.id) === String(selectedExoticHash));
                if (!hasSelectedExotic) continue;
              }

              const rawW = h.stats.weapons + a.stats.weapons + c.stats.weapons + l.stats.weapons + ci.stats.weapons + mwBonus;
              const rawH = h.stats.health + a.stats.health + c.stats.health + l.stats.health + ci.stats.health + mwBonus;
              const rawC = h.stats.classAbility + a.stats.classAbility + c.stats.classAbility + l.stats.classAbility + ci.stats.classAbility + mwBonus;
              const rawG = h.stats.grenade + a.stats.grenade + c.stats.grenade + l.stats.grenade + ci.stats.grenade + mwBonus;
              const rawS = h.stats.superAbility + a.stats.superAbility + c.stats.superAbility + l.stats.superAbility + ci.stats.superAbility + mwBonus;
              const rawM = h.stats.melee + a.stats.melee + c.stats.melee + l.stats.melee + ci.stats.melee + mwBonus;

              const defW = Math.max(0, targetW - rawW);
              const defH = Math.max(0, targetH - rawH);
              const defC = Math.max(0, targetC - rawC);
              const defG = Math.max(0, targetG - rawG);
              const defS = Math.max(0, targetS - rawS);
              const defM = Math.max(0, targetM - rawM);

              const actualArtificeCount = pieces.filter(it => it.isArtifice).length;
              const totalArtificeSlots = assumeArtifice ? 5 : actualArtificeCount;

              const modsNeeded = [];
              let modsCount = 0;

              const addModsForStat = (deficit, statName, shortName) => {
                let remaining = deficit;
                while (remaining > 5 && modsCount < 5) {
                  modsNeeded.push({ stat: statName, short: shortName, value: 10, label: `+10 ${statName}` });
                  remaining -= 10;
                  modsCount++;
                }
                if (remaining > 0 && modsCount < 5) {
                  modsNeeded.push({ stat: statName, short: shortName, value: 5, label: `+5 ${statName}` });
                  remaining -= 5;
                  modsCount++;
                }
                return Math.max(0, remaining);
              };

              let remW = addModsForStat(defW, 'Weapons', 'WEAP');
              let remH = addModsForStat(defH, 'Health', 'HLTH');
              let remC = addModsForStat(defC, 'Class', 'CLAS');
              let remG = addModsForStat(defG, 'Grenade', 'GREN');
              let remS = addModsForStat(defS, 'Super', 'SUPR');
              let remM = addModsForStat(defM, 'Melee', 'MELE');

              let artificeAssigned = 0;
              const artificeMods = [];
              const applyArtifice = (deficit, statName, shortName) => {
                let rem = deficit;
                while (rem > 0 && artificeAssigned < totalArtificeSlots) {
                  artificeMods.push({ stat: statName, short: shortName, value: 3, label: `+3 ${statName}` });
                  rem = Math.max(0, rem - 3);
                  artificeAssigned++;
                }
                return rem;
              };

              remW = applyArtifice(remW, 'Weapons', 'WEAP');
              remH = applyArtifice(remH, 'Health', 'HLTH');
              remC = applyArtifice(remC, 'Class', 'CLAS');
              remG = applyArtifice(remG, 'Grenade', 'GREN');
              remS = applyArtifice(remS, 'Super', 'SUPR');
              remM = applyArtifice(remM, 'Melee', 'MELE');

              const allAssignedMods = [...modsNeeded, ...artificeMods];
              const modWBonus = allAssignedMods.filter(m => m.short === 'WEAP').reduce((acc, m) => acc + m.value, 0);
              const modHBonus = allAssignedMods.filter(m => m.short === 'HLTH').reduce((acc, m) => acc + m.value, 0);
              const modCBonus = allAssignedMods.filter(m => m.short === 'CLAS').reduce((acc, m) => acc + m.value, 0);
              const modGBonus = allAssignedMods.filter(m => m.short === 'GREN').reduce((acc, m) => acc + m.value, 0);
              const modSBonus = allAssignedMods.filter(m => m.short === 'SUPR').reduce((acc, m) => acc + m.value, 0);
              const modMBonus = allAssignedMods.filter(m => m.short === 'MELE').reduce((acc, m) => acc + m.value, 0);

              const finalW = rawW + modWBonus;
              const finalH = rawH + modHBonus;
              const finalC = rawC + modCBonus;
              const finalG = rawG + modGBonus;
              const finalS = rawS + modSBonus;
              const finalM = rawM + modMBonus;

              const totalStatPoints = finalW + finalH + finalC + finalG + finalS + finalM;

              const isPerfectMatch = remW === 0 && remH === 0 && remC === 0 && remG === 0 && remS === 0 && remM === 0 &&
                finalW >= targetW && finalH >= targetH && finalC >= targetC && finalG >= targetG && finalS >= targetS && finalM >= targetM;

              const overchargedCount = [finalW, finalH, finalC, finalG, finalS, finalM].filter(v => v >= 100).length;

              results.push({
                pieces,
                stats: {
                  weapons: finalW,
                  health: finalH,
                  classAbility: finalC,
                  grenade: finalG,
                  superAbility: finalS,
                  melee: finalM
                },
                totalStatPoints,
                overchargedCount,
                modsNeeded: allAssignedMods,
                isPerfectMatch
              });
            }
          }
        }
      }
    }

    results.sort((a, b) => {
      if (a.isPerfectMatch && !b.isPerfectMatch) return -1;
      if (!a.isPerfectMatch && b.isPerfectMatch) return 1;
      if (b.overchargedCount !== a.overchargedCount) return b.overchargedCount - a.overchargedCount;
      return b.totalStatPoints - a.totalStatPoints;
    });

    return results.slice(0, 10);
  }, [allOwnedArmor, targetStats, assumeMasterwork, assumeArtifice, selectedExoticHash, selectedSetFilter, activeChar]);

  const handleApplyPreset = (preset) => {
    setTargetStats(preset.stats);
  };

  const handleStatChange = (statKey, delta) => {
    setTargetStats(prev => {
      const current = prev[statKey] || 0;
      const next = Math.max(0, Math.min(200, current + delta));
      return { ...prev, [statKey]: next };
    });
  };

  const handleEquipBuild = async (build) => {
    if (!build || isBuilding) return;
    setIsBuilding(true);
    setBuildingStatus('Equipping build on Guardian...');

    try {
      for (const piece of build.pieces) {
        if (!piece.itemInstanceId) continue;
        if (piece.location === 'vault') {
          await onTransferItem?.(piece, false);
          await new Promise(r => setTimeout(r, 600));
        }
        await onEquipItem?.(piece.itemInstanceId);
        await new Promise(r => setTimeout(r, 400));
      }
      setBuildingStatus('Full Armour Build Equipped!');
    } catch (err) {
      setBuildingStatus('Error equipping build pieces');
    } finally {
      setIsBuilding(false);
      setTimeout(() => setBuildingStatus(null), 3000);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      
      {/* Clean Header & Options */}
      <div className="bg-[#121722] border border-[#1e2638] rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white font-heading tracking-wide">
              Armour Stat Optimizer
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              {allOwnedArmor.length} pieces scanned for {activeChar?.classType}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-[#0b0e14] px-2.5 py-1 rounded-lg border border-[#1e2638] cursor-pointer hover:border-slate-600">
              <input
                type="checkbox"
                checked={assumeMasterwork}
                onChange={(e) => setAssumeMasterwork(e.target.checked)}
                className="accent-amber-500 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span>Masterwork (+2)</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-[#0b0e14] px-2.5 py-1 rounded-lg border border-[#1e2638] cursor-pointer hover:border-slate-600">
              <input
                type="checkbox"
                checked={assumeArtifice}
                onChange={(e) => setAssumeArtifice(e.target.checked)}
                className="accent-amber-500 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span>Artifice (+3)</span>
            </label>
          </div>
        </div>

        {/* Quick Presets Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1 border-t border-[#1e2638]">
          <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap mr-1">Presets:</span>
          {presets.map((pr, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(pr)}
              className="px-2.5 py-1 rounded-lg bg-[#0b0e14] hover:bg-slate-800 border border-[#1e2638] hover:border-amber-500/40 text-slate-300 hover:text-white text-xs font-mono whitespace-nowrap transition-colors"
            >
              {pr.name}
            </button>
          ))}
        </div>
      </div>

      {/* 6 Target Stat Steppers Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {statMeta.map(st => {
          const currentVal = targetStats[st.key] || 0;
          return (
            <div 
              key={st.key}
              className="p-2.5 rounded-xl bg-[#121722] border border-[#1e2638] space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-slate-300">{st.short}</span>
                <span className="text-white font-bold">{currentVal}</span>
              </div>

              <div className="flex items-center justify-between gap-1 bg-[#0b0e14] border border-[#1e2638] rounded-lg p-0.5">
                <button
                  onClick={() => handleStatChange(st.key, -10)}
                  disabled={currentVal <= 0}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs disabled:opacity-30"
                >
                  -
                </button>
                <span className="text-[10px] font-mono text-slate-400">
                  {currentVal >= 100 ? '⚡ 100+' : `${currentVal}`}
                </span>
                <button
                  onClick={() => handleStatChange(st.key, 10)}
                  disabled={currentVal >= 200}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center text-xs disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Exotic & Set Filter Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-[#121722] border border-[#1e2638] rounded-2xl p-3">
        <div className="space-y-1">
          <label className="text-[11px] font-mono text-slate-400 block">Lock Exotic:</label>
          <select
            value={selectedExoticHash}
            onChange={(e) => setSelectedExoticHash(e.target.value)}
            className="w-full bg-[#0b0e14] border border-[#1e2638] rounded-xl p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
          >
            <option value="any">✨ Any Exotic (Best Stats)</option>
            <option value="none">🛡️ No Exotic (Legendaries Only)</option>
            {availableExotics.map(ex => (
              <option key={ex.itemHash || ex.id} value={ex.itemHash || ex.id}>
                {ex.name} ({ex.itemTypeDisplayName || ex.slotType})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-mono text-slate-400 block">Armour Set Preference:</label>
          <select
            value={selectedSetFilter}
            onChange={(e) => setSelectedSetFilter(e.target.value)}
            className="w-full bg-[#0b0e14] border border-[#1e2638] rounded-xl p-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
          >
            <option value="any">🌐 Any Sets (Highest Stats)</option>
            <option value="artifice">💠 Artifice Sets</option>
            <option value="iron_banner">⚔️ Iron Banner Sets</option>
            <option value="raid">🏆 Raid & Dungeon Sets</option>
            <option value="moments_of_triumph">🌟 Moments of Triumph Sets</option>
          </select>
        </div>
      </div>

      {/* Status Banner */}
      {buildingStatus && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-medium flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{buildingStatus}</span>
        </div>
      )}

      {/* Optimized Builds List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider font-heading">
            Optimized Builds ({calculatedBuilds.length})
          </h3>
        </div>

        {calculatedBuilds.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#121722] border border-[#1e2638] text-center space-y-1.5">
            <AlertCircle className="w-6 h-6 text-slate-500 mx-auto" />
            <h4 className="text-sm font-bold text-slate-300 font-heading">No Valid Builds Found</h4>
            <p className="text-xs text-slate-500">
              Try reducing target stat requirements or setting Exotic to "Any Exotic".
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {calculatedBuilds.map((build, bIdx) => (
              <div
                key={bIdx}
                className={`bg-[#121722] border rounded-2xl p-3.5 space-y-3 shadow-md ${
                  build.isPerfectMatch 
                    ? 'border-amber-500/40' 
                    : 'border-[#1e2638]'
                }`}
              >
                {/* Build Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[#1e2638] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-500 text-black font-heading font-bold text-xs tracking-wider">
                      {build.totalStatPoints} Points
                    </span>
                    {build.isPerfectMatch && (
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold flex items-center gap-1">
                        <Check className="w-3 h-3" /> Target Met
                      </span>
                    )}
                  </div>

                  {/* 6 Stats Pills */}
                  <div className="flex items-center gap-1 flex-wrap text-[10px] font-mono">
                    {statMeta.map(st => (
                      <span
                        key={st.key}
                        className={`px-1.5 py-0.2 rounded bg-[#0b0e14] border border-slate-800 ${
                          build.stats[st.key] >= 100 ? 'text-amber-400 font-bold border-amber-500/30' : 'text-slate-300'
                        }`}
                      >
                        {st.short} {build.stats[st.key]}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 5 Armor Pieces Row */}
                <div className="grid grid-cols-5 gap-2">
                  {build.pieces.map((piece, pIdx) => {
                    const tier = getTierInfo(piece.tierTypeName);
                    return (
                      <div
                        key={pIdx}
                        onClick={() => onSelectArmor?.(piece)}
                        className="p-1.5 rounded-xl bg-[#0b0e14] border border-[#1e2638] hover:border-amber-400 transition-all cursor-pointer space-y-1 group"
                        title={piece.name}
                      >
                        <div className="relative w-full aspect-square rounded-lg bg-black/60 border border-white/10 overflow-hidden">
                          {piece.icon && (
                            <img src={piece.icon} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          )}
                          {piece.isArtifice && (
                            <div className="absolute top-0 right-0 w-3 h-3 bg-indigo-500 rounded-bl text-[7px] flex items-center justify-center font-bold text-white">
                              A
                            </div>
                          )}
                        </div>
                        <div className="text-[10px] font-bold text-white truncate font-heading text-center">
                          {piece.name}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer: Required Mods & Equip Button */}
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    {build.modsNeeded.map((mod, mIdx) => (
                      <span
                        key={mIdx}
                        className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0b0e14] border border-slate-800 text-slate-300"
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
                    <span>Equip Build</span>
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
