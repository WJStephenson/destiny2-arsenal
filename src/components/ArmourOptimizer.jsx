import React, { useState, useMemo } from 'react';
import { 
  Shield, 
  Sparkles, 
  Zap, 
  Sliders, 
  Check, 
  Flame, 
  ArrowRight, 
  Layers, 
  Cpu, 
  Lock, 
  Unlock, 
  RotateCcw,
  Box,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Award
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
  // Target Stat Tiers (0 to 10)
  const [targetTiers, setTargetTiers] = useState({
    mobility: 2,
    resilience: 10,
    recovery: 10,
    discipline: 10,
    intellect: 2,
    strength: 2
  });

  // Subclass Fragment Stat Modifiers (-20 to +40)
  const [fragmentBonus, setFragmentBonus] = useState({
    mobility: 0,
    resilience: 10,
    recovery: 0,
    discipline: 0,
    intellect: 0,
    strength: 0
  });

  const [assumeMasterwork, setAssumeMasterwork] = useState(true);
  const [assumeArtifice, setAssumeArtifice] = useState(false);
  const [selectedExoticHash, setSelectedExoticHash] = useState('any'); // 'any' | 'none' | itemHash (number)
  const [selectedSetFilter, setSelectedSetFilter] = useState('any'); // 'any' | 'artifice' | 'iron_banner' | 'raid' | 'moments_of_triumph'
  const [showSandboxGuide, setShowSandboxGuide] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildingStatus, setBuildingStatus] = useState(null);

  const statMeta = [
    { key: 'mobility', label: 'Mobility', short: 'MOB', color: 'text-sky-400', bg: 'bg-sky-500/20', border: 'border-sky-500/40', desc: '+40% Strafe Speed & Hunter Dodge CD' },
    { key: 'resilience', label: 'Resilience', short: 'RES', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/40', desc: '+30% PvE Damage Resistance & Titan Barricade CD' },
    { key: 'recovery', label: 'Recovery', short: 'REC', color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', desc: '+43% Faster Health Regen & Warlock Rift CD' },
    { key: 'discipline', label: 'Discipline', short: 'DIS', color: 'text-indigo-400', bg: 'bg-indigo-500/20', border: 'border-indigo-500/40', desc: '-64% Grenade Ability Cooldown' },
    { key: 'intellect', label: 'Intellect', short: 'INT', color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/40', desc: 'Fast Super Cooldown Passive Scaling' },
    { key: 'strength', label: 'Strength', short: 'STR', color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/40', desc: '-64% Powered Melee Cooldown' }
  ];

  // Presets (Modern Meta & Moments of Triumph Sandbox)
  const presets = [
    {
      name: 'Triple 100 (Resil / Recov / Disc)',
      desc: 'PvE Meta Tank & Abilities (30% DR + Fast Grenades)',
      tiers: { mobility: 1, resilience: 10, recovery: 10, discipline: 10, intellect: 2, strength: 2 }
    },
    {
      name: 'Hunter Mobility / Recov / Disc',
      desc: 'Max Dodge & Agility for Hunter Meta',
      tiers: { mobility: 10, resilience: 3, recovery: 10, discipline: 10, intellect: 2, strength: 2 }
    },
    {
      name: 'Super & Intellect Raid Focus',
      desc: 'Moments of Triumph / Raid DPS Rotations',
      tiers: { mobility: 2, resilience: 10, recovery: 8, discipline: 4, intellect: 10, strength: 2 }
    },
    {
      name: 'Melee Brawler (Strength / Resil)',
      desc: 'Heavy Melee & Survival (Titan / Hunter Prismatic)',
      tiers: { mobility: 2, resilience: 10, recovery: 8, discipline: 2, intellect: 2, strength: 10 }
    }
  ];

  // Helper to extract clean armor slot name
  const getArmorSlotName = (item) => {
    if (item.bucketHash === 3448274439 || item.armorSlot?.toLowerCase().includes('helmet') || item.slot?.toLowerCase().includes('helmet')) return 'helmet';
    if (item.bucketHash === 3551901077 || item.armorSlot?.toLowerCase().includes('gauntlet') || item.slot?.toLowerCase().includes('gauntlet') || item.itemTypeDisplayName?.toLowerCase().includes('gauntlet') || item.itemTypeDisplayName?.toLowerCase().includes('arms')) return 'gauntlets';
    if (item.bucketHash === 1423949262 || item.armorSlot?.toLowerCase().includes('chest') || item.slot?.toLowerCase().includes('chest') || item.itemTypeDisplayName?.toLowerCase().includes('chest')) return 'chest';
    if (item.bucketHash === 20886954 || item.armorSlot?.toLowerCase().includes('leg') || item.slot?.toLowerCase().includes('leg') || item.itemTypeDisplayName?.toLowerCase().includes('leg')) return 'legs';
    if (item.bucketHash === 1585787867 || item.armorSlot?.toLowerCase().includes('class') || item.slot?.toLowerCase().includes('class') || item.itemTypeDisplayName?.toLowerCase().includes('class') || item.itemTypeDisplayName?.toLowerCase().includes('mark') || item.itemTypeDisplayName?.toLowerCase().includes('cloak') || item.itemTypeDisplayName?.toLowerCase().includes('bond')) return 'classItem';
    return null;
  };

  // Helper to get normalized armor stats from an item
  const getItemStats = (item) => {
    if (item.armorStats && typeof item.armorStats === 'object') {
      return item.armorStats;
    }
    let mob = 0, res = 0, rec = 0, dis = 0, int = 0, str = 0;
    if (item.statsList) {
      item.statsList.forEach(s => {
        const n = s.name?.toLowerCase() || '';
        if (n.includes('mobility')) mob = s.value;
        else if (n.includes('resilience')) res = s.value;
        else if (n.includes('recovery')) rec = s.value;
        else if (n.includes('discipline')) dis = s.value;
        else if (n.includes('intellect')) int = s.value;
        else if (n.includes('strength')) str = s.value;
      });
    }
    return {
      mobility: mob,
      resilience: res,
      recovery: rec,
      discipline: dis,
      intellect: int,
      strength: str,
      total: mob + res + rec + dis + int + str
    };
  };

  // Collect all owned armor for the active character class across Equipped, Bag, and Vault
  const allOwnedArmor = useMemo(() => {
    if (!activeChar) return [];

    const charClass = activeChar.classType; // 'Titan' | 'Hunter' | 'Warlock'
    const items = [];

    // 1. Equipped on character
    (activeChar.equipped || []).forEach(it => {
      if (it.isArmor) {
        const slot = getArmorSlotName(it);
        if (slot) items.push({ ...it, location: 'equipped', slotType: slot, stats: getItemStats(it) });
      }
    });

    // 2. In character inventory / bag
    (activeChar.bag || []).forEach(it => {
      if (it.isArmor) {
        const slot = getArmorSlotName(it);
        if (slot) items.push({ ...it, location: 'bag', slotType: slot, stats: getItemStats(it) });
      }
    });

    // 3. In Vault
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

  // List of all unique Exotics available for this class
  const availableExotics = useMemo(() => {
    const map = new Map();
    allOwnedArmor.forEach(it => {
      if (it.tierTypeName === 'Exotic') {
        const h = it.itemHash || it.id;
        if (!map.has(h)) {
          map.set(h, it);
        }
      }
    });
    return Array.from(map.values());
  }, [allOwnedArmor]);

  // Combinatorial Optimization Engine
  const calculatedBuilds = useMemo(() => {
    if (allOwnedArmor.length === 0) return [];

    // Apply set filters if chosen
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

    // Group items by 5 slots
    const helmets = filteredPool.filter(it => it.slotType === 'helmet');
    const arms = filteredPool.filter(it => it.slotType === 'gauntlets');
    const chests = filteredPool.filter(it => it.slotType === 'chest');
    const legs = filteredPool.filter(it => it.slotType === 'legs');
    const classItems = filteredPool.filter(it => it.slotType === 'classItem');

    const dummyClass = classItems.length > 0 ? classItems : [{
      name: `${activeChar?.classType || ''} Class Item`,
      tierTypeName: 'Legendary',
      slotType: 'classItem',
      stats: { mobility: 0, resilience: 0, recovery: 0, discipline: 0, intellect: 0, strength: 0, total: 0 }
    }];

    const results = [];

    // Limit pool per slot to best rolls to keep search under 20ms
    const topH = helmets.slice(0, 14);
    const topA = arms.slice(0, 14);
    const topC = chests.slice(0, 14);
    const topL = legs.slice(0, 14);
    const topCI = dummyClass.slice(0, 4);

    const targetMob = (targetTiers.mobility || 0) * 10;
    const targetRes = (targetTiers.resilience || 0) * 10;
    const targetRec = (targetTiers.recovery || 0) * 10;
    const targetDis = (targetTiers.discipline || 0) * 10;
    const targetInt = (targetTiers.intellect || 0) * 10;
    const targetStr = (targetTiers.strength || 0) * 10;

    const mwBonus = assumeMasterwork ? 10 : 0; // +2 per piece across 5 pieces = +10
    const artificePerPiece = assumeArtifice ? 3 : 0;

    for (const h of topH) {
      for (const a of topA) {
        for (const c of topC) {
          for (const l of topL) {
            for (const ci of topCI) {
              const pieces = [h, a, c, l, ci];
              const exoticsCount = pieces.filter(it => it.tierTypeName === 'Exotic').length;
              if (exoticsCount > 1) continue; // Maximum 1 exotic

              // Check locked exotic filter
              if (selectedExoticHash === 'none' && exoticsCount > 0) continue;
              if (selectedExoticHash !== 'any' && selectedExoticHash !== 'none') {
                const hasSelectedExotic = pieces.some(it => String(it.itemHash || it.id) === String(selectedExoticHash));
                if (!hasSelectedExotic) continue;
              }

              // Base stats sum + Masterwork bonus + Fragment bonus
              const rawMob = h.stats.mobility + a.stats.mobility + c.stats.mobility + l.stats.mobility + ci.stats.mobility + mwBonus + (fragmentBonus.mobility || 0);
              const rawRes = h.stats.resilience + a.stats.resilience + c.stats.resilience + l.stats.resilience + ci.stats.resilience + mwBonus + (fragmentBonus.resilience || 0);
              const rawRec = h.stats.recovery + a.stats.recovery + c.stats.recovery + l.stats.recovery + ci.stats.recovery + mwBonus + (fragmentBonus.recovery || 0);
              const rawDis = h.stats.discipline + a.stats.discipline + c.stats.discipline + l.stats.discipline + ci.stats.discipline + mwBonus + (fragmentBonus.discipline || 0);
              const rawInt = h.stats.intellect + a.stats.intellect + c.stats.intellect + l.stats.intellect + ci.stats.intellect + mwBonus + (fragmentBonus.intellect || 0);
              const rawStr = h.stats.strength + a.stats.strength + c.stats.strength + l.stats.strength + ci.stats.strength + mwBonus + (fragmentBonus.strength || 0);

              // Calculate stat deficit against targets
              const defMob = Math.max(0, targetMob - rawMob);
              const defRes = Math.max(0, targetRes - rawRes);
              const defRec = Math.max(0, targetRec - rawRec);
              const defDis = Math.max(0, targetDis - rawDis);
              const defInt = Math.max(0, targetInt - rawInt);
              const defStr = Math.max(0, targetStr - rawStr);

              // Count available artifice slots in this specific set
              const actualArtificeCount = pieces.filter(it => it.isArtifice).length;
              const totalArtificeSlots = assumeArtifice ? 5 : actualArtificeCount;

              // Calculate required major (+10) and minor (+5) stat mods (up to 5 mod slots)
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

              let remMob = addModsForStat(defMob, 'Mobility', 'MOB');
              let remRes = addModsForStat(defRes, 'Resilience', 'RES');
              let remRec = addModsForStat(defRec, 'Recovery', 'REC');
              let remDis = addModsForStat(defDis, 'Discipline', 'DIS');
              let remInt = addModsForStat(defInt, 'Intellect', 'INT');
              let remStr = addModsForStat(defStr, 'Strength', 'STR');

              // Allocate Artifice +3 bonus slots to remaining deficits if available
              let artificeAssigned = 0;
              const artificeMods = [];
              const applyArtifice = (deficit, statName, shortName) => {
                let rem = deficit;
                while (rem > 0 && artificeAssigned < totalArtificeSlots) {
                  artificeMods.push({ stat: statName, short: shortName, value: 3, label: `+3 ${statName} (Artifice)` });
                  rem = Math.max(0, rem - 3);
                  artificeAssigned++;
                }
                return rem;
              };

              remMob = applyArtifice(remMob, 'Mobility', 'MOB');
              remRes = applyArtifice(remRes, 'Resilience', 'RES');
              remRec = applyArtifice(remRec, 'Recovery', 'REC');
              remDis = applyArtifice(remDis, 'Discipline', 'DIS');
              remInt = applyArtifice(remInt, 'Intellect', 'INT');
              remStr = applyArtifice(remStr, 'Strength', 'STR');

              // Final stats after mods + artifice
              const allAssignedMods = [...modsNeeded, ...artificeMods];
              const modMobBonus = allAssignedMods.filter(m => m.short === 'MOB').reduce((acc, m) => acc + m.value, 0);
              const modResBonus = allAssignedMods.filter(m => m.short === 'RES').reduce((acc, m) => acc + m.value, 0);
              const modRecBonus = allAssignedMods.filter(m => m.short === 'REC').reduce((acc, m) => acc + m.value, 0);
              const modDisBonus = allAssignedMods.filter(m => m.short === 'DIS').reduce((acc, m) => acc + m.value, 0);
              const modIntBonus = allAssignedMods.filter(m => m.short === 'INT').reduce((acc, m) => acc + m.value, 0);
              const modStrBonus = allAssignedMods.filter(m => m.short === 'STR').reduce((acc, m) => acc + m.value, 0);

              const finalMob = rawMob + modMobBonus;
              const finalRes = rawRes + modResBonus;
              const finalRec = rawRec + modRecBonus;
              const finalDis = rawDis + modDisBonus;
              const finalInt = rawInt + modIntBonus;
              const finalStr = rawStr + modStrBonus;

              const tierMob = Math.min(10, Math.floor(finalMob / 10));
              const tierRes = Math.min(10, Math.floor(finalRes / 10));
              const tierRec = Math.min(10, Math.floor(finalRec / 10));
              const tierDis = Math.min(10, Math.floor(finalDis / 10));
              const tierInt = Math.min(10, Math.floor(finalInt / 10));
              const tierStr = Math.min(10, Math.floor(finalStr / 10));

              const totalTiers = tierMob + tierRes + tierRec + tierDis + tierInt + tierStr;
              const wastedStats = (finalMob % 10) + (finalRes % 10) + (finalRec % 10) + (finalDis % 10) + (finalInt % 10) + (finalStr % 10);

              const isPerfectMatch = remMob === 0 && remRes === 0 && remRec === 0 && remDis === 0 && remInt === 0 && remStr === 0 &&
                tierMob >= (targetTiers.mobility || 0) &&
                tierRes >= (targetTiers.resilience || 0) &&
                tierRec >= (targetTiers.recovery || 0) &&
                tierDis >= (targetTiers.discipline || 0) &&
                tierInt >= (targetTiers.intellect || 0) &&
                tierStr >= (targetTiers.strength || 0);

              results.push({
                pieces,
                stats: {
                  mobility: finalMob,
                  resilience: finalRes,
                  recovery: finalRec,
                  discipline: finalDis,
                  intellect: finalInt,
                  strength: finalStr
                },
                tiers: {
                  mobility: tierMob,
                  resilience: tierRes,
                  recovery: tierRec,
                  discipline: tierDis,
                  intellect: tierInt,
                  strength: tierStr
                },
                totalTiers,
                wastedStats,
                modsNeeded: allAssignedMods,
                isPerfectMatch
              });
            }
          }
        }
      }
    }

    // Sort results
    results.sort((a, b) => {
      if (a.isPerfectMatch && !b.isPerfectMatch) return -1;
      if (!a.isPerfectMatch && b.isPerfectMatch) return 1;
      if (b.totalTiers !== a.totalTiers) return b.totalTiers - a.totalTiers;
      return a.wastedStats - b.wastedStats;
    });

    return results.slice(0, 15);
  }, [allOwnedArmor, targetTiers, fragmentBonus, assumeMasterwork, assumeArtifice, selectedExoticHash, selectedSetFilter, activeChar]);

  const handleApplyPreset = (preset) => {
    setTargetTiers(preset.tiers);
  };

  const handleTierChange = (statKey, delta) => {
    setTargetTiers(prev => {
      const current = prev[statKey] || 0;
      const next = Math.max(0, Math.min(10, current + delta));
      return { ...prev, [statKey]: next };
    });
  };

  const handleFragmentChange = (statKey, val) => {
    setFragmentBonus(prev => ({
      ...prev,
      [statKey]: parseInt(val || 0, 10)
    }));
  };

  const handleEquipBuild = async (build) => {
    if (!build || isBuilding) return;
    setIsBuilding(true);
    setBuildingStatus('Equipping full armour set on Guardian...');

    try {
      for (const piece of build.pieces) {
        if (!piece.itemInstanceId) continue;

        if (piece.location === 'vault') {
          setBuildingStatus(`Transferring ${piece.name} from Vault...`);
          await onTransferItem?.(piece, false);
          await new Promise(r => setTimeout(r, 600));
        }

        setBuildingStatus(`Equipping ${piece.name}...`);
        await onEquipItem?.(piece.itemInstanceId);
        await new Promise(r => setTimeout(r, 400));
      }

      setBuildingStatus('⚡ Full Armour Build Equipped Successfully!');
    } catch (err) {
      setBuildingStatus('Error equipping build pieces');
    } finally {
      setIsBuilding(false);
      setTimeout(() => setBuildingStatus(null), 3500);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Top Banner & Sandbox Features */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#121722] to-indigo-500/15 border border-amber-500/30 shadow-xl space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-heading tracking-wide">
                  Armour Stat Optimizer & Loadout Builder
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold uppercase">
                  Moments of Triumph Sandbox
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Cross-references {allOwnedArmor.length} armour pieces across your {activeChar?.classType} (Equipped, Bag & Vault) with +10/+5 mods & Artifice slots
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs font-mono text-slate-300 bg-black/50 px-2.5 py-1.5 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700">
              <input
                type="checkbox"
                checked={assumeMasterwork}
                onChange={(e) => setAssumeMasterwork(e.target.checked)}
                className="accent-amber-500 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span>Masterwork (+2 all)</span>
            </label>

            <label className="flex items-center gap-1.5 text-xs font-mono text-indigo-300 bg-indigo-950/40 px-2.5 py-1.5 rounded-lg border border-indigo-500/30 cursor-pointer hover:border-indigo-500/50">
              <input
                type="checkbox"
                checked={assumeArtifice}
                onChange={(e) => setAssumeArtifice(e.target.checked)}
                className="accent-indigo-500 w-3.5 h-3.5 rounded cursor-pointer"
              />
              <span>+3 Artifice Slots</span>
            </label>

            <button
              onClick={() => setShowSandboxGuide(!showSandboxGuide)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono text-slate-300 transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>Stat Benefits</span>
            </button>
          </div>
        </div>

        {/* Current Sandbox Scaling Sheet */}
        {showSandboxGuide && (
          <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-amber-500/30 space-y-2 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-amber-300 font-heading uppercase tracking-wider">
                Current Destiny 2 Sandbox Stat Benefits (Moments of Triumph / Episodes)
              </h4>
              <button onClick={() => setShowSandboxGuide(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs font-mono">
              {statMeta.map(st => (
                <div key={st.key} className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 space-y-0.5">
                  <span className={`font-bold ${st.color}`}>{st.short} • {st.label}</span>
                  <p className="text-[11px] text-slate-300">{st.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Presets Row */}
        <div className="pt-2 border-t border-white/5">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
            Quick Tier Presets:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {presets.map((pr, idx) => (
              <button
                key={idx}
                onClick={() => handleApplyPreset(pr)}
                className="p-2 rounded-xl bg-[#0b0e14]/90 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/50 text-left transition-all group"
              >
                <div className="text-xs font-bold text-slate-200 group-hover:text-amber-300 truncate font-heading">
                  {pr.name}
                </div>
                <div className="text-[10px] text-slate-400 truncate mt-0.5">{pr.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Configuration Matrix: Target Tiers & Exotic Lock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left: 6 Target Stat Sliders */}
        <div className="lg:col-span-2 bg-[#121722] border border-[#20293a] rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-[#20293a] pb-3">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              Target Stat Distribution
            </h3>
            <span className="text-xs font-mono text-amber-400 font-bold">
              Target Total: {Object.values(targetTiers).reduce((a, b) => a + b, 0) * 10} / 360
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {statMeta.map(st => {
              const currentTier = targetTiers[st.key] || 0;
              return (
                <div 
                  key={st.key}
                  className="p-3 rounded-xl bg-[#0b0e14] border border-[#20293a] flex items-center justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold font-mono ${st.color}`}>
                        {st.short}
                      </span>
                      <span className="text-xs text-slate-300 font-medium">
                        {st.label}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      Tier {currentTier} ({currentTier * 10} Stat Points)
                    </div>
                  </div>

                  {/* Stepper Buttons */}
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1">
                    <button
                      onClick={() => handleTierChange(st.key, -1)}
                      disabled={currentTier <= 0}
                      className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      -
                    </button>
                    <span className="w-8 text-center font-mono font-bold text-sm text-white">
                      T{currentTier}
                    </span>
                    <button
                      onClick={() => handleTierChange(st.key, 1)}
                      disabled={currentTier >= 10}
                      className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Subclass Fragment Stat Tuning */}
          <div className="pt-2 border-t border-[#20293a]">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
              Subclass Fragment Stat Tuning (Optional):
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {statMeta.map(st => (
                <div key={st.key} className="space-y-0.5">
                  <span className={`text-[10px] font-mono font-bold ${st.color}`}>{st.short}</span>
                  <select
                    value={fragmentBonus[st.key] || 0}
                    onChange={(e) => handleFragmentChange(st.key, e.target.value)}
                    className="w-full bg-[#0b0e14] border border-slate-700 rounded-lg p-1 text-[11px] font-mono text-slate-200 text-center"
                  >
                    <option value="-20">-20</option>
                    <option value="-10">-10</option>
                    <option value="0">+0</option>
                    <option value="10">+10</option>
                    <option value="20">+20</option>
                    <option value="30">+30</option>
                  </select>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right: Exotic Armor Selection & Set Filter */}
        <div className="bg-[#121722] border border-[#20293a] rounded-2xl p-4 sm:p-5 space-y-4 shadow-lg flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-[#20293a] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-heading flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Exotic & Set Filter
              </h3>
              <span className="text-xs font-mono text-slate-400">
                {availableExotics.length} Exotics
              </span>
            </div>

            {/* Exotic Picker */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-mono block">Lock Specific Exotic:</label>
              <select
                value={selectedExoticHash}
                onChange={(e) => setSelectedExoticHash(e.target.value)}
                className="w-full bg-[#0b0e14] border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
              >
                <option value="any">✨ Any Exotic / Best Available</option>
                <option value="none">🛡️ No Exotic (Legendaries Only)</option>
                {availableExotics.map(ex => (
                  <option key={ex.itemHash || ex.id} value={ex.itemHash || ex.id}>
                    🟡 {ex.name} ({ex.itemTypeDisplayName || ex.slotType})
                  </option>
                ))}
              </select>
            </div>

            {/* Set Filter */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs text-slate-400 font-mono block">Armour Set Preference:</label>
              <select
                value={selectedSetFilter}
                onChange={(e) => setSelectedSetFilter(e.target.value)}
                className="w-full bg-[#0b0e14] border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-amber-400"
              >
                <option value="any">🌐 Any Armour Sets (Highest Stats)</option>
                <option value="artifice">💠 Prioritize Artifice Dungeon Sets</option>
                <option value="iron_banner">⚔️ Prioritize Iron Banner Sets (Iron Lord's Pride)</option>
                <option value="raid">🏆 Prioritize Raid / Dungeon Sets</option>
                <option value="moments_of_triumph">🌟 Prioritize Moments of Triumph Sets</option>
              </select>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed bg-[#0b0e14] p-3 rounded-xl border border-slate-800">
              Calculates combinations across your {activeChar?.classType}'s gear, solves optimal +10/+5 mods, factors in Masterwork bumps, and arranges 1-tap equips.
            </p>
          </div>

          <div className="text-xs font-mono text-amber-400 pt-2 flex items-center gap-1.5">
            <Check className="w-4 h-4" />
            <span>{calculatedBuilds.length} Optimized Sets Found</span>
          </div>
        </div>

      </div>

      {/* Building Status Notification */}
      {buildingStatus && (
        <div className="p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-mono font-bold flex items-center gap-2 animate-fadeIn shadow-lg">
          <Zap className="w-4 h-4 text-amber-400 animate-spin" />
          <span>{buildingStatus}</span>
        </div>
      )}

      {/* Generated Builds List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider font-heading flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            Optimized Armour Set Combinations ({calculatedBuilds.length})
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Ranked by target match & highest tiers
          </span>
        </div>

        {calculatedBuilds.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#121722] border border-[#20293a] text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-amber-400 mx-auto opacity-60" />
            <h4 className="text-base font-bold text-white font-heading">No Valid Builds Found</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Try reducing target tier requirements (e.g. lowering Tier 10 goals) or changing the Exotic / Set filter.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {calculatedBuilds.map((build, bIdx) => (
              <div
                key={bIdx}
                className={`bg-[#121722] border rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl transition-all ${
                  build.isPerfectMatch 
                    ? 'border-amber-500/60 bg-gradient-to-r from-amber-500/5 via-[#121722] to-amber-500/5' 
                    : 'border-[#20293a] hover:border-slate-700'
                }`}
              >
                {/* Build Header: Total Tiers Badge + 6 Stat Breakdown */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#20293a] pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="px-3 py-1 rounded-xl bg-amber-500 text-black font-heading font-bold text-sm tracking-wider shadow-md shadow-amber-500/20">
                      Tier {build.totalTiers} Build
                    </span>
                    {build.isPerfectMatch && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> 100% Target Match
                      </span>
                    )}
                    <span className="text-xs font-mono text-slate-400">
                      {build.wastedStats} Wasted Points
                    </span>
                  </div>

                  {/* 6 Final Stat Badges */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {statMeta.map(st => (
                      <span
                        key={st.key}
                        className={`text-xs font-mono px-2 py-0.5 rounded-md font-bold ${st.bg} ${st.color} border ${st.border}`}
                      >
                        {st.short} {build.stats[st.key]} (T{build.tiers[st.key]})
                      </span>
                    ))}
                  </div>
                </div>

                {/* 5 Armor Pieces Row */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                  {build.pieces.map((piece, pIdx) => {
                    const tier = getTierInfo(piece.tierTypeName);
                    return (
                      <div
                        key={pIdx}
                        onClick={() => onSelectArmor?.(piece)}
                        className="p-2.5 rounded-xl bg-[#0b0e14] border border-slate-800 hover:border-amber-400 transition-all cursor-pointer space-y-2 group shadow-sm"
                      >
                        <div className="flex items-start gap-2">
                          <div className="relative w-10 h-10 rounded-lg bg-black/60 border border-white/10 overflow-hidden flex-shrink-0">
                            {piece.icon && (
                              <img src={piece.icon} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            )}
                            {piece.isArtifice && (
                              <div className="absolute top-0 right-0 w-3 h-3 bg-indigo-500 rounded-bl text-[7px] flex items-center justify-center font-bold text-white">
                                A
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className={`text-[9px] font-mono font-bold uppercase block ${tier.text}`}>
                              {piece.tierTypeName}
                            </span>
                            <h5 className="text-xs font-bold text-white truncate group-hover:text-amber-300">
                              {piece.name}
                            </h5>
                          </div>
                        </div>

                        {/* Set Tag / Location Tag & Total Stat */}
                        <div className="flex items-center justify-between text-[10px] font-mono pt-1 border-t border-slate-800/80">
                          <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                            piece.location === 'equipped' 
                              ? 'bg-emerald-500/20 text-emerald-300' 
                              : piece.location === 'bag' 
                                ? 'bg-sky-500/20 text-sky-300' 
                                : 'bg-purple-500/20 text-purple-300'
                          }`}>
                            {piece.location}
                          </span>
                          <span className="text-slate-300 font-bold">
                            Base: {piece.stats?.total || 0}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Required Mods Guide & Action Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                      Required Armour Stat & Artifice Mods:
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {build.modsNeeded.length > 0 ? (
                        build.modsNeeded.map((mod, mIdx) => (
                          <span
                            key={mIdx}
                            className={`text-[11px] font-mono px-2 py-0.5 rounded border flex items-center gap-1 ${
                              mod.value === 3 
                                ? 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40' 
                                : 'bg-slate-900 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            <Zap className="w-3 h-3 text-amber-400" />
                            {mod.label}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs font-mono text-emerald-400">
                          ✓ No Stat Mods required! Target met with raw armor stats.
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    disabled={isBuilding}
                    onClick={() => handleEquipBuild(build)}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold font-heading tracking-wide text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Equip Full Armour Build</span>
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
